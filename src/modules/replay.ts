import type { ModuleDef } from "../core/index.js";

/**
 * Module de DESTINATION (carnet §6.2) — la règle 1 du Kalah (§3.6),
 * transformée en objet.
 *
 * Si le dernier Jeton s'arrête ici, le joueur rejoue. Le tour n'est PAS
 * consommé : la Charge et les compteurs sont conservés, ce qui rend le build
 * de tempo possible (§5.2).
 *
 * Le Rejouer ne relance rien tout seul : il rend la main au joueur, qui doit
 * choisir un nouveau point de départ. C'est cette contrainte qui rend la
 * boucle infinie structurellement impossible.
 *
 * Empilable : au niveau N il accorde N Rejouer (chacun soumis au plafond du
 * tour, qui reste le garde-fou anti-boucle).
 */
export const replay: ModuleDef = {
  id: "replay",
  label: "Rejouer",
  trigger: "destination",
  oncePerSow: true,
  apply(context) {
    for (let i = 0; i < context.level; i++) context.grantReplay();
  },
};
