/**
 * Types du cœur de règles.
 *
 * Règle absolue : aucune valeur de jeu n'est écrite dans src/core/.
 * Le nombre de Nœuds, le seuil de capture, la longueur du Circuit, le quota —
 * tout arrive par GameConfig. Les presets vivent dans src/presets/.
 */

import type { ModuleRegistry } from "./modules/types.js";

/** Index d'un Nœud dans le tableau des Nœuds. */
export type NodeId = number;

/**
 * Territoire d'un Nœud. Volontairement une chaîne libre et non une énumération :
 * l'axe 4 de rejouabilité (carnet §9) prévoit des plateaux à plus de deux zones.
 */
export type ZoneId = string;

/** Position purement visuelle d'un Nœud. Le cœur ne s'en sert jamais. */
export interface NodeLayout {
  row: number;
  col: number;
}

/**
 * La topologie du Circuit, entièrement en données.
 * Changer de plateau (2×8, 4×8, circuit en huit) = fournir un autre objet.
 */
export interface CircuitConfig {
  nodeCount: number;
  /** successors[i] = le Nœud qui suit le Nœud i. Encode le sens de rotation. */
  successors: NodeId[];
  /** zones[i] = le territoire du Nœud i. */
  zones: ZoneId[];
  layout: NodeLayout[];
}

/** Les règles cassables. Chaque champ est une surface d'attaque pour un Module. */
export interface RulesConfig {
  /** Totaux qui rendent un Nœud moissonnable (Awalé : 2 et 3). */
  captureThresholds: number[];
  /** Territoires où la Moisson est autorisée. */
  harvestableZones: ZoneId[];
  /** Territoires depuis lesquels le joueur peut lancer une Distribution. */
  playableZones: ZoneId[];
  /** La chaîne s'arrête-t-elle en sortant d'une zone moissonnable ? */
  chainBreaksOnZoneExit: boolean;
  /** Le Nœud d'origine est-il sauté pendant la Distribution ? (carnet §3.2) */
  skipOriginOnSow: boolean;
  /** Valeur de la Charge au début de chaque tour. */
  baseCharge: number;
  /** Valeur d'un Jeton pour le calcul de la Moisson (carnet §5.1). */
  tokenValue: number;
}

/**
 * Répartition aléatoire — mais SEEDÉE — d'un total de Jetons sur les Nœuds
 * d'une zone.
 *
 * Le `total` est fixe : seule la FORME varie d'une graine à l'autre. La matière
 * reste constante d'une manche à l'autre, donc aucune dérive d'équilibrage —
 * seule l'ouverture change, ce qui casse le « même puzzle à chaque manche »
 * (carnet §13.1) sans toucher à la planification.
 *
 * `perNodeMax` encode EN DONNÉE le garde-fou §7.2 : côté Zone Neutre, il borne
 * chaque Nœud sous la fenêtre de capture pour qu'aucun ne démarre moissonnable.
 */
export interface SeedingSpec {
  /** Nombre total de Jetons à répartir sur les Nœuds de la zone. */
  total: number;
  /** Minimum garanti par Nœud. */
  perNodeMin: number;
  /** Maximum autorisé par Nœud (garde-fou §7.2 pour la Zone Neutre). */
  perNodeMax: number;
}

/**
 * Amorçage d'une zone : soit un nombre FIXE de Jetons par Nœud (déterministe,
 * comportement historique), soit une SeedingSpec répartie par le PRNG seedé.
 */
export type ZoneSeeding = number | SeedingSpec;

/** Les paramètres d'une manche. */
export interface RoundConfig {
  quota: number;
  turnLimit: number;
  /**
   * Jetons présents au départ : un nombre uniforme pour tout le plateau, ou un
   * amorçage par territoire — chaque zone recevant soit un nombre fixe par
   * Nœud, soit une SeedingSpec tirée au sort.
   *
   * Le découpage par zone n'est pas cosmétique. La Zone Neutre n'est jamais
   * jouée par personne, donc rien ne la vide tant qu'aucune Moisson n'a eu
   * lieu : ses compteurs ne font que MONTER. Si elle démarre au-dessus de la
   * fenêtre de capture, aucune Moisson n'est possible, et comme seules les
   * Moissons marquent, la manche entière vaut zéro. L'amorçage est donc un
   * paramètre de règle, pas un détail de mise en place.
   */
  initialTokens: number | Record<ZoneId, ZoneSeeding>;
  /** Plafond dur sur les Rejouer d'un même tour (carnet §13.2). */
  maxReplaysPerTurn: number;
  /** Filet de sécurité : nombre max de Jetons déposés dans un tour. */
  maxDropsPerTurn: number;
}

/** Un Module posé sur un Nœud. */
export interface ModulePlacement {
  nodeId: NodeId;
  moduleId: string;
}

export interface GameConfig {
  circuit: CircuitConfig;
  rules: RulesConfig;
  round: RoundConfig;
  /**
   * Le catalogue des Modules jouables. Injecté, jamais codé dans le moteur :
   * c'est ce qui permet d'ajouter un Module sans toucher au cœur.
   */
  registry: ModuleRegistry;
  placements: ModulePlacement[];
}

export interface NodeState {
  /**
   * Jalon 0 : un compteur suffit. L'axe 2 de rejouabilité (Jetons typés)
   * remplacera ce champ par un tableau, ce qui touchera sow.ts et harvest.ts.
   */
  tokens: number;
  moduleId: string | null;
}

/** État sérialisable du générateur pseudo-aléatoire. */
export interface RngState {
  seed: number;
  cursor: number;
}

export type RoundPhase = "awaiting-move" | "ended";

export type RoundOutcome = "quota-reached" | "turns-exhausted" | "deadlock";

export interface RoundState {
  readonly config: GameConfig;
  nodes: NodeState[];
  /** Le multiplicateur du tour en cours. */
  charge: number;
  score: number;
  /** Nombre de tours consommés. Un Rejouer ne consomme pas de tour. */
  turn: number;
  replaysUsed: number;
  /** Le joueur a gagné un Rejouer : il reprend la main dans le même tour. */
  replayPending: boolean;
  /** Jetons déposés depuis le début du tour, toutes Distributions confondues. */
  dropsThisTurn: number;
  /** Points marqués depuis le début du tour, tous Rejouer confondus. */
  gainedThisTurn: number;
  phase: RoundPhase;
  outcome: RoundOutcome | null;
  rng: RngState;
  /** Mémoire privée des Modules, indexée par Nœud. Opaque au moteur. */
  moduleMemory: Record<string, unknown>;
}

/** Un coup. Union discriminée pour rester extensible. */
export type Move = { type: "sow"; node: NodeId };
