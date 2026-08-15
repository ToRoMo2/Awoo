/**
 * Manche jouable en ligne de commande.
 *
 * Ce fichier existe pour prouver la règle d'architecture n°1 : le cœur est
 * jouable sans une ligne de rendu. Si un jour il faut du Canvas pour jouer un
 * tour, c'est que le cœur a été contaminé.
 *
 *   npm run cli
 */

import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import {
  applyMove,
  createRound,
  legalMoves,
  type GameEvent,
  type RoundState,
} from "../core/index.js";
import { makeMilestone0Config, MILESTONE_0_PLACEMENTS } from "../presets/milestone0.js";

const LABELS = ["A", "B", "C", "D", "E", "F", "a", "b", "c", "d", "e", "f"];

function labelOf(node: number): string {
  return LABELS[node] ?? String(node);
}

function drawBoard(state: RoundState): string {
  const { layout } = state.config.circuit;
  const rows = Math.max(...layout.map((cell) => cell.row)) + 1;
  const cols = Math.max(...layout.map((cell) => cell.col)) + 1;

  const moduleAt = (node: number): string => {
    const id = state.nodes[node]?.moduleId;
    return id ? (state.config.registry.get(id)?.label ?? id) : "";
  };

  const lines: string[] = [];
  for (let row = 0; row < rows; row++) {
    const names: string[] = [];
    const counts: string[] = [];
    const modules: string[] = [];
    for (let col = 0; col < cols; col++) {
      const node = layout.findIndex((cell) => cell.row === row && cell.col === col);
      names.push(labelOf(node).padStart(10));
      counts.push(String(state.nodes[node]!.tokens).padStart(10));
      modules.push(moduleAt(node).padStart(10));
    }
    // La rangée du haut porte ses Modules au-dessus, celle du bas en dessous :
    // le libellé reste toujours du côté extérieur du plateau.
    const block =
      row === 0
        ? [modules.join(" "), names.join(" "), counts.join(" ")]
        : [names.join(" "), counts.join(" "), modules.join(" ")];
    lines.push(...block);
  }
  return lines.join("\n");
}

/** Rendu texte des événements : la même liste que consommera l'animation. */
function describe(event: GameEvent, moduleLabel: (id: string) => string): string | null {
  switch (event.type) {
    case "TURN_STARTED":
      return `\n── Tour ${event.turn} ── Charge ${event.charge}`;
    case "NODE_EMPTIED":
      return `  ${labelOf(event.node)} se vide (${event.count} Jetons)`;
    case "TOKEN_DROPPED":
      return `    clac → ${labelOf(event.node)} (${event.tokensAfter})`;
    case "MODULE_TRIGGERED":
      return `    ⚙ ${moduleLabel(event.moduleId)} sur ${labelOf(event.node)}`;
    case "CHARGE_CHANGED":
      return `    Charge ${event.from} → ${event.to}`;
    case "HARVEST_STARTED":
      return `  MOISSON depuis ${labelOf(event.fromNode)}`;
    case "HARVEST_LINK":
      return `    maillon ${event.linkIndex} : ${labelOf(event.node)} → ${event.tokens}`;
    case "HARVEST_BROKEN":
      return `    ... chaîne rompue sur ${labelOf(event.node)} (${event.reason})`;
    case "HARVEST_TOTAL":
      return `  Moisson : ${event.tokens} Jetons, valeur ${event.value}`;
    case "HARVEST_NONE":
      return `  Aucune Moisson (${event.reason}) — ce tour rapporte 0`;
    case "SCORE_COMPUTED":
      return `  ${event.harvest} × ${event.charge} = ${event.gained}  (total ${event.total})`;
    case "REPLAY_GRANTED":
      return `  ↻ Rejouer (${event.used}/${event.max})`;
    case "REPLAY_DENIED":
      return `  ↻ Rejouer refusé : plafond atteint`;
    case "ROUND_ENDED":
      return `\n═══ Manche terminée : ${event.outcome} — ${event.score}/${event.quota} en ${event.turnsUsed} tours`;
    case "SOW_ENDED":
    case "TURN_ENDED":
      return null;
  }
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  const config = makeMilestone0Config(MILESTONE_0_PLACEMENTS);
  let state = createRound(config, Date.now());

  const moduleLabel = (id: string): string => config.registry.get(id)?.label ?? id;

  const say = (text: string): void => {
    stdout.write(`${text}\n`);
  };

  say("Distribuez depuis un Nœud de votre camp. « q » pour quitter.");

  while (state.phase !== "ended") {
    say(`\n${drawBoard(state)}`);
    say(
      `Score ${state.score}/${state.config.round.quota} — ` +
        `tour ${state.turn + 1}/${state.config.round.turnLimit}` +
        (state.replayPending ? " — REJOUER" : ""),
    );

    const options = legalMoves(state).map((move) => labelOf(move.node));
    const answer = (await rl.question(`Coup [${options.join(" ")}] > `)).trim();
    if (answer === "q") break;

    const node = LABELS.indexOf(answer);
    if (node < 0 || !legalMoves(state).some((move) => move.node === node)) {
      say("Coup illégal.");
      continue;
    }

    const result = applyMove(state, { type: "sow", node });
    state = result.state;
    for (const event of result.events) {
      const line = describe(event, moduleLabel);
      if (line !== null) say(line);
    }
  }

  rl.close();
}

void main();
