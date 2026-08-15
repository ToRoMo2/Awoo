/**
 * Les prédicats de règle, isolés pour qu'un Module ou une Épreuve puisse un
 * jour les détourner en un seul endroit (carnet §2, pilier 3 : des règles
 * cassables).
 */

import { getCircuit } from "./circuit.js";
import type { NodeId, RoundState, RulesConfig, ZoneId } from "./types.js";

/** Le joueur peut-il lancer une Distribution depuis ce territoire ? */
export function isPlayableZone(rules: RulesConfig, zone: ZoneId): boolean {
  return rules.playableZones.includes(zone);
}

/** Ce territoire est-il moissonnable ? (carnet §7 : seule la Zone Neutre l'est) */
export function isHarvestableZone(rules: RulesConfig, zone: ZoneId): boolean {
  return rules.harvestableZones.includes(zone);
}

/** Ce total tombe-t-il dans la fenêtre de capture ? (Awalé : exactement 2 ou 3) */
export function isWithinCaptureWindow(rules: RulesConfig, tokens: number): boolean {
  return rules.captureThresholds.includes(tokens);
}

/**
 * Où en est un Nœud vis-à-vis de la Moisson.
 *
 *  - `ready`  : moissonnable dès qu'un dernier Jeton s'y arrête ;
 *  - `arming` : un Jeton de plus l'amène dans la fenêtre ;
 *  - `over`   : Zone Neutre AU-DESSUS de la fenêtre. Son compteur ne fait que
 *               monter (rien ne le vide sans Moisson), donc la case n'est plus
 *               récupérable qu'en la moissonnant par une chaîne qui remonte
 *               dedans. Marquée à part pour ne pas la confondre avec `out` ;
 *  - `out`    : hors d'atteinte pour ce tour (hors zone, ou en dessous).
 *
 * C'est une lecture de RÈGLE, pas une aide de jeu : l'information est déjà à
 * l'écran, dans les compteurs. La présentation s'en sert pour la rendre
 * lisible en une seconde (carnet §13.3) au lieu de la réimplémenter — et si
 * un Module élargit le seuil, le marquage suit sans rien changer ailleurs.
 *
 * Ne dit PAS si un coup donné capture : ça reste le calcul du joueur, et
 * c'est ce qui fait le suspense de la chaîne (carnet §11.1).
 */
export type HarvestStatus = "ready" | "arming" | "over" | "out";

/**
 * `tokens` permet d'interroger un contenu autre que celui de l'état : pendant
 * une animation, les compteurs affichés sont en retard sur le cœur, et c'est
 * ce que le joueur voit qui doit être marqué.
 */
export function harvestStatusOf(
  state: RoundState,
  node: NodeId,
  tokens: number = state.nodes[node]?.tokens ?? 0,
): HarvestStatus {
  const { rules } = state.config;
  const circuit = getCircuit(state.config.circuit);

  if (!isHarvestableZone(rules, circuit.zoneOf(node))) return "out";

  if (isWithinCaptureWindow(rules, tokens)) return "ready";
  if (isWithinCaptureWindow(rules, tokens + 1)) return "arming";
  if (tokens > Math.max(...rules.captureThresholds)) return "over";
  return "out";
}
