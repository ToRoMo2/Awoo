/** Création d'une manche. */

import { buildCircuit } from "./circuit.js";
import { createRng } from "./rng.js";
import type { GameConfig, NodeState, RoundState } from "./types.js";

export function createRound(config: GameConfig, seed: number): RoundState {
  // Valide la topologie tout de suite : un Circuit incohérent doit échouer
  // à la création, pas au milieu d'une Moisson.
  const circuit = buildCircuit(config.circuit);

  const { initialTokens } = config.round;
  const startingTokens = (node: number): number => {
    if (typeof initialTokens === "number") return initialTokens;
    const zone = circuit.zoneOf(node);
    const value = initialTokens[zone];
    if (value === undefined) {
      throw new Error(`Aucun nombre de Jetons de départ défini pour la zone « ${zone} ».`);
    }
    return value;
  };

  const nodes: NodeState[] = Array.from(
    { length: config.circuit.nodeCount },
    (_, node): NodeState => ({
      tokens: startingTokens(node),
      moduleId: null,
    }),
  );

  for (const placement of config.placements) {
    const node = nodes[placement.nodeId];
    if (!node) {
      throw new Error(
        `Module « ${placement.moduleId} » posé sur un Nœud inexistant : ${placement.nodeId}.`,
      );
    }
    if (node.moduleId !== null) {
      throw new Error(`Deux Modules posés sur le Nœud ${placement.nodeId}.`);
    }
    node.moduleId = placement.moduleId;
  }

  return {
    config,
    nodes,
    charge: config.rules.baseCharge,
    score: 0,
    turn: 0,
    replaysUsed: 0,
    replayPending: false,
    dropsThisTurn: 0,
    gainedThisTurn: 0,
    phase: "awaiting-move",
    outcome: null,
    rng: createRng(seed),
    moduleMemory: {},
  };
}

/** Copie de travail. La config est partagée : elle est traitée comme immuable. */
export function cloneRound(state: RoundState): RoundState {
  return {
    ...state,
    nodes: state.nodes.map((node) => ({ ...node })),
    rng: { ...state.rng },
    moduleMemory: structuredClone(state.moduleMemory),
  };
}
