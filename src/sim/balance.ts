/**
 * Équilibrage par simulation.
 *
 * C'est le bénéfice n°2 de la séparation cœur/rendu (carnet §15.2) : le
 * moteur étant pur, on peut jouer des milliers de manches sans rendu et
 * calibrer le quota sur des chiffres plutôt que sur une intuition.
 *
 *   npm run balance
 */

import {
  applyMove,
  createRound,
  getCircuit,
  legalMoves,
  type GameConfig,
  type Move,
  type RoundState,
  type SeedingSpec,
} from "../core/index.js";
import { makeMilestone0SeededConfig, MILESTONE_0_PLACEMENTS } from "../presets/milestone0.js";

/** Une politique de jeu : choisit un coup parmi les coups légaux. */
type Policy = (state: RoundState) => Move;

/** Joue au hasard. Le plancher : ce qu'obtient quelqu'un qui ne réfléchit pas. */
const randomPolicy =
  (random: () => number): Policy =>
  (state) => {
    const moves = legalMoves(state);
    return moves[Math.floor(random() * moves.length)]!;
  };

/**
 * Joue le coup qui rapporte le plus TOUT DE SUITE.
 *
 * Le moteur étant pur, on peut essayer chaque coup et regarder le résultat
 * sans rien casser. C'est une approximation d'un joueur correct mais sans
 * vision : le vrai joueur, lui, arme le plateau plusieurs tours à l'avance.
 */
const greedyPolicy: Policy = (state) => {
  const moves = legalMoves(state);
  const { rules } = state.config;
  const circuit = getCircuit(state.config.circuit);

  /**
   * Départage les coups qui ne rapportent rien. Sans ça, la politique jouerait
   * toujours le premier Nœud de la liste et mesurerait le vide : la moitié des
   * coups servent à ARMER le plateau (carnet §5.3), il faut donc valoriser les
   * Nœuds amenés dans la fenêtre de capture.
   */
  const armed = (candidate: RoundState): number => {
    let count = 0;
    for (let node = 0; node < candidate.nodes.length; node++) {
      if (!rules.harvestableZones.includes(circuit.zoneOf(node))) continue;
      if (rules.captureThresholds.includes(candidate.nodes[node]!.tokens)) count += 1;
    }
    return count;
  };

  let best = moves[0]!;
  let bestGain = -1;
  let bestArmed = -1;

  for (const move of moves) {
    const { state: after } = applyMove(state, move);
    const gain = after.score - state.score;
    const readiness = armed(after);
    if (gain > bestGain || (gain === bestGain && readiness > bestArmed)) {
      bestGain = gain;
      bestArmed = readiness;
      best = move;
    }
  }
  return best;
};

/**
 * Le meilleur score atteignable en explorant `depth` coups d'avance.
 *
 * Le jeu est à information parfaite et sans hasard (carnet §13.1) : une
 * recherche exhaustive à quelques coups est donc EXACTEMENT ce qu'un joueur
 * attentif fait de tête. C'est le plafond réaliste du niveau.
 */
function bestReachable(state: RoundState, depth: number): number {
  if (depth <= 0 || state.phase === "ended") return state.score;
  let best = state.score;
  for (const move of legalMoves(state)) {
    best = Math.max(best, bestReachable(applyMove(state, move).state, depth - 1));
  }
  return best;
}

const lookaheadPolicy =
  (depth: number): Policy =>
  (state) => {
    const moves = legalMoves(state);
    let best = moves[0]!;
    let bestScore = -1;
    for (const move of moves) {
      const score = bestReachable(applyMove(state, move).state, depth - 1);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  };

/**
 * Un joueur qui voit à `depth` coups mais se trompe une fois sur `errorRate`.
 *
 * C'est la seule politique qui produise une DISTRIBUTION : le jeu étant
 * déterministe, toute politique parfaite rend le même score à chaque manche.
 */
const humanPolicy =
  (depth: number, errorRate: number, random: () => number): Policy =>
  (state) => {
    if (random() < errorRate) {
      const moves = legalMoves(state);
      return moves[Math.floor(random() * moves.length)]!;
    }
    return lookaheadPolicy(depth)(state);
  };

interface Outcome {
  score: number;
  turns: number;
  harvests: number;
}

function playRound(config: GameConfig, seed: number, policy: Policy): Outcome {
  let state = createRound(config, seed);
  let harvests = 0;
  // Le quota est neutralisé : on veut savoir ce qu'une manche PRODUIT,
  // pas si elle franchit une barre choisie d'avance.
  let guard = 0;

  while (state.phase !== "ended" && ++guard < 500) {
    const before = state.score;
    const result = applyMove(state, policy(state));
    state = result.state;
    if (state.score > before) harvests += 1;
  }

  return { score: state.score, turns: state.turn, harvests };
}

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[index]!;
}

