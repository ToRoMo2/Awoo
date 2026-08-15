import { describe, expect, it } from "vitest";
import { buildCircuit, createRound } from "../src/core/index.js";
import { makeTwoRowRing, NEUTRAL_ZONE, PLAYER_ZONE } from "../src/presets/board.js";
import { makeMilestone0Config } from "../src/presets/milestone0.js";
import { N } from "./helpers.js";

describe("Circuit", () => {
  /** Carnet §3.1 : A → B → C → D → E → F → a → b → c → d → e → f → A. */
  it("forme une boucle unique de 12 Nœuds", () => {
    const circuit = buildCircuit(makeTwoRowRing(6));

    const path: number[] = [N.A];
    let cursor: number = N.A;
    for (let i = 0; i < 11; i++) {
      cursor = circuit.next(cursor);
      path.push(cursor);
    }

    expect(path).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(circuit.next(N.f)).toBe(N.A);
  });

  it("expose un prev() qui est l'exact inverse de next()", () => {
    const circuit = buildCircuit(makeTwoRowRing(6));
    for (let node = 0; node < circuit.nodeCount; node++) {
      expect(circuit.prev(circuit.next(node))).toBe(node);
      expect(circuit.next(circuit.prev(node))).toBe(node);
    }
  });

  it("place la première rangée chez le joueur et la seconde en Zone Neutre", () => {
    const circuit = buildCircuit(makeTwoRowRing(6));
    expect([0, 1, 2, 3, 4, 5].map((n) => circuit.zoneOf(n))).toEqual(
      Array<string>(6).fill(PLAYER_ZONE),
    );
    expect([6, 7, 8, 9, 10, 11].map((n) => circuit.zoneOf(n))).toEqual(
      Array<string>(6).fill(NEUTRAL_ZONE),
    );
  });

  /** Le cœur ne code aucune taille en dur : un autre plateau doit marcher tel quel. */
  it("accepte une géométrie différente sans toucher au cœur", () => {
    const circuit = buildCircuit(makeTwoRowRing(8));
    expect(circuit.nodeCount).toBe(16);
    expect(circuit.next(15)).toBe(0);
    expect(circuit.zoneOf(7)).toBe(PLAYER_ZONE);
    expect(circuit.zoneOf(8)).toBe(NEUTRAL_ZONE);

    const state = createRound(
      { ...makeMilestone0Config(), circuit: makeTwoRowRing(8) },
      1,
    );
    expect(state.nodes).toHaveLength(16);
  });

  it("refuse une connectivité ambiguë", () => {
    const broken = makeTwoRowRing(6);
    broken.successors[0] = broken.successors[1]!;
    expect(() => buildCircuit(broken)).toThrow(/prédécesseurs/);
  });

  it("refuse un successeur hors du Circuit", () => {
    const broken = makeTwoRowRing(6);
    broken.successors[0] = 99;
    expect(() => buildCircuit(broken)).toThrow(/pointe vers/);
  });
});
