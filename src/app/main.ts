/**
 * Assemblage de la couche de présentation — mode RUN.
 *
 * Le cœur (manche + run) est appelé ici, et seulement ici. app/ connaît core/,
 * core/ ignore que app/ existe.
 *
 * L'app est une petite machine à trois modes : on joue une manche, la boutique
 * s'ouvre entre les manches, un écran de fin clôt le run. Placeholder assumé
 * (carnet §14) — l'UI évoluera avec la vraie DA.
 */

import {
  applyRunAction,
  createRun,
  getCircuit,
  harvestStatusOf,
  isPlayableZone,
  legalMoves,
  previewSow,
  stageAt,
  type GameConfig,
  type HarvestStatus,
  type NodeId,
  type RoundState,
  type RunState,
} from "../core/index.js";
import { makeMilestone1Run } from "../presets/run.js";
import { GameAudio } from "./audio.js";
import { Renderer } from "./render.js";
import { TimelinePlayer } from "./timeline.js";
import { ageView, createView, ViewDriver, type ViewState } from "./view.js";

const FAST_FORWARD = 6;

const canvasEl = document.getElementById("board");
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error("Canvas introuvable.");
}
const canvas: HTMLCanvasElement = canvasEl;

const runConfig = makeMilestone1Run();
const audio = new GameAudio();

type Mode = "manche" | "shop" | "ended";
type ShopSel = { kind: "module"; slot: number } | { kind: "tokens" } | null;

let runState: RunState;
let mancheConfig: GameConfig;
let renderer: Renderer;
let view: ViewState;
let driver: ViewDriver;
let player: TimelinePlayer;
let mode: Mode = "manche";
/** Une manche vient de se terminer ; on attend la fin de l'animation pour enchaîner. */
let pendingTransition = false;
let shopSel: ShopSel = null;

