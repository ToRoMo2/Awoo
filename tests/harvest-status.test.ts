/**
 * La lecture de la fenêtre de capture.
 *
 * Le rendu s'appuie dessus pour marquer les Nœuds (carnet §13.3). C'est une
 * règle, donc elle est testée ici et pas réimplémentée dans la présentation.
 */

import { describe, expect, it } from "vitest";
import { harvestStatusOf } from "../src/core/index.js";
import { N, roundWithTokens } from "./helpers.js";

describe("État de Moisson d'un Nœud", () => {
  it("marque les Nœuds neutres dans la fenêtre de capture", () => {
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([2, 3, 0, 0, 0, 0, 2, 3, 1, 4, 0, 5]);

    expect(harvestStatusOf(state, N.a)).toBe("ready");
    expect(harvestStatusOf(state, N.b)).toBe("ready");
  });

  it("marque comme « arming » un Nœud qu'un seul Jeton amènerait dans la fenêtre", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 0, 2, 3, 1, 4, 0, 5]);

    // 1 + 1 = 2, qui est un seuil.
    expect(harvestStatusOf(state, N.c)).toBe("arming");
    // 0 + 1 = 1, qui n'en est pas un.
    expect(harvestStatusOf(state, N.e)).toBe("out");
  });

  it("marque « over » les Nœuds neutres au-dessus de la fenêtre", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 0, 2, 3, 1, 4, 0, 5]);

    // Au-dessus du seuil (4, 5) : en hausse, récupérable seulement en chaîne.
    expect(harvestStatusOf(state, N.d)).toBe("over");
    expect(harvestStatusOf(state, N.f)).toBe("over");
    // En DESSOUS de la fenêtre (0) reste « out », pas « over » : ce n'est pas
    // condamné, juste pas encore armé.
    expect(harvestStatusOf(state, N.e)).toBe("out");
  });

  /** Le camp du joueur n'est jamais moissonnable, quel que soit son contenu. */
  it("ne marque jamais un Nœud du camp du joueur", () => {
    const state = roundWithTokens([2, 3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    for (const node of [N.A, N.B, N.C]) {
      expect(harvestStatusOf(state, node)).toBe("out");
    }
  });

  it("accepte un contenu imposé, pour suivre l'affichage pendant une animation", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 0, 9, 0, 0, 0, 0, 0]);

    expect(harvestStatusOf(state, N.a)).toBe("over");
    // Ce que l'écran affiche encore, alors que le cœur a déjà fini.
    expect(harvestStatusOf(state, N.a, 2)).toBe("ready");
    expect(harvestStatusOf(state, N.a, 1)).toBe("arming");
  });

  /** Un Module qui élargit le seuil doit déplacer le marquage sans le toucher. */
  it("suit le seuil de capture défini par la configuration", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 0, 4, 3, 0, 0, 0, 0]);
    expect(harvestStatusOf(state, N.a)).toBe("over");

    const widened = {
      ...state,
      config: {
        ...state.config,
        rules: { ...state.config.rules, captureThresholds: [2, 3, 4] },
      },
    };
    expect(harvestStatusOf(widened, N.a)).toBe("ready");
    // 3 devient « arming » pour 4, tout en restant lui-même un seuil.
    expect(harvestStatusOf(widened, N.b)).toBe("ready");
  });
});
