/**
 * La Distribution (carnet §3.2).
 *
 * Vide un Nœud et dépose ses Jetons un par un le long du Circuit.
 * Chaque dépôt émet TOKEN_DROPPED : c'est le clac, l'unité de tempo du jeu.
 *
 * Mute l'état reçu — turn.ts en a déjà pris une copie de travail.
 */

import { getCircuit } from "./circuit.js";
import type { GameEvent } from "./events.js";
import { triggerModule, type SowScope } from "./modules/run.js";
import type { NodeId, RoundState } from "./types.js";

export interface SowResult {
  /** Le Nœud où le dernier Jeton s'est posé. C'est lui qui amorce la Moisson. */
  lastNode: NodeId;
  dropped: number;
  /** Vrai si le plafond maxDropsPerTurn a interrompu la Distribution. */
  capped: boolean;
}

/**
 * Le trajet qu'emprunterait une Distribution, sans rien modifier.
 *
 * Sert à pré-visualiser le parcours au survol (carnet §6.6, §13.3) : c'est ce
 * qui rend la POSITION des Modules lisible, donc jouable.
 *
 * Trajet NOMINAL : un futur Module de topologie (téléportation, raccourci)
 * pourra le dévier en cours de route. L'aperçu restera une intention, pas une
 * promesse — et c'est très bien ainsi.
 */
export function previewSow(state: RoundState, origin: NodeId): NodeId[] {
  const circuit = getCircuit(state.config.circuit);
  const { rules } = state.config;

  const count = state.nodes[origin]?.tokens ?? 0;
  if (count <= 0) return [];

  const path: NodeId[] = [];
  let cursor = origin;
  let steps = 0;
  const maxSteps = (count + 1) * circuit.nodeCount + circuit.nodeCount;

  while (path.length < count && ++steps <= maxSteps) {
    cursor = circuit.next(cursor);
    if (rules.skipOriginOnSow && cursor === origin) continue;
    path.push(cursor);
  }

  return path;
}

export function sow(
  state: RoundState,
  origin: NodeId,
  scope: SowScope,
  emit: (event: GameEvent) => void,
): SowResult {
  const circuit = getCircuit(state.config.circuit);
  const { rules, round } = state.config;

  const originNode = state.nodes[origin];
  if (!originNode) throw new Error(`Distribution depuis un Nœud inexistant : ${origin}.`);

  const count = originNode.tokens;
  if (count <= 0) {
    throw new Error(`Distribution depuis un Nœud vide : ${origin}.`);
  }

  originNode.tokens = 0;
  emit({ type: "NODE_EMPTIED", node: origin, count });

  let cursor = origin;
  let lastNode = origin;
  let remaining = count;
  let dropped = 0;
  let capped = false;

  // Garde-fou : borne le nombre de pas de Circuit, pas seulement le nombre de
  // dépôts. Un Module de topologie qui ferait tourner le curseur sans jamais
  // déposer serait sinon une boucle infinie (carnet §13.2).
  const maxSteps = (count + 1) * circuit.nodeCount + circuit.nodeCount;
  let steps = 0;

  while (remaining > 0) {
    if (++steps > maxSteps) {
      capped = true;
      break;
    }

    cursor = circuit.next(cursor);

    // Le Nœud d'origine est sauté : il reste vide même sur un tour complet.
    if (rules.skipOriginOnSow && cursor === origin) continue;

    if (state.dropsThisTurn >= round.maxDropsPerTurn) {
      capped = true;
      break;
    }

    const target = state.nodes[cursor]!;
    target.tokens += 1;
    remaining -= 1;
    dropped += 1;
    state.dropsThisTurn += 1;
    lastNode = cursor;

    emit({
      type: "TOKEN_DROPPED",
      node: cursor,
      index: dropped,
      remaining,
      tokensAfter: target.tokens,
    });

    // « Traverser » un Nœud, c'est y déposer un Jeton — pas le survoler.
    // Un clac, un déclenchement. Le dernier Jeton compte comme les autres.
    triggerModule(state, cursor, "passage", scope, emit);
  }

  emit({ type: "SOW_ENDED", lastNode });

  return { lastNode, dropped, capped };
}
