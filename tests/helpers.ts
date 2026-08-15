/** Outils de test : construire un état de plateau arbitraire. */

import {
  createRound,
  type GameConfig,
  type ModulePlacement,
  type ModuleRegistry,
  type RoundState,
} from "../src/core/index.js";
import { makeMilestone0Config } from "../src/presets/milestone0.js";

export interface RoundOverrides {
  quota?: number;
  turnLimit?: number;
  placements?: ModulePlacement[];
  registry?: ModuleRegistry;
  seed?: number;
}

/**
 * Une manche dont le plateau de départ est celui de l'Awalé : 4 Jetons dans
 * les 12 Nœuds (carnet §3.1).
 *
 * Le preset du jalon 0 démarre volontairement la Zone Neutre plus bas — sinon
 * aucune Moisson n'est possible. Les tests qui reproduisent un oracle du
 * carnet doivent donc dire explicitement qu'ils veulent le plateau d'origine,
 * au lieu de dépendre du preset.
 */
export function awaleRound(overrides: RoundOverrides = {}): RoundState {
  const base = makeMilestone0Config(overrides.placements ?? []);
  return createRound(
    { ...base, round: { ...base.round, initialTokens: 4 } },
    overrides.seed ?? 1,
  );
}

/**
 * Crée une manche du jalon 0 dont le contenu des Nœuds est imposé.
 *
 * `tokens` suit l'indexation du preset : [A..F, a..f].
 */
export function roundWithTokens(
  tokens: number[],
  overrides: RoundOverrides = {},
): RoundState {
  const base =
    overrides.registry === undefined
      ? makeMilestone0Config(overrides.placements ?? [])
      : makeMilestone0Config(overrides.placements ?? [], overrides.registry);
  const config: GameConfig = {
    ...base,
    round: {
      ...base.round,
      ...(overrides.quota !== undefined ? { quota: overrides.quota } : {}),
      ...(overrides.turnLimit !== undefined ? { turnLimit: overrides.turnLimit } : {}),
    },
  };

  if (tokens.length !== config.circuit.nodeCount) {
    throw new Error(
      `Le tableau de test a ${tokens.length} valeurs pour ${config.circuit.nodeCount} Nœuds.`,
    );
  }

  const state = createRound(config, overrides.seed ?? 1);
  state.nodes.forEach((node, index) => {
    node.tokens = tokens[index]!;
  });
  return state;
}

/** Le contenu des Nœuds, pour comparer à un plateau attendu. */
export function tokensOf(state: RoundState): number[] {
  return state.nodes.map((node) => node.tokens);
}

/** Indices lisibles du plateau 2×6, dans le vocabulaire du carnet §3.1. */
export const N = {
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  a: 6,
  b: 7,
  c: 8,
  d: 9,
  e: 10,
  f: 11,
} as const;
