/**
 * Le lecteur d'événements.
 *
 * Le cœur produit une liste ordonnée ; ce fichier lui donne une durée. C'est
 * ici, et nulle part ailleurs, que vit le TEMPO du jeu.
 *
 * Deux règles du carnet sont implémentées ici :
 *  - §11.2, le tempo s'accélère quand la Charge monte ;
 *  - §12 et §13.2, aucune animation n'est imposée : tout est accélérable.
 */

import type { GameEvent } from "../core/index.js";

/** Durées de base, en millisecondes. Le curseur de feel est ce tableau. */
export const TEMPO = {
  turnStart: 120,
  nodeEmptied: 220,
  /** Le clac. Ralenti au début du jeu, accéléré par la Charge. */
  tokenDropped: 145,
  tokenDroppedFloor: 55,
  moduleTriggered: 90,
  chargeChanged: 60,
  sowEnded: 120,
  /** Le suspense : plus lent qu'un clac, exprès. */
  harvestStarted: 320,
  harvestLink: 260,
  /** Le silence après la rupture. Il doit être inconfortable. */
  harvestBroken: 520,
  harvestTotal: 380,
  harvestNone: 620,
  scoreComputed: 700,
  replay: 420,
  turnEnded: 160,
  roundEnded: 400,
} as const;

export interface Step {
  event: GameEvent;
  /** Temps que dure cette étape avant de passer à la suivante. */
  duration: number;
}

/**
 * Durée d'une étape. `charge` est la Charge en vigueur AU MOMENT de l'étape,
 * suivie par le lecteur au fil des CHARGE_CHANGED.
 */
export function durationOf(event: GameEvent, charge: number): number {
  switch (event.type) {
    case "TURN_STARTED":
      return TEMPO.turnStart;
    case "NODE_EMPTIED":
      return TEMPO.nodeEmptied;
    case "TOKEN_DROPPED": {
      // Le tempo s'accélère avec la Charge, sans jamais devenir illisible.
      const scaled = TEMPO.tokenDropped / (1 + 0.16 * Math.max(0, charge - 1));
      return Math.max(TEMPO.tokenDroppedFloor, scaled);
    }
    case "MODULE_TRIGGERED":
      return TEMPO.moduleTriggered;
    case "CHARGE_CHANGED":
      return TEMPO.chargeChanged;
    case "SOW_ENDED":
      return TEMPO.sowEnded;
    case "HARVEST_STARTED":
      return TEMPO.harvestStarted;
    case "HARVEST_LINK":
      return TEMPO.harvestLink;
    case "HARVEST_BROKEN":
      return TEMPO.harvestBroken;
    case "HARVEST_TOTAL":
      return TEMPO.harvestTotal;
    case "HARVEST_NONE":
      return TEMPO.harvestNone;
    case "SCORE_COMPUTED":
      return TEMPO.scoreComputed;
    case "REPLAY_GRANTED":
    case "REPLAY_DENIED":
      return TEMPO.replay;
    case "TURN_ENDED":
      return TEMPO.turnEnded;
    case "ROUND_ENDED":
      return TEMPO.roundEnded;
  }
}

export interface PlayerHandlers {
  /** L'étape commence : lancer l'animation et le son. */
  onEnter(event: GameEvent, step: Step): void;
  /** L'étape se termine : figer son résultat visuel. */
  onExit(event: GameEvent): void;
}

/**
 * Rejoue une liste d'événements dans le temps.
 *
 * Ne connaît ni le Canvas ni le son : il ordonne, il ne dessine pas.
 */
export class TimelinePlayer {
  private queue: Step[] = [];
  private index = -1;
  private elapsed = 0;
  private charge = 1;
  private speed = 1;

  constructor(private readonly handlers: PlayerHandlers) {}

  /** Ajoute des événements à la file. Les événements en cours ne sont pas perdus. */
  push(events: readonly GameEvent[]): void {
    for (const event of events) {
      // La Charge est suivie ici pour que le tempo d'un TOKEN_DROPPED reflète
      // la Charge réellement atteinte à ce moment-là du trajet.
      if (event.type === "CHARGE_CHANGED") this.charge = event.to;
      if (event.type === "TURN_STARTED") this.charge = event.charge;
      this.queue.push({ event, duration: durationOf(event, this.charge) });
    }
    if (this.index < 0) this.advance();
  }

  get busy(): boolean {
    return this.index >= 0;
  }

  /** Progression de l'étape en cours, dans [0, 1]. */
  get progress(): number {
    const step = this.current;
    if (!step || step.duration <= 0) return 1;
    return Math.min(1, this.elapsed / step.duration);
  }

  get current(): Step | null {
    return this.queue[this.index] ?? null;
  }

  /** Multiplicateur de vitesse. Le joueur doit toujours pouvoir accélérer. */
  setSpeed(speed: number): void {
    this.speed = Math.max(1, speed);
  }

  get currentSpeed(): number {
    return this.speed;
  }

  /** Vide la file instantanément, en jouant chaque sortie d'étape. */
  skip(): void {
    while (this.index >= 0) {
      const step = this.queue[this.index]!;
      this.handlers.onExit(step.event);
      this.advance();
    }
  }

  update(deltaMs: number): void {
    if (this.index < 0) return;
    this.elapsed += deltaMs * this.speed;

    let guard = 0;
    while (this.index >= 0 && this.elapsed >= this.queue[this.index]!.duration) {
      // Garde-fou : une durée nulle ne doit pas figer la boucle de rendu.
      if (++guard > 512) break;
      const step = this.queue[this.index]!;
      this.elapsed -= step.duration;
      this.handlers.onExit(step.event);
      this.advance();
    }
  }

  private advance(): void {
    const nextIndex = this.index + 1;
    if (nextIndex >= this.queue.length) {
      this.queue = [];
      this.index = -1;
      this.elapsed = 0;
      return;
    }
    this.index = nextIndex;
    const step = this.queue[this.index]!;
    this.handlers.onEnter(step.event, step);
  }
}
