/**
 * Les événements émis par le cœur.
 *
 * C'est le SEUL canal entre le moteur de règles et la couche de présentation.
 * La liste est ordonnée : la rejouer dans l'ordre suffit à animer et sonoriser
 * un tour complet. Le cœur ignore qu'une animation existe.
 */

import type { NodeId, RoundOutcome } from "./types.js";

/** Quand un Module se déclenche. */
export type Trigger = "passage" | "destination" | "turn-end";

/** Pourquoi la chaîne de Moisson s'est arrêtée. */
export type HarvestBreakReason =
  /** Le Nœud est hors de la fenêtre de capture. */
  | "out-of-threshold"
  /** Le Nœud est sorti d'un territoire moissonnable. */
  | "out-of-zone"
  /** Garde-fou : la chaîne a fait le tour du Circuit. */
  | "loop";

/** Pourquoi le tour n'a rien moissonné du tout. */
export type HarvestNoneReason = "out-of-threshold" | "out-of-zone";

export type GameEvent =
  // --- Cadre du tour ---
  | { type: "TURN_STARTED"; turn: number; charge: number }
  | { type: "TURN_ENDED"; turn: number; gained: number; charge: number }
  | {
      type: "ROUND_ENDED";
      outcome: RoundOutcome;
      score: number;
      quota: number;
      turnsUsed: number;
    }

  // --- Distribution ---
  | { type: "NODE_EMPTIED"; node: NodeId; count: number }
  /**
   * Le clac. `index` (1-based) et `remaining` pilotent l'accélération du tempo
   * pendant la distribution ; `tokensAfter` permet d'afficher le compteur.
   */
  | {
      type: "TOKEN_DROPPED";
      node: NodeId;
      index: number;
      remaining: number;
      tokensAfter: number;
    }
  | { type: "SOW_ENDED"; lastNode: NodeId }

  // --- Modules ---
  | {
      type: "MODULE_TRIGGERED";
      node: NodeId;
      moduleId: string;
      trigger: Trigger;
      detail?: unknown;
    }
  | {
      type: "CHARGE_CHANGED";
      from: number;
      to: number;
      /** Identifiant du Module responsable, ou "reset" en début de tour. */
      cause: string;
      node?: NodeId;
    }

  // --- Moisson ---
  | { type: "HARVEST_STARTED"; fromNode: NodeId }
  /** Un maillon. `linkIndex` (1-based) donne la hauteur de la note. */
  | { type: "HARVEST_LINK"; node: NodeId; tokens: number; linkIndex: number }
  /** Le silence. */
  | {
      type: "HARVEST_BROKEN";
      node: NodeId;
      reason: HarvestBreakReason;
      linksResolved: number;
    }
  | { type: "HARVEST_TOTAL"; tokens: number; value: number }
  /** Le tour n'a rien capturé — carnet §5.3, il rapporte zéro. */
  | { type: "HARVEST_NONE"; lastNode: NodeId; reason: HarvestNoneReason }

  // --- Score ---
  | {
      type: "SCORE_COMPUTED";
      harvest: number;
      charge: number;
      gained: number;
      total: number;
    }

  // --- Rejouer ---
  | {
      type: "REPLAY_GRANTED";
      node: NodeId;
      moduleId: string;
      used: number;
      max: number;
    }
  /** Un plafond invisible se lit comme un bug : il doit être annoncé. */
  | { type: "REPLAY_DENIED"; node: NodeId; moduleId: string; reason: "cap" };

export type GameEventType = GameEvent["type"];

/** Extrait les événements d'un type donné, en préservant le typage. */
export function eventsOfType<T extends GameEventType>(
  events: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
}
