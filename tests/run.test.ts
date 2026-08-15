/**
 * La boucle de RUN et la BOUTIQUE (jalon 1, incréments 2a + 2b).
 *
 * Machine pure : enchaînement des manches, économie (décision A), plateau qui
 * se vide et se réensemence partiellement (B/D), géométrie neuve à l'étape
 * suivante avec build conservé (C/D), et la boutique — acheter Modules et
 * Jetons (E), reroll, refus annoncés. Tout par simulation, aucun rendu.
 */

import { describe, expect, it } from "vitest";
import {
  applyRunAction,
  createRun,
  legalMoves,
  mancheReward,
  stageAt,
  type CircuitConfig,
  type EconomyConfig,
  type MancheSpec,
  type RunAction,
  type RunConfig,
  type RunState,
  type ShopConfig,
  type StageBlueprint,
  type StageTemplate,
} from "../src/core/index.js";
import {
  makeOutpostRing,
  makeTwoRowRing,
  OUTPOST_POSITIONS,
  PLAYER_ZONE,
} from "../src/presets/board.js";
import { AWALE_RULES } from "../src/presets/milestone0.js";
import { makeMilestone1Run } from "../src/presets/run.js";
import { makeRegistry } from "../src/modules/index.js";

const ECONOMY: EconomyConfig = { startingMoney: 0, baseReward: 5, overshootDivisor: 10 };

const SHOP: ShopConfig = {
  offerSize: 3,
  rerollCost: 2,
  modulePool: [
    { moduleId: "charge-plus-one", weight: 1, price: 4, stackBase: 3, stackFactor: 1.4 },
    { moduleId: "replay", weight: 1, price: 6, stackBase: 5, stackFactor: 1.6 },
  ],
  tokenPack: { amount: 3, price: 2 },
};

function stageOf(
  label: string,
  circuit: CircuitConfig,
  playerNodes: number,
  manches: MancheSpec[],
): StageBlueprint {
  return {
    label,
    circuit,
    rules: AWALE_RULES,
    seeding: {
      initialTokens: { player: { total: playerNodes * 4, perNodeMin: 2, perNodeMax: 6 }, neutral: 1 },
      maxReplaysPerTurn: 3,
      maxDropsPerTurn: 500,
    },
    manches,
  };
}

function runOf(stages: StageBlueprint[], overrides: Partial<RunConfig> = {}): RunConfig {
  return {
    stages,
    economy: ECONOMY,
    reseed: { tokensPerManche: 6 },
    shop: SHOP,
    registry: makeRegistry(),
    startingPlacements: [],
    ...overrides,
  };
}

const sumTokens = (state: RunState): number =>
  state.round.nodes.reduce((total, node) => total + node.tokens, 0);

/** Le coup qui maximise le score immédiat de la manche. */
function greedySow(state: RunState): RunAction {
  const moves = legalMoves(state.round);
  let best = moves[0]!.node;
  let bestScore = -1;
  for (const move of moves) {
    const after = applyRunAction(state, { type: "sow", node: move.node }).state;
    if (after.round.score > bestScore) {
      bestScore = after.round.score;
      best = move.node;
    }
  }
  return { type: "sow", node: best };
}

function playManche(state: RunState): RunState {
  let guard = 0;
  while (state.phase === "playing" && ++guard < 300) {
    state = applyRunAction(state, greedySow(state)).state;
  }
  return state;
}

function playFullRun(state: RunState): RunState {
  let guard = 0;
  while ((state.phase === "playing" || state.phase === "shop") && ++guard < 50) {
    state =
      state.phase === "playing"
        ? playManche(state)
        : applyRunAction(state, { type: "start-manche" }).state;
  }
  return state;
}

/** Un run à deux étapes d'une manche, pour atteindre la boutique. */
const twoStageRun = (overrides: Partial<RunConfig> = {}): RunConfig =>
  runOf(
    [
      stageOf("s1", makeTwoRowRing(6), 6, [{ quota: 2, turnLimit: 15 }]),
      stageOf("s2", makeOutpostRing(), 7, [{ quota: 2, turnLimit: 15 }]),
    ],
    overrides,
  );

