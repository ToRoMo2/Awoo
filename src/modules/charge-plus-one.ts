import type { ModuleDef } from "../core/index.js";

/**
 * Module de PASSAGE (carnet §6.1).
 *
 * +1 Charge par Jeton déposé sur ce Nœud. L'effet est linéaire, donc il se
 * déclenche à chaque Jeton : quatre Jetons, quatre clacs, +4 Charge.
 *
 * C'est le Module « plancher » du jalon 0 : il ne casse aucune règle, mais il
 * sert de matière première aux multiplicateurs placés en aval (carnet §6.6).
 */
export const chargePlusOne: ModuleDef = {
  id: "charge-plus-one",
  label: "+1 Charge",
  trigger: "passage",
  oncePerSow: false,
  apply(context) {
    context.addCharge(1);
  },
};
