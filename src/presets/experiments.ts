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
  GameConfig,
  ModulePlacement,
  ModuleRegistry,
  RoundConfig,
} from "../core/index.js";
import { makeRegistry } from "../modules/index.js";
import { makeOutpostRing } from "./board.js";
import { AWALE_RULES, MILESTONE_0_SEEDED_ROUND } from "./milestone0.js";

/**
 * Sept Nœuds joueur (les six de la base + l'avant-poste, Nœud 9) et cinq Nœuds
 * moissonnables (6,7,8,10,11). Total joueur à 28 pour garder la densité de ~4
 * Jetons par Nœud du plateau standard, avant-poste compris — il démarre donc
 * déjà chargé, prêt à tirer dans la poche voisine.
 */
export const OUTPOST_ROUND: RoundConfig = {
  ...MILESTONE_0_SEEDED_ROUND,
  initialTokens: {
    player: { total: 28, perNodeMin: 2, perNodeMax: 6 },
    neutral: 1,
  },
};

export function makeOutpostConfig(
  placements: ModulePlacement[] = [],
  registry: ModuleRegistry = makeRegistry(),
): GameConfig {
  return {
    circuit: makeOutpostRing(),
    rules: AWALE_RULES,
    round: OUTPOST_ROUND,
    registry,
    placements,
  };
}
