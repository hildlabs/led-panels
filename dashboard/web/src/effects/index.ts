import {
  cubicwave8,
  easeInOutQuad,
  fadeAll,
  hsv2rgb,
  heatColor,
  rand8,
  setLed,
  addLed,
  PANEL_LEDS,
  NUM_PANELS,
  type EffectDef,
  type EffectState,
} from "./types";

const fillSolid = (frame: Uint8Array, r: number, g: number, b: number) => {
  for (let i = 0; i < frame.length; i += 3) {
    frame[i] = r; frame[i + 1] = g; frame[i + 2] = b;
  }
};

// ─── Effects ─────────────────────────────────────────────────────────────
// Infinity — four flares chase around each panel, 25% phase-offset.
const infinity = (frame: Uint8Array, s: EffectState, t: number) => {
  fadeAll(frame, 35);
  const basePhase = (t % s.speed) / s.speed; // 0..1
  const [r, g, b] = hsv2rgb(s.hue, s.sat, 255);
  const hotR = Math.round(255 * 0.55);
  const hotG = Math.round(230 * 0.55);
  const hotB = Math.round(200 * 0.55);
  for (let p = 0; p < NUM_PANELS; p++) {
    const phase = (basePhase + p / NUM_PANELS) % 1;
    const sub = phase * PANEL_LEDS;
    const idx = Math.floor(sub) % PANEL_LEDS;
    const frac = (sub - Math.floor(sub)) * 255;
    const headK = (255 - frac) / 255;
    const nextK = frac / 255;
    addLed(frame, p, idx,              Math.round(r * headK), Math.round(g * headK), Math.round(b * headK));
    addLed(frame, p, (idx + 1) & 15,   Math.round(r * nextK), Math.round(g * nextK), Math.round(b * nextK));
    addLed(frame, p, idx,              Math.round(hotR * headK), Math.round(hotG * headK), Math.round(hotB * headK));
    addLed(frame, p, (idx + 1) & 15,   Math.round(hotR * nextK), Math.round(hotG * nextK), Math.round(hotB * nextK));
  }
};

const solid = (frame: Uint8Array, s: EffectState) => {
  const [r, g, b] = hsv2rgb(s.hue, s.sat, 255);
  fillSolid(frame, r, g, b);
};

// Pulse — cascading cubic breath across panels.
const pulse = (frame: Uint8Array, s: EffectState, t: number) => {
  for (let p = 0; p < NUM_PANELS; p++) {
    const phase = (((t + (p * s.speed) / NUM_PANELS) % s.speed) / s.speed);
    const v = cubicwave8(Math.floor(phase * 256));
    const [r, g, b] = hsv2rgb(s.hue, s.sat, v);
    for (let i = 0; i < PANEL_LEDS; i++) setLed(frame, p, i, r, g, b);
  }
};

// Rainbow — single continuous gradient stretched over all 4 panels.
const rainbow = (frame: Uint8Array, s: EffectState, t: number) => {
  const base = Math.floor(((t % s.speed) / s.speed) * 256);
  for (let p = 0; p < NUM_PANELS; p++) {
    const panelOff = p * 64;
    for (let i = 0; i < PANEL_LEDS; i++) {
      const h = (base + panelOff + i * 4) & 0xff;
      const [r, g, b] = hsv2rgb(h, s.sat, 255);
      setLed(frame, p, i, r, g, b);
    }
  }
};

// Comet — rolling head through all four panels, same direction, phase-offset.
const comet = (frame: Uint8Array, s: EffectState, t: number) => {
  fadeAll(frame, 40);
  const phase = (t % s.speed) / s.speed;
  const baseIdx = Math.floor(phase * PANEL_LEDS) % PANEL_LEDS;
  const [r, g, b] = hsv2rgb(s.hue, s.sat, 255);
  for (let p = 0; p < NUM_PANELS; p++) {
    const i = (baseIdx + p * 4) & 15;
    setLed(frame, p, i, r, g, b);
  }
};

// Theater — triad chase offset per panel → horizontal barber-pole.
const theater = (frame: Uint8Array, s: EffectState, t: number) => {
  const tick = Math.max(50, Math.floor(s.speed / 20));
  const base = Math.floor(t / tick);
  const [r, g, b] = hsv2rgb(s.hue, s.sat, 255);
  for (let p = 0; p < NUM_PANELS; p++) {
    const step = (base + p) % 3;
    for (let i = 0; i < PANEL_LEDS; i++) {
      if (i % 3 === step) setLed(frame, p, i, r, g, b);
      else                setLed(frame, p, i, 0, 0, 0);
    }
  }
};

