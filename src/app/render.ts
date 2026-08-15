/**
 * Rendu Canvas 2D.
 *
 * Placeholders assumés : des cercles et des chiffres (carnet §14, jalon 0).
 * Une seule contrainte tenue dès maintenant, parce qu'elle est structurelle
 * et pas cosmétique : l'état du plateau doit se lire en UNE SECONDE
 * (carnet §13.3). D'où la hiérarchie stricte — le nombre de Jetons domine,
 * le Module vient après.
 *
 * La Charge et la Moisson ont chacune leur couleur, constante partout
 * (carnet §10.6).
 */

import type { GameConfig, HarvestStatus, NodeId } from "../core/index.js";
import type { ViewState } from "./view.js";

const THEME = {
  background: "#12141c",
  grid: "#1c2030",
  playerNode: "#2a3348",
  neutralNode: "#3d3427",
  /** Zone Neutre : Nœud déjà dans la fenêtre de capture. */
  nodeReady: "#6b5420",
  /** Zone Neutre : un Jeton de plus et il y entre. */
  nodeArming: "#4c412c",
  nodeEdge: "#4a5570",
  nodeEdgePlayable: "#7d8db8",
  text: "#e8ecf5",
  textDim: "#8892a8",
  /** La Charge. Une seule couleur, partout. */
  charge: "#9d7bff",
  /** La Moisson. Une seule couleur, partout. */
  harvest: "#ffc247",
  token: "#e8ecf5",
  /** Le trajet pré-visualisé au survol. */
  preview: "#5a6a92",
} as const;

export interface Geometry {
  radius: number;
  centers: { x: number; y: number }[];
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private geometry: Geometry = { radius: 0, centers: [] };
  private width = 0;
  private height = 0;
  private rows = 1;
  private status: readonly HarvestStatus[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly config: GameConfig,
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D indisponible.");
    this.ctx = ctx;
    this.resize();
  }

  /** Recalcule la géométrie à partir du layout de la config. Rien en dur. */
  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { layout } = this.config.circuit;
    const rows = Math.max(...layout.map((c) => c.row)) + 1;
    const cols = Math.max(...layout.map((c) => c.col)) + 1;
    this.rows = rows;

    const marginX = this.width * 0.07;
    const marginTop = this.height * 0.24;
    // Large : la bannière de score se pose SOUS le plateau, jamais dessus.
    const marginBottom = this.height * 0.26;

    const usableW = this.width - marginX * 2;
    const usableH = this.height - marginTop - marginBottom;

    const cellW = usableW / cols;
    const cellH = usableH / rows;
    this.geometry.radius = Math.min(cellW, cellH) * 0.38;