describe("Économie du run", () => {
  it("récompense = fixe + bonus par tranche de dépassement", () => {
    expect(mancheReward(ECONOMY, 73, 50)).toBe(7); // 5 + floor(23/10)
    expect(mancheReward(ECONOMY, 50, 50)).toBe(5);
    expect(mancheReward(ECONOMY, 40, 50)).toBe(5); // sous le quota (déjà réussi), pas négatif
  });
});

describe("Boucle de run", () => {
  it("verse la récompense et gagne quand la dernière manche tombe", () => {
    const done = playManche(createRun(runOf([stageOf("s", makeTwoRowRing(6), 6, [{ quota: 2, turnLimit: 15 }])]), 1));
    expect(done.phase).toBe("won");
    expect(done.money).toBeGreaterThanOrEqual(ECONOMY.baseReward);
  });

  it("perd la run si le quota n'est pas atteint dans la limite de tours", () => {
    const config = runOf([stageOf("s", makeTwoRowRing(6), 6, [{ quota: 1_000_000, turnLimit: 5 }])]);
    const done = playManche(createRun(config, 1));
    expect(done.phase).toBe("lost");
    expect(done.outcome).toBe("lost");
  });

  it("ouvre la boutique sur le plateau préparé après une manche réussie", () => {
    const config = runOf([
      stageOf("s", makeTwoRowRing(6), 6, [
        { quota: 2, turnLimit: 15 },
        { quota: 2, turnLimit: 15 },
      ]),
    ]);
    const shop = playManche(createRun(config, 1));
    expect(shop.phase).toBe("shop");
    expect(shop.offer).not.toBeNull();
    expect(shop.offer!.modules).toHaveLength(SHOP.offerSize);
    expect(shop.mancheIndex).toBe(1);
  });

  it("conserve le plateau vidé et le réensemence partiellement dans une étape", () => {
    const make = (tokensPerManche: number): RunConfig =>
      runOf(
        [stageOf("s", makeTwoRowRing(6), 6, [{ quota: 2, turnLimit: 15 }, { quota: 2, turnLimit: 15 }])],
        { reseed: { tokensPerManche } },
      );
    const shop0 = playManche(createRun(make(0), 1));
    const shop6 = playManche(createRun(make(6), 1));

    expect(shop0.phase).toBe("shop");
    // Plateau conservé/vidé, PAS re-semé à plein (standard 2×6 = 24 + 6 = 30).
    expect(sumTokens(shop0)).toBeLessThan(30);
    // À graine égale, le réensemencement ajoute EXACTEMENT 6, rien d'autre ne change.
    expect(sumTokens(shop6)).toBe(sumTokens(shop0) + 6);
  });

  it("change de géométrie à l'étape suivante en conservant le build", () => {
    const config = twoStageRun({ startingPlacements: [{ nodeId: 3, moduleId: "charge-plus-one" }] });
    const shop = playManche(createRun(config, 1));
    expect(shop.phase).toBe("shop");
    expect(shop.stageIndex).toBe(1);
    // Plateau neuf (avant-poste) mais le Module posé est toujours là.
    expect(shop.round.nodes[3]!.moduleId).toBe("charge-plus-one");
    expect(shop.placements).toEqual([{ nodeId: 3, moduleId: "charge-plus-one" }]);
  });

  it("rejoue le run à l'identique depuis la même graine", () => {
    const config = twoStageRun();
    const a = playFullRun(createRun(config, 42));
    const b = playFullRun(createRun(config, 42));
    expect(a.phase).toBe(b.phase);
    expect(a.money).toBe(b.money);
    expect(sumTokens(a)).toBe(sumTokens(b));
  });
});

