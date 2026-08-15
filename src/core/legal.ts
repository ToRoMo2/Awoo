/** Les coups légaux. */

import { getCircuit } from "./circuit.js";
import { isPlayableZone } from "./rules.js";
import type { Move, NodeId, RoundState } from "./types.js";

/**
 * Un Nœud est jouable s'il est dans un territoire jouable et non vide
 * (carnet §3.2). La Zone Neutre n'est jamais un point de départ : c'est ce qui
 * force le joueur à nourrir sa propre cible (carnet §7.1).
 */
export function canSow(state: RoundState, node: NodeId): boolean {
  if (state.phase === "ended") return false;
  const target = state.nodes[node];
  if (!target || target.tokens <= 0) return false;
  const circuit = getCircuit(state.config.circuit);
  return isPlayableZone(state.config.rules, circuit.zoneOf(node));
}

export function legalMoves(state: RoundState): Move[] {
  if (state.phase === "ended") return [];
  const circuit = getCircuit(state.config.circuit);
  const { rules } = state.config;
  const moves: Move[] = [];
  for (let node = 0; node < state.nodes.length; node++) {
    if (state.nodes[node]!.tokens <= 0) continue;
    if (!isPlayableZone(rules, circuit.zoneOf(node))) continue;
    moves.push({ type: "sow", node });
  }
  return moves;
}
