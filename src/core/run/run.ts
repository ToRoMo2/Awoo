/**
 * L'orchestrateur du RUN.
 *
 * Signature miroir du cœur : (runState, action) -> { state, events }.
 * L'état d'entrée n'est jamais modifié.
 *
 * Le run délègue chaque Distribution à applyMove : il ne réimplémente aucune
 * règle de manche. Il gère ce qui vit AU-DESSUS d'une manche — l'argent, le
 * build, la boutique, et l'enchaînement des manches et des étapes.
 *
 * Flux : réussir une manche PRÉPARE tout de suite le plateau de la suivante
 * (plateau conservé + réensemencé, ou plateau neuf), puis ouvre la boutique sur
 * CE plateau. Le joueur voit ce qu'il aura, investit (décision E), puis lance.
 */

import { getCircuit } from "../circuit.js";
import { createRng, nextInt } from "../rng.js";
import { isPlayableZone } from "../rules.js";
import { cloneRound, createRound } from "../setup.js";
import { applyMove } from "../turn.js";
import type { CircuitConfig, GameConfig, NodeState, RoundState } from "../types.js";
import { mancheReward } from "./economy.js";
import { cloneOffer, generateOffer } from "./shop.js";
import type {
  MancheSpec,
  PurchaseDenyReason,
  RunAction,
  RunConfig,
  RunEvent,
  RunState,
  StageBlueprint,
} from "./types.js";

export interface RunResult {
  state: RunState;
  events: RunEvent[];
}

/** Borne des graines de plateau tirées du PRNG du run. */
const SEED_BOUND = 0x7fffffff;

export function createRun(config: RunConfig, seed: number): RunState {
  const stage = config.stages[0];
  if (!stage) throw new Error("Run sans étape.");

  const rng = createRng(seed);
  const placements = config.startingPlacements.map((p) => ({ ...p }));
  const round = freshManche(config, stage, stage.manches[0]!, placements, rng);

  return {
    config,
    money: config.economy.startingMoney,
    stageIndex: 0,
    mancheIndex: 0,
    round,
    offer: null,
    placements,
    phase: "playing",
    outcome: null,
    rng,
  };
}

export function applyRunAction(state: RunState, action: RunAction): RunResult {
  if (state.phase === "won" || state.phase === "lost") {
    throw new Error("Action jouée sur un run terminé.");
  }

  const next: RunState = {
    ...state,
    round: cloneRound(state.round),
    offer: state.offer ? cloneOffer(state.offer) : null,
    rng: { ...state.rng },
    placements: state.placements.map((p) => ({ ...p })),
  };
  const events: RunEvent[] = [];

  switch (action.type) {
    case "sow": {
      requirePhase(state, "playing", "Distribution");
      const result = applyMove(state.round, { type: "sow", node: action.node });
      next.round = result.state;
      for (const event of result.events) events.push({ type: "MANCHE_EVENT", event });
      if (next.round.phase === "ended") resolveMancheEnd(next, events);
      return { state: next, events };
    }
    case "buy-module":
      requirePhase(state, "shop", "Achat de Module");
      buyModule(next, action.slot, action.node, events);
      return { state: next, events };
    case "buy-tokens":
      requirePhase(state, "shop", "Achat de Jetons");
      buyTokens(next, action.node, events);
      return { state: next, events };
    case "reroll":
      requirePhase(state, "shop", "Reroll");
      rerollOffer(next, events);
      return { state: next, events };
    case "start-manche": {
      requirePhase(state, "shop", "Lancement de manche");
      next.offer = null;
      next.phase = "playing";
      events.push(mancheStarted(next, next.config.stages[next.stageIndex]!));
      return { state: next, events };
    }
  }
}

function requirePhase(state: RunState, phase: RunState["phase"], what: string): void {
  if (state.phase !== phase) {
    throw new Error(`${what} demandé hors de la phase « ${phase} ».`);
  }
}

// --- Fin de manche ---------------------------------------------------------

