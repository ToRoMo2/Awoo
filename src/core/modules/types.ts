/**
 * Le contrat des Modules.
 *
 * Le cœur définit cette interface et sait l'exécuter. Il ne connaît AUCUN
 * Module en particulier : le catalogue est injecté par la configuration.
 * Ajouter un Module est un fichier dans src/modules/, jamais une modification
 * du moteur, et jamais un `switch` sur un identifiant.
 */

import type { Trigger } from "../events.js";
import type { NodeId, RoundState } from "../types.js";

/**
 * Les seules mutations qu'un Module peut provoquer.
 *
 * Il ne touche jamais l'état directement : le cœur garde la main sur l'ordre
 * de résolution, sur les plafonds et sur l'émission des événements.
 */
export interface ModuleContext {
  /** Le Nœud qui porte ce Module. */
  readonly nodeId: NodeId;
  /** L'état, en lecture seule. */
  readonly state: Readonly<RoundState>;
  /** Mémoire privée de cet emplacement, persistante pendant la manche. */
  readonly memory: Record<string, unknown>;

  addCharge(amount: number): void;
  multiplyCharge(factor: number): void;
  /** Demande un Rejouer. Peut être refusé par le plafond (carnet §13.2). */
  grantReplay(): void;
  /** Détail libre, joint à MODULE_TRIGGERED pour l'affichage. */
  note(detail: unknown): void;
}

export interface ModuleDef {
  id: string;
  /** Nom affiché. En français, en vocabulaire neutre (carnet §4). */
  label: string;
  /** Quand le Module se déclenche. */
  trigger: Trigger;
  /**
   * Un seul déclenchement par Distribution, même si plusieurs Jetons se
   * déposent sur le Nœud. Indispensable aux effets multiplicatifs, qui
   * deviendraient exponentiels autrement.
   */
  oncePerSow: boolean;
  apply(context: ModuleContext): void;
}

/** Le catalogue disponible dans une partie, indexé par identifiant. */
export type ModuleRegistry = ReadonlyMap<string, ModuleDef>;
