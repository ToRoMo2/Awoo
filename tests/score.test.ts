import { describe, expect, it } from "vitest";
import { applyMove, computeScore, eventsOfType } from "../src/core/index.js";
import { N, roundWithTokens } from "./helpers.js";

describe("Moteur de score", () => {
  it("multiplie la Moisson par la Charge", () => {
    expect(computeScore(10, 1)).toBe(10);
    expect(computeScore(10, 4)).toBe(40);
    expect(computeScore(0, 12)).toBe(0);
  });

  /** Carnet §5.3 : un tour sans capture rapporte zéro. Non négociable. */
  it("ne marque rien sur un tour sans Moisson", () => {
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.A });

    expect(eventsOfType(events, "HARVEST_NONE")).toHaveLength(1);
    expect(eventsOfType(events, "SCORE_COMPUTED")).toHaveLength(0);
    expect(after.score).toBe(0);
  });

  it("expose la Charge utilisée dans SCORE_COMPUTED", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]);

    const { events } = applyMove(state, { type: "sow", node: N.F });

    // Sans Module, la Charge vaut baseCharge : la formule reste visible.
    expect(eventsOfType(events, "SCORE_COMPUTED")[0]).toMatchObject({
      harvest: 2,
      charge: 1,
      gained: 2,
      total: 2,
    });
  });

  it("cumule le score sur plusieurs tours", () => {
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    let state = roundWithTokens([0, 0, 0, 0, 3, 1, 1, 2, 0, 0, 0, 0]);

    // Tour 1 : F amène a à 2, capture de 2.
    state = applyMove(state, { type: "sow", node: N.F }).state;
    expect(state.score).toBe(2);
    expect(state.turn).toBe(1);

    // Tour 2 : E traverse F et a pour finir sur b à 3, capture de 3.
    state = applyMove(state, { type: "sow", node: N.E }).state;
    expect(state.score).toBe(5);
    expect(state.turn).toBe(2);
  });
});
