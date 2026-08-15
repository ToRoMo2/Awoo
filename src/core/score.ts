/**
 * Le moteur de score.
 *
 * LE SEUL ENDROIT du projet où la formule MOISSON × CHARGE est écrite
 * (carnet §5.1). Si elle doit changer, elle change ici et nulle part ailleurs.
 */

import type { GameEvent } from "./events.js";
import type { RoundState } from "./types.js";

/** La formule. */
export function computeScore(harvestValue: number, charge: number): number {
  return harvestValue * charge;
}

/**
 * Applique le score d'une Moisson.
 *
 * Rien n'est émis quand la Moisson est vide : un tour sans capture rapporte
 * zéro (carnet §5.3) et c'est HARVEST_NONE qui porte ce silence, pas un
 * SCORE_COMPUTED à 0.
 */
export function applyHarvestScore(
  state: RoundState,
  harvestValue: number,
  emit: (event: GameEvent) => void,
): number {
  if (harvestValue <= 0) return 0;

  const gained = computeScore(harvestValue, state.charge);
  state.score += gained;
  state.gainedThisTurn += gained;

  emit({
    type: "SCORE_COMPUTED",
    harvest: harvestValue,
    charge: state.charge,
    gained,
    total: state.score,
  });

  return gained;
}