    this.geometry.centers = layout.map((cell) => ({
      x: marginX + cellW * (cell.col + 0.5),
      y: marginTop + cellH * (cell.row + 0.5),
    }));
  }

  /** Le Nœud sous le curseur, ou null. */
  hitTest(x: number, y: number): NodeId | null {
    const r = this.geometry.radius * 1.15;
    for (let node = 0; node < this.geometry.centers.length; node++) {
      const center = this.geometry.centers[node]!;
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy <= r * r) return node;
    }
    return null;
  }

  draw(
    view: ViewState,
    playable: ReadonlySet<NodeId>,
    flyProgress: number,
    status: readonly HarvestStatus[] = [],
  ): void {
    this.status = status;
    const ctx = this.ctx;

    ctx.save();
    if (view.shake > 0) {
      const amount = view.shake * 5;
      ctx.translate(
        (Math.random() - 0.5) * amount,
        (Math.random() - 0.5) * amount,
      );
    }

    ctx.fillStyle = THEME.background;
    ctx.fillRect(-20, -20, this.width + 40, this.height + 40);

    this.drawZoneLabel();
    this.drawPreview(view);
    this.drawNodes(view, playable);
    this.drawFlyingToken(view, flyProgress);
    this.drawHud(view);
    this.drawBanner(view);

    ctx.restore();
  }

  private drawZoneLabel(): void {
    const ctx = this.ctx;
    const { zones } = this.config.circuit;
    const centers = this.geometry.centers;

    // Une bande derrière la Zone Neutre : elle est le seul territoire
    // moissonnable, donc elle doit se distinguer sans effort de lecture.
    const neutral = centers.filter(
      (_, node) => this.config.rules.harvestableZones.includes(zones[node]!),
    );
    if (neutral.length === 0) return;

    const top = Math.min(...neutral.map((c) => c.y)) - this.geometry.radius * 1.7;
    const bottom = Math.max(...neutral.map((c) => c.y)) + this.geometry.radius * 1.7;

    ctx.fillStyle = THEME.grid;
    ctx.fillRect(0, top, this.width, bottom - top);

    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("ZONE NEUTRE — seul territoire moissonnable", 14, top + 8);
  }

  private drawPreview(view: ViewState): void {
    if (view.preview.length === 0) return;
    const ctx = this.ctx;
    const centers = this.geometry.centers;

    const source = view.hovered !== null ? centers[view.hovered] : null;
    if (!source) return;

    ctx.save();
    ctx.strokeStyle = THEME.preview;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.moveTo(source.x, source.y);
    for (const node of view.preview) {
      const center = centers[node]!;
      ctx.lineTo(center.x, center.y);
    }
    ctx.stroke();
    ctx.restore();

    // On marque où le dernier Jeton se posera — mais PAS s'il capture.
    // Savoir si le coup moissonne est justement ce que le joueur doit
    // calculer ; l'afficher tuerait le suspense de la chaîne (carnet §11.1).
    // D'où un anneau neutre, et surtout pas la couleur de la Moisson.
    const last = view.preview.at(-1);
    if (last !== undefined) {
      const center = centers[last]!;
      ctx.save();
      ctx.strokeStyle = THEME.text;
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(center.x, center.y, this.geometry.radius * 1.24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawNodes(view: ViewState, playable: ReadonlySet<NodeId>): void {
    const ctx = this.ctx;
    const { zones } = this.config.circuit;
    const radius = this.geometry.radius;

    for (let node = 0; node < this.geometry.centers.length; node++) {
      const center = this.geometry.centers[node]!;
      const harvestable = this.config.rules.harvestableZones.includes(zones[node]!);
      const pulse = view.pulses.get(node);
      const glow = view.chainGlow.get(node) ?? 0;

      const scale = 1 + (pulse ? pulse.life * 0.09 : 0);
      const r = radius * scale;

      if (glow > 0) {
        ctx.save();
        ctx.globalAlpha = glow * 0.55;
        ctx.fillStyle = THEME.harvest;
        ctx.beginPath();
        ctx.arc(center.x, center.y, r * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // La fenêtre de capture se lit sur le Nœud lui-même. C'est ce qu'un
      // joueur voit d'un coup d'œil sur un plateau physique, et que des
      // chiffres nus ne donnent pas (carnet §13.3).
      const status = this.status[node] ?? "out";
      ctx.fillStyle = harvestable
        ? status === "ready"
          ? THEME.nodeReady
          : status === "arming"
            ? THEME.nodeArming
            : THEME.neutralNode
        : THEME.playerNode;
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineWidth = playable.has(node) ? 2.5 : 1.5;
      ctx.strokeStyle = pulse
        ? pulse.kind === "module"
          ? THEME.charge
          : pulse.kind === "harvest"
            ? THEME.harvest
            : THEME.text
        : playable.has(node)
          ? THEME.nodeEdgePlayable
          : THEME.nodeEdge;
      ctx.stroke();

      // HIÉRARCHIE : le nombre de Jetons d'abord, et de loin.
      const count = view.tokens[node] ?? 0;
      ctx.fillStyle =
        status === "ready" ? THEME.harvest : count === 0 ? THEME.textDim : THEME.text;
      ctx.font = `700 ${Math.round(radius * 0.95)}px system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(count), center.x, center.y);

      // Le Module ensuite, plus petit, hors du cercle. Toujours du côté
      // EXTÉRIEUR du plateau, pour ne jamais empiéter sur l'autre rangée.
      const moduleId = this.config.placements.find((p) => p.nodeId === node)?.moduleId;
      if (moduleId) {
        const def = this.config.registry.get(moduleId);
        const cell = this.config.circuit.layout[node]!;
        const above = cell.row < this.rows / 2;
        ctx.fillStyle = THEME.charge;
        ctx.font = "600 12px system-ui, sans-serif";
        ctx.textBaseline = above ? "bottom" : "top";
        ctx.fillText(
          def?.label ?? moduleId,
          center.x,
          center.y + (above ? -radius * 1.35 : radius * 1.35),
        );
        ctx.textBaseline = "middle";
      }
    }
  }

  private drawFlyingToken(view: ViewState, progress: number): void {
    if (!view.flying) return;
    const from = this.geometry.centers[view.flying.from];
    const to = this.geometry.centers[view.flying.to];
    if (!from || !to) return;

    const t = Math.min(1, Math.max(0, progress));
    // Un arc, pas une ligne droite : le Jeton doit avoir un poids.
    const eased = t * t * (3 - 2 * t);
    const x = from.x + (to.x - from.x) * eased;
    const y = from.y + (to.y - from.y) * eased - Math.sin(t * Math.PI) * this.geometry.radius * 0.9;

    const ctx = this.ctx;
    ctx.fillStyle = THEME.token;
    ctx.beginPath();
    ctx.arc(x, y, this.geometry.radius * 0.19, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHud(view: ViewState): void {
    const ctx = this.ctx;
    ctx.textBaseline = "top";

    ctx.textAlign = "left";
    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText("SCORE", 22, 18);

    const score = `${view.score}`;
    ctx.font = "800 34px system-ui, sans-serif";
    const scoreWidth = ctx.measureText(score).width;
    ctx.fillStyle = view.score >= view.quota ? THEME.harvest : THEME.text;
    ctx.fillText(score, 22, 34);

    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 14px system-ui, sans-serif";
    ctx.fillText(`/ ${view.quota}`, 22 + scoreWidth + 8, 52);

    // La Charge, dans sa couleur dédiée.
    ctx.textAlign = "right";
    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.fillText("CHARGE", this.width - 22, 18);

    ctx.fillStyle = THEME.charge;
    ctx.font = "800 34px system-ui, sans-serif";
    ctx.fillText(`×${view.charge}`, this.width - 22, 34);

    ctx.textAlign = "center";
    ctx.fillStyle = THEME.textDim;
    ctx.font = "600 13px system-ui, sans-serif";
    const turnLabel = view.replayPending
      ? `TOUR ${Math.min(view.turn + 1, view.turnLimit)} / ${view.turnLimit}  ·  REJOUER ${view.replaysUsed}/${view.maxReplays}`
      : `TOUR ${Math.min(view.turn + 1, view.turnLimit)} / ${view.turnLimit}`;
    ctx.fillText(turnLabel, this.width / 2, 22);

    ctx.fillStyle = THEME.textDim;
    ctx.font = "500 11px system-ui, sans-serif";
    ctx.textBaseline = "bottom";
    ctx.fillText(
      view.ended
        ? "R — nouvelle manche   ·   M — son"
        : "clic — distribuer   ·   espace — accélérer   ·   R — nouvelle manche   ·   M — son",
      this.width / 2,
      this.height - 12,
    );
  }

  private drawBanner(view: ViewState): void {
    if (!view.banner) return;
    const ctx = this.ctx;
    const { text, tone, life } = view.banner;

    const alpha = Math.min(1, life * 1.6);
    const rise = (1 - life) * 14;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const color =
      tone === "harvest"
        ? THEME.harvest
        : tone === "replay"
          ? THEME.charge
          : tone === "end"
            ? THEME.text
            : THEME.textDim;

    // Le nombre final doit devenir trop gros pour sa boîte (carnet §11.2) —
    // mais sous le plateau, jamais par-dessus : au moment où le score tombe,
    // le joueur regarde encore les Nœuds qui viennent d'être moissonnés.
    const size = tone === "harvest" ? 46 : 26;
    ctx.fillStyle = color;
    ctx.font = `800 ${size}px system-ui, sans-serif`;
    ctx.fillText(text, this.width / 2, this.height * 0.87 - rise);
    ctx.restore();
  }
}
