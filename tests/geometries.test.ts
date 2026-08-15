/**
 * Les géométries d'expérience du jalon 1 (playtest — carnet §9 axe 4).
 *
 * On vérifie que chaque plateau conçu à la main est bien formé : zones
 * attendues, totaux d'amorçage conservés, et pour les plateaux qui scindent la
 * Moisson, que les poches sont bien isolées. Tout vient de la config — le cœur
 * n'a pas bougé.
 */

import { describe, expect, it } from "vitest";
import { createRound, getCircuit, type GameConfig } from "../src/core/index.js";
import { NEUTRAL_ZONE, PLAYER_ZONE } from "../src/presets/board.js";
import {
  makeBigConfig,
  makeDoubleConfig,
  makeInterleavedConfig,
} from "../src/presets/experiments.js";

const zonesOf = (config: GameConfig): string[] => {
  const circuit = getCircuit(config.circuit);
  return config.circuit.zones.map((_, node) => circuit.zoneOf(node));
};

const totalOn = (config: GameConfig, nodes: number[]): number => {
  const tokens = createRound(config, 5).nodes.map((n) => n.tokens);
  return nodes.reduce((sum, node) => sum + tokens[node]!, 0);
};

describe("Géométrie « grand 2×8 »", () => {
  it("compte 16 Nœuds avec un avant-poste joueur au Nœud 12", () => {
    const config = makeBigConfig();
    expect(config.circuit.nodeCount).toBe(16);
    const zones = zonesOf(config);
    expect(zones[12]).toBe(PLAYER_ZONE);
    // Deux poches moissonnables séparées par l'avant-poste.
    for (const n of [8, 9, 10, 11, 13, 14, 15]) expect(zones[n]).toBe(NEUTRAL_ZONE);
  });

  it("répartit 36 Jetons sur les 9 Nœuds joueur et 7 sur la rangée neutre", () => {
    const config = makeBigConfig();
    expect(totalOn(config, [0, 1, 2, 3, 4, 5, 6, 7, 12])).toBe(36);
    expect(totalOn(config, [8, 9, 10, 11, 13, 14, 15])).toBe(7);
  });
});

describe("Géométrie « double avant-poste »", () => {
  it("pose deux cases joueur (6 et 9) et laisse deux poches de deux", () => {
    const zones = zonesOf(makeDoubleConfig());
    expect(zones[6]).toBe(PLAYER_ZONE);
    expect(zones[9]).toBe(PLAYER_ZONE);
    for (const n of [7, 8, 10, 11]) expect(zones[n]).toBe(NEUTRAL_ZONE);
  });

  it("répartit 32 Jetons sur les 8 Nœuds joueur et 4 sur la rangée neutre", () => {
    const config = makeDoubleConfig();
    expect(totalOn(config, [0, 1, 2, 3, 4, 5, 6, 9])).toBe(32);
    expect(totalOn(config, [7, 8, 10, 11])).toBe(4);
  });
});

describe("Géométrie « intercalé »", () => {
  it("rend le Nœud 2 moissonnable au milieu de la base joueur", () => {
    const zones = zonesOf(makeInterleavedConfig());
    expect(zones[2]).toBe(NEUTRAL_ZONE);
    for (const n of [0, 1, 3, 4, 5]) expect(zones[n]).toBe(PLAYER_ZONE);
  });

  it("répartit 20 Jetons sur les 5 Nœuds joueur, et démarre la cible sous le seuil", () => {
    const config = makeInterleavedConfig();
    expect(totalOn(config, [0, 1, 3, 4, 5])).toBe(20);
    // Le Nœud 2 (moissonnable) démarre à 1, sous la fenêtre {2,3} : il faut
    // l'armer avant de tirer (§5.3, §7.2).
    expect(totalOn(config, [2])).toBe(1);
  });
});
