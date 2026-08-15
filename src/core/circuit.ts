/**
 * La topologie du Circuit.
 *
 * SEUL fichier du cœur qui sait comment les Nœuds sont reliés. Tout le reste
 * passe par next()/prev(). C'est ce qui permettra les plateaux alternatifs
 * (carnet §9, axe 4) sans toucher aux règles.
 */

import type { CircuitConfig, NodeId, ZoneId } from "./types.js";

export interface Circuit {
  readonly nodeCount: number;
  /** Le Nœud suivant dans le sens de distribution. */
  next(node: NodeId): NodeId;
  /** Le Nœud précédent — c'est par là que remonte la chaîne de Moisson. */
  prev(node: NodeId): NodeId;
  zoneOf(node: NodeId): ZoneId;
}

/**
 * Construit le Circuit et vérifie sa cohérence.
 *
 * Contrainte actuelle : la connectivité doit être une permutation (un
 * prédécesseur unique par Nœud), sans quoi prev() serait ambigu et la chaîne
 * de Moisson n'aurait pas de sens. Les Circuits à embranchements demanderont
 * une politique de choix explicite — ils changeront ce fichier, et lui seul.
 */
export function buildCircuit(config: CircuitConfig): Circuit {
  const { nodeCount, successors, zones } = config;

  if (nodeCount <= 0) {
    throw new Error("Circuit invalide : nodeCount doit être positif.");
  }
  if (successors.length !== nodeCount) {
    throw new Error(
      `Circuit invalide : ${successors.length} successeurs pour ${nodeCount} Nœuds.`,
    );
  }
  if (zones.length !== nodeCount) {
    throw new Error(`Circuit invalide : ${zones.length} zones pour ${nodeCount} Nœuds.`);
  }

  const predecessors = new Array<NodeId>(nodeCount).fill(-1);
  for (let node = 0; node < nodeCount; node++) {
    const target = successors[node]!;
    if (!Number.isInteger(target) || target < 0 || target >= nodeCount) {
      throw new Error(`Circuit invalide : le Nœud ${node} pointe vers ${target}.`);
    }
    if (predecessors[target] !== -1) {
      throw new Error(
        `Circuit invalide : le Nœud ${target} a deux prédécesseurs ` +
          `(${predecessors[target]} et ${node}). prev() serait ambigu.`,
      );
    }
    predecessors[target] = node;
  }

  const assertNode = (node: NodeId): void => {
    if (!Number.isInteger(node) || node < 0 || node >= nodeCount) {
      throw new Error(`Nœud hors du Circuit : ${node}.`);
    }
  };

  return {
    nodeCount,
    next(node) {
      assertNode(node);
      return successors[node]!;
    },
    prev(node) {
      assertNode(node);
      return predecessors[node]!;
    },
    zoneOf(node) {
      assertNode(node);
      return zones[node]!;
    },
  };
}

const cache = new WeakMap<CircuitConfig, Circuit>();

/**
 * Version mémoïsée de buildCircuit. La config est traitée comme immuable, donc
 * la même entrée donne toujours la même sortie : la mémoïsation ne casse pas
 * la pureté du cœur, elle évite juste de revalider la topologie à chaque coup.
 */
export function getCircuit(config: CircuitConfig): Circuit {
  let circuit = cache.get(config);
  if (!circuit) {
    circuit = buildCircuit(config);
    cache.set(config, circuit);
  }
  return circuit;
}
