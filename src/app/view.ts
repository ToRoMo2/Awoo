/**
 * L'état visuel, et la traduction des événements du cœur en effets.
 *
 * C'est le seul endroit qui décide « cet événement se voit et s'entend comme
 * ceci ». Le cœur ne sait rien de tout ça, et ce fichier ne connaît aucune
 * règle du jeu : il ne fait que réagir à une liste ordonnée.
 */

import type { GameEvent, NodeId, RoundState } from "../core/index.js";
import type { GameAudio } from "./audio.js";

export type PulseKind = "drop" | "module" | "origin" | "harvest";

export interface Pulse {
  kind: PulseKind;
  /** Décroît de 1 vers 0. */
  life: number;
}

export interface Banner {
  text: string;
  tone: "harvest" | "silence" | "replay" | "end";
  life: number;
}

export interface FlyingToken {
  from: NodeId;
  to: NodeId;
}

export interface ViewState {
  tokens: number[];
  charge: number;
  score: number;
  quota: number;
  turn: number;
  turnLimit: number;
  replaysUsed: number;
  maxReplays: number;
  replayPending: boolean;
  ended: boolean;

  /** Le Jeton en vol : c'est lui qu'on suit des yeux (carnet §11.2). */
  flying: FlyingToken | null;
  pulses: Map<NodeId, Pulse>;
  /** Les Nœuds moissonnés, encore lumineux. */
  chainGlow: Map<NodeId, number>;
  /** Le Nœud d'où part la Distribution en cours. */
  sourceNode: NodeId | null;
  banner: Banner | null;
  shake: number;
  /** Le trajet pré-visualisé au survol (carnet §6.6). */
  preview: NodeId[];
  hovered: NodeId | null;
}

export function createView(state: RoundState): ViewState {
  return {
    tokens: state.nodes.map((node) => node.tokens),
    charge: state.charge,
    score: state.score,
    quota: state.config.round.quota,
    turn: state.turn,
    turnLimit: state.config.round.turnLimit,
    replaysUsed: state.replaysUsed,
    maxReplays: state.config.round.maxReplaysPerTurn,
    replayPending: state.replayPending,
    ended: state.phase === "ended",
    flying: null,
    pulses: new Map(),
    chainGlow: new Map(),
    sourceNode: null,
    banner: null,
    shake: 0,
    preview: [],
    hovered: null,
  };
}

/** Fait vieillir les effets. `deltaMs` est le temps réel écoulé. */
export function ageView(view: ViewState, deltaMs: number): void {
  const decay = deltaMs / 380;

  for (const [node, pulse] of view.pulses) {
    pulse.life -= decay;
    if (pulse.life <= 0) view.pulses.delete(node);
  }
  for (const [node, life] of view.chainGlow) {
    const next = life - deltaMs / 1400;
    if (next <= 0) view.chainGlow.delete(node);
    else view.chainGlow.set(node, next);
  }
  if (view.banner) {
    view.banner.life -= deltaMs / 1600;
    if (view.banner.life <= 0) view.banner = null;
  }
  view.shake = Math.max(0, view.shake - deltaMs / 260);
}

/**
 * Traduit les événements en effets.
 *
 * `onEnter` lance ce qui dure (le vol d'un Jeton, la note d'un maillon),
 * `onExit` fige le résultat (le compteur qui monte, le clac).
 */
export class ViewDriver {
  /** D'où part le prochain Jeton en vol. */
  private lastDrop: NodeId | null = null;

  constructor(
    private readonly view: ViewState,
    private readonly audio: GameAudio,
  ) {}

  onEnter(event: GameEvent): void {
    const view = this.view;

    switch (event.type) {
      case "TURN_STARTED":
        view.charge = event.charge;
        view.chainGlow.clear();
        this.lastDrop = null;
        break;

      case "NODE_EMPTIED":
        view.sourceNode = event.node;
        this.lastDrop = event.node;
        view.pulses.set(event.node, { kind: "origin", life: 1 });
        break;

      case "TOKEN_DROPPED":
        // Le Jeton décolle : il vole pendant toute la durée de l'étape.
        view.flying = { from: this.lastDrop ?? event.node, to: event.node };
        break;

      case "HARVEST_LINK":
        // Le maillon se résout tout de suite : on l'entend et on le voit
        // disparaître, puis le suspense reprend jusqu'au maillon suivant.
        view.tokens[event.node] = 0;
        view.chainGlow.set(event.node, 1);
        view.pulses.set(event.node, { kind: "harvest", life: 1 });
        view.shake = Math.min(1, 0.25 + event.linkIndex * 0.12);
        this.audio.chainLink(event.linkIndex - 1);
        break;

      case "HARVEST_BROKEN":
        this.audio.chainBroken();
        view.pulses.set(event.node, { kind: "module", life: 1 });
        break;

      case "HARVEST_NONE":
        view.banner = { text: "Aucune Moisson", tone: "silence", life: 1 };
        this.audio.chainBroken();
        break;

      case "HARVEST_TOTAL":
        if (event.tokens > 0) this.audio.impact();
        break;

      case "REPLAY_GRANTED":
        view.replaysUsed = event.used;
        view.replayPending = true;
        view.banner = {
          text: `Rejouer  ${event.used}/${event.max}`,
          tone: "replay",
          life: 1,
        };
        this.audio.spark();
        break;

      case "REPLAY_DENIED":
        view.banner = { text: "Rejouer — plafond atteint", tone: "silence", life: 1 };
        break;

      case "MODULE_TRIGGERED":
        view.pulses.set(event.node, { kind: "module", life: 1 });
        this.audio.spark();
        break;

      case "ROUND_ENDED":
        view.ended = true;
        view.banner = {
          text:
            event.outcome === "quota-reached"
              ? `Quota atteint — ${event.score}/${event.quota}`
              : event.outcome === "turns-exhausted"
                ? `Tours épuisés — ${event.score}/${event.quota}`
                : `Plus aucun coup — ${event.score}/${event.quota}`,
          tone: "end",
          life: 1,
        };
        this.audio.impact();
        break;

      default:
        break;
    }
  }

  onExit(event: GameEvent): void {
    const view = this.view;

    switch (event.type) {
      case "NODE_EMPTIED":
        view.tokens[event.node] = 0;
        break;

      case "TOKEN_DROPPED":
        // Le Jeton se pose : c'est MAINTENANT que le compteur monte et que le
        // clac sonne. Jamais avant : on suit l'objet, pas le chiffre.
        view.tokens[event.node] = event.tokensAfter;
        view.flying = null;
        view.pulses.set(event.node, { kind: "drop", life: 1 });
        this.lastDrop = event.node;
        this.audio.clack(1 + Math.min(view.charge - 1, 8) * 0.045);
        break;

      case "CHARGE_CHANGED":
        view.charge = event.to;
        break;

      case "SOW_ENDED":
        view.flying = null;
        view.sourceNode = null;
        break;

      case "HARVEST_TOTAL":
        if (event.tokens > 0) {
          view.banner = {
            text: `Moisson  ${event.tokens}`,
            tone: "harvest",
            life: 1,
          };
        }
        break;

      case "SCORE_COMPUTED":
        view.score = event.total;
        view.banner = {
          text: `${event.harvest} × ${event.charge} = ${event.gained}`,
          tone: "harvest",
          life: 1,
        };
        view.shake = 1;
        break;

      case "TURN_ENDED":
        view.turn = event.turn;
        view.replayPending = false;
        break;

      default:
        break;
    }
  }
}
