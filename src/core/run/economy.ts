/**
 * L'économie du run — décision A du jalon 1.
 *
 * UN SEUL endroit calcule l'argent gagné, exactement comme le score
 * MOISSON×CHARGE (règle 4 du CLAUDE.md) : lisible, modifiable, équilibrable.
 * L'argent est une ressource DISTINCTE du score.
 */

import type { EconomyConfig } from "./types.js";

/**
 * Récompense d'une manche réussie : une somme fixe, plus un bonus proportionnel
 * au dépassement du quota (1 pièce par tranche de `overshootDivisor` points).
 */
export function mancheReward(economy: EconomyConfig, score: number, quota: number): number {
  const overshoot = Math.max(0, score - quota);
  return economy.baseReward + Math.floor(overshoot / economy.overshootDivisor);
}
