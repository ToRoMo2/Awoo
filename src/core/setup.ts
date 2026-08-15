/** Création d'une manche. */

import type { Circuit } from "./circuit.js";
import { buildCircuit } from "./circuit.js";
import { createRng, nextInt } from "./rng.js";
import type {
  GameConfig,
  NodeId,
  NodeState,
  RngState,
  RoundState,
  SeedingSpec,
  ZoneId,
} from "./types.js";

export function createRound(config: GameConfig, seed: number): RoundState {
  // Valide la topologie tout de suite : un Circuit incohérent doit échouer
  // à la création, pas au milieu d'une Moisson.
  const circuit = buildCircuit(config.circuit);

  // Le PRNG naît AVANT le plateau : l'amorçage seedé le consomme pour répartir
  // les Jetons, donc une graine donnée rejoue exactement le même plateau.
  const rng = createRng(seed);
  const tokensByNode = seedTokens(config, circuit, rng);

  const nodes: NodeState[] = Array.from(
    { length: config.circuit.nodeCount },
    (_, node): NodeState => ({
      tokens: tokensByNode[node]!,
      moduleId: null,
      moduleLevel: 0,
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
    node.moduleLevel = placement.level ?? 1;
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
    rng,
    moduleMemory: {},
  };
}

/**
 * Calcule le contenu de départ de chaque Nœud.
 *
 * Amorçage uniforme (un nombre) : chaque Nœud reçoit la même valeur, aucun
 * tirage. Amorçage par zone : chaque zone reçoit soit un nombre fixe par Nœud,
 * soit une SeedingSpec dont la répartition est tirée du PRNG.
 */
function seedTokens(config: GameConfig, circuit: Circuit, rng: RngState): number[] {
  const { initialTokens } = config.round;
  const nodeCount = config.circuit.nodeCount;

  if (typeof initialTokens === "number") {
    return new Array<number>(nodeCount).fill(initialTokens);
  }

  // Les Nœuds sont groupés par zone dans l'ORDRE D'APPARITION : c'est ce qui
  // fixe l'ordre de consommation du PRNG, donc la reproductibilité du plateau.
  const zoneNodes = new Map<ZoneId, NodeId[]>();
  for (let node = 0; node < nodeCount; node++) {
    const zone = circuit.zoneOf(node);
    let list = zoneNodes.get(zone);
    if (!list) {
      list = [];
      zoneNodes.set(zone, list);
    }
    list.push(node);
  }

  const tokens = new Array<number>(nodeCount).fill(0);
  for (const [zone, nodesOfZone] of zoneNodes) {
    const seeding = initialTokens[zone];
    if (seeding === undefined) {
      throw new Error(`Aucun amorçage défini pour la zone « ${zone} ».`);
    }
    if (typeof seeding === "number") {
      for (const node of nodesOfZone) tokens[node] = seeding;
      continue;
    }
    const distributed = distribute(rng, nodesOfZone.length, seeding, zone);
    nodesOfZone.forEach((node, index) => {
      tokens[node] = distributed[index]!;
    });
  }
  return tokens;
}

/**
 * Répartit `spec.total` Jetons sur `count` Nœuds, chacun borné à
 * [perNodeMin, perNodeMax], en tirant le surplus au PRNG.
 *
 * Un amorçage incohérent échoue ICI, à la création, jamais au milieu d'un tour.
 */
function distribute(
  rng: RngState,
  count: number,
  spec: SeedingSpec,
  zone: ZoneId,
): number[] {
  const { total, perNodeMin, perNodeMax } = spec;

  if (!Number.isInteger(total) || total < 0) {
    throw new Error(`Amorçage de « ${zone} » : total invalide (${total}).`);
  }
  if (!Number.isInteger(perNodeMin) || perNodeMin < 0) {
    throw new Error(`Amorçage de « ${zone} » : perNodeMin invalide (${perNodeMin}).`);
  }
  if (!Number.isInteger(perNodeMax) || perNodeMax < perNodeMin) {
    throw new Error(
      `Amorçage de « ${zone} » : perNodeMax (${perNodeMax}) < perNodeMin (${perNodeMin}).`,
    );
  }

  const floor = perNodeMin * count;
  const ceil = perNodeMax * count;
  if (total < floor || total > ceil) {
    throw new Error(
      `Amorçage impossible pour la zone « ${zone} » : ${total} Jetons sur ${count} ` +
        `Nœuds bornés à [${perNodeMin}, ${perNodeMax}] (plage atteignable ${floor}–${ceil}).`,
    );
  }

  // Chaque Nœud part au minimum, puis on distribue le surplus un Jeton à la
  // fois sur un Nœud encore sous son maximum, tiré au sort.
  const result = new Array<number>(count).fill(perNodeMin);
  let remaining = total - floor;
  while (remaining > 0) {
    const eligible: number[] = [];
    for (let i = 0; i < count; i++) {
      if (result[i]! < perNodeMax) eligible.push(i);
    }
    const pick = eligible[nextInt(rng, eligible.length)]!;
    result[pick]! += 1;
    remaining -= 1;
  }
  return result;
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
