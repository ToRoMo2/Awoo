/**
 * Le preset de RUN du jalon 1 — la boucle de run jouable.
 *
 * Trois étapes, toutes en 2×6 (taille de plateau FIXE pour une run, décision D),
 * mais chacune sur une géométrie différente : le plateau se vide au fil de ses
 * deux manches et change de forme à l'étape suivante. Tous les chiffres du jeu
 * sont ici et nulle part dans le cœur.
 */

import type {
  MancheSpec,
  ModulePlacement,
  RunConfig,
  ShopConfig,
  StageBlueprint,
  StageSeeding,
} from "../core/index.js";
import { makeRegistry } from "../modules/index.js";
import {
  makeDoubleOutpostRing,
  makeOutpostRing,
  makeTwoRowRing,
  OUTPOST_POSITIONS,
} from "./board.js";
import { AWALE_RULES } from "./milestone0.js";
import type { CircuitConfig } from "../core/index.js";

/** Plafonds communs à toutes les étapes (mêmes garde-fous qu'au jalon 0). */
const CAPS = { maxReplaysPerTurn: 3, maxDropsPerTurn: 500 } as const;

/** Un amorçage seedé pour `playerNodes` Nœuds jouables, à densité ~4. */
function seeding(playerNodes: number): StageSeeding {
  return {
    initialTokens: {
      player: { total: playerNodes * 4, perNodeMin: 2, perNodeMax: 6 },
      neutral: 1,
    },
    ...CAPS,
  };
}

/** Petite puis grande manche : le quota monte, la géométrie reste (décision D). */
function manches(petit: number, grand: number): MancheSpec[] {
  return [
    { quota: petit, turnLimit: 15, label: "petite" },
    { quota: grand, turnLimit: 15, label: "grande" },
  ];
}

function stage(
  label: string,
  circuit: CircuitConfig,
  playerNodes: number,
  petit: number,
  grand: number,
  variants?: CircuitConfig[],
): StageBlueprint {
  return {
    label,
    circuit,
    ...(variants ? { variants } : {}),
    rules: AWALE_RULES,
    seeding: seeding(playerNodes),
    manches: manches(petit, grand),
  };
}

/**
 * La boutique du jalon 1. Prix et poids sont des PLACEHOLDERS — l'équilibrage
 * viendra du sim de runs complètes, une fois la boucle jouable. Le pool démarre
 * avec les 3 Modules existants ; le lot de Jetons est toujours dispo (décision E).
 */
const MILESTONE_1_SHOP: ShopConfig = {
  offerSize: 3,
  rerollCost: 2,
  modulePool: [
    { moduleId: "charge-plus-one", weight: 3, price: 4 },
    { moduleId: "charge-double", weight: 1, price: 8 },
    { moduleId: "replay", weight: 2, price: 6 },
  ],
  tokenPack: { amount: 3, price: 2 },
};

/**
 * Trois étapes de difficulté croissante. La montée vient à la fois du quota ET
 * de la géométrie : « double avant-poste » est naturellement plus tendu (moins
 * de matière, chaînes plus courtes).
 *
 * Quotas PLACEHOLDERS, volontairement bas : la 1ʳᵉ manche doit être gagnable
 * SANS Module (le build se construit ensuite à la boutique). Vrai équilibrage
 * reporté au sim de runs complètes (décision E).
 */
export function makeMilestone1Run(
  startingPlacements: ModulePlacement[] = [],
): RunConfig {
  return {
    stages: [
      stage("standard", makeTwoRowRing(6), 6, 15, 25),
      // La position de l'avant-poste varie d'une run à l'autre (pool seedé) :
      // finie la case bleue toujours au même endroit.
      stage("avant-poste", makeOutpostRing(), 7, 20, 32, OUTPOST_POSITIONS.map((p) => makeOutpostRing(p))),
      stage("double avant-poste", makeDoubleOutpostRing(), 8, 25, 40),
    ],
    economy: { startingMoney: 0, baseReward: 6, overshootDivisor: 8 },
    reseed: { tokensPerManche: 6 },
    shop: MILESTONE_1_SHOP,
    registry: makeRegistry(),
    startingPlacements,
  };
}
