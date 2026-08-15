/**
 * L'exécution d'un Module.
 *
 * Aucun identifiant de Module n'apparaît ici : le moteur exécute un contrat,
 * il ne connaît pas le catalogue.
 *
 * Mute l'état reçu.
 */

import type { GameEvent, Trigger } from "../events.js";
import type { NodeId, RoundState } from "../types.js";
import type { ModuleContext, ModuleDef } from "./types.js";

/**
 * Portée d'une Distribution : mémorise ce qui s'est déjà déclenché, pour
 * honorer `oncePerSow`. Recréée à chaque Distribution, donc un Rejouer laisse
 * bien les Modules se redéclencher.
 */
export interface SowScope {
  fired: Set<string>;
}

export function createSowScope(): SowScope {
  return { fired: new Set() };
}

function memoryOf(state: RoundState, nodeId: NodeId): Record<string, unknown> {
  const key = String(nodeId);
  let memory = state.moduleMemory[key];
  if (typeof memory !== "object" || memory === null) {
    memory = {};
    state.moduleMemory[key] = memory;
  }
  return memory as Record<string, unknown>;
}

/**
 * Déclenche le Module posé sur `nodeId`, s'il existe et s'il répond à ce
 * déclencheur. Sans Module, sans déclencheur correspondant, ou si `oncePerSow`
 * a déjà été honoré : ne fait rien et n'émet rien.
 */
export function triggerModule(
  state: RoundState,
  nodeId: NodeId,
  trigger: Trigger,
  scope: SowScope,
  emit: (event: GameEvent) => void,
): void {
  const moduleId = state.nodes[nodeId]?.moduleId;
  if (!moduleId) return;

  const def = state.config.registry.get(moduleId);
  if (!def) {
    throw new Error(`Module inconnu du catalogue : « ${moduleId} ».`);
  }
  if (def.trigger !== trigger) return;

  const key = `${nodeId}:${trigger}`;
  if (def.oncePerSow && scope.fired.has(key)) return;
  scope.fired.add(key);

  // Les conséquences sont mises en tampon : MODULE_TRIGGERED doit venir en
  // premier (le Nœud s'illumine, puis son effet se produit), mais son `detail`
  // n'est connu qu'après l'exécution.
  const pending: GameEvent[] = [];
  let detail: unknown;

  const context = makeContext(state, nodeId, def, pending, (value) => {
    detail = value;
  });

  def.apply(context);

  emit({
    type: "MODULE_TRIGGERED",
    node: nodeId,
    moduleId: def.id,
    trigger,
    ...(detail === undefined ? {} : { detail }),
  });
  for (const event of pending) emit(event);
}

function makeContext(
  state: RoundState,
  nodeId: NodeId,
  def: ModuleDef,
  pending: GameEvent[],
  setDetail: (detail: unknown) => void,
): ModuleContext {
  const changeCharge = (to: number): void => {
    const from = state.charge;
    state.charge = to;
    pending.push({ type: "CHARGE_CHANGED", from, to, cause: def.id, node: nodeId });
  };

  return {
    nodeId,
    state,
    memory: memoryOf(state, nodeId),

    addCharge(amount) {
      changeCharge(state.charge + amount);
    },

    multiplyCharge(factor) {
      changeCharge(state.charge * factor);
    },

    grantReplay() {
      const max = state.config.round.maxReplaysPerTurn;
      // Le plafond est annoncé, jamais silencieux : un Rejouer qui disparaît
      // sans explication se lit comme un bug (carnet §13.2).
      if (state.replaysUsed >= max) {
        pending.push({
          type: "REPLAY_DENIED",
          node: nodeId,
          moduleId: def.id,
          reason: "cap",
        });
        return;
      }
      state.replaysUsed += 1;
      state.replayPending = true;
      pending.push({
        type: "REPLAY_GRANTED",
        node: nodeId,
        moduleId: def.id,
        used: state.replaysUsed,
        max,
      });
    },

    note(value) {
      setDetail(value);
    },
  };
}