function report(label: string, outcomes: Outcome[]): void {
  const scores = outcomes.map((o) => o.score).sort((a, b) => a - b);
  const mean = scores.reduce((sum, value) => sum + value, 0) / scores.length;
  const harvests = outcomes.reduce((sum, o) => sum + o.harvests, 0) / outcomes.length;
  const turns = outcomes.reduce((sum, o) => sum + o.turns, 0) / outcomes.length;

  process.stdout.write(
    `${label.padEnd(10)} ` +
      `moy ${mean.toFixed(1).padStart(6)}  ` +
      `p10 ${String(percentile(scores, 0.1)).padStart(4)}  ` +
      `médiane ${String(percentile(scores, 0.5)).padStart(4)}  ` +
      `p90 ${String(percentile(scores, 0.9)).padStart(4)}  ` +
      `max ${String(scores.at(-1)).padStart(4)}  ` +
      `| Moissons ${harvests.toFixed(1)} / ${turns.toFixed(1)} tours\n`,
  );
}

/** Taux de réussite d'un quota donné, sur une distribution mesurée. */
function passRate(outcomes: Outcome[], quota: number): number {
  return outcomes.filter((o) => o.score >= quota).length / outcomes.length;
}

function main(): void {
  const runs = 400;
  const base = makeMilestone0SeededConfig(MILESTONE_0_PLACEMENTS);
  const config: GameConfig = {
    ...base,
    // Le quota ne doit pas interrompre la mesure : hors d'atteinte.
    round: { ...base.round, quota: Number.MAX_SAFE_INTEGER },
  };

  let cursor = 12345;
  const random = (): number => {
    cursor = (cursor * 1664525 + 1013904223) >>> 0;
    return cursor / 4294967296;
  };

  const describeZone = (z: number | SeedingSpec): string =>
    typeof z === "number" ? String(z) : `${z.total}~[${z.perNodeMin}-${z.perNodeMax}]`;
  const seeding = config.round.initialTokens;
  const seedingLabel =
    typeof seeding === "number"
      ? String(seeding)
      : `J${describeZone(seeding.player!)}/N${describeZone(seeding.neutral!)}`;
  process.stdout.write(
    `\nPlateau 2×6 — ${config.round.turnLimit} tours — départ ${seedingLabel}\n` +
      `Modules : ${config.placements.map((p) => p.moduleId).join(", ")}\n\n`,
  );

  // Le plateau varie désormais avec la graine (incrément 1) : une politique
  // PARFAITE, sans erreur, ne rend plus un score constant mais une DISTRIBUTION.
  // C'est la preuve chiffrée que le risque n°1 (§13.1) recule.
  process.stdout.write("Politique parfaite (vision 3) sur 150 graines :\n");
  report(
    "  parfait",
    Array.from({ length: 150 }, (_, i) => playRound(config, i, lookaheadPolicy(3))),
  );
  process.stdout.write(
    "  Avant l'incrément, ce bloc rendait UN score unique (plateau figé).\n",
  );

  // Repère de niveau sur une graine donnée : ce que rapporte le fait de voir plus loin.
  process.stdout.write("\nPlafond de compétence (graine 1) :\n");
  for (const depth of [1, 2, 3, 4]) {
    const outcome = playRound(config, 1, lookaheadPolicy(depth));
    process.stdout.write(
      `  vision ${depth} coup${depth > 1 ? "s" : " "}  →  ` +
        `${String(outcome.score).padStart(4)} points, ` +
        `${outcome.harvests} Moissons en ${outcome.turns} tours\n`,
    );
  }

  process.stdout.write("\nDistributions :\n");
  const profiles: { label: string; outcomes: Outcome[] }[] = [
    {
      label: "au hasard",
      outcomes: Array.from({ length: runs }, (_, i) =>
        playRound(config, i, randomPolicy(random)),
      ),
    },
    {
      label: "débutant",
      outcomes: Array.from({ length: runs }, (_, i) =>
        playRound(config, i, humanPolicy(2, 0.35, random)),
      ),
    },
    {
      label: "appliqué",
      outcomes: Array.from({ length: runs }, (_, i) =>
        playRound(config, i, humanPolicy(3, 0.15, random)),
      ),
    },
  ];

  for (const profile of profiles) report(`  ${profile.label}`, profile.outcomes);

  // Une manche d'ouverture doit passer très souvent : c'est la première petite
  // manche de l'étape 1 (carnet §8.1), pas une Épreuve.
  process.stdout.write("\nTaux de réussite selon le quota :\n");
  process.stdout.write(
    `  quota  ${profiles.map((p) => p.label.padStart(9)).join("")}\n`,
  );
  for (const quota of [30, 40, 45, 50, 55, 60, 65, 70, 75, 85]) {
    const cells = profiles
      .map((p) => `${(passRate(p.outcomes, quota) * 100).toFixed(0)}%`.padStart(9))
      .join("");
    process.stdout.write(`  ${String(quota).padStart(5)}  ${cells}\n`);
  }

  process.stdout.write(
    "\nLecture : pour une manche d'OUVERTURE, viser ~85-90 % chez « appliqué »\n" +
      "et un « au hasard » qui échoue nettement. Une manche difficile se règle\n" +
      "plus tard, avec les étapes et les Épreuves (carnet §8).\n\n",
  );
}

main();
