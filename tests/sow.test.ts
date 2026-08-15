import { describe, expect, it } from "vitest";
import { applyMove, eventsOfType, legalMoves } from "../src/core/index.js";
import { awaleRound, N, roundWithTokens, tokensOf } from "./helpers.js";

describe("Distribution", () => {
  /** Carnet §3.2 : le Sud joue D, les 4 Jetons partent vers E, F, a, b. */
  it("reproduit l'exemple du carnet §3.2", () => {
    const state = awaleRound();

    const { state: after, events } = applyMove(state, { type: "sow", node: N.D });

    //                     A  B  C  D  E  F  a  b  c  d  e  f
    expect(tokensOf(after)).toEqual([4, 4, 4, 0, 5, 5, 5, 5, 4, 4, 4, 4]);

    expect(eventsOfType(events, "NODE_EMPTIED")[0]).toMatchObject({
      node: N.D,
      count: 4,
    });
    expect(eventsOfType(events, "TOKEN_DROPPED").map((e) => e.node)).toEqual([
      N.E,
      N.F,
      N.a,
      N.b,
    ]);
    expect(eventsOfType(events, "SOW_ENDED")[0]).toMatchObject({ lastNode: N.b });
  });

  it("émet un TOKEN_DROPPED par Jeton, avec un décompte qui descend", () => {
    const state = awaleRound();
    const { events } = applyMove(state, { type: "sow", node: N.A });

    const drops = eventsOfType(events, "TOKEN_DROPPED");
    expect(drops).toHaveLength(4);
    expect(drops.map((e) => e.index)).toEqual([1, 2, 3, 4]);
    expect(drops.map((e) => e.remaining)).toEqual([3, 2, 1, 0]);
    expect(drops.map((e) => e.tokensAfter)).toEqual([5, 5, 5, 5]);
  });

  /** Carnet §3.2, cas particulier : au-delà d'un tour complet, on saute l'origine. */
  it("saute le Nœud d'origine quand la Distribution dépasse un tour complet", () => {
    //                        A   B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([13, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.A });

    // 13 Jetons sur 11 autres Nœuds : B et C en reçoivent deux, A reste vide.
    expect(tokensOf(after)).toEqual([0, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1]);

    const drops = eventsOfType(events, "TOKEN_DROPPED");
    expect(drops).toHaveLength(13);
    expect(drops.every((e) => e.node !== N.A)).toBe(true);
    expect(drops.at(-1)!.node).toBe(N.C);
  });

  it("refuse de distribuer depuis la Zone Neutre", () => {
    const state = awaleRound();
    expect(() => applyMove(state, { type: "sow", node: N.a })).toThrow(/illégal/i);
  });

  it("refuse de distribuer depuis un Nœud vide", () => {
    const state = roundWithTokens([0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
    expect(() => applyMove(state, { type: "sow", node: N.A })).toThrow(/illégal/i);
  });

  it("ne liste que les Nœuds non vides du camp du joueur", () => {
    const state = roundWithTokens([1, 0, 3, 0, 0, 2, 4, 4, 4, 4, 4, 4]);
    expect(legalMoves(state).map((m) => m.node)).toEqual([N.A, N.C, N.F]);
  });

  it("ne modifie jamais l'état d'entrée", () => {
    const state = awaleRound();
    const before = tokensOf(state);

    applyMove(state, { type: "sow", node: N.D });

    expect(tokensOf(state)).toEqual(before);
    expect(state.turn).toBe(0);
    expect(state.score).toBe(0);
  });
});
