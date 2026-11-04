export const PANEL_LEDS = 16;
export const NUM_PANELS = 4;
export const FRAME_BYTES = NUM_PANELS * PANEL_LEDS * 3;

export type EffectState = {
  mode: string;
  bri: number;    // 0..255
  speed: number;  // period ms
  hue: number;    // 0..255
  sat: number;    // 0..255
};

export type EffectCtx = Record<string, unknown>;

export type EffectFn = (
  frame: Uint8Array,
  state: EffectState,
  tMs: number,
  ctx: EffectCtx,
) => void;

export type EffectDef = {
  id: string;        // wire name sent to ESP
  label: string;
  blurb: string;
  render: EffectFn;
};

// ── util ────────────────────────────────────────────────────────────────
export const clamp = (v: number, lo: number, hi: number) =>
  v < lo ? lo : v > hi ? hi : v;

export const setLed = (
  frame: Uint8Array,
  panel: number,
  idx: number,
  r: number,
  g: number,
  b: number,
) => {
  const o = (panel * PANEL_LEDS + idx) * 3;
  frame[o] = r; frame[o + 1] = g; frame[o + 2] = b;
};

export const addLed = (
  frame: Uint8Array,
  panel: number,
  idx: number,
  r: number,
  g: number,
  b: number,
) => {
  const o = (panel * PANEL_LEDS + idx) * 3;
  frame[o]     = Math.min(255, frame[o]     + r);
  frame[o + 1] = Math.min(255, frame[o + 1] + g);
  frame[o + 2] = Math.min(255, frame[o + 2] + b);
};

export const fadeAll = (frame: Uint8Array, by: number) => {
  const k = (255 - by) / 255;
  for (let i = 0; i < frame.length; i++) frame[i] = Math.max(0, Math.floor(frame[i] * k));
};

// FastLED-ish HSV → RGB (close enough for preview parity)
export function hsv2rgb(h255: number, s255: number, v255: number): [number, number, number] {
  const h = (((h255 % 256) + 256) % 256) / 255;
  const s = clamp(s255, 0, 255) / 255;
  const v = clamp(v255, 0, 255) / 255;
  const H = h * 360;
  const C = v * s;
  const X = C * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = v - C;
  let r = 0, g = 0, b = 0;
  if (H < 60)       [r, g, b] = [C, X, 0];
  else if (H < 120) [r, g, b] = [X, C, 0];
  else if (H < 180) [r, g, b] = [0, C, X];
  else if (H < 240) [r, g, b] = [0, X, C];
  else if (H < 300) [r, g, b] = [X, 0, C];
  else              [r, g, b] = [C, 0, X];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

// cubic wave 0..255 → 0..255 (matches FastLED.cubicwave8 shape)
export const cubicwave8 = (x: number) => {
  const t = (x % 256) / 256;
  const s = Math.sin(t * Math.PI * 2) * 0.5 + 0.5;
  return Math.round(s * 255);
};

export const easeInOutQuad = (t: number) => {
  const n = t / 255;
  const v = n < 0.5 ? 2 * n * n : 1 - Math.pow(-2 * n + 2, 2) / 2;
  return Math.round(v * 255);
};

// HeatColor: FastLED's black-body-radiation palette
export function heatColor(h: number): [number, number, number] {
  h = clamp(h | 0, 0, 255);
  const t192 = Math.round((h / 255) * 191);
  const heatramp = (t192 & 0x3f) << 2;
  if (t192 & 0x80) return [255, 255, heatramp];
  if (t192 & 0x40) return [255, heatramp, 0];
  return [heatramp, 0, 0];
}

// Mulberry32 PRNG — deterministic when needed, but we seed from Math.random
let _seed = (Math.random() * 0xffffffff) | 0;
export function rand8(): number {
  _seed = (_seed + 0x6D2B79F5) | 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) & 0xff;
}
