import { describe, expect, it } from "vitest";
import { applyMove, eventsOfType, legalMoves } from "../src/core/index.js";
import { awaleRound, N, roundWithTokens } from "./helpers.js";

describe("Manche", () => {
  it("termine la manche quand le quota est atteint", () => {
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([4, 0, 0, 0, 0, 4, 2, 2, 2, 2, 0, 0], {
      quota: 8,
    });

    const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

    expect(after.score).toBeGreaterThanOrEqual(8);
    expect(after.phase).toBe("ended");
    expect(after.outcome).toBe("quota-reached");
    expect(eventsOfType(events, "ROUND_ENDED")[0]).toMatchObject({
      outcome: "quota-reached",
      quota: 8,
      turnsUsed: 1,
    });
  });

  it("termine la manche à l'épuisement des tours", () => {
    const state = awaleRound();

    let current = state;
    let ended = false;
    for (let i = 0; i < 15 && !ended; i++) {
      const move = legalMoves(current)[0]!;
      const result = applyMove(current, move);
      current = result.state;
      ended = eventsOfType(result.events, "ROUND_ENDED").length > 0;
    }

    expect(current.phase).toBe("ended");
    expect(current.turn).toBeLessThanOrEqual(15);
  });

  it("termine la manche en blocage quand le camp du joueur est vide", () => {
    // Le seul coup possible vide le camp du joueur sans rien capturer.
    //                        A  B  C  D  E  F  a  b  c  d  e  f
    const state = roundWithTokens([0, 0, 0, 0, 0, 1, 6, 0, 0, 0, 0, 0]);

    const { state: after, events } = applyMove(state, { type: "sow", node: N.F });

    expect(legalMoves(after)).toEqual([]);
    expect(after.outcome).toBe("deadlock");
    expect(eventsOfType(events, "ROUND_ENDED")[0]).toMatchObject({
      outcome: "deadlock",
    });
  });

  it("refuse tout coup après la fin de la manche", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 1, 6, 0, 0, 0, 0, 0]);
    const { state: after } = applyMove(state, { type: "sow", node: N.F });

    expect(() => applyMove(after, { type: "sow", node: N.F })).toThrow(/terminée/i);
  });

  it("compte un tour par Distribution, en l'absence de Rejouer", () => {
    const state = awaleRound();

    const first = applyMove(state, { type: "sow", node: N.A });
    expect(first.state.turn).toBe(1);
    expect(eventsOfType(first.events, "TURN_STARTED")[0]).toMatchObject({ turn: 1 });
    expect(eventsOfType(first.events, "TURN_ENDED")[0]).toMatchObject({ turn: 1 });

    const second = applyMove(first.state, { type: "sow", node: N.B });
    expect(second.state.turn).toBe(2);
  });

  it("remet la Charge à sa valeur de base au début de chaque tour", () => {
    const state = awaleRound();
    const { state: after, events } = applyMove(state, { type: "sow", node: N.A });

    expect(eventsOfType(events, "TURN_STARTED")[0]!.charge).toBe(
      state.config.rules.baseCharge,
    );
    expect(after.charge).toBe(state.config.rules.baseCharge);
  });
});
