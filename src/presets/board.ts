/**
 * Fabriques de plateaux.
 *
 * Tout ce qui est ici est de la DONNÉE : le cœur ne contient aucun de ces
 * nombres. Changer de géométrie (2×8, 4×8, circuit en huit — carnet §9, axe 4)
 * se fait en ajoutant une fabrique ici, sans toucher aux règles.
 */

import type { CircuitConfig, NodeId, NodeLayout, ZoneId } from "../core/index.js";

export const PLAYER_ZONE: ZoneId = "player";
export const NEUTRAL_ZONE: ZoneId = "neutral";

/**
 * Le plateau de l'Awalé : deux rangées, un anneau unique.
 *
 * Indexation, pour `columns = 6` (carnet §3.1) :
 *
 *   index   0 1 2 3 4 5  = A B C D E F  — camp du joueur (rangée du bas)
 *   index   6 7 8 9 10 11 = a b c d e f — Zone Neutre    (rangée du haut)
 *
 * Le Circuit est UNE SEULE BOUCLE : A → B → … → F → a → b → … → f → A.
 *
 * Le layout inverse la rangée du haut, pour que le sens de circulation se lise
 * comme une boucle antihoraire à l'écran, conformément au schéma du carnet.
 */
export function makeTwoRowRing(columns: number): CircuitConfig {
  if (!Number.isInteger(columns) || columns <= 0) {
    throw new Error("Plateau invalide : columns doit être un entier positif.");
  }

  const nodeCount = columns * 2;
  const successors: NodeId[] = Array.from(
    { length: nodeCount },
    (_, node) => (node + 1) % nodeCount,
  );

  const zones: ZoneId[] = Array.from({ length: nodeCount }, (_, node) =>
    node < columns ? PLAYER_ZONE : NEUTRAL_ZONE,
  );

  const layout: NodeLayout[] = Array.from({ length: nodeCount }, (_, node) =>
    node < columns
      ? { row: 1, col: node }
      : { row: 0, col: columns - 1 - (node - columns) },
  );

  return { nodeCount, successors, zones, layout };
}

/**
 * Le plateau « avant-poste » : le 2×6 standard, PLUS une case du JOUEUR posée
 * au milieu de la rangée neutre (carnet §9 axe 4, playtest du jalon 1).
 *
 * Un seul paramètre change par rapport à makeTwoRowRing : le Nœud 9 passe en
 * PLAYER_ZONE. Conséquences :
 *  - il n'est pas moissonnable → la chaîne s'y brise, scindant la Moisson en
 *    deux poches — {6,7,8} et {10,11} — qu'aucune chaîne ne relie. Le grand
 *    balayage d'un seul coup disparaît ;
 *  - mais il est JOUABLE → au lieu d'un mur mort qui gaspille les Jetons, c'est
 *    une tête de pont : on peut y charger un coup et tirer dans les 2 Nœuds
 *    suivants (la poche {10,11}), sans router depuis la base.
 *
 * C'est de la DONNÉE : un plateau conçu à la main, pas une règle du cœur.
 */
export function makeOutpostRing(): CircuitConfig {
  const base = makeTwoRowRing(6);
  const zones = base.zones.slice();
  zones[9] = PLAYER_ZONE;
  return { ...base, zones };
}
