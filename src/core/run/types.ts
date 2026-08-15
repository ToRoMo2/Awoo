/**
 * Les types de la boucle de RUN (jalon 1).
 *
 * Une couche PURE au-dessus de la manche : elle enchaîne les manches, tient
 * l'argent, le build et la boutique, et décide de la victoire ou de la défaite.
 * Comme le cœur, elle est jouable en CLI et simulable en batch — sans quoi on
 * ne pourrait pas équilibrer l'économie (carnet §15.2).
 *
 * Aucune valeur de jeu ici : quotas, récompenses, prix, dose de réensemencement
 * vivent dans src/presets/.
 */

import type { GameEvent } from "../events.js";
import type { ModuleRegistry } from "../modules/types.js";
import type {
  CircuitConfig,
  ModulePlacement,
  NodeId,
  RngState,
  RoundConfig,
  RoundState,
  RulesConfig,
} from "../types.js";

/** Le plateau d'une étape, hors quota/limite (ceux-là sont définis par manche). */
export type StageSeeding = Pick<
  RoundConfig,
  "initialTokens" | "maxReplaysPerTurn" | "maxDropsPerTurn"
>;

/** Une manche : un quota à atteindre dans une limite de tours. */
export interface MancheSpec {
  quota: number;
  turnLimit: number;
  label?: string;
}

/**
 * Une étape : une géométrie FIXE (le plateau se vide au fil de ses manches,
 * décision D du jalon 1), et la suite de manches jouées dessus.
 *
 * La TAILLE du plateau (nodeCount) est la même pour toutes les étapes d'une
 * run, sans quoi le build ne resterait pas valide d'une étape à l'autre. Seul
 * le layout des zones change.
 */
export interface StageBlueprint {
  label: string;
  circuit: CircuitConfig;
  /**
   * Variantes de géométrie de MÊME taille (nodeCount identique à `circuit`,
   * seul le layout des zones change). Si fournies, le run en tire UNE au PRNG à
   * l'entrée de l'étape, fixe pour toutes ses manches. C'est ce qui fait varier
   * la position d'une case spéciale d'une run à l'autre sans casser le build.
   */
  variants?: CircuitConfig[];
  rules: RulesConfig;
  seeding: StageSeeding;
  manches: MancheSpec[];
}

/** L'économie du run (décision A). La formule vit dans economy.ts, un seul endroit. */
export interface EconomyConfig {
  startingMoney: number;
  /** Récompense fixe d'une manche réussie. */
  baseReward: number;
  /** Bonus : 1 pièce par tranche de `overshootDivisor` points au-dessus du quota. */
  overshootDivisor: number;
}

/** Réensemencement partiel entre manches d'une même étape (décision B). */
export interface ReseedConfig {
  /** Jetons ajoutés à des Nœuds jouables tirés au sort entre deux manches. */
  tokensPerManche: number;
}

/** Un lot de Jetons vendu à la boutique (décision E). */
export interface TokenPack {
  amount: number;
  price: number;
}

/** Une entrée du pool de Modules : probabilité (poids), prix, et coût d'empilement. */
export interface ModulePoolEntry {
  moduleId: string;
  weight: number;
  /** Prix pour poser le Module (niveau 1) sur un Nœud vide. */
  price: number;
  /**
   * Surcoût pour EMPILER sur le même Module. Passer du niveau L à L+1 coûte
   * `stackBase × stackFactor^(L-1)`. Un effet linéaire (+1) prend un facteur
   * doux ; un effet multiplicatif (×2) prend un facteur élevé, car sa puissance
   * grimpe très vite (décision du jalon 1).
   */
  stackBase: number;
  stackFactor: number;
}

/** La boutique en données. Le pool de Modules et le lot de Jetons vivent ici. */
export interface ShopConfig {
  /** Nombre de Modules dans l'offre aléatoire. */
  offerSize: number;
  rerollCost: number;
  modulePool: ModulePoolEntry[];
  /** Les Jetons sont TOUJOURS disponibles, à prix fixe (décision E). */
  tokenPack: TokenPack;
}

