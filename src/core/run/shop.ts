/**
 * La boutique — génération de l'offre (pur).
 *
 * L'offre de Modules est tirée d'un POOL en données (poids/prix) par le PRNG
 * seedé : ajouter un Module au catalogue ne touche pas ce fichier. Le lot de
 * Jetons, lui, est toujours disponible à prix fixe (décision E du jalon 1).
 *
 * La logique d'ACHAT (dépenser, poser, refuser) vit dans run.ts, car elle mute
 * l'état du run ; ici on ne fait que produire et copier une offre.
 */

import { nextFloat } from "../rng.js";
import type { RngState } from "../types.js";
import type { ModulePoolEntry, ShopConfig, ShopOffer } from "./types.js";

export function generateOffer(shop: ShopConfig, rng: RngState): ShopOffer {
  const modules = Array.from({ length: shop.offerSize }, () => {
    const entry = weightedPick(shop.modulePool, rng);
    return { moduleId: entry.moduleId, price: entry.price, sold: false };
  });
  return { modules, tokenPack: { ...shop.tokenPack }, rerollCost: shop.rerollCost };
}

/** Tire une entrée du pool proportionnellement à son poids. */
function weightedPick(pool: ModulePoolEntry[], rng: RngState): ModulePoolEntry {
  if (pool.length === 0) throw new Error("Pool de boutique vide.");
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = nextFloat(rng) * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll < 0) return entry;
  }
  return pool[pool.length - 1]!;
}

/** Copie profonde de l'offre : le run ne mute jamais l'offre reçue en entrée. */
export function cloneOffer(offer: ShopOffer): ShopOffer {
  return {
    modules: offer.modules.map((module) => ({ ...module })),
    tokenPack: { ...offer.tokenPack },
    rerollCost: offer.rerollCost,
  };
}