describe("Boutique", () => {
  const rich = { economy: { startingMoney: 20, baseReward: 6, overshootDivisor: 8 } };

  it("achète un Module et le pose sur le Nœud choisi", () => {
    const shop = playManche(createRun(twoStageRun(rich), 1));
    const slot = shop.offer!.modules[0]!;
    const moneyBefore = shop.money;

    const bought = applyRunAction(shop, { type: "buy-module", slot: 0, node: 0 }).state;
    expect(bought.money).toBe(moneyBefore - slot.price);
    expect(bought.round.nodes[0]!.moduleId).toBe(slot.moduleId);
    expect(bought.placements).toContainEqual({ nodeId: 0, moduleId: slot.moduleId, level: 1 });
    expect(bought.offer!.modules[0]!.sold).toBe(true);
  });

  it("achète des Jetons et les pose sur un Nœud jouable choisi", () => {
    const shop = playManche(createRun(twoStageRun(rich), 1));
    const pack = shop.offer!.tokenPack;
    const before = shop.round.nodes[0]!.tokens;
    const moneyBefore = shop.money;

    const bought = applyRunAction(shop, { type: "buy-tokens", node: 0 }).state;
    expect(bought.round.nodes[0]!.tokens).toBe(before + pack.amount);
    expect(bought.money).toBe(moneyBefore - pack.price);
  });

  it("refuse un achat trop cher, sans rien changer, mais en l'annonçant", () => {
    const broke = twoStageRun({ economy: { startingMoney: 0, baseReward: 0, overshootDivisor: 8 } });
    const shop = playManche(createRun(broke, 1));
    expect(shop.money).toBe(0);

    const { state, events } = applyRunAction(shop, { type: "buy-tokens", node: 0 });
    expect(events.some((e) => e.type === "PURCHASE_DENIED" && e.reason === "money")).toBe(true);
    expect(state.money).toBe(0);
    expect(state.round.nodes[0]!.tokens).toBe(shop.round.nodes[0]!.tokens);
  });

  it("refuse de poser un Module sur un Nœud portant un Module DIFFÉRENT", () => {
    // charge-double n'est pas dans le pool de test : l'offre ne peut jamais
    // proposer le même Module que celui déjà posé → toujours « occupé ».
    const config = twoStageRun({ ...rich, startingPlacements: [{ nodeId: 0, moduleId: "charge-double" }] });
    const shop = playManche(createRun(config, 1));
    const { state, events } = applyRunAction(shop, { type: "buy-module", slot: 0, node: 0 });
    expect(events.some((e) => e.type === "PURCHASE_DENIED" && e.reason === "occupied")).toBe(true);
    expect(state.money).toBe(shop.money);
  });

  it("empile le même Module sur un Nœud et fait payer le surcoût", () => {
    const stackShop: ShopConfig = {
      offerSize: 2,
      rerollCost: 2,
      modulePool: [{ moduleId: "charge-plus-one", weight: 1, price: 4, stackBase: 3, stackFactor: 1.4 }],
      tokenPack: { amount: 3, price: 2 },
    };
    const config = twoStageRun({ ...rich, shop: stackShop });
    let shop = playManche(createRun(config, 1));

    // 1er achat : pose au niveau 1 sur le Nœud 0.
    shop = applyRunAction(shop, { type: "buy-module", slot: 0, node: 0 }).state;
    expect(shop.round.nodes[0]!.moduleLevel).toBe(1);
    const moneyAfterFirst = shop.money;

    // 2e achat du même Module sur le MÊME Nœud : empile au niveau 2, surcoût = stackBase (3).
    const result = applyRunAction(shop, { type: "buy-module", slot: 1, node: 0 });
    expect(result.state.round.nodes[0]!.moduleLevel).toBe(2);
    expect(result.state.money).toBe(moneyAfterFirst - 3);
    expect(result.state.placements).toContainEqual({ nodeId: 0, moduleId: "charge-plus-one", level: 2 });
    expect(result.events.some((e) => e.type === "MODULE_BOUGHT" && e.level === 2)).toBe(true);
  });

  it("reroll coûte et redonne une offre, de façon déterministe", () => {
    const config = twoStageRun(rich);
    const a = applyRunAction(playManche(createRun(config, 7)), { type: "reroll" });
    const b = applyRunAction(playManche(createRun(config, 7)), { type: "reroll" });
    // Coût prélevé, événement émis.
    expect(a.state.money).toBe(playManche(createRun(config, 7)).money - config.shop.rerollCost);
    expect(a.events.some((e) => e.type === "REROLLED")).toBe(true);
    // Même graine → même nouvelle offre.
    expect(a.state.offer).toEqual(b.state.offer);
  });
});

