import { useMemo } from "react";
import clsx from "clsx";
import type { BuilderState } from "../../hooks/useBuilderState";
import { NUM_PANELS } from "../../effects/types";

const SWATCHES = [
  "#ffffff", "#ffb454", "#ff5e3a", "#ff2966",
  "#a64dff", "#3a8dff", "#22d3ee", "#39ff7d",
  "#ffd83a", "#ff8c1a", "#c70039", "#7e3af2",
  "#1c64f2", "#0ea5e9", "#10b981", "#000000",
];

type Props = {
  builder: BuilderState;
  onSave: () => void;
  onCancel: () => void;
};

export function EditSidebar({ builder, onSave, onCancel }: Props) {
  const {
    effect,
    activeKf,
    kf,
    tool,
    color,
    selection,
    updateEffect,
    updateKeyframe,
    addKeyframe,
    deleteKeyframeAt,
    setActiveKf,
    setTool,
    setColor,
    togglePanelMask,
    applyColorToSelection,
    clearSelection,
  } = builder;

  // keyframes sorted by t, paired with their original array index
  const sortedKfs = useMemo(
    () =>
      effect.keyframes
        .map((k, idx) => ({ k, idx }))
        .sort((a, b) => a.k.t - b.k.t),
    [effect.keyframes],
  );

  return (
    <aside className="flex flex-col h-full border-r border-ink-500 bg-ink-800/40 backdrop-blur-sm overflow-y-auto scroll-y">
      {/* header */}
      <div className="px-4 pt-4 pb-3 border-b border-ink-500/70">
        <div className="flex items-baseline justify-between mb-1">
          <span className="font-display font-bold tracking-tight text-amber-500 text-sm">
            EFFECT BUILDER
          </span>
          <span className="caps text-ink-300">keyframe</span>
        </div>
        <input
          value={effect.label}
          onChange={(e) => updateEffect({ label: e.target.value })}
          placeholder="Untitled"
          className="w-full bg-transparent border-0 px-0 py-1 text-ink-50 focus:outline-none font-display font-semibold text-base tracking-tight placeholder:text-ink-300"
        />
        <input
          value={effect.blurb}
          onChange={(e) => updateEffect({ blurb: e.target.value })}
          placeholder="tag"
          className="w-full bg-transparent border-0 px-0 py-0 text-ink-200 focus:outline-none caps placeholder:text-ink-300"
        />
      </div>

      {/* tools */}
      <Section label="Tools">
        <div className="grid grid-cols-2 gap-2">
          <ToolBtn icon="✎" label="Pencil"  active={tool === "pencil"} onClick={() => setTool("pencil")} />
          <ToolBtn icon="▭" label="Rect"    active={tool === "rect"}   onClick={() => setTool("rect")} />
          <ToolBtn icon="▣" label="Fill"    active={tool === "fill"}   onClick={() => setTool("fill")} />
          <ToolBtn icon="⌫" label="Erase"   active={tool === "erase"}  onClick={() => setTool("erase")} />
        </div>
        {tool === "rect" && (
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={applyColorToSelection}
              disabled={selection.size === 0}
              className="caps px-3 py-2 border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 disabled:opacity-30 disabled:hover:bg-transparent transition"
            >
              apply color · {selection.size}
            </button>
            <button
              onClick={clearSelection}
              disabled={selection.size === 0}
              className="caps px-3 py-2 border border-ink-400 text-ink-200 hover:border-ink-200 disabled:opacity-30 transition"
            >
              clear selection
            </button>
          </div>
        )}
      </Section>

      {/* color */}
      <Section label="Color">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 border border-ink-400"
            style={{
              background: color,
              boxShadow: "0 0 18px 0 " + color + "55",
            }}
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-12 h-10 bg-transparent border border-ink-400 cursor-pointer"
          />
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="flex-1 min-w-0 bg-ink-900 border border-ink-500 px-2 py-1 text-ink-50 focus:border-amber-500 outline-none font-mono text-xs uppercase"
            spellCheck={false}
          />
        </div>
        <div className="mt-3 grid grid-cols-8 gap-1.5">
          {SWATCHES.map((sw) => (
            <button
              key={sw}
              onClick={() => setColor(sw)}
              className={clsx(
                "aspect-square border transition-all duration-150",
                color.toLowerCase() === sw
                  ? "border-amber-500 scale-110 z-10"
                  : "border-ink-500 hover:border-ink-300",
              )}
              style={{ background: sw }}
            />
          ))}
        </div>
      </Section>

      {/* keyframes list */}
      <Section label={`Keyframes · ${effect.keyframes.length}`}>
        <div className="flex flex-col gap-1">
          {sortedKfs.map(({ k, idx }, displayIdx) => {
            const isActive = idx === activeKf;
            return (
              <div
                key={idx}
                onClick={() => setActiveKf(idx)}
                className={clsx(
                  "flex items-center gap-2 px-2 py-1.5 border cursor-pointer transition",
                  isActive
                    ? "border-amber-500 bg-amber-500/10"
                    : "border-ink-500 hover:border-ink-300 bg-ink-900/30",
                )}
              >
                <span
                  className={clsx(
                    "w-1.5 h-1.5 rounded-full flex-shrink-0",
                    isActive ? "bg-amber-500" : "bg-ink-300",
                  )}
                  style={
                    isActive
                      ? { boxShadow: "0 0 6px 1px rgba(255,180,84,0.7)" }
                      : undefined
                  }
                />
                <span className="caps text-ink-300 w-4 tabular-nums">
                  {displayIdx + 1}
                </span>
                <input
                  type="number"
                  value={k.t}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const n = +e.target.value;
                    if (Number.isNaN(n)) return;
                    const t = Math.max(0, Math.min(effect.duration, n));
                    updateKeyframe(idx, { t });
                  }}
                  className="flex-1 min-w-0 bg-ink-900 border border-ink-500/60 px-2 py-1 text-ink-50 focus:border-amber-500 outline-none font-mono text-xs tabular-nums"
                  min={0}
                  max={effect.duration}
                  step={5}
                />
                <span className="caps text-ink-300">ms</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteKeyframeAt(idx);
                  }}
                  disabled={effect.keyframes.length <= 1}
                  title="delete"
                  aria-label="delete keyframe"
                  className="w-5 h-5 flex items-center justify-center text-ink-300 hover:text-signal-off hover:bg-signal-off/10 transition border border-transparent hover:border-signal-off/40 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:border-transparent leading-none"
                >
                  ×
                </button>
              </div>
            );
          })}
          <button
            onClick={addKeyframe}
            className="caps mt-1 px-3 py-1.5 border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition"
          >
            + add keyframe
          </button>
        </div>
      </Section>

      {/* panels */}
      <Section label={`Panels · ${kf.panels.length}/${NUM_PANELS}`}>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: NUM_PANELS }, (_, p) => p).map((p) => {
            const on = kf.panels.includes(p);
            return (
              <button
                key={p}
                onClick={() => togglePanelMask(p)}
                className={clsx(
                  "aspect-square border flex flex-col items-center justify-center font-display font-bold text-base transition",
                  on
                    ? "border-amber-500 text-amber-500 bg-amber-500/[0.08]"
                    : "border-ink-500 text-ink-300 hover:border-ink-300",
                )}
              >
                P{p + 1}
                <span className="caps text-[8px] mt-0.5">
                  {on ? "active" : "skip"}
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* save/cancel */}
      <div className="px-4 py-3 mt-auto border-t border-ink-500/70 bg-ink-900/40 flex flex-col gap-2">
        <button
          onClick={onSave}
          className="caps py-2 text-ink-900 bg-amber-500 hover:bg-amber-600 font-bold border border-amber-500 transition"
          style={{ boxShadow: "0 0 14px 0 rgba(255,180,84,0.35)" }}
        >
          save effect
        </button>
        <button
          onClick={onCancel}
          className="caps py-2 text-ink-200 hover:text-signal-off border border-ink-400 hover:border-signal-off/60 transition"
        >
          discard
        </button>
        <p className="caps text-ink-300 leading-relaxed text-center mt-1">
          1·2·3·4 tools · esc clears selection
        </p>
      </div>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────
function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-4 pt-4 pb-3 border-b border-ink-500/40">
      <div className="caps text-ink-100 mb-3">{label}</div>
      {children}
    </div>
  );
}

function ToolBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex flex-col items-center justify-center py-3 border transition",
        active
          ? "border-amber-500 text-amber-500 bg-amber-500/10"
          : "border-ink-500 text-ink-100 hover:border-ink-300",
      )}
      style={
        active
          ? { boxShadow: "inset 0 0 14px 0 rgba(255,180,84,0.18)" }
          : undefined
      }
    >
      <span className="text-2xl leading-none mb-1">{icon}</span>
      <span className="caps">{label}</span>
    </button>
  );
}
