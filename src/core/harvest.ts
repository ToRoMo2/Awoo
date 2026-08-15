/**
 * La Moisson en chaîne (carnet §3.4) — le mécanisme central.
 *
 * On part du Nœud où le dernier Jeton s'est posé, et on REMONTE le Circuit.
 * Chaque maillon est une petite victoire, la rupture est un silence.
 * L'ordre d'émission des événements EST l'ordre de la mise en scène.
 *
 * Mute l'état reçu.
 */

import { getCircuit } from "./circuit.js";
import type { GameEvent } from "./events.js";
import { isHarvestableZone, isWithinCaptureWindow } from "./rules.js";
import type { NodeId, RoundState } from "./types.js";

export interface HarvestResult {
  /** Nombre de Jetons capturés. */
  tokens: number;
  /** Valeur de la Moisson : Jetons × valeur unitaire (carnet §5.1). */
  value: number;
  /** Les Nœuds capturés, dans l'ordre de résolution (à rebours). */
  links: NodeId[];
}

export function harvest(
  state: RoundState,
  lastNode: NodeId,
  emit: (event: GameEvent) => void,
): HarvestResult {
  const circuit = getCircuit(state.config.circuit);
  const { rules } = state.config;

  // --- Amorce : les trois conditions cumulatives du carnet §3.3 ---
  // (la première — « dernier Jeton déposé » — est garantie par l'appelant)
  if (!isHarvestableZone(rules, circuit.zoneOf(lastNode))) {
    emit({ type: "HARVEST_NONE", lastNode, reason: "out-of-zone" });
    return { tokens: 0, value: 0, links: [] };
  }
  if (!isWithinCaptureWindow(rules, state.nodes[lastNode]!.tokens)) {
    emit({ type: "HARVEST_NONE", lastNode, reason: "out-of-threshold" });
    return { tokens: 0, value: 0, links: [] };
  }

  emit({ type: "HARVEST_STARTED", fromNode: lastNode });

  const links: NodeId[] = [];
  const visited = new Set<NodeId>();
  let cursor = lastNode;
  let tokens = 0;

  for (;;) {
    // Garde-fou : un Circuit entièrement moissonnable boucle sans elle.
    if (visited.has(cursor) || links.length >= circuit.nodeCount) {
      emit({
        type: "HARVEST_BROKEN",
        node: cursor,
        reason: "loop",
        linksResolved: links.length,
      });
      break;
    }

    // La zone n'est testée qu'en propagation : l'amorce l'a déjà validée, et
    // un Module peut lever cette limite sans pour autant autoriser à amorcer
    // hors Zone Neutre (carnet §6.3).
    const zoneBlocks =
      links.length > 0 &&
      rules.chainBreaksOnZoneExit &&
      !isHarvestableZone(rules, circuit.zoneOf(cursor));

    if (zoneBlocks) {
      emit({
        type: "HARVEST_BROKEN",
        node: cursor,
        reason: "out-of-zone",
        linksResolved: links.length,
      });
      break;
    }

    const node = state.nodes[cursor]!;
    if (!isWithinCaptureWindow(rules, node.tokens)) {
      emit({
        type: "HARVEST_BROKEN",
        node: cursor,
        reason: "out-of-threshold",
        linksResolved: links.length,
      });
      break;
    }

    // Capture. Les Jetons moissonnés quittent définitivement le jeu (carnet §8.2).
    tokens += node.tokens;
    links.push(cursor);
    visited.add(cursor);

    emit({
      type: "HARVEST_LINK",
      node: cursor,
      tokens: node.tokens,
      linkIndex: links.length,
    });

    node.tokens = 0;
    cursor = circuit.prev(cursor);
  }

  const value = tokens * rules.tokenValue;
  emit({ type: "HARVEST_TOTAL", tokens, value });

  return { tokens, value, links };
}