function resolveMancheEnd(next: RunState, events: RunEvent[]): void {
  const stage = next.config.stages[next.stageIndex]!;
  const manche = stage.manches[next.mancheIndex]!;
  const round = next.round;

  if (round.outcome !== "quota-reached") {
    // turns-exhausted ou deadlock : le quota n'est pas tombé, la run s'arrête.
    next.phase = "lost";
    next.outcome = "lost";
    events.push({ type: "RUN_LOST", stage: next.stageIndex, manche: next.mancheIndex });
    return;
  }

  const reward = mancheReward(next.config.economy, round.score, manche.quota);
  changeMoney(next, reward, "manche-cleared", events);
  events.push({ type: "MANCHE_CLEARED", score: round.score, quota: manche.quota, reward });

  if (isLastManche(next.config, next.stageIndex, next.mancheIndex)) {
    next.phase = "won";
    next.outcome = "won";
    events.push({ type: "RUN_WON", money: next.money });
    return;
  }

  // Prépare le plateau de la manche suivante, puis ouvre la boutique dessus.
  prepareNextManche(next, events);
  next.phase = "shop";
  next.offer = generateOffer(next.config.shop, next.rng);
  events.push({ type: "SHOP_OPENED", money: next.money });
}

/** Avance d'une manche : même étape (plateau conservé) ou étape suivante (plateau neuf). */
function prepareNextManche(next: RunState, events: RunEvent[]): void {
  const config = next.config;
  const currentStage = config.stages[next.stageIndex]!;
  const lastOfStage = next.mancheIndex >= currentStage.manches.length - 1;

  if (!lastOfStage) {
    next.mancheIndex += 1;
    const manche = currentStage.manches[next.mancheIndex]!;
    next.round = continueManche(next.round, currentStage, manche, next);
    return;
  }

  events.push({ type: "STAGE_CLEARED", stage: next.stageIndex });
  next.stageIndex += 1;
  next.mancheIndex = 0;
  const stage = config.stages[next.stageIndex];
  if (!stage) throw new Error("Étape suivante inexistante sur un run non gagné.");
  next.round = freshManche(config, stage, stage.manches[0]!, next.placements, next.rng);
}

// --- Boutique --------------------------------------------------------------

function buyModule(next: RunState, slot: number, node: number, events: RunEvent[]): void {
  const offered = next.offer?.modules[slot];
  if (!offered || offered.sold) return deny(events, "sold");
  if (next.money < offered.price) return deny(events, "money");

  const target = next.round.nodes[node];
  if (!target) return deny(events, "invalid-node");
  if (target.moduleId !== null) return deny(events, "occupied");

  changeMoney(next, -offered.price, "buy-module", events);
  target.moduleId = offered.moduleId;
  next.placements.push({ nodeId: node, moduleId: offered.moduleId });
  offered.sold = true;
  events.push({ type: "MODULE_BOUGHT", moduleId: offered.moduleId, node, price: offered.price });
}

function buyTokens(next: RunState, node: number, events: RunEvent[]): void {
  const pack = next.offer?.tokenPack;
  if (!pack) return deny(events, "invalid-node");
  if (next.money < pack.price) return deny(events, "money");

  // Les Jetons se posent sur un Nœud JOUABLE choisi : du carburant, pas une
  // Moisson achetée toute faite (décision E + garde §7.2).
  const circuit = getCircuit(next.round.config.circuit);
  const target = next.round.nodes[node];
  if (!target || !isPlayableZone(next.round.config.rules, circuit.zoneOf(node))) {
    return deny(events, "invalid-node");
  }

  changeMoney(next, -pack.price, "buy-tokens", events);
  target.tokens += pack.amount;
  events.push({ type: "TOKENS_BOUGHT", amount: pack.amount, node, price: pack.price });
}

function rerollOffer(next: RunState, events: RunEvent[]): void {
  const cost = next.offer?.rerollCost ?? 0;
  if (!next.offer) return deny(events, "invalid-node");
  if (next.money < cost) return deny(events, "money");

  changeMoney(next, -cost, "reroll", events);
  next.offer = generateOffer(next.config.shop, next.rng);
  events.push({ type: "REROLLED", cost });
}

function deny(events: RunEvent[], reason: PurchaseDenyReason): void {
  events.push({ type: "PURCHASE_DENIED", reason });
}

function changeMoney(next: RunState, delta: number, cause: string, events: RunEvent[]): void {
  const from = next.money;
  next.money += delta;
  events.push({ type: "MONEY_CHANGED", from, to: next.money, cause });
}

