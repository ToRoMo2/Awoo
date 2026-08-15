/**
 * Assemblage de la couche de présentation.
 *
 * Le cœur est appelé ici, et seulement ici. Le sens de la dépendance ne
 * s'inverse jamais : app/ connaît core/, core/ ignore que app/ existe.
 */

import {
  applyMove,
  createRound,
  harvestStatusOf,
  legalMoves,
  previewSow,
  type HarvestStatus,
  type NodeId,
  type RoundState,
} from "../core/index.js";
import { makeMilestone0SeededConfig, MILESTONE_0_PLACEMENTS } from "../presets/milestone0.js";
import { makeOutpostConfig } from "../presets/experiments.js";
import { GameAudio } from "./audio.js";
import { Renderer } from "./render.js";
import { TimelinePlayer } from "./timeline.js";
import { ageView, createView, ViewDriver, type ViewState } from "./view.js";

const FAST_FORWARD = 6;

const canvas = document.getElementById("board");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas introuvable.");
}

/**
 * Playtest du jalon 1 : la touche G bascule entre géométries pour SENTIR si
 * varier le terrain casse la stratégie dominante (mémoire « lever-anti-autopilote »).
 * Chaque géométrie est juste une autre config — le cœur ne bouge pas.
 */
const GEOMETRIES = [
  { name: "standard", config: makeMilestone0SeededConfig(MILESTONE_0_PLACEMENTS) },
  { name: "avant-poste", config: makeOutpostConfig(MILESTONE_0_PLACEMENTS) },
];
let geoIndex = 0;
let config = GEOMETRIES[geoIndex]!.config;

const audio = new GameAudio();
let renderer = new Renderer(canvas, config);

let state: RoundState;
let view: ViewState;
let player: TimelinePlayer;

function newRound(): void {
  // La graine vient d'ici, pas du cœur : le moteur reste déterministe.
  state = createRound(config, (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  view = createView(state);
  const driver = new ViewDriver(view, audio);
  player = new TimelinePlayer({
    onEnter: (event) => driver.onEnter(event),
    onExit: (event) => driver.onExit(event),
  });
}

newRound();

/** Les Nœuds jouables, recalculés depuis le cœur — jamais devinés. */
function playableNodes(): Set<NodeId> {
  if (player.busy) return new Set();
  return new Set(legalMoves(state).map((move) => move.node));
}

/**
 * L'état de Moisson de chaque Nœud, calculé sur les compteurs AFFICHÉS.
 * Pendant une cascade, le cœur a déjà fini alors que l'écran est encore en
 * train de dérouler : le marquage doit suivre ce que le joueur voit.
 */
function harvestStatuses(): HarvestStatus[] {
  return state.nodes.map((_, node) => harvestStatusOf(state, node, view.tokens[node]));
}

function play(node: NodeId): void {
  audio.unlock();
  if (player.busy) {
    // Aucune animation n'est imposée : un clic pendant la cascade la termine.
    player.skip();
    return;
  }
  if (state.phase === "ended") return;
  if (!legalMoves(state).some((move) => move.node === node)) return;

  const result = applyMove(state, { type: "sow", node });
  state = result.state;
  view.preview = [];
  view.hovered = null;
  player.push(result.events);
}

// --- Entrées ---

canvas.addEventListener("pointermove", (event) => {
  const rect = canvas.getBoundingClientRect();
  const node = renderer.hitTest(event.clientX - rect.left, event.clientY - rect.top);
  const playable = playableNodes();

  if (node !== null && playable.has(node)) {
    view.hovered = node;
    view.preview = previewSow(state, node);
  } else {
    view.hovered = null;
    view.preview = [];
  }
});

canvas.addEventListener("pointerleave", () => {
  view.hovered = null;
  view.preview = [];
});

canvas.addEventListener("pointerdown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const node = renderer.hitTest(event.clientX - rect.left, event.clientY - rect.top);
  if (node === null) {
    audio.unlock();
    if (player.busy) player.skip();
    return;
  }
  play(node);
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    player.setSpeed(FAST_FORWARD);
    return;
  }
  if (event.key === "r" || event.key === "R") {
    audio.unlock();
    newRound();
    return;
  }
  if (event.key === "g" || event.key === "G") {
    // Bascule de géométrie (playtest). On reconstruit le rendu : le layout et
    // les zones changent, donc la géométrie visuelle aussi.
    audio.unlock();
    geoIndex = (geoIndex + 1) % GEOMETRIES.length;
    config = GEOMETRIES[geoIndex]!.config;
    renderer = new Renderer(canvas, config);
    newRound();
    return;
  }
  if (event.key === "m" || event.key === "M") {
    audio.unlock();
    audio.toggleMute();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") player.setSpeed(1);
});

window.addEventListener("resize", () => renderer.resize());

// --- Boucle de rendu ---

let previous = performance.now();

function frame(now: number): void {
  const delta = Math.min(64, now - previous);
  previous = now;

  player.update(delta);
  ageView(view, delta);
  renderer.draw(view, playableNodes(), player.progress, harvestStatuses());

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