type FireCtx = { heat: Uint8Array[]; last: number };
const fire = (frame: Uint8Array, s: EffectState, t: number, ctx: any) => {
  const c: FireCtx = ctx.fire ?? (ctx.fire = {
    heat: Array.from({ length: NUM_PANELS }, () => new Uint8Array(PANEL_LEDS)),
    last: 0,
  });
  const interval = Math.max(10, Math.floor(s.speed / 60));
  if (t - c.last > interval) {
    c.last = t;
    for (let p = 0; p < NUM_PANELS; p++) {
      const h = c.heat[p];
      for (let i = 0; i < PANEL_LEDS; i++) {
        h[i] = Math.max(0, h[i] - ((rand8() * 40) >> 8));
      }
      for (let i = PANEL_LEDS - 1; i >= 2; i--) {
        h[i] = Math.floor((h[i - 1] + h[i - 2] + h[i - 2]) / 3);
      }
      if (rand8() < 120) {
        const y = rand8() % 3;
        h[y] = Math.min(255, h[y] + (rand8() % 96) + 160);
      }
    }
  }
  for (let p = 0; p < NUM_PANELS; p++) {
    const h = c.heat[p];
    for (let i = 0; i < PANEL_LEDS; i++) {
      const [r, g, b] = heatColor(h[i]);
      setLed(frame, p, i, r, g, b);
    }
  }
};

// Wipe — boundary sweeps across the panel row, reverses, repeats.
const wipe = (frame: Uint8Array, s: EffectState, t: number) => {
  const [rA, gA, bA] = hsv2rgb(s.hue, s.sat, 255);
  const [rB, gB, bB] = hsv2rgb((s.hue + 128) & 0xff, s.sat, 255);
  const phase = Math.floor(((t % s.speed) / s.speed) * 512);
  const half = phase >> 8;
  const sweep = phase & 0xff;
  for (let p = 0; p < NUM_PANELS; p++) {
    const thresh = p * 64 + 32;
    const crossed = sweep > thresh;
    const useA = half === 1 ? crossed : !crossed;
    const R = useA ? rA : rB;
    const G = useA ? gA : gB;
    const B = useA ? bA : bB;
    for (let i = 0; i < PANEL_LEDS; i++) setLed(frame, p, i, R, G, B);
  }
};

const breathe = (frame: Uint8Array, s: EffectState, t: number) => {
  const phase = (t % s.speed) / s.speed;
  const wave = Math.round((Math.sin(phase * Math.PI * 2) * 0.5 + 0.5) * 255);
  const v = easeInOutQuad(wave);
  const [r, g, b] = hsv2rgb(s.hue, s.sat, v);
  fillSolid(frame, r, g, b);
};

// ─── Registry ────────────────────────────────────────────────────────────
import { CUSTOM_EFFECTS } from "./custom";
import {
  loadKeyframeEffects,
  asEffectDef as keyframeAsEffectDef,
} from "./keyframe";

const BUILTIN_EFFECTS: EffectDef[] = [
  { id: "infinity", label: "Infinity",  blurb: "figure-8 flare", render: infinity },
  { id: "solid",    label: "Solid",     blurb: "steady fill",    render: solid },
  { id: "pulse",    label: "Pulse",     blurb: "cubic wave",     render: pulse },
  { id: "rainbow",  label: "Rainbow",   blurb: "hue drift",      render: rainbow },
  { id: "comet",    label: "Comet",     blurb: "mirror chase",   render: comet },
  { id: "theater",  label: "Theater",   blurb: "triad march",    render: theater },
  { id: "fire",     label: "Fire",      blurb: "black-body",     render: fire },
  { id: "wipe",     label: "Wipe",      blurb: "color alternation", render: wipe },
  { id: "breathe",  label: "Breathe",   blurb: "eased sinus",    render: breathe },
];

export const EFFECTS: EffectDef[] = [...BUILTIN_EFFECTS, ...CUSTOM_EFFECTS];

export const effectById = (id: string): EffectDef => {
  const builtin = EFFECTS.find((e) => e.id === id);
  if (builtin) return builtin;
  // fallback: maybe a keyframe effect
  const kf = loadKeyframeEffects().find((e) => e.id === id);
  if (kf) return keyframeAsEffectDef(kf);
  return EFFECTS[0];
};
