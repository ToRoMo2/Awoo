import type { ModuleDef } from "../core/index.js";

/**
 * Module de STRUCTURE (carnet §6.5) — la pierre angulaire du §6.6.
 *
 * Double la Charge accumulée jusqu'ici. Sa valeur dépend entièrement de sa
 * POSITION : après trois « +1 Charge », il double une grosse Charge ; avant
 * eux, il ne double presque rien.
 *
 * `oncePerSow` : un déclenchement par Distribution, pas par Jeton. Sinon
 * quatre Jetons déposés ici feraient ×16, et l'échelle de score partirait dès
 * le premier tour du jalon 0.
 *
 * Empilable, mais MULTIPLICATIF : au niveau N il fait ×2^N (×2, ×4, ×8…). La
 * puissance monte exponentiellement, donc son surcoût d'empilement aussi
 * (côté boutique).
 */
export const chargeDouble: ModuleDef = {
  id: "charge-double",
  label: "×2 Charge",
  trigger: "passage",
  oncePerSow: true,
  apply(context) {
    context.multiplyCharge(2 ** context.level);
  },
};
