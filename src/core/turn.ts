/**
 * L'orchestrateur d'un coup.
 *
 * Signature du cœur : (état, coup) -> { état, événements }.
 * L'état d'entrée n'est jamais modifié.
 *
 * Un appel = AU PLUS une Distribution et sa Moisson. Le Rejouer ne relance
 * rien tout seul : il rend la main au joueur (carnet §13.2). C'est ce qui rend
 * la boucle infinie structurellement impossible dans le cœur.
 */

import type { GameEvent } from "./events.js";
import { harvest } from "./harvest.js";
import { canSow, legalMoves } from "./legal.js";
import { createSowScope, triggerModule } from "./modules/run.js";
import { applyHarvestScore } from "./score.js";
import { cloneRound } from "./setup.js";
import { sow } from "./sow.js";
import type { Move, RoundOutcome, RoundState } from "./types.js";

export interface MoveResult {
  state: RoundState;
  events: GameEvent[];
}

export function applyMove(state: RoundState, move: Move): MoveResult {
  if (state.phase === "ended") {
    throw new Error("Coup joué sur une manche terminée.");
  }
  if (move.type !== "sow") {
    throw new Error(`Type de coup inconnu : ${(move as Move).type}.`);
  }
  if (!canSow(state, move.node)) {
    throw new Error(`Coup illégal : Distribution depuis le Nœud ${move.node}.`);
  }

  const next = cloneRound(state);
  const events: GameEvent[] = [];
  const emit = (event: GameEvent): void => {
    events.push(event);
  };

  // --- Début de tour ---
  // Un Rejouer prolonge le tour en cours : ni la Charge ni les compteurs ne
  // sont remis à zéro, c'est ce qui rend le build de tempo possible (§5.2).
  const isReplay = next.replayPending;
  next.replayPending = false;

  if (!isReplay) {
    next.charge = next.config.rules.baseCharge;
    next.replaysUsed = 0;
    next.dropsThisTurn = 0;
    next.gainedThisTurn = 0;
    emit({ type: "TURN_STARTED", turn: next.turn + 1, charge: next.charge });
  }

  // --- Distribution ---
  const scope = createSowScope();
  const sowResult = sow(next, move.node, scope, emit);

  // --- Modules de destination ---
  // Avant la Moisson : un Module de destination peut modifier le contenu du
  // Nœud, donc le faire entrer ou sortir de la fenêtre de capture (§6.2).
  triggerModule(next, sowResult.lastNode, "destination", scope, emit);

  // --- Moisson, puis score ---
  const harvested = harvest(next, sowResult.lastNode, emit);
  applyHarvestScore(next, harvested.value, emit);

  // --- Fin de tour ---
  // Un Rejouer accordé sans coup légal disponible ne peut pas être honoré :
  // le tour se termine, et la manche se conclura en blocage.
  if (next.replayPending && legalMoves(next).length === 0) {
    next.replayPending = false;
  }

  if (!next.replayPending) {
    next.turn += 1;
    emit({
      type: "TURN_ENDED",
      turn: next.turn,
      gained: next.gainedThisTurn,
      charge: next.charge,
    });
    closeRoundIfOver(next, emit);
  }

  return { state: next, events };
}

function closeRoundIfOver(state: RoundState, emit: (event: GameEvent) => void): void {
  const { round } = state.config;

  let outcome: RoundOutcome | null = null;
  if (state.score >= round.quota) {
    outcome = "quota-reached";
  } else if (state.turn >= round.turnLimit) {
    outcome = "turns-exhausted";
  } else if (legalMoves(state).length === 0) {
    outcome = "deadlock";
  }

  if (outcome === null) return;

  state.phase = "ended";
  state.outcome = outcome;
  emit({
    type: "ROUND_ENDED",
    outcome,
    score: state.score,
    quota: round.quota,
    turnsUsed: state.turn,
  });
}