describe("Variantes de géométrie d'étape", () => {
  /** La position de l'avant-poste = le Nœud joueur dans la rangée neutre (6..11). */
  const outpostPositionOf = (state: RunState): number =>
    state.round.config.circuit.zones.findIndex(
      (zone, node) => node >= 6 && zone === PLAYER_ZONE,
    );

  const outpostStage = (): StageBlueprint => ({
    label: "avant-poste",
    circuit: makeOutpostRing(9),
    variants: OUTPOST_POSITIONS.map((p) => makeOutpostRing(p)),
    rules: AWALE_RULES,
    seeding: {
      initialTokens: { player: { total: 28, perNodeMin: 2, perNodeMax: 6 }, neutral: 1 },
      maxReplaysPerTurn: 3,
      maxDropsPerTurn: 500,
    },
    manches: [{ quota: 2, turnLimit: 15 }, { quota: 2, turnLimit: 15 }],
  });

  it("tire des positions d'avant-poste différentes selon la graine", () => {
    const config = runOf([outpostStage()]);
    const positions = new Set(
      Array.from({ length: 16 }, (_, seed) => outpostPositionOf(createRun(config, seed))),
    );
    expect(positions.size).toBeGreaterThan(1);
    for (const p of positions) expect(OUTPOST_POSITIONS).toContain(p);
  });

  it("garde la position de l'avant-poste stable au fil des manches d'une étape", () => {
    const config = runOf([outpostStage()]);
    const start = createRun(config, 3);
    const before = outpostPositionOf(start);
    const next = applyRunAction(playManche(start), { type: "start-manche" }).state;
    expect(outpostPositionOf(next)).toBe(before);
  });
});

describe("Mode endless", () => {
  const template = (label: string, circuit: CircuitConfig, playerNodes: number): StageTemplate => ({
    label,
    circuit,
    rules: AWALE_RULES,
    seeding: {
      initialTokens: { player: { total: playerNodes * 4, perNodeMin: 2, perNodeMax: 6 }, neutral: 1 },
      maxReplaysPerTurn: 3,
      maxDropsPerTurn: 500,
    },
  });

  it("génère les étapes au-delà des écrites : géométrie cyclée, quota par la formule", () => {
    const pool = [template("A", makeTwoRowRing(6), 6), template("B", makeOutpostRing(9), 7)];
    const config = runOf([stageOf("écrite", makeTwoRowRing(6), 6, [{ quota: 2, turnLimit: 15 }])], {
      endless: { pool, quotaBase: 10, quotaGrowth: 2, manchesPerStage: 1, turnLimit: 15 },
    });

    // Étape 0 écrite ; 1 et 3 générées, cyclées sur le pool de 2 (index % 2 = 1).
    expect(stageAt(config, 1).label).toBe("B");
    expect(stageAt(config, 3).label).toBe("B");
    expect(stageAt(config, 2).label).toBe("A");
    // Quota généré = base × growth^(index × manchesPerStage + i).
    expect(stageAt(config, 1).manches[0]!.quota).toBe(20); // 10 × 2^1
    expect(stageAt(config, 3).manches[0]!.quota).toBe(80); // 10 × 2^3
  });

  it("ne gagne jamais par épuisement : la dernière étape écrite mène à une étape générée", () => {
    const pool = [template("suite", makeTwoRowRing(6), 6)];
    const config = runOf([stageOf("écrite", makeTwoRowRing(6), 6, [{ quota: 2, turnLimit: 15 }])], {
      endless: { pool, quotaBase: 2, quotaGrowth: 1.5, manchesPerStage: 1, turnLimit: 15 },
    });

    const shop = playManche(createRun(config, 1));
    // PAS « won » : le run continue, boutique ouverte sur l'étape générée.
    expect(shop.phase).toBe("shop");
    expect(shop.stageIndex).toBe(1);
    expect(shop.round.config.round.quota).toBe(3); // 2 × 1.5^1
  });
});

describe("Preset de run du jalon 1", () => {
  it("se construit avec trois étapes en 2×6 et une boutique", () => {
    const config = makeMilestone1Run();
    expect(config.stages).toHaveLength(3);
    expect(config.shop.modulePool.length).toBeGreaterThan(0);
    for (const stage of config.stages) {
      expect(stage.circuit.nodeCount).toBe(12);
      expect(stage.manches).toHaveLength(2);
    }
  });
});
