/**
 * La géométrie « avant-poste » (jalon 1, playtest — carnet §9 axe 4).
 *
 * Une case du joueur posée au milieu de la rangée neutre scinde la Moisson en
 * deux poches, comme un mur — mais contrairement à un mur mort, elle est
 * JOUABLE. Ces tests verrouillent les deux propriétés : la chaîne se brise sur
 * l'avant-poste (anti-balayage préservé), et on peut y charger un coup pour
 * tirer dans la poche voisine (la nouvelle option tactique). Le cœur n'a pas
 * bougé : tout vient de la config.
 */

import { describe, expect, it } from "vitest";
import {
  applyMove,
  createRound,
  eventsOfType,
  getCircuit,
  isHarvestableZone,
  isPlayableZone,
  legalMoves,
} from "../src/core/index.js";
import { PLAYER_ZONE } from "../src/presets/board.js";
import { makeOutpostConfig } from "../src/presets/experiments.js";

describe("Géométrie « avant-poste » — une case joueur dans la rangée neutre", () => {
  it("pose une case joueur, jouable mais non moissonnable, au Nœud 9", () => {
    const config = makeOutpostConfig();
    const circuit = getCircuit(config.circuit);
    expect(circuit.zoneOf(9)).toBe(PLAYER_ZONE);
    expect(isPlayableZone(config.rules, PLAYER_ZONE)).toBe(true);
    expect(isHarvestableZone(config.rules, PLAYER_ZONE)).toBe(false);
  });

  it("répartit 28 Jetons sur les 7 Nœuds joueur et 5 sur la rangée neutre", () => {
    const tokens = createRound(makeOutpostConfig(), 3).nodes.map((n) => n.tokens);
    const sum = (nodes: number[]) => nodes.reduce((t, i) => t + tokens[i]!, 0);
    expect(sum([0, 1, 2, 3, 4, 5, 9])).toBe(28); // base + avant-poste
    expect(sum([6, 7, 8, 10, 11])).toBe(5); // 5 Nœuds neutres à 1
  });

  it("la chaîne s'arrête sur l'avant-poste et épargne l'autre poche", () => {
    const state = createRound(makeOutpostConfig(), 1);

    // Scénario imposé : poches à 1, avant-poste à 0, base F (Nœud 5) à 6 Jetons.
    state.nodes.forEach((n) => (n.tokens = 0));
    state.nodes[5]!.tokens = 6;
    for (const i of [6, 7, 8, 10, 11]) state.nodes[i]!.tokens = 1;

    // Les 6 Jetons tombent sur 6,7,8,9,10,11 ; le dernier s'arrête en 11.
    const { state: after, events } = applyMove(state, { type: "sow", node: 5 });
    const links = eventsOfType(events, "HARVEST_LINK").map((e) => e.node);

    // 11 → 10 → 9 (avant-poste, non moissonnable) : la chaîne se brise.
    expect(links).toEqual([11, 10]);
    expect(after.nodes[10]!.tokens).toBe(0);
    expect(after.nodes[11]!.tokens).toBe(0);
    // La poche droite {6,7,8}, dans la fenêtre, est épargnée : pas de balayage.
    expect(after.nodes[6]!.tokens).toBe(2);
    expect(after.nodes[7]!.tokens).toBe(2);
    expect(after.nodes[8]!.tokens).toBe(2);
  });

  it("permet de charger un coup depuis l'avant-poste et de tirer dans la poche voisine", () => {
    const state = createRound(makeOutpostConfig(), 1);

    // La base est vide : seul l'avant-poste (Nœud 9, 2 Jetons) est jouable.
    state.nodes.forEach((n) => (n.tokens = 0));
    state.nodes[9]!.tokens = 2;
    state.nodes[10]!.tokens = 1;
    state.nodes[11]!.tokens = 1;

    // L'avant-poste EST un coup légal, hors de la base.
    expect(legalMoves(state).map((m) => m.node)).toContain(9);

    // Distribuer depuis 9 dépose sur 10 puis 11 : « les 2 cases suivantes ».
    const { state: after, events } = applyMove(state, { type: "sow", node: 9 });
    const links = eventsOfType(events, "HARVEST_LINK").map((e) => e.node);
    expect(links).toEqual([11, 10]);
    expect(after.nodes[10]!.tokens).toBe(0);
    expect(after.nodes[11]!.tokens).toBe(0);
  });
});
