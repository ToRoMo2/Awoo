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
 * dans la rangée neutre, au Nœud `position` (carnet §9 axe 4, playtest jalon 1).
 *
 * Conséquences :
 *  - la case n'est pas moissonnable → la chaîne s'y brise, scindant la Moisson
 *    en deux poches qu'aucune chaîne ne relie. Le grand balayage disparaît ;
 *  - mais elle est JOUABLE → au lieu d'un mur mort qui gaspille les Jetons,
 *    c'est une tête de pont : on peut y charger un coup et tirer dans les Nœuds
 *    suivants, sans router depuis la base.
 *
 * `position` est PARAMÉTRÉ pour varier d'une run à l'autre (le run en tire une
 * valeur au PRNG), ce qui casse la redondance repérée en playtest. Il doit être
 * un Nœud de la rangée neutre dont le successeur reste neutre (6 à 10 sur un
 * 2×6) — sinon la tête de pont tirerait dans la base.
 */
export function makeOutpostRing(position: NodeId = 9): CircuitConfig {
  const base = makeTwoRowRing(6);
  if (base.zones[position] !== NEUTRAL_ZONE) {
    throw new Error(`Avant-poste invalide : le Nœud ${position} n'est pas en Zone Neutre.`);
  }
  const zones = base.zones.slice();
  zones[position] = PLAYER_ZONE;
  return { ...base, zones };
}

/** Les positions d'avant-poste jouables sur un 2×6 : leur successeur reste neutre. */
export const OUTPOST_POSITIONS: NodeId[] = [6, 7, 8, 9, 10];

/**
 * Le plateau « grand » : un 2×8 (16 Nœuds), avec un avant-poste au Nœud 12.
 *
 * Teste le lever de l'avant-poste à une TAILLE différente. Circuit plus long
 * (§9 axe 4) : plus de trajet, donc plus de Charge potentielle, mais les poches
 * sont plus loin. Le Nœud 12 (joueur) scinde la rangée neutre en deux poches,
 * {8,9,10,11} et {13,14,15}, et sert de tête de pont sur la seconde.
 */
export function makeBigOutpostRing(): CircuitConfig {
  const base = makeTwoRowRing(8);
  const zones = base.zones.slice();
  zones[12] = PLAYER_ZONE;
  return { ...base, zones };
}

/**
 * Le plateau « double avant-poste » : le 2×6 standard avec DEUX cases joueur
 * dans la rangée neutre (Nœuds 6 et 9).
 *
 * Deux fronts symétriques : deux poches de deux Nœuds — {7,8} et {10,11} —
 * chacune précédée de son avant-poste (6 tire dans 7,8 ; 9 tire dans 10,11).
 * On peut opérer les deux fronts, ce qui change complètement le tempo.
 */
export function makeDoubleOutpostRing(): CircuitConfig {
  const base = makeTwoRowRing(6);
  const zones = base.zones.slice();
  zones[6] = PLAYER_ZONE;
  zones[9] = PLAYER_ZONE;
  return { ...base, zones };
}

/**
 * Le plateau « intercalé » : une case MOISSONNABLE posée au milieu de la base
 * du joueur (Nœud 2).
 *
 * Répond au « cases moissonnables au milieu de nos cases » du playtest. Un
 * cible de précision dans sa propre rangée (chaîne impossible dessus : elle est
 * isolée entre deux cases joueur), en plus de la rangée neutre restée intacte.
 * La rangée neutre garde son balayage — l'intérêt est d'AJOUTER une option de
 * micro-jeu, pas de casser l'ancienne.
 */
export function makeInterleavedRing(): CircuitConfig {
  const base = makeTwoRowRing(6);
  const zones = base.zones.slice();
  zones[2] = NEUTRAL_ZONE;
  return { ...base, zones };
}
