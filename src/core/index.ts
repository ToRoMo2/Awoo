/**
 * Surface publique du cœur de règles.
 *
 * Le cœur est PUR : ni rendu, ni son, ni entrée utilisateur, ni DOM, ni
 * horloge, ni Math.random. Il est jouable en CLI sans une ligne de rendu.
 * Cette contrainte est vérifiée par tests/core-purity.test.ts.
 */

export { getCircuit, buildCircuit, type Circuit } from "./circuit.js";
export {
  eventsOfType,
  type GameEvent,
  type GameEventType,
  type HarvestBreakReason,
  type HarvestNoneReason,
  type Trigger,
} from "./events.js";
export { canSow, legalMoves } from "./legal.js";
export type { ModuleContext, ModuleDef, ModuleRegistry } from "./modules/types.js";
export {
  harvestStatusOf,
  isHarvestableZone,
  isPlayableZone,
  isWithinCaptureWindow,
  type HarvestStatus,
} from "./rules.js";
export { computeScore } from "./score.js";
export { cloneRound, createRound } from "./setup.js";
export { previewSow } from "./sow.js";
export { applyMove, type MoveResult } from "./turn.js";
export { mancheReward } from "./run/economy.js";
export { applyRunAction, createRun, type RunResult } from "./run/run.js";
export { cloneOffer, generateOffer } from "./run/shop.js";
export type {
  EconomyConfig,
  MancheSpec,
  ModulePoolEntry,
  OfferedModule,
  PurchaseDenyReason,
  ReseedConfig,
  RunAction,
  RunConfig,
  RunEvent,
  RunOutcome,
  RunPhase,
  RunState,
  ShopConfig,
  ShopOffer,
  StageBlueprint,
  StageSeeding,
  TokenPack,
} from "./run/types.js";
export type {
  CircuitConfig,
  GameConfig,
  Move,
  ModulePlacement,
  NodeId,
  NodeLayout,
  NodeState,
  RngState,
  RoundConfig,
  RoundOutcome,
  RoundPhase,
  RoundState,
  RulesConfig,
  SeedingSpec,
  ZoneId,
  ZoneSeeding,
} from "./types.js";
