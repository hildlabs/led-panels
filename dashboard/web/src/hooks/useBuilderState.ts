import { useEffect, useMemo, useRef, useState } from "react";
import {
  cloneKeyframe,
  emptyKeyframe,
  saveKeyframeEffect,
  type Keyframe,
  type KeyframeEffectDef,
  type RGB,
} from "../effects/keyframe";
import { NUM_PANELS, PANEL_LEDS } from "../effects/types";
import { bytesToHex, postCommand } from "../lib/api";

export type Tool = "pencil" | "rect" | "fill" | "erase";

const hexToRgb = (hex: string): RGB => {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
};

/** Build a render frame for a single keyframe (no interpolation). */
function frameFromKeyframe(kf: Keyframe): Uint8Array {
  const frame = new Uint8Array(NUM_PANELS * PANEL_LEDS * 3);
  for (const p of kf.panels) {
    const arr = kf.colors[p];
    if (!arr) continue;
    for (let i = 0; i < PANEL_LEDS; i++) {
      const o = (p * PANEL_LEDS + i) * 3;
      frame[o] = arr[i][0];
      frame[o + 1] = arr[i][1];
      frame[o + 2] = arr[i][2];
    }
  }
  return frame;
}

/** Lerp the full effect into a frame at time `t`. */
export function buildInterpFrame(
  effect: KeyframeEffectDef,
  t: number,
): Uint8Array {
  const frame = new Uint8Array(NUM_PANELS * PANEL_LEDS * 3);
  const kfs = [...effect.keyframes].sort((a, b) => a.t - b.t);
  if (kfs.length === 0) return frame;
  const dur = Math.max(1, effect.duration);
  const phase = effect.loop ? t % dur : Math.min(t, dur);

  for (let p = 0; p < NUM_PANELS; p++) {
    const owning = kfs.filter((k) => k.panels.includes(p));
    if (owning.length === 0) continue;

    let before = owning[owning.length - 1];
    let after = owning[0];
    let beforeT = before.t - dur;
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
      const o = (p * PANEL_LEDS + i) * 3;
      frame[o] = (ca[0] + (cb[0] - ca[0]) * u) | 0;
      frame[o + 1] = (ca[1] + (cb[1] - ca[1]) * u) | 0;
      frame[o + 2] = (ca[2] + (cb[2] - ca[2]) * u) | 0;
    }
  }
  return frame;
}

