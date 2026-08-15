/**
 * Le son.
 *
 * Deux voix seulement, mais ce sont les deux du carnet §11.2 :
 *  - le CLAC, un par Jeton déposé, tempo régulier ;
 *  - la NOTE de chaîne, qui monte d'un demi-ton à chaque maillon.
 *
 * Aucun fichier audio : tout est synthétisé, pour que le tempo reste
 * exactement celui que le moteur dicte.
 */

const SEMITONE = 2 ** (1 / 12);

/** Nommée GameAudio pour ne pas masquer le constructeur Audio du DOM. */
export class GameAudio {
  private context: AudioContext | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;

  /** À appeler depuis un geste utilisateur : les navigateurs l'exigent. */
  unlock(): void {
    if (this.context) {
      void this.context.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as never as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.context = new Ctor();
    this.noise = this.makeNoise(this.context);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /**
   * Le clac. Un transitoire de bruit filtré plus un corps très court : c'est
   * percussif, sec, et ça supporte un tempo rapide sans devenir de la bouillie.
   *
   * `pitch` monte légèrement avec la Charge, pour que l'accélération s'entende
   * aussi en hauteur et pas seulement en vitesse.
   */
  clack(pitch = 1): void {
    const ctx = this.ready();
    if (!ctx || !this.noise) return;
    const now = ctx.currentTime;

    const source = ctx.createBufferSource();
    source.buffer = this.noise;

    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1500 * pitch;
    band.Q.value = 1.4;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    const body = ctx.createOscillator();
    body.type = "triangle";
    body.frequency.setValueAtTime(220 * pitch, now);
    body.frequency.exponentialRampToValueAtTime(110 * pitch, now + 0.05);

    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.18, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    source.connect(band).connect(gain).connect(ctx.destination);
    body.connect(bodyGain).connect(ctx.destination);

    source.start(now);
    source.stop(now + 0.08);
    body.start(now);
    body.stop(now + 0.08);
  }

  /**
   * Un maillon de chaîne. `step` est l'index du maillon : chaque maillon monte
   * d'un demi-ton. C'est le suspense du carnet §11.1.
   */
  chainLink(step: number): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;
    const frequency = 330 * SEMITONE ** step;

    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = frequency;

    const harmonic = ctx.createOscillator();
    harmonic.type = "sine";
    harmonic.frequency.value = frequency * 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    const harmonicGain = ctx.createGain();
    harmonicGain.gain.setValueAtTime(0.0001, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain).connect(ctx.destination);
    harmonic.connect(harmonicGain).connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.34);
    harmonic.start(now);
    harmonic.stop(now + 0.34);
  }

  /** La rupture de chaîne : une note sourde qui descend, puis le silence. */
  chainBroken(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.28);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  /** Un Module se déclenche : un petit éclat clair, distinct du clac. */
  spark(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  /** Le total qui tombe. */
  impact(): void {
    const ctx = this.ready();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.4);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }

  private ready(): AudioContext | null {
    if (this.muted) return null;
    return this.context;
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      // Décroissance rapide : c'est ce qui rend le transitoire sec.
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    return buffer;
  }
}