const newSeed = (): number => (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;

// stageAt lit l'étape courante même GÉNÉRÉE (au-delà des étapes écrites, endless).
const currentStage = () => stageAt(runState.config, runState.stageIndex);
const mancheLabel = () =>
  currentStage().manches[runState.mancheIndex]?.label ?? `manche ${runState.mancheIndex + 1}`;
const progressLabel = () => {
  // En endless le total n'a pas de sens : on n'affiche que la profondeur atteinte.
  const stageNum = runState.stageIndex + 1;
  const scope = runState.config.endless
    ? `Étape ${stageNum}`
    : `Étape ${stageNum}/${runState.config.stages.length}`;
  return `${scope} · ${mancheLabel()} · ${currentStage().label}`;
};

/**
 * (Re)synchronise tout l'affichage sur la manche courante de runState : la
 * géométrie peut avoir changé (nouvelle étape), et le build évolue (achats).
 */
function syncDisplay(): void {
  // Les placements achetés vivent dans runState.placements ; on les injecte pour
  // que le rendu affiche les Modules fraîchement posés.
  mancheConfig = { ...runState.round.config, placements: runState.placements };
  renderer = new Renderer(canvas, mancheConfig, progressLabel());
  renderer.money = runState.money;
  view = createView(runState.round);
  driver = new ViewDriver(view, audio);
  player = new TimelinePlayer({
    onEnter: (event) => driver.onEnter(event),
    onExit: (event) => driver.onExit(event),
  });
}

function newRun(): void {
  // La graine vient d'ici, pas du cœur : le moteur reste déterministe.
  runState = createRun(runConfig, newSeed());
  mode = "manche";
  shopSel = null;
  pendingTransition = false;
  syncDisplay();
}

newRun();

// --- Lecture de l'état pour le rendu ---------------------------------------

function harvestStatuses(): HarvestStatus[] {
  // On marque sur les compteurs AFFICHÉS et selon la géométrie AFFICHÉE : le
  // stub porte juste la config, le seul champ que harvestStatusOf lit ici.
  const stub = { config: mancheConfig } as RoundState;
  return view.tokens.map((_, node) => harvestStatusOf(stub, node, view.tokens[node]));
}

function playableNodes(): Set<NodeId> {
  if (mode !== "manche" || player.busy || runState.phase !== "playing") return new Set();
  return new Set(legalMoves(runState.round).map((move) => move.node));
}

/** Les Nœuds où l'article sélectionné peut se poser (surlignés en boutique). */
function placementTargets(): Set<NodeId> {
  if (mode !== "shop" || !shopSel) return new Set();
  const targets = new Set<NodeId>();
  const circuit = getCircuit(runState.round.config.circuit);
  const rules = runState.round.config.rules;
  runState.round.nodes.forEach((node, index) => {
    if (shopSel!.kind === "module") {
      if (node.moduleId === null) targets.add(index);
    } else if (isPlayableZone(rules, circuit.zoneOf(index))) {
      targets.add(index);
    }
  });
  return targets;
}

const shopSelKey = (): string | null =>
  !shopSel ? null : shopSel.kind === "module" ? `mod:${shopSel.slot}` : "tokens";

// --- Actions ---------------------------------------------------------------

function playSow(node: NodeId): void {
  if (mode !== "manche" || runState.phase !== "playing") return;
  if (player.busy) {
    player.skip();
    return;
  }
  if (!legalMoves(runState.round).some((move) => move.node === node)) return;

  const result = applyRunAction(runState, { type: "sow", node });
  runState = result.state;

  const gameEvents = result.events.flatMap((event) =>
    event.type === "MANCHE_EVENT" ? [event.event] : [],
  );
  if (
    result.events.some(
      (event) =>
        event.type === "MANCHE_CLEARED" ||
        event.type === "RUN_WON" ||
        event.type === "RUN_LOST",
    )
  ) {
    pendingTransition = true;
  }

  view.preview = [];
  view.hovered = null;
  player.push(gameEvents);
}

/** Une fois l'animation de fin de manche terminée : boutique, ou écran de fin. */
function finishTransition(): void {
  pendingTransition = false;
  if (runState.phase === "shop") {
    mode = "shop";
    shopSel = null;
    syncDisplay();
  } else {
    mode = "ended";
  }
}

function startManche(): void {
  runState = applyRunAction(runState, { type: "start-manche" }).state;
  mode = "manche";
  shopSel = null;
  syncDisplay();
}

function shopClickElement(key: string): void {
  const offer = runState.offer;
  if (!offer) return;

  if (key.startsWith("mod:")) {
    const slot = Number(key.slice(4));
    const module = offer.modules[slot];
    shopSel = module && !module.sold && runState.money >= module.price ? { kind: "module", slot } : null;
    if (shopSel) audio.spark();
  } else if (key === "tokens") {
    shopSel = runState.money >= offer.tokenPack.price ? { kind: "tokens" } : null;
    if (shopSel) audio.spark();
  } else if (key === "reroll") {
    runState = applyRunAction(runState, { type: "reroll" }).state;
    shopSel = null;
    audio.spark();
  } else if (key === "start") {
    startManche();
  }
}

function shopClickNode(node: NodeId): void {
  if (!shopSel) return;
  const action =
    shopSel.kind === "module"
      ? ({ type: "buy-module", slot: shopSel.slot, node } as const)
      : ({ type: "buy-tokens", node } as const);

  const result = applyRunAction(runState, action);
  runState = result.state;
  const bought = result.events.some(
    (event) => event.type === "MODULE_BOUGHT" || event.type === "TOKENS_BOUGHT",
  );

  if (bought) {
    audio.spark();
    // Un Module ne se pose qu'une fois ; les Jetons se rachètent en série.
    if (shopSel.kind === "module") shopSel = null;
    syncDisplay();
  } else {
    audio.chainBroken();
  }
}

// --- Entrées ---------------------------------------------------------------

function local(event: PointerEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

canvas.addEventListener("pointermove", (event) => {
  if (mode !== "manche") {
    view.hovered = null;
    view.preview = [];
    return;
  }
  const { x, y } = local(event);
  const node = renderer.hitTest(x, y);
  if (node !== null && playableNodes().has(node)) {
    view.hovered = node;
    view.preview = previewSow(runState.round, node);
  } else {
    view.hovered = null;
    view.preview = [];
  }
});

canvas.addEventListener("pointerleave", () => {
  view.hovered = null;
  view.preview = [];
});

canvas.addEventListener("pointerdown", (event) => {
  audio.unlock();
  const { x, y } = local(event);

  if (mode === "shop") {
    const element = renderer.hitTestShop(x, y);
    if (element) return shopClickElement(element);
    const node = renderer.hitTest(x, y);
    if (node !== null) return shopClickNode(node);
    shopSel = null;
    return;
  }

  if (mode === "ended") return;

  const node = renderer.hitTest(x, y);
  if (node === null) {
    if (player.busy) player.skip();
    return;
  }
  playSow(node);
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    player.setSpeed(FAST_FORWARD);
    return;
  }
  if (event.key === "r" || event.key === "R") {
    audio.unlock();
    newRun();
    return;
  }
  if (event.key === "m" || event.key === "M") {
    audio.unlock();
    audio.toggleMute();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") player.setSpeed(1);
});

window.addEventListener("resize", () => renderer.resize());

// --- Boucle de rendu -------------------------------------------------------

let previous = performance.now();

function frame(now: number): void {
  const delta = Math.min(64, now - previous);
  previous = now;

  player.update(delta);
  ageView(view, delta);
  renderer.money = runState.money;

  const highlight = mode === "shop" ? placementTargets() : playableNodes();
  renderer.draw(view, highlight, player.progress, harvestStatuses());

  if (mode === "shop" && runState.offer) {
    renderer.drawShopPanel(runState.offer, runState.money, shopSelKey());
  }
  if (mode === "ended") {
    renderer.drawRunEnd(
      runState.phase === "won",
      runState.money,
      `Perdu — étape ${runState.stageIndex + 1} · ${mancheLabel()}`,
    );
  }

  if (pendingTransition && !player.busy) finishTransition();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