export function useBuilderState(initial: KeyframeEffectDef) {
  const [effect, setEffect] = useState<KeyframeEffectDef>(() => deepClone(initial));
  const [activeKf, setActiveKf] = useState(0);
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#ffb454");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [playing, setPlaying] = useState(false);
  const [playT, setPlayT] = useState(0);

  // Playback engine
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const start = performance.now();
    const tick = () => {
      const now = performance.now();
      setPlayT(((now - start) % effect.duration) | 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, effect.duration]);

  // Keep activeKf valid when keyframes change
  useEffect(() => {
    if (activeKf >= effect.keyframes.length) {
      setActiveKf(Math.max(0, effect.keyframes.length - 1));
    }
  }, [effect.keyframes.length, activeKf]);

  const kf = effect.keyframes[activeKf] ?? effect.keyframes[0];

  const editingFrame = useMemo(() => frameFromKeyframe(kf), [kf]);
  const liveFrame = playing ? buildInterpFrame(effect, playT) : editingFrame;

  // Push the live frame to the physical panels while playing. The firmware
  // honors any frame: command for ~250ms; sending at 20fps keeps it fresh.
  const liveFrameRef = useRef(liveFrame);
  liveFrameRef.current = liveFrame;

  useEffect(() => {
    if (!playing) return;
    let cancelled = false;
    let inflight = false;
    const FRAME_INTERVAL_MS = 50; // 20 fps

    const tick = async () => {
      if (cancelled) return;
      const f = liveFrameRef.current;
      if (f && !inflight) {
        inflight = true;
        try {
          await postCommand(`frame:${bytesToHex(f)}`);
        } finally {
          inflight = false;
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, FRAME_INTERVAL_MS);
    };

    let timer: number = window.setTimeout(tick, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      // No mode-restore needed — once frames stop, firmware reverts to its
      // current mode after STREAM_OVERRIDE_MS (250ms).
    };
  }, [playing]);

  // ── mutations ────────────────────────────────────────────────────────
  const updateEffect = (patch: Partial<KeyframeEffectDef>) =>
    setEffect((e) => ({ ...e, ...patch }));

  const updateKeyframe = (idx: number, patch: Partial<Keyframe>) =>
    setEffect((e) => {
      const kfs = [...e.keyframes];
      kfs[idx] = { ...kfs[idx], ...patch };
      return { ...e, keyframes: kfs };
    });

  const addKeyframe = () => {
    setEffect((e) => {
      const lastT = Math.max(0, ...e.keyframes.map((k) => k.t));
      const newT = Math.min(e.duration, lastT + Math.round(e.duration / 4));
      const base = e.keyframes[e.keyframes.length - 1] ?? emptyKeyframe(newT);
      const next = cloneKeyframe(base, newT);
      const kfs = [...e.keyframes, next].sort((a, b) => a.t - b.t);
      return { ...e, keyframes: kfs };
    });
    setActiveKf((i) => i + 1);
  };

  const deleteKeyframe = () => {
    if (effect.keyframes.length <= 1) return;
    setEffect((e) => ({
      ...e,
      keyframes: e.keyframes.filter((_, i) => i !== activeKf),
    }));
    setActiveKf((i) => Math.max(0, i - 1));
  };

  const deleteKeyframeAt = (idx: number) => {
    if (effect.keyframes.length <= 1) return;
    setEffect((e) => ({
      ...e,
      keyframes: e.keyframes.filter((_, i) => i !== idx),
    }));
    setActiveKf((curr) => {
      if (curr === idx) return Math.max(0, curr - 1);
      if (curr > idx) return curr - 1;
      return curr;
    });
  };

  const setLedColor = (panel: number, led: number, rgb: RGB) => {
    setEffect((e) => {
      const kfs = [...e.keyframes];
      const cur = { ...kfs[activeKf] };
      const colors = { ...cur.colors };
      const arr = (
        colors[panel] ??
        Array.from({ length: PANEL_LEDS }, () => [0, 0, 0] as RGB)
      ).map((c) => [...c] as RGB);
      arr[led] = [...rgb];
      colors[panel] = arr;
      const panels = cur.panels.includes(panel)
        ? cur.panels
        : [...cur.panels, panel].sort();
      kfs[activeKf] = { ...cur, colors, panels };
      return { ...e, keyframes: kfs };
    });
  };

  const togglePanelMask = (p: number) => {
    setEffect((e) => {
      const kfs = [...e.keyframes];
      const cur = kfs[activeKf];
      const has = cur.panels.includes(p);
      const panels = has
        ? cur.panels.filter((x) => x !== p)
        : [...cur.panels, p].sort();
      kfs[activeKf] = { ...cur, panels };
      return { ...e, keyframes: kfs };
    });
  };

  const cellKeyRef = useRef((p: number, l: number) => `${p}:${l}`);
  const cellKey = cellKeyRef.current;

  const applyTool = (cells: Array<{ panel: number; led: number; kind: string }>) => {
    const targets = cells.filter((c) => c.kind === "led");
    if (targets.length === 0) return;
    if (tool === "pencil") {
      const rgb = hexToRgb(color);
      for (const c of targets) setLedColor(c.panel, c.led, rgb);
    } else if (tool === "erase") {
      for (const c of targets) setLedColor(c.panel, c.led, [0, 0, 0]);
    } else if (tool === "fill") {
      const rgb = hexToRgb(color);
      for (const p of kf.panels) {
        for (let i = 0; i < PANEL_LEDS; i++) setLedColor(p, i, rgb);
      }
    } else if (tool === "rect") {
      const next = new Set(selection);
      for (const c of targets) {
        const k = cellKey(c.panel, c.led);
        if (next.has(k)) next.delete(k);
        else next.add(k);
      }
      setSelection(next);
    }
  };

  const applyColorToSelection = () => {
    const rgb = hexToRgb(color);
    selection.forEach((k) => {
      const [p, l] = k.split(":").map((n) => parseInt(n, 10));
      setLedColor(p, l, rgb);
    });
  };

  const clearSelection = () => setSelection(new Set());

  const save = () => {
    saveKeyframeEffect(effect);
  };

  return {
    // state
    effect,
    activeKf,
    kf,
    tool,
    color,
    selection,
    playing,
    playT,
    editingFrame,
    liveFrame,
    // setters
    setActiveKf,
    setTool,
    setColor,
    setSelection,
    setPlaying,
    setPlayT,
    // actions
    updateEffect,
    updateKeyframe,
    addKeyframe,
    deleteKeyframe,
    deleteKeyframeAt,
    setLedColor,
    togglePanelMask,
    applyTool,
    applyColorToSelection,
    clearSelection,
    cellKey,
    save,
  };
}

export type BuilderState = ReturnType<typeof useBuilderState>;

function deepClone(e: KeyframeEffectDef): KeyframeEffectDef {
  return {
    ...e,
    keyframes: e.keyframes.map((k) => ({
      t: k.t,
      panels: [...k.panels],
      colors: Object.fromEntries(
        Object.entries(k.colors).map(([p, arr]) => [
          p,
          arr.map((c) => [...c] as RGB),
        ]),
      ),
    })),
  };
}
