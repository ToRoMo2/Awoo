/**
 * PRNG seedé (mulberry32).
 *
 * Le cœur n'appelle jamais Math.random : l'aléatoire vit dans l'état, donc une
 * partie se rejoue à l'identique depuis sa graine. Indispensable pour tester
 * et pour équilibrer par simulation en batch (carnet §15.2).
 *
 * Inutilisé au jalon 0 — mais en place, pour que le premier Module aléatoire
 * n'ait rien à casser.
 */

import type { RngState } from "./types.js";

export function createRng(seed: number): RngState {
  return { seed: seed >>> 0, cursor: 0 };
}

/** Avance l'état et renvoie un flottant dans [0, 1). Mute `rng`. */
export function nextFloat(rng: RngState): number {
  rng.cursor = (rng.cursor + 1) >>> 0;
  let t = (rng.seed + rng.cursor * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Entier dans [0, bound). */
export function nextInt(rng: RngState, bound: number): number {
  return Math.floor(nextFloat(rng) * bound);
}