// --- Construction des manches ----------------------------------------------

function mancheStarted(next: RunState, stage: StageBlueprint): RunEvent {
  const manche = stage.manches[next.mancheIndex]!;
  return {
    type: "MANCHE_STARTED",
    stage: next.stageIndex,
    manche: next.mancheIndex,
    quota: manche.quota,
    geometry: stage.label,
  };
}

function isLastManche(config: RunConfig, stageIndex: number, mancheIndex: number): boolean {
  const lastStage = config.stages.length - 1;
  if (stageIndex !== lastStage) return false;
  return mancheIndex >= config.stages[lastStage]!.manches.length - 1;
}

/**
 * La géométrie d'une étape : tirée du pool de variantes au PRNG si l'étape en
 * a un, sinon la géométrie fixe. Appelée UNE fois par entrée d'étape ; les
 * manches suivantes réutilisent la géométrie déjà en place.
 */
function resolveStageCircuit(stage: StageBlueprint, rng: RunState["rng"]): CircuitConfig {
  const variants = stage.variants;
  if (variants && variants.length > 0) return variants[nextInt(rng, variants.length)]!;
  return stage.circuit;
}

/** La GameConfig d'une manche : géométrie + quota de la manche + build. */
function mancheConfig(
  circuit: CircuitConfig,
  stage: StageBlueprint,
  manche: MancheSpec,
  placements: RunState["placements"],
  registry: RunConfig["registry"],
): GameConfig {
  return {
    circuit,
    rules: stage.rules,
    round: { ...stage.seeding, quota: manche.quota, turnLimit: manche.turnLimit },
    registry,
    placements,
  };
}

/** Une manche sur un plateau NEUF (nouvelle étape) : géométrie tirée, puis amorçage. */
function freshManche(
  config: RunConfig,
  stage: StageBlueprint,
  manche: MancheSpec,
  placements: RunState["placements"],
  rng: RunState["rng"],
): RoundState {
  const circuit = resolveStageCircuit(stage, rng);
  const gameConfig = mancheConfig(circuit, stage, manche, placements, config.registry);
  return createRound(gameConfig, nextInt(rng, SEED_BOUND));
}

/**
 * Une manche qui POURSUIT le plateau de la précédente : mêmes Jetons (le
 * plateau s'est vidé au fil des Moissons), build ré-appliqué, état de manche
 * remis à zéro, puis réensemencement partiel (décision B).
 */
function continueManche(
  prev: RoundState,
  stage: StageBlueprint,
  manche: MancheSpec,
  next: RunState,
): RoundState {
  // Même étape : on GARDE la géométrie déjà tirée (celle du plateau précédent),
  // on ne re-tire pas de variante.
  const gameConfig = mancheConfig(prev.config.circuit, stage, manche, next.placements, next.config.registry);

  const nodes: NodeState[] = prev.nodes.map((node): NodeState => ({
    tokens: node.tokens,
    moduleId: null,
  }));
  for (const placement of next.placements) {
    const node = nodes[placement.nodeId];
    if (node) node.moduleId = placement.moduleId;
  }

  const round: RoundState = {
    config: gameConfig,
    nodes,
    charge: gameConfig.rules.baseCharge,
    score: 0,
    turn: 0,
    replaysUsed: 0,
    replayPending: false,
    dropsThisTurn: 0,
    gainedThisTurn: 0,
    phase: "awaiting-move",
    outcome: null,
    rng: { ...prev.rng },
    moduleMemory: {},
  };

  reseed(round, next.config.reseed.tokensPerManche, next.rng);
  return round;
}

/** Ajoute `count` Jetons à des Nœuds jouables tirés au sort. */
function reseed(round: RoundState, count: number, rng: RunState["rng"]): void {
  const circuit = getCircuit(round.config.circuit);
  const playable: number[] = [];
  for (let node = 0; node < round.nodes.length; node++) {
    if (isPlayableZone(round.config.rules, circuit.zoneOf(node))) playable.push(node);
  }
  if (playable.length === 0) return;

  for (let i = 0; i < count; i++) {
    const node = playable[nextInt(rng, playable.length)]!;
    round.nodes[node]!.tokens += 1;
  }
}
