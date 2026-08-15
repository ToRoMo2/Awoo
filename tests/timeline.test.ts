/**
 * Le tempo.
 *
 * C'est 80 % du plaisir du jeu (carnet §11), donc ça se teste comme le reste.
 * Le lecteur n'a besoin ni de Canvas ni de son : il ordonne dans le temps.
 */

import { describe, expect, it } from "vitest";
import { applyMove, type GameEvent } from "../src/core/index.js";
import { durationOf, TEMPO, TimelinePlayer } from "../src/app/timeline.js";
import { N, roundWithTokens } from "./helpers.js";

function recorder() {
  const entered: GameEvent["type"][] = [];
  const exited: GameEvent["type"][] = [];
  const player = new TimelinePlayer({
    onEnter: (event) => entered.push(event.type),
    onExit: (event) => exited.push(event.type),
  });
  return { player, entered, exited };
}

describe("Lecteur d'événements", () => {
  it("rejoue les événements dans l'ordre du cœur", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]);
    const { events } = applyMove(state, { type: "sow", node: N.F });

    const { player, exited } = recorder();
    player.push(events);
    // Largement de quoi tout consommer.
    player.update(60_000);

    expect(exited).toEqual(events.map((event) => event.type));
    expect(player.busy).toBe(false);
  });

  it("entre dans une étape avant d'en sortir", () => {
    const { player, entered, exited } = recorder();
    player.push([{ type: "TURN_STARTED", turn: 1, charge: 1 }]);

    expect(entered).toEqual(["TURN_STARTED"]);
    expect(exited).toEqual([]);

    player.update(TEMPO.turnStart + 1);
    expect(exited).toEqual(["TURN_STARTED"]);
  });

  /** Carnet §11.2 : le tempo s'accélère quand la Charge monte. */
  it("accélère les clacs à mesure que la Charge monte", () => {
    const drop: GameEvent = {
      type: "TOKEN_DROPPED",
      node: 0,
      index: 1,
      remaining: 0,
      tokensAfter: 1,
    };

    const slow = durationOf(drop, 1);
    const fast = durationOf(drop, 6);
    const veryFast = durationOf(drop, 40);

    expect(slow).toBe(TEMPO.tokenDropped);
    expect(fast).toBeLessThan(slow);
    // Mais jamais au point de devenir illisible.
    expect(veryFast).toBeGreaterThanOrEqual(TEMPO.tokenDroppedFloor);
  });

  /** La chaîne est un suspense, pas une énumération : elle doit être plus lente. */
  it("donne plus de temps à un maillon de chaîne qu'à un clac", () => {
    const link: GameEvent = { type: "HARVEST_LINK", node: 0, tokens: 3, linkIndex: 1 };
    const drop: GameEvent = {
      type: "TOKEN_DROPPED",
      node: 0,
      index: 1,
      remaining: 0,
      tokensAfter: 1,
    };

    expect(durationOf(link, 1)).toBeGreaterThan(durationOf(drop, 1));
    // Et la rupture doit laisser un vrai silence.
    const broken: GameEvent = {
      type: "HARVEST_BROKEN",
      node: 0,
      reason: "out-of-zone",
      linksResolved: 3,
    };
    expect(durationOf(broken, 1)).toBeGreaterThan(durationOf(link, 1));
  });

  /** Carnet §12 : aucune animation n'est imposée. */
  it("vide la file instantanément sur skip, sans perdre d'étape", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0]);
    const { events } = applyMove(state, { type: "sow", node: N.F });

    const { player, exited } = recorder();
    player.push(events);
    player.skip();

    expect(exited).toEqual(events.map((event) => event.type));
    expect(player.busy).toBe(false);
  });

  it("accélère sans jamais sauter d'étape", () => {
    const state = roundWithTokens([0, 0, 0, 0, 0, 3, 0, 0, 1, 0, 0, 0]);
    const { events } = applyMove(state, { type: "sow", node: N.F });

    const { player, exited } = recorder();
    player.setSpeed(8);
    player.push(events);

    let guard = 0;
    while (player.busy && ++guard < 1000) player.update(16);

    expect(exited).toEqual(events.map((event) => event.type));
  });

  it("ne descend jamais sous la vitesse normale", () => {
    const { player } = recorder();
    player.setSpeed(0.1);
    expect(player.currentSpeed).toBe(1);
  });

  it("enchaîne des événements poussés pendant une lecture en cours", () => {
    const { player, exited } = recorder();
    player.push([{ type: "TURN_STARTED", turn: 1, charge: 1 }]);
    player.push([{ type: "TURN_ENDED", turn: 1, gained: 0, charge: 1 }]);

    player.update(60_000);
    expect(exited).toEqual(["TURN_STARTED", "TURN_ENDED"]);
  });

  it("attribue une durée à chaque type d'événement", () => {
    // Garde-fou : un nouvel événement sans durée passerait inaperçu.
    const samples: GameEvent[] = [
      { type: "TURN_STARTED", turn: 1, charge: 1 },
      { type: "TURN_ENDED", turn: 1, gained: 0, charge: 1 },
      { type: "ROUND_ENDED", outcome: "quota-reached", score: 1, quota: 1, turnsUsed: 1 },
      { type: "NODE_EMPTIED", node: 0, count: 1 },
      { type: "TOKEN_DROPPED", node: 0, index: 1, remaining: 0, tokensAfter: 1 },
      { type: "SOW_ENDED", lastNode: 0 },
      { type: "MODULE_TRIGGERED", node: 0, moduleId: "x", trigger: "passage" },
      { type: "CHARGE_CHANGED", from: 1, to: 2, cause: "x" },
      { type: "HARVEST_STARTED", fromNode: 0 },
      { type: "HARVEST_LINK", node: 0, tokens: 2, linkIndex: 1 },
      { type: "HARVEST_BROKEN", node: 0, reason: "loop", linksResolved: 1 },
      { type: "HARVEST_TOTAL", tokens: 2, value: 2 },
      { type: "HARVEST_NONE", lastNode: 0, reason: "out-of-zone" },
      { type: "SCORE_COMPUTED", harvest: 2, charge: 1, gained: 2, total: 2 },
      { type: "REPLAY_GRANTED", node: 0, moduleId: "x", used: 1, max: 3 },
      { type: "REPLAY_DENIED", node: 0, moduleId: "x", reason: "cap" },
    ];

    for (const event of samples) {
      expect(durationOf(event, 1), event.type).toBeGreaterThan(0);
    }
  });
});
