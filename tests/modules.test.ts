import { describe, expect, it } from "vitest";
import { applyMove, eventsOfType, type ModuleDef } from "../src/core/index.js";
import { makeRegistry, MODULES } from "../src/modules/index.js";
import { N, roundWithTokens } from "./helpers.js";

describe("Modules", () => {
  describe("+1 Charge (passage)", () => {
    it("ajoute 1 Charge par Jeton déposé", () => {
      // F distribue 3 Jetons ; a porte le Module, mais un seul Jeton s'y pose.
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "charge-plus-one" }],
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

      expect(eventsOfType(events, "CHARGE_CHANGED").map((e) => [e.from, e.to])).toEqual([
        [1, 2],
      ]);
      expect(after.charge).toBe(2);
    });

    it("se déclenche une fois par Jeton, pas une fois par Distribution", () => {
      // A distribue 8 Jetons : le Circuit fait presque un tour, et a en reçoit
      // deux (le 6e et, après le tour, aucun — donc un seul ici).
      // On force le cas en posant le Module sur B, qui reçoit 2 Jetons.
      //                        A   B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], {
        placements: [{ nodeId: N.B, moduleId: "charge-plus-one" }],
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.A });

      // B reçoit deux Jetons → deux déclenchements
      const fired = eventsOfType(events, "MODULE_TRIGGERED").filter(
        (e) => e.node === N.B,
      );
      expect(fired).toHaveLength(2);
      expect(after.charge).toBe(3);
    });
  });

  describe("×2 Charge (structure)", () => {
    it("double la Charge accumulée jusqu'ici", () => {
      // Trajet : a (+1), b (+1), c (×2). Charge 1 → 2 → 3 → 6.
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0], {
        placements: [
          { nodeId: N.a, moduleId: "charge-plus-one" },
          { nodeId: N.b, moduleId: "charge-plus-one" },
          { nodeId: N.c, moduleId: "charge-double" },
        ],
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

      expect(eventsOfType(events, "CHARGE_CHANGED").map((e) => e.to)).toEqual([2, 3, 6]);
      expect(after.charge).toBe(6);

      // c passe à 2 : Moisson de 2, puis la chaîne casse sur b (1 Jeton).
      expect(eventsOfType(events, "SCORE_COMPUTED")[0]).toMatchObject({
        harvest: 2,
        charge: 6,
        gained: 12,
      });
    });

    /** Carnet §6.6 : la position vaut autant que l'effet. */
    it("ne double presque rien s'il est placé AVANT les +1 Charge", () => {
      // Même trajet, ordre inversé : c (×2) d'abord... mais le trajet va
      // a → b → c, donc on met le ×2 en tête.
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const placements = [
        { nodeId: N.a, moduleId: "charge-double" },
        { nodeId: N.b, moduleId: "charge-plus-one" },
        { nodeId: N.c, moduleId: "charge-plus-one" },
      ];
      const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0], {
        placements,
      });

      const { state: after } = applyMove(state, { type: "sow", node: N.F });

      // 1 → 2 → 3 → 4, contre 6 dans l'autre sens. Le placement est le puzzle.
      expect(after.charge).toBe(4);
    });

    it("ne se déclenche qu'une fois par Distribution, même sur plusieurs Jetons", () => {
      // B reçoit deux Jetons ; sans oncePerSow la Charge ferait ×4.
      //                        A   B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], {
        placements: [{ nodeId: N.B, moduleId: "charge-double" }],
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.A });

      expect(eventsOfType(events, "MODULE_TRIGGERED")).toHaveLength(1);
      expect(after.charge).toBe(2);
    });
  });

  describe("Empilement (niveau)", () => {
    it("+1 Charge au niveau 2 ajoute +2 par Jeton déposé", () => {
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "charge-plus-one", level: 2 }],
      });

      const { state: after } = applyMove(state, { type: "sow", node: N.F });
      // a reçoit 1 Jeton → +2 (niveau 2). Charge 1 → 3.
      expect(after.charge).toBe(3);
    });

    it("×2 Charge au niveau 2 fait ×4", () => {
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "charge-double", level: 2 }],
      });

      const { state: after } = applyMove(state, { type: "sow", node: N.F });
      // Charge 1 → ×2^2 = 4.
      expect(after.charge).toBe(4);
    });

    it("un placement sans niveau se comporte comme un niveau 1", () => {
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "charge-plus-one" }],
      });

      const { state: after } = applyMove(state, { type: "sow", node: N.F });
      expect(after.charge).toBe(2);
    });
  });

  describe("Rejouer (destination)", () => {
    it("rend la main au joueur sans consommer de tour", () => {
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "replay" }],
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

      expect(eventsOfType(events, "REPLAY_GRANTED")[0]).toMatchObject({
        node: N.a,
        used: 1,
        max: 3,
      });
      expect(after.replayPending).toBe(true);
      expect(after.turn).toBe(0);
      expect(eventsOfType(events, "TURN_ENDED")).toHaveLength(0);
    });

    it("ne se déclenche pas quand le Nœud n'est que traversé", () => {
      // Le dernier Jeton dépasse a : le Module de destination reste muet.
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "replay" }],
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

      expect(eventsOfType(events, "MODULE_TRIGGERED")).toHaveLength(0);
      expect(after.replayPending).toBe(false);
      expect(after.turn).toBe(1);
    });

    it("conserve la Charge d'une Distribution à l'autre dans le même tour", () => {
      // Tour 1 : E traverse F (+1) puis s'arrête sur a (Rejouer).
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const state = roundWithTokens([0, 0, 0, 2, 2, 0, 0, 0, 0, 0, 0, 0], {
        placements: [
          { nodeId: N.F, moduleId: "charge-plus-one" },
          { nodeId: N.a, moduleId: "replay" },
        ],
      });

      const first = applyMove(state, { type: "sow", node: N.E });
      expect(first.state.charge).toBe(2);
      expect(first.state.replayPending).toBe(true);

      // Le Rejouer prolonge le tour : la Charge n'est pas remise à 1.
      const second = applyMove(first.state, { type: "sow", node: N.D });
      expect(eventsOfType(second.events, "TURN_STARTED")).toHaveLength(0);
      expect(second.state.charge).toBe(3);
      expect(second.state.turn).toBe(1);
    });

    it("refuse le Rejouer au-delà du plafond, et l'annonce", () => {
      //                        A  B  C  D  E  F  a  b  c  d  e  f
      const placements = [{ nodeId: N.a, moduleId: "replay" }];
      let state = roundWithTokens([1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0], {
        placements,
      });

      // Trois Rejouer accordés, puis un quatrième refusé.
      const granted: number[] = [];
      let denied = 0;
      for (const node of [N.F, N.F, N.F, N.F]) {
        // On réarme F à chaque itération pour rejouer le même trajet.
        state.nodes[N.F]!.tokens = 1;
        state.nodes[N.a]!.tokens = 0;
        const result = applyMove(state, { type: "sow", node });
        state = result.state;
        granted.push(...eventsOfType(result.events, "REPLAY_GRANTED").map((e) => e.used));
        denied += eventsOfType(result.events, "REPLAY_DENIED").length;
      }

      expect(granted).toEqual([1, 2, 3]);
      expect(denied).toBe(1);
      expect(state.replayPending).toBe(false);
      expect(state.turn).toBe(1);
    });
  });

  describe("Le cœur ne connaît aucun Module", () => {
    /**
     * Le vrai test de la règle n°3 : un Module inventé ici, jamais vu par le
     * moteur, doit fonctionner sans qu'une ligne du cœur ait changé.
     */
    it("exécute un Module défini hors du catalogue du jeu", () => {
      const invented: ModuleDef = {
        id: "test-charge-x10",
        label: "×10 Charge",
        trigger: "passage",
        oncePerSow: true,
        apply(context) {
          context.multiplyCharge(10);
          context.note({ note: "bonjour" });
        },
      };

      const state = roundWithTokens([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: invented.id }],
        registry: makeRegistry([...MODULES, invented]),
      });

      const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

      expect(after.charge).toBe(10);
      expect(eventsOfType(events, "MODULE_TRIGGERED")[0]).toMatchObject({
        moduleId: "test-charge-x10",
        detail: { note: "bonjour" },
      });
      expect(after.score).toBe(20);
    });

    it("refuse un Module absent du catalogue", () => {
      const state = roundWithTokens([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0], {
        placements: [{ nodeId: N.a, moduleId: "module-fantome" }],
      });

      expect(() => applyMove(state, { type: "sow", node: N.F })).toThrow(/inconnu/i);
    });

    it("refuse deux Modules de même identifiant dans le catalogue", () => {
      expect(() => makeRegistry([...MODULES, MODULES[0]!])).toThrow(/identifiant/);
    });
  });

  it("émet MODULE_TRIGGERED avant ses conséquences", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0], {
      placements: [{ nodeId: N.a, moduleId: "charge-plus-one" }],
    });

    const { events } = applyMove(state, { type: "sow", node: N.F });
    const types = events.map((e) => e.type);

    expect(types.indexOf("MODULE_TRIGGERED")).toBeLessThan(
      types.indexOf("CHARGE_CHANGED"),
    );
    // Le clac vient avant l'effet : on voit le Jeton se poser, puis le Nœud réagir.
    expect(types.indexOf("TOKEN_DROPPED")).toBeLessThan(
      types.indexOf("MODULE_TRIGGERED"),
    );
  });
});
