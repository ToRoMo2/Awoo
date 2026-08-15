/**
 * Presets d'EXPÉRIENCE — playtest du jalon 1.
 *
 * Ces configs ne font pas partie du contenu figé : elles servent à sentir un
 * lever de design manette en main avant de l'industrialiser. Ici, la géométrie
 * moissonnable variable (carnet §9 axe 4), pour casser la stratégie dominante
 * repérée en playtest — voir la mémoire projet « lever-anti-autopilote ».
 *
 * Tout reste « tout est donnée » : une géométrie différente = une autre config,
 * zéro ligne de cœur.
 */

import type {
  CircuitConfig,
  GameConfig,
  ModulePlacement,
  ModuleRegistry,
  RoundConfig,
  SeedingSpec,
} from "../core/index.js";
import { makeRegistry } from "../modules/index.js";
import {
  makeBigOutpostRing,
  makeDoubleOutpostRing,
  makeInterleavedRing,
  makeOutpostRing,
} from "./board.js";
import { AWALE_RULES, MILESTONE_0_SEEDED_ROUND } from "./milestone0.js";

/**
 * Une manche d'expérience : le quota / la limite de tours de la manche seedée
 * du jalon 1, mais un amorçage joueur adapté au nombre de Nœuds jouables du
 * plateau, à densité constante (~4 Jetons par Nœud), et la Zone Neutre à 1.
 */
function experimentRound(playerSpec: SeedingSpec): RoundConfig {
  return {
    ...MILESTONE_0_SEEDED_ROUND,
    initialTokens: { player: playerSpec, neutral: 1 },
  };
}

function makeConfig(
  circuit: CircuitConfig,
  round: RoundConfig,
  placements: ModulePlacement[],
  registry: ModuleRegistry,
): GameConfig {
  return { circuit, rules: AWALE_RULES, round, registry, placements };
}

/** Avant-poste simple : 7 Nœuds joueur (base + Nœud 9), total 28. */
export function makeOutpostConfig(
  placements: ModulePlacement[] = [],
  registry: ModuleRegistry = makeRegistry(),
): GameConfig {
  const round = experimentRound({ total: 28, perNodeMin: 2, perNodeMax: 6 });
  return makeConfig(makeOutpostRing(), round, placements, registry);
}

/** Grand plateau 2×8 : 9 Nœuds joueur (base 0-7 + Nœud 12), total 36. */
export function makeBigConfig(
  placements: ModulePlacement[] = [],
  registry: ModuleRegistry = makeRegistry(),
): GameConfig {
  const round = experimentRound({ total: 36, perNodeMin: 2, perNodeMax: 6 });
  return makeConfig(makeBigOutpostRing(), round, placements, registry);
}

/** Double avant-poste : 8 Nœuds joueur (base + Nœuds 6 et 9), total 32. */
export function makeDoubleConfig(
  placements: ModulePlacement[] = [],
  registry: ModuleRegistry = makeRegistry(),
): GameConfig {
  const round = experimentRound({ total: 32, perNodeMin: 2, perNodeMax: 6 });
  return makeConfig(makeDoubleOutpostRing(), round, placements, registry);
}

/** Intercalé : 5 Nœuds joueur (base sans le Nœud 2, devenu moissonnable), total 20. */
export function makeInterleavedConfig(
  placements: ModulePlacement[] = [],
  registry: ModuleRegistry = makeRegistry(),
): GameConfig {
  const round = experimentRound({ total: 20, perNodeMin: 2, perNodeMax: 6 });
  return makeConfig(makeInterleavedRing(), round, placements, registry);
}
