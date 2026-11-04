/**
 * Keyframe-based custom effect engine.
 *
 * A KeyframeEffect defines a sequence of full-frame snapshots ("keyframes"),
 * each at a specific time within the effect's duration. The renderer linearly
 * interpolates colors between adjacent keyframes for the current playback
 * time. Panels not in a keyframe's `panels` mask are left untouched (stay at
 * whatever the previous keyframe set, or black if none).
 *
 * Stored in localStorage as JSON. Each effect registers itself as an EffectDef
 * so the rest of the dashboard treats it identically to builtin effects.
 */

import {
  PANEL_LEDS,
  NUM_PANELS,
  type EffectDef,
  type EffectState,
  setLed,
} from "./types";

export type RGB = [number, number, number];

export type Keyframe = {
  /** time within the effect's duration, 0..duration */
  t: number;
  /** which panels this keyframe affects (the rest pass through) */
  panels: number[];
  /** colors[panel][ledIdx] = [r, g, b] (only for panels in `panels`) */
  colors: Record<number, RGB[]>;
};

export type KeyframeEffectDef = {
  id: string;
  label: string;
  blurb: string;
  duration: number; // ms
  loop: boolean;
  keyframes: Keyframe[];
};

const STORAGE_KEY = "led-panel:keyframe-effects";

// ─── persistence (cached — render loop hits this every frame) ──────────
let cache: KeyframeEffectDef[] | null = null;

function readStorage(): KeyframeEffectDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidEffect);
  } catch {
    return [];
  }
}

export function loadKeyframeEffects(): KeyframeEffectDef[] {
  if (cache === null) cache = readStorage();
  return cache;
}

function writeStorage(all: KeyframeEffectDef[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  cache = all;
}

export function saveKeyframeEffect(effect: KeyframeEffectDef) {
  const all = [...loadKeyframeEffects()];
  const idx = all.findIndex((e) => e.id === effect.id);
  if (idx >= 0) all[idx] = effect;
  else all.push(effect);
  writeStorage(all);
}

export function deleteKeyframeEffect(id: string) {
  writeStorage(loadKeyframeEffects().filter((e) => e.id !== id));
}

function isValidEffect(o: any): o is KeyframeEffectDef {
  return (
    o &&
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.duration === "number" &&
    Array.isArray(o.keyframes)
  );
}

// ─── factory + helpers ──────────────────────────────────────────────────
export function newEffect(): KeyframeEffectDef {
  const id = `kf-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  return {
    id,
    label: "Untitled",
    blurb: "keyframe",
    duration: 4000,
    loop: true,
    keyframes: [emptyKeyframe(0)],
  };
}

export function emptyKeyframe(t: number): Keyframe {
  const colors: Record<number, RGB[]> = {};
  const panels: number[] = [];
  for (let p = 0; p < NUM_PANELS; p++) {
    panels.push(p);
    colors[p] = Array.from({ length: PANEL_LEDS }, () => [0, 0, 0] as RGB);
  }
  return { t, panels, colors };
}

export function cloneKeyframe(kf: Keyframe, newT: number): Keyframe {
  const colors: Record<number, RGB[]> = {};
  for (const p of Object.keys(kf.colors)) {
    colors[+p] = kf.colors[+p].map((c) => [...c] as RGB);
  }
  return { t: newT, panels: [...kf.panels], colors };
}

// ─── playback ───────────────────────────────────────────────────────────
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpColor(a: RGB, b: RGB, t: number): RGB {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Returns a render function compatible with EffectDef.render. */
function makePlayer(effect: KeyframeEffectDef) {
  return (frame: Uint8Array, _s: EffectState, tMs: number) => {
    const kfs = [...effect.keyframes].sort((a, b) => a.t - b.t);
    if (kfs.length === 0) return;
    const dur = Math.max(1, effect.duration);
    const phase = effect.loop ? tMs % dur : Math.min(tMs, dur);

    // For each panel, find the relevant pair of keyframes that "own" it.
    for (let p = 0; p < NUM_PANELS; p++) {
      const owning = kfs.filter((k) => k.panels.includes(p));
      if (owning.length === 0) continue;

      // Find before/after
      let before = owning[owning.length - 1];
      let after = owning[0];
      let beforeT = before.t - dur; // wrap
      let afterT = after.t;

      for (let i = 0; i < owning.length; i++) {
        const k = owning[i];
        if (k.t <= phase) {
          before = k;
          beforeT = k.t;
          after = owning[(i + 1) % owning.length];
          afterT = i + 1 < owning.length ? owning[i + 1].t : owning[0].t + dur;
        }
      }

      const span = afterT - beforeT;
      const u = span <= 0 ? 0 : (phase - beforeT) / span;

      const a = before.colors[p] ?? [];
      const b = after.colors[p] ?? a;
      for (let i = 0; i < PANEL_LEDS; i++) {
        const ca: RGB = a[i] ?? [0, 0, 0];
        const cb: RGB = b[i] ?? ca;
        const [r, g, by] = lerpColor(ca, cb, u);
        setLed(frame, p, i, r | 0, g | 0, by | 0);
      }
    }
  };
}

export function asEffectDef(effect: KeyframeEffectDef): EffectDef {
  return {
    id: effect.id,
    label: effect.label,
    blurb: effect.blurb,
    render: makePlayer(effect),
  };
}
