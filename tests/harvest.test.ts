import { describe, expect, it } from "vitest";
import { applyMove, eventsOfType } from "../src/core/index.js";
import { N, roundWithTokens, tokensOf } from "./helpers.js";

describe("Moisson en chaîne", () => {
  /**
   * L'ORACLE DE RÉFÉRENCE — carnet §3.4.
   *
   *   AVANT              f  e  d  c  b  a
   *                      0  1  2  1  1  2
   *                      3  0  2  0  1 [4]
   *                      A  B  C  D  E  F
   *
   *   Le Sud joue F. Les 4 Jetons partent vers a, b, c, d.
   *   La chaîne remonte d → c → b → a, puis s'arrête sur F (territoire propre).
   *   RÉCOLTE : 10 Jetons.
   *
   * Ce test garde la règle centrale du projet. Il ne doit jamais être assoupli.
   */
  it("reproduit l'exemple du carnet §3.4", () => {
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([3, 0, 2, 0, 1, 4, 2, 1, 1, 2, 1, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

    // Le plateau final du carnet
    expect(tokensOf(after)).toEqual([3, 0, 2, 0, 1, 0, 0, 0, 0, 0, 1, 0]);

    // Les dépôts, dans l'ordre : a, b, c, d
    expect(eventsOfType(events, "TOKEN_DROPPED").map((e) => e.node)).toEqual([
      N.a,
      N.b,
      N.c,
      N.d,
    ]);

    // La chaîne se résout à REBOURS, en quatre maillons
    const links = eventsOfType(events, "HARVEST_LINK");
    expect(links.map((e) => e.node)).toEqual([N.d, N.c, N.b, N.a]);
    expect(links.map((e) => e.tokens)).toEqual([3, 2, 2, 3]);
    expect(links.map((e) => e.linkIndex)).toEqual([1, 2, 3, 4]);

    // Elle casse en sortant de la Zone Neutre, sur F
    const broken = eventsOfType(events, "HARVEST_BROKEN");
    expect(broken).toHaveLength(1);
    expect(broken[0]).toMatchObject({
      node: N.F,
      reason: "out-of-zone",
      linksResolved: 4,
    });

    // RÉCOLTE : 10
    expect(eventsOfType(events, "HARVEST_TOTAL")[0]).toMatchObject({
      tokens: 10,
      value: 10,
    });
    expect(after.score).toBe(10);
  });

  it("émet les événements du §3.4 dans l'ordre de la mise en scène", () => {
    const state = roundWithTokens([3, 0, 2, 0, 1, 4, 2, 1, 1, 2, 1, 0]);
    const { events } = applyMove(state, { type: "sow", node: N.F });

    expect(events.map((e) => e.type)).toEqual([
      "TURN_STARTED",
      "NODE_EMPTIED",
      "TOKEN_DROPPED",
      "TOKEN_DROPPED",
      "TOKEN_DROPPED",
      "TOKEN_DROPPED",
      "SOW_ENDED",
      "HARVEST_STARTED",
      "HARVEST_LINK",
      "HARVEST_LINK",
      "HARVEST_LINK",
      "HARVEST_LINK",
      "HARVEST_BROKEN",
      "HARVEST_TOTAL",
      "SCORE_COMPUTED",
      "TURN_ENDED",
    ]);
  });

  it("casse la chaîne sur un Nœud hors de la fenêtre de capture", () => {
    // Le dernier Jeton tombe sur b (2 ✓), mais a en contient 5 : la chaîne
    // s'arrête immédiatement après le premier maillon.
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([0, 0, 0, 0, 0, 2, 5, 1, 0, 0, 0, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

    const links = eventsOfType(events, "HARVEST_LINK");
    expect(links.map((e) => e.node)).toEqual([N.b]);

    expect(eventsOfType(events, "HARVEST_BROKEN")[0]).toMatchObject({
      node: N.a,
      reason: "out-of-threshold",
      linksResolved: 1,
    });
    expect(after.score).toBe(2);
    expect(after.nodes[N.a]!.tokens).toBe(6);
  });

  it("ne moissonne pas quand le dernier Jeton reste dans le camp du joueur", () => {
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.A });

    expect(eventsOfType(events, "HARVEST_NONE")[0]).toMatchObject({
      lastNode: N.B,
      reason: "out-of-zone",
    });
    expect(eventsOfType(events, "SCORE_COMPUTED")).toHaveLength(0);
    expect(after.score).toBe(0);
  });

  it("ne moissonne pas quand le Nœud d'arrivée est hors de la fenêtre", () => {
    // Dernier Jeton sur a, qui passe à 5 : hors seuil, aucune capture.
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([0, 0, 0, 0, 0, 1, 4, 0, 0, 0, 0, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

    expect(eventsOfType(events, "HARVEST_NONE")[0]).toMatchObject({
      lastNode: N.a,
      reason: "out-of-threshold",
    });
    expect(after.score).toBe(0);
    expect(after.nodes[N.a]!.tokens).toBe(5);
  });

  it("moissonne un Nœud vidé par la chaîne sans le compter deux fois", () => {
    // Chaîne complète sur toute la Zone Neutre : 6 maillons, puis la chaîne
    // sort de la zone sur F. Le garde-fou anti-boucle ne doit pas se déclencher.
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([0, 0, 0, 0, 0, 6, 2, 2, 2, 2, 2, 1]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

    const links = eventsOfType(events, "HARVEST_LINK");
    expect(links.map((e) => e.node)).toEqual([N.f, N.e, N.d, N.c, N.b, N.a]);
    expect(eventsOfType(events, "HARVEST_BROKEN")[0]).toMatchObject({
      node: N.F,
      reason: "out-of-zone",
    });
    expect(eventsOfType(events, "HARVEST_TOTAL")[0]!.tokens).toBe(17);
    expect(tokensOf(after).slice(6)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});
