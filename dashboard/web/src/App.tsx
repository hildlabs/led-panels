import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Scene3D } from "./components/Scene3D";
import { EffectPicker } from "./components/EffectPicker";
import { Slider } from "./components/Slider";
import { EditSidebar } from "./components/builder/EditSidebar";
import { LedGridEditor } from "./components/builder/LedGridEditor";
import { KeyframeBar } from "./components/builder/KeyframeBar";
import { useConnection } from "./hooks/useConnection";
import { useEffectEngine } from "./hooks/useEffectEngine";
import { useBuilderState } from "./hooks/useBuilderState";
import {
  FRAME_BYTES,
  NUM_PANELS,
  PANEL_LEDS,
  type EffectState,
  hsv2rgb,
} from "./effects/types";
import { bytesToHex, fetchState, patchState, postCommand } from "./lib/api";
import {
  loadKeyframeEffects,
  newEffect,
  type KeyframeEffectDef,
} from "./effects/keyframe";

const DEFAULT_STATE: EffectState = {
  mode: "infinity",
  bri: 170,
  speed: 3000,
  hue: 170,
  sat: 210,
};

export const rateToPeriod = (r: number) => Math.round(8000 - (r / 100) * 7700);
export const periodToRate = (p: number) => Math.round(((8000 - p) / 7700) * 100);

const TOTAL_LEDS = NUM_PANELS * PANEL_LEDS;

