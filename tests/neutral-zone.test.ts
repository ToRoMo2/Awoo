/**
 * La Zone Neutre est un puits (carnet §7).
 *
 * Personne ne la joue : le joueur ne peut pas en partir, et il n'y a pas d'IA
 * adverse. Ses compteurs ne peuvent donc que MONTER, tant qu'aucune Moisson ne
 * les remet à zéro. Si elle démarre au-dessus de la fenêtre de capture, aucune
 * Moisson n'est jamais possible — et comme seules les Moissons marquent
 * (§5.3), la manche entière vaut zéro.
 *
 * Ces tests gardent cette propriété visible : c'est une conséquence de règle,
 * pas un réglage d'équilibrage, et elle contraint tout amorçage futur.
 */

import { describe, expect, it } from "vitest";
import { applyMove, createRound, legalMoves, type RoundState } from "../src/core/index.js";
import { makeMilestone0Config, MILESTONE_0_ROUND } from "../src/presets/milestone0.js";
import { awaleRound } from "./helpers.js";

/** Joue la manche entière avec une politique donnée et rend le score final. */
function playOut(start: RoundState, pick: (state: RoundState) => number): number {
  let state = start;
  let guard = 0;
  while (state.phase !== "ended" && ++guard < 200) {
    state = applyMove(state, { type: "sow", node: pick(state) }).state;
  }
  return state.score;
}

const firstMove = (state: RoundState): number => legalMoves(state)[0]!.node;

/** Le meilleur coup immédiat : suffisant pour prouver qu'un score est possible. */
const bestMove = (state: RoundState): number => {
  let best = legalMoves(state)[0]!.node;
  let bestGain = -1;
  for (const move of legalMoves(state)) {
    const gain = applyMove(state, move).state.score - state.score;
    if (gain > bestGain) {
      bestGain = gain;
      best = move.node;
    }
  }
  return best;
};

describe("Amorçage de la Zone Neutre", () => {
  it("rend toute Moisson impossible si elle démarre au-dessus de la fenêtre", () => {
    // Le plateau d'Awalé : 4 Jetons partout. Un Nœud neutre passe à 5, jamais
    // à 2 ou 3. Aucune ligne de jeu ne marque le moindre point.
    expect(playOut(awaleRound(), firstMove)).toBe(0);
    expect(playOut(awaleRound(), bestMove)).toBe(0);
  });

  it("reste bloquée même juste au-dessus de la fenêtre", () => {
    const base = makeMilestone0Config();
    const state = createRound(
      { ...base, round: { ...base.round, initialTokens: { player: 4, neutral: 3 } } },
      1,
    );
    // 3 est dans la fenêtre, mais tout dépôt le porte à 4 : la fenêtre est
    // franchie avant que le dernier Jeton puisse s'y arrêter.
    expect(playOut(state, bestMove)).toBe(0);
  });

  it("redevient moissonnable dès que le preset la fait démarrer sous la fenêtre", () => {
    const state = createRound(makeMilestone0Config(), 1);
    expect(playOut(state, bestMove)).toBeGreaterThan(0);
  });

  it("garde le preset du jalon 0 sous le seuil de capture", () => {
    const { initialTokens } = MILESTONE_0_ROUND;
    expect(typeof initialTokens).not.toBe("number");

    const perZone = initialTokens as Record<string, number>;
    const thresholds = makeMilestone0Config().rules.captureThresholds;
    // Sous le plus petit seuil : il faut au moins un dépôt pour armer un Nœud.
    // C'est ce qui préserve la distinction armer / tirer du §5.3.
    expect(perZone.neutral).toBeLessThan(Math.min(...thresholds));
  });

  it("ne laisse jamais un Nœud neutre décroître sans Moisson", () => {
    let state = createRound(makeMilestone0Config(), 1);
    const neutral = [6, 7, 8, 9, 10, 11];
    let guard = 0;

    while (state.phase !== "ended" && ++guard < 50) {
      const before = neutral.map((node) => state.nodes[node]!.tokens);
      const result = applyMove(state, { type: "sow", node: firstMove(state) });
      const harvested = result.events.some((event) => event.type === "HARVEST_LINK");
      const after = neutral.map((node) => result.state.nodes[node]!.tokens);

      if (!harvested) {
        // Sans Moisson, aucun compteur neutre ne descend.
        after.forEach((value, index) => expect(value).toBeGreaterThanOrEqual(before[index]!));
      }
      state = result.state;
    }
  });
});