/** Une étape SANS ses manches : géométrie + amorçage, réutilisable pour générer. */
export type StageTemplate = Omit<StageBlueprint, "manches">;

/**
 * La génération d'étapes AU-DELÀ des étapes écrites — le mode endless (façon
 * Balatro). Passé les étapes écrites, le run cycle ce pool de géométries et
 * fait monter le quota par la même formule, indéfiniment, jusqu'à la défaite.
 * La « distance » atteinte devient le score de la run.
 */
export interface EndlessConfig {
  pool: StageTemplate[];
  quotaBase: number;
  quotaGrowth: number;
  manchesPerStage: number;
  turnLimit: number;
}

export interface RunConfig {
  stages: StageBlueprint[];
  /** Si présent, le run ne s'arrête jamais par épuisement : il génère à l'infini. */
  endless?: EndlessConfig;
  economy: EconomyConfig;
  reseed: ReseedConfig;
  shop: ShopConfig;
  registry: ModuleRegistry;
  /** Le build au départ. Vide en run normale : le build se construit à la boutique. */
  startingPlacements: ModulePlacement[];
}

/** Un Module proposé à l'achat. `sold` reste dans l'offre pour ne pas bouger les index. */
export interface OfferedModule {
  moduleId: string;
  price: number;
  sold: boolean;
}

/** L'offre courante de la boutique : Modules tirés au sort + lot de Jetons + reroll. */
export interface ShopOffer {
  modules: OfferedModule[];
  tokenPack: TokenPack;
  rerollCost: number;
}

export type RunPhase = "playing" | "shop" | "won" | "lost";
export type RunOutcome = "won" | "lost";

export interface RunState {
  readonly config: RunConfig;
  money: number;
  stageIndex: number;
  mancheIndex: number;
  /**
   * La manche en cours de jeu, OU — pendant la boutique — la manche déjà
   * PRÉPARÉE (plateau conservé + réensemencé, ou plateau neuf) que le joueur
   * s'apprête à jouer. C'est ce plateau qu'il voit pour décider ses achats.
   */
  round: RoundState;
  /** L'offre de boutique, non nulle seulement en phase "shop". */
  offer: ShopOffer | null;
  /** Le build : les Modules posés, portés toute la run (décision C). */
  placements: ModulePlacement[];
  phase: RunPhase;
  outcome: RunOutcome | null;
  /** PRNG du run (réensemencement, graines des plateaux, offre de boutique). */
  rng: RngState;
}

/** Pourquoi un achat a été refusé — annoncé, jamais silencieux (cf. carnet §13.2). */
export type PurchaseDenyReason = "money" | "occupied" | "sold" | "invalid-node";

/** Un coup au niveau run : jouer, acheter, ou lancer la manche préparée. */
export type RunAction =
  | { type: "sow"; node: NodeId }
  | { type: "buy-module"; slot: number; node: NodeId }
  | { type: "buy-tokens"; node: NodeId }
  | { type: "reroll" }
  | { type: "start-manche" };

/**
 * Le flux ordonné du run. Il ENVELOPPE les événements de la manche
 * (MANCHE_EVENT) et intercale des marqueurs de run : la présentation le rejoue
 * tel quel, comme aujourd'hui pour la manche.
 */
export type RunEvent =
  | { type: "MANCHE_STARTED"; stage: number; manche: number; quota: number; geometry: string }
  | { type: "MANCHE_CLEARED"; score: number; quota: number; reward: number }
  | { type: "MONEY_CHANGED"; from: number; to: number; cause: string }
  | { type: "STAGE_CLEARED"; stage: number }
  | { type: "SHOP_OPENED"; money: number }
  | { type: "MODULE_BOUGHT"; moduleId: string; node: NodeId; price: number; level: number }
  | { type: "TOKENS_BOUGHT"; amount: number; node: NodeId; price: number }
  | { type: "REROLLED"; cost: number }
  | { type: "PURCHASE_DENIED"; reason: PurchaseDenyReason }
  | { type: "RUN_WON"; money: number }
  | { type: "RUN_LOST"; stage: number; manche: number }
  | { type: "MANCHE_EVENT"; event: GameEvent };
