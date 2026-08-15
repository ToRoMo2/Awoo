/**
 * Le preset du JALON 0 (carnet §14).
 *
 * Plateau 2×6, règles de l'Awalé, une manche à quota en 15 tours.
 * Tous les chiffres du jeu sont ici et nulle part ailleurs.
 */

import type {
  GameConfig,
  ModulePlacement,
  ModuleRegistry,
  RoundConfig,
  RulesConfig,
} from "../core/index.js";
import { makeRegistry } from "../modules/index.js";
import { makeTwoRowRing, NEUTRAL_ZONE, PLAYER_ZONE } from "./board.js";

/** Les règles de l'Awalé, telles que le carnet les fixe (§3.3, §3.4, §5.1). */
export const AWALE_RULES: RulesConfig = {
  captureThresholds: [2, 3],
  harvestableZones: [NEUTRAL_ZONE],
  playableZones: [PLAYER_ZONE],
  chainBreaksOnZoneExit: true,
  skipOriginOnSow: true,
  baseCharge: 1,
  tokenValue: 1,
};

export const MILESTONE_0_ROUND: RoundConfig = {
  /**
   * Cette manche est la PETITE MANCHE DE L'ÉTAPE 1 (carnet §8.1) : la plus
   * facile de tout le jeu. Elle doit être une rampe, pas un filtre — la
   * difficulté viendra des étapes suivantes et des Épreuves.
   *
   * Calibré par simulation (npm run balance) :
   *   plafond à 4 coups d'avance ......... 156
   *   joueur appliqué, médiane ........... 106  → 99 % de réussite à 50
   *   joueur débutant, médiane ............ 92  → 96 %
   *   jeu au hasard, médiane .............. 58  → 64 %
   *
   * Un premier réglage à 75 s'est révélé trop haut en playtest (2-3 réussites
   * sur 10) : il était calibré contre une politique gloutonne, ce qui mesure
   * « fait-il mieux qu'un bot myope » et non « est-ce une bonne ouverture ».
   */
  quota: 50,
  turnLimit: 15,
  /**
   * ⚠ DÉCISION DE RÈGLE en attente d'arbitrage (carnet §7.2).
   *
   * Le camp du joueur démarre à 4 comme l'Awalé, mais la Zone Neutre démarre
   * à 1. Sans cet écart, ses compteurs ne redescendent JAMAIS dans la fenêtre
   * de capture — personne ne joue la Zone Neutre, donc rien ne la vide — et
   * aucune Moisson n'est possible de toute la manche : mesuré à 0 point sur
   * 4000 manches simulées, avec un départ uniforme à 4 comme à 3.
   *
   * 1 plutôt que 2 : à 2, la Zone Neutre est déjà dans la fenêtre de capture
   * au premier coup, ce qui permet de moissonner sans rien préparer et dilue
   * la distinction armer/tirer du §5.3.
   */
  initialTokens: { player: 4, neutral: 1 },
  maxReplaysPerTurn: 3,
  maxDropsPerTurn: 500,
};

export function makeMilestone0Config(
  placements: ModulePlacement[] = [],
  registry: ModuleRegistry = makeRegistry(),
): GameConfig {
  return {
    circuit: makeTwoRowRing(6),
    rules: AWALE_RULES,
    round: MILESTONE_0_ROUND,
    registry,
    placements,
  };
}

/**
 * La disposition de départ du jalon 0.
 *
 * Elle est choisie pour être PÉDAGOGIQUE : les trois Modules de Charge sont
 * posés sur les derniers Nœuds du camp du joueur (D, E, F), juste avant
 * l'entrée en Zone Neutre. Partir de A, B ou C construit donc la Charge, puis
 * le trajet entre en territoire moissonnable — le §5.1 se lit dans le trajet
 * lui-même : « le voyage construit le multiplicateur, la destination
 * détermine la base ».
 *
 * L'ordre +1, +1, ×2 est celui du §6.6 : le ×2 est placé APRÈS les deux +1,
 * donc il double une Charge déjà montée. L'inverser divise le résultat.
 *
 * « Rejouer » est en Zone Neutre, sur c : l'atteindre demande de compter.
 *
 * Placeholder de playtest — pas une décision de design.
 */
export const MILESTONE_0_PLACEMENTS: ModulePlacement[] = [
  { nodeId: 3, moduleId: "charge-plus-one" },
  { nodeId: 4, moduleId: "charge-plus-one" },
  { nodeId: 5, moduleId: "charge-double" },
  { nodeId: 8, moduleId: "replay" },
];
