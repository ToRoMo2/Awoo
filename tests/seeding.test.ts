/**
 * L'amorçage seedé du plateau (jalon 1, incrément 1 — carnet §13.1).
 *
 * Ces tests verrouillent le curseur du premier pas : le plateau VARIE avec la
 * graine (fin du « même puzzle à chaque manche »), mais le total par zone reste
 * FIXE (aucune dérive d'équilibrage) et la Zone Neutre reste sous la fenêtre de
 * capture (garde-fou §7.2). Le jeu reste rejouable à l'identique depuis sa
 * graine, condition de tout ce qui suit.
 */

import { describe, expect, it } from "vitest";
import { createRound, type GameConfig, type RoundConfig } from "../src/core/index.js";
import {
  makeMilestone0Config,
  makeMilestone0SeededConfig,
  MILESTONE_0_SEEDED_ROUND,
} from "../src/presets/milestone0.js";
import { tokensOf } from "./helpers.js";

const PLAYER = [0, 1, 2, 3, 4, 5];
const NEUTRAL = [6, 7, 8, 9, 10, 11];

const sumOf = (tokens: number[], nodes: number[]): number =>
  nodes.reduce((total, node) => total + tokens[node]!, 0);

/** Une config seedée dont on force l'amorçage, pour tester des cas précis. */
function withSeeding(initialTokens: RoundConfig["initialTokens"]): GameConfig {
  const base = makeMilestone0SeededConfig();
  return { ...base, round: { ...base.round, initialTokens } };
}

describe("Amorçage seedé du plateau", () => {
  it("rejoue exactement le même plateau depuis la même graine", () => {
    const config = makeMilestone0SeededConfig();
    expect(tokensOf(createRound(config, 7))).toEqual(tokensOf(createRound(config, 7)));
  });

  it("produit des ouvertures différentes selon la graine", () => {
    const config = makeMilestone0SeededConfig();
    // On échantillonne plusieurs graines : la répartition côté joueur ne doit
    // pas être figée. C'est précisément le bug que l'incrément corrige.
    const boards = new Set(
      Array.from({ length: 8 }, (_, seed) =>
        PLAYER.map((node) => tokensOf(createRound(config, seed))[node]).join(","),
      ),
    );
    expect(boards.size).toBeGreaterThan(1);
  });

  it("garde le total de chaque zone constant, quelle que soit la graine", () => {
    const config = makeMilestone0SeededConfig();
    for (let seed = 0; seed < 12; seed++) {
      const tokens = tokensOf(createRound(config, seed));
      // 24 côté joueur (le total de la spec), 6 côté neutre (1 par Nœud).
      expect(sumOf(tokens, PLAYER)).toBe(24);
      expect(sumOf(tokens, NEUTRAL)).toBe(6);
    }
  });

  it("respecte les bornes par Nœud de la spec", () => {
    const config = makeMilestone0SeededConfig();
    for (let seed = 0; seed < 12; seed++) {
      const tokens = tokensOf(createRound(config, seed));
      for (const node of PLAYER) {
        expect(tokens[node]).toBeGreaterThanOrEqual(2);
        expect(tokens[node]).toBeLessThanOrEqual(6);
      }
    }
  });

  it("ne laisse jamais un Nœud neutre démarrer dans la fenêtre de capture (§7.2)", () => {
    // Zone Neutre en SPEC cette fois, bornée sous le plus petit seuil (2).
    const config = withSeeding({
      player: { total: 24, perNodeMin: 2, perNodeMax: 6 },
      neutral: { total: 6, perNodeMin: 0, perNodeMax: 1 },
    });
    const thresholds = config.rules.captureThresholds;
    const floor = Math.min(...thresholds);
    for (let seed = 0; seed < 12; seed++) {
      const tokens = tokensOf(createRound(config, seed));
      for (const node of NEUTRAL) {
        expect(tokens[node]).toBeLessThan(floor);
      }
    }
  });

  it("échoue à la création si l'amorçage est infaisable", () => {
    // 30 Jetons sur 6 Nœuds plafonnés à 4 : impossible (max atteignable 24).
    const config = withSeeding({
      player: { total: 30, perNodeMin: 2, perNodeMax: 4 },
      neutral: 1,
    });
    expect(() => createRound(config, 1)).toThrow(/impossible/i);
  });

  it("garde le preset seedé sous le seuil de capture côté Zone Neutre", () => {
    // La Zone Neutre du preset reste un nombre fixe (1), pas une spec.
    expect(MILESTONE_0_SEEDED_ROUND.initialTokens).toMatchObject({ neutral: 1 });
  });
});

describe("Amorçage fixe — non-régression", () => {
  it("laisse un amorçage uniforme (number) inchangé et insensible à la graine", () => {
    const base = makeMilestone0Config();
    const config = { ...base, round: { ...base.round, initialTokens: 4 } };
    const expected = new Array(12).fill(4);
    expect(tokensOf(createRound(config, 1))).toEqual(expected);
    expect(tokensOf(createRound(config, 999))).toEqual(expected);
  });

  it("laisse un amorçage par zone fixe (Record<zone, number>) inchangé", () => {
    // Le preset par défaut du jalon 0 : joueur 4, neutre 1, partout, toujours.
    const config = makeMilestone0Config();
    const expected = [4, 4, 4, 4, 4, 4, 1, 1, 1, 1, 1, 1];
    expect(tokensOf(createRound(config, 1))).toEqual(expected);
    expect(tokensOf(createRound(config, 42))).toEqual(expected);
  });
});
