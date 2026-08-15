/**
 * Le catalogue des Modules.
 *
 * Hors du cœur, volontairement : le moteur exécute le contrat ModuleDef sans
 * jamais connaître un identifiant. Ajouter un Module = un fichier ici + une
 * ligne dans MODULES. Le cœur ne bouge pas.
 *
 * Objectif à terme : 150+ Modules (carnet §9, axe 1).
 */

import type { ModuleDef, ModuleRegistry } from "../core/index.js";
import { chargeDouble } from "./charge-double.js";
import { chargePlusOne } from "./charge-plus-one.js";
import { replay } from "./replay.js";

/** Les trois Modules du jalon 0 (carnet §14). */
export const MODULES: readonly ModuleDef[] = [chargePlusOne, chargeDouble, replay];

export function makeRegistry(modules: readonly ModuleDef[] = MODULES): ModuleRegistry {
  const registry = new Map<string, ModuleDef>();
  for (const module of modules) {
    if (registry.has(module.id)) {
      throw new Error(`Deux Modules partagent l'identifiant « ${module.id} ».`);
    }
    registry.set(module.id, module);
  }
  return registry;
}

export { chargeDouble, chargePlusOne, replay };