export default function App() {
  const [state, setState] = useState<EffectState>(DEFAULT_STATE);
  const status = useConnection(2500);
  const frameRef = useRef<Uint8Array>(new Uint8Array(FRAME_BYTES));
  useEffectEngine(state, frameRef);

  const [editor, setEditor] = useState<KeyframeEffectDef | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current || !status.reachable) return;
    hydrated.current = true;
    fetchState().then((s) => {
      if (s) setState((cur) => ({ ...cur, ...s }));
    });
  }, [status.reachable]);

  // While a custom keyframe effect is active in browse mode, stream the
  // computed frame to the panels (the firmware doesn't know custom effects).
  useEffect(() => {
    if (editor) return;
    const isKeyframe = loadKeyframeEffects().some((e) => e.id === state.mode);
    if (!isKeyframe) return;
    let cancelled = false;
    let inflight = false;
    const FRAME_INTERVAL_MS = 50; // 20 fps
    const tick = async () => {
      if (cancelled) return;
      const f = frameRef.current;
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
    };
  }, [state.mode, editor, refreshKey]);

  useEffect(() => {
    const [r, g, b] = hsv2rgb(state.hue, Math.max(state.sat, 160), 255);
    const css = `rgb(${r}, ${g}, ${b})`;
    document.documentElement.style.setProperty("--accent", css);
    document.documentElement.style.setProperty(
      "--accent-soft",
      `rgba(${r}, ${g}, ${b}, 0.25)`,
    );
  }, [state.hue, state.sat]);

  const postTimer = useRef<number | null>(null);
  const lastSent = useRef<Partial<EffectState>>({});

  const apply = (patch: Partial<EffectState>) => {
    setState((cur) => ({ ...cur, ...patch }));
    if (postTimer.current) window.clearTimeout(postTimer.current);
    postTimer.current = window.setTimeout(() => {
      const merged = { ...lastSent.current, ...patch };
      lastSent.current = {};
      if (Object.keys(merged).length) patchState(merged);
    }, 40);
    lastSent.current = { ...lastSent.current, ...patch };
  };

  const rate = useMemo(() => periodToRate(state.speed), [state.speed]);

  const hueGradient = useMemo(() => {
    const stops: string[] = [];
    for (let i = 0; i <= 12; i++) {
      const h = Math.round((i / 12) * 255);
      const [r, g, b] = hsv2rgb(h, 255, 255);
      stops.push(`rgb(${r},${g},${b}) ${(i / 12) * 100}%`);
    }
    return `linear-gradient(90deg, ${stops.join(",")})`;
  }, []);

  const satGradient = useMemo(() => {
    const [rHi, gHi, bHi] = hsv2rgb(state.hue, 255, 255);
    return `linear-gradient(90deg, rgb(120,120,120) 0%, rgb(${rHi},${gHi},${bHi}) 100%)`;
  }, [state.hue]);

  return (
    <div className="h-screen w-screen flex flex-col bg-ink-900 text-ink-50 overflow-hidden">
      <Header
        status={status}
        accentCss={`rgb(${hsv2rgb(state.hue, state.sat, 255).join(",")})`}
      />

      {editor ? (
        <BuilderLayout
          initial={editor}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            setRefreshKey((k) => k + 1);
          }}
        />
      ) : (
        <BrowseLayout
          state={state}
          rate={rate}
          frameRef={frameRef}
          hueGradient={hueGradient}
          satGradient={satGradient}
          apply={apply}
          onSelect={(id) => apply({ mode: id })}
          onCreate={() => setEditor(newEffect())}
          onEdit={(e) => setEditor(e)}
          refreshKey={refreshKey}
        />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Browse layout (default mode)
// ───────────────────────────────────────────────────────────────────────
function BrowseLayout({
  state,
  rate,
  frameRef,
  hueGradient,
  satGradient,
  apply,
  onSelect,
  onCreate,
  onEdit,
  refreshKey,
}: {
  state: EffectState;
  rate: number;
  frameRef: React.MutableRefObject<Uint8Array>;
  hueGradient: string;
  satGradient: string;
  apply: (p: Partial<EffectState>) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onEdit: (e: KeyframeEffectDef) => void;
  refreshKey: number;
}) {
  return (
    <div className="flex-1 flex min-h-0 mode-fade">
      <div className="w-[340px] flex-shrink-0 min-h-0">
        <EffectPicker
          state={state}
          onSelect={onSelect}
          onCreate={onCreate}
          onEdit={onEdit}
          refreshKey={refreshKey}
        />
      </div>
      <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
        <div className="flex-1 min-h-0 flex flex-col">
          <Viewport state={state} rate={rate} frameRef={frameRef} />
        </div>
        <div className="flex-shrink-0 px-6 py-4 border-t border-ink-500/60 bg-ink-900/50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Slider
              label="Intensity"
              value={state.bri}
              min={0}
              max={255}
              onChange={(v) => apply({ bri: v })}
              format={(v) => String(v)}
            />
            <Slider
              label="Rate"
              value={rate}
              min={0}
              max={100}
              unit="%"
              onChange={(v) => apply({ speed: rateToPeriod(v) })}
              format={(v) => `${v}`}
            />
            <Slider
              label="Hue"
              value={state.hue}
              min={0}
              max={255}
              onChange={(v) => apply({ hue: v })}
              format={(v) => String(v)}
              gradient={hueGradient}
            />
            <Slider
              label="Saturation"
              value={state.sat}
              min={0}
              max={255}
              onChange={(v) => apply({ sat: v })}
              format={(v) => String(v)}
              gradient={satGradient}
            />
          </div>
          <div className="mt-3 flex justify-between caps text-ink-300">
            <span>
              CHANNEL A · {state.mode.padEnd(10, " ")} ·{" "}
              {rateToPeriod(rate)}ms/cycle
            </span>
            <span>SN · LP-MKII-0001</span>
          </div>
        </div>
      </main>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Builder layout (edit mode) — full layout swap, no modal
// ───────────────────────────────────────────────────────────────────────
function BuilderLayout({
  initial,
  onClose,
  onSaved,
}: {
  initial: KeyframeEffectDef;
  onClose: () => void;
  onSaved: () => void;
}) {
  const builder = useBuilderState(initial);
  const builderFrameRef = useRef<Uint8Array>(new Uint8Array(FRAME_BYTES));

  // pump the builder's live frame into the 3D viewport buffer
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      builderFrameRef.current.set(builder.liveFrame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [builder.liveFrame]);

  // keyboard shortcuts: 1·2·3·4 tools, esc clears selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "1") builder.setTool("pencil");
      else if (e.key === "2") builder.setTool("rect");
      else if (e.key === "3") builder.setTool("fill");
      else if (e.key === "4") builder.setTool("erase");
      else if (e.key === "Escape") builder.clearSelection();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [builder]);

  return (
    <div className="flex-1 grid grid-rows-[1fr_auto] grid-cols-[340px_1fr] min-h-0 mode-fade">
      <EditSidebar
        builder={builder}
        onSave={() => {
          builder.save();
          onSaved();
        }}
        onCancel={onClose}
      />
      <main className="flex flex-col min-h-0 overflow-hidden">
        <div className="relative flex-shrink-0 viewport-ticks scanlines overflow-hidden border-b border-ink-500" style={{ height: "42%" }}>
          <span className="tick-tl" />
          <span className="tick-br" />
          <Scene3D frameRef={builderFrameRef} />
          <div className="pointer-events-none absolute top-4 left-5 flex flex-col gap-1 z-10">
            <span className="caps text-ink-100">VIEWPORT · BUILDER PREVIEW</span>
            <span className="caps text-ink-300">
              {builder.effect.label.toUpperCase() || "UNTITLED"} · KF {builder.activeKf + 1}/{builder.effect.keyframes.length}
            </span>
          </div>
          <div className="pointer-events-none absolute bottom-4 right-5 flex flex-col items-end gap-1 z-10">
            <span className="caps text-ink-300">
              {NUM_PANELS} PANELS · {TOTAL_LEDS} LED
            </span>
            <span className="caps text-ink-300">live · ws2812b</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <LedGridEditor builder={builder} />
        </div>
      </main>
      {/* keyframe bar spans the full bottom width */}
      <div className="col-span-2">
        <KeyframeBar builder={builder} />
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Browse-mode viewport (extracted)
// ───────────────────────────────────────────────────────────────────────
function Viewport({
  state,
  rate,
  frameRef,
}: {
  state: EffectState;
  rate: number;
  frameRef: React.MutableRefObject<Uint8Array>;
}) {
  return (
    <div className="relative flex-1 viewport-ticks scanlines overflow-hidden border-b border-ink-500 min-h-0">
      <span className="tick-tl" />
      <span className="tick-br" />
      <Scene3D frameRef={frameRef} />
      <div className="pointer-events-none absolute top-4 left-5 flex flex-col gap-1 z-10">
        <span className="caps text-ink-100">VIEWPORT · 3D-SIM</span>
        <span className="caps text-ink-300">
          {state.mode.toUpperCase()} · {rate}% rate
        </span>
      </div>
      <div className="pointer-events-none absolute bottom-4 right-5 flex flex-col items-end gap-1 z-10">
        <span className="caps text-ink-300">
          {NUM_PANELS} PANELS · {TOTAL_LEDS} LED
        </span>
        <span className="caps text-ink-300">ws2812b · 5v</span>
      </div>
      <div className="pointer-events-none absolute bottom-4 left-5 flex flex-col gap-0.5 z-10">
        <span className="caps text-ink-300">ORBIT · DRAG</span>
        <span className="caps text-ink-300">ZOOM · SCROLL</span>
      </div>
    </div>
  );
}
