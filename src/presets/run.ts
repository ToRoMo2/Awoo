/**
 * Le preset de RUN du jalon 1 — la boucle de run jouable.
 *
 * Trois étapes, toutes en 2×6 (taille de plateau FIXE pour une run, décision D),
 * mais chacune sur une géométrie différente : le plateau se vide au fil de ses
 * deux manches et change de forme à l'étape suivante. Tous les chiffres du jeu
 * sont ici et nulle part dans le cœur.
 */

import type {
  ModulePlacement,
  RunConfig,
  ShopConfig,
  StageBlueprint,
  StageSeeding,
  StageTemplate,
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

/**
 * Le quota grandit selon une FORMULE, jamais une liste tapée à la main : un
 * seul curseur — la croissance — règle toute la difficulté d'une run, et
 * prépare des runs potentiellement infinies (l'endless de Balatro). `base` et
 * `growth` sont des PLACEHOLDERS, à régler au sim/playtest.
 *
 * Croissance monotone sur tout le run : la petite manche d'une étape est plus
 * dure que la grande de la précédente. La 1ʳᵉ manche reste basse, gagnable sans
 * Module (le build se construit à la boutique).
 */
const QUOTA_BASE = 12;
const QUOTA_GROWTH = 1.28;
const quotaFor = (mancheIndex: number): number =>
  Math.round(QUOTA_BASE * Math.pow(QUOTA_GROWTH, mancheIndex));

interface StageDef {
  label: string;
  circuit: CircuitConfig;
  playerNodes: number;
  variants?: CircuitConfig[];
}

/**
 * Les étapes, hors quotas (fournis par la formule). La montée de difficulté
 * vient à la fois du quota ET de la géométrie : « double avant-poste » est
 * naturellement plus tendu (moins de matière, chaînes plus courtes).
 */
const STAGE_DEFS: StageDef[] = [
  { label: "standard", circuit: makeTwoRowRing(6), playerNodes: 6 },
  // La position de l'avant-poste varie d'une run à l'autre (pool seedé) :
  // finie la case bleue toujours au même endroit.
  {
    label: "avant-poste",
    circuit: makeOutpostRing(),
    playerNodes: 7,
    variants: OUTPOST_POSITIONS.map((p) => makeOutpostRing(p)),
  },
  { label: "double avant-poste", circuit: makeDoubleOutpostRing(), playerNodes: 8 },
];

/** Une géométrie sans ses manches — sert aux étapes écrites ET au pool endless. */
const templateOf = (def: StageDef): StageTemplate => ({
  label: def.label,
  circuit: def.circuit,
  ...(def.variants ? { variants: def.variants } : {}),
  rules: AWALE_RULES,
  seeding: seeding(def.playerNodes),
});

const MANCHES_PER_STAGE = 2;
const TURN_LIMIT = 15;

/**
 * La boutique du jalon 1. Prix et poids sont des PLACEHOLDERS — l'équilibrage
 * viendra du sim de runs complètes, une fois la boucle jouable. Le pool démarre
 * avec les 3 Modules existants ; le lot de Jetons est toujours dispo (décision E).
 */
const MILESTONE_1_SHOP: ShopConfig = {
  offerSize: 3,
  rerollCost: 2,
  modulePool: [
    // +1 : puissance linéaire → empilement à surcoût DOUX.
    { moduleId: "charge-plus-one", weight: 3, price: 4, stackBase: 3, stackFactor: 1.4 },
    // ×2 : puissance qui double → empilement à surcoût STEEP (×2 sur ×4 coûte cher).
    { moduleId: "charge-double", weight: 1, price: 8, stackBase: 6, stackFactor: 2 },
    { moduleId: "replay", weight: 2, price: 6, stackBase: 5, stackFactor: 1.6 },
  ],
  tokenPack: { amount: 3, price: 2 },
};

export function makeMilestone1Run(
  startingPlacements: ModulePlacement[] = [],
): RunConfig {
  let manche = 0;
  const stages: StageBlueprint[] = STAGE_DEFS.map((def) => ({
    ...templateOf(def),
    manches: [
      { quota: quotaFor(manche++), turnLimit: TURN_LIMIT, label: "petite" },
      { quota: quotaFor(manche++), turnLimit: TURN_LIMIT, label: "grande" },
    ],
  }));

  return {
    stages,
    // Endless : passé les 3 étapes écrites, on cycle les mêmes géométries et le
    // quota continue de monter par la MÊME formule. Le run ne s'arrête que sur
    // une défaite ; la distance atteinte est le score (façon Balatro).
    endless: {
      pool: STAGE_DEFS.map(templateOf),
      quotaBase: QUOTA_BASE,
      quotaGrowth: QUOTA_GROWTH,
      manchesPerStage: MANCHES_PER_STAGE,
      turnLimit: TURN_LIMIT,
    },
    economy: { startingMoney: 0, baseReward: 6, overshootDivisor: 8 },
    reseed: { tokensPerManche: 6 },
    shop: MILESTONE_1_SHOP,
    registry: makeRegistry(),
    startingPlacements,
  };
}
