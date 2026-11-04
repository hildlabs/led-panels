import { useRef } from "react";
import clsx from "clsx";
import type { BuilderState } from "../../hooks/useBuilderState";

const fmtTime = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 10);
  return `${String(s).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
};

type Props = {
  builder: BuilderState;
};

export function KeyframeBar({ builder }: Props) {
  const {
    effect,
    activeKf,
    playing,
    playT,
    setActiveKf,
    setPlaying,
    updateEffect,
    updateKeyframe,
    addKeyframe,
    deleteKeyframe,
    kf,
  } = builder;

  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ idx: number } | null>(null);

  const tToPct = (t: number) => (t / effect.duration) * 100;

  const onPointerDown = (idx: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = { idx };
    setActiveKf(idx);
  };

  const SNAP_MS = 5;
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragging.current;
    if (!d || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const pct = x / rect.width;
    const raw = pct * effect.duration;
    const newT = Math.round(raw / SNAP_MS) * SNAP_MS;
    updateKeyframe(d.idx, { t: Math.max(0, Math.min(effect.duration, newT)) });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    dragging.current = null;
  };

  return (
    <div className="border-t border-ink-500 bg-ink-800/70 px-6 py-3">
      <div className="flex items-center gap-6">
        {/* play controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPlaying(!playing)}
            className={clsx(
              "caps px-4 py-1.5 border transition",
              playing
                ? "border-amber-500 text-amber-500 bg-amber-500/10"
                : "border-ink-400 text-ink-100 hover:border-ink-200",
            )}
          >
            {playing ? "■ stop" : "▶ play"}
          </button>
          <span className="caps text-ink-300 tabular-nums min-w-[100px]">
            {fmtTime(playing ? playT : kf.t)} / {fmtTime(effect.duration)}
          </span>
        </div>

        {/* track */}
        <div
          ref={trackRef}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          className="relative flex-1 h-12 bg-ink-900 border border-ink-500 select-none"
          style={{
            background:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0 1px, transparent 1px calc(100% / 8))",
          }}
        >
          <div className="absolute inset-x-0 top-0 h-1.5 bg-ink-700/60" />
          {playing && (
            <div
              className="absolute top-0 bottom-0 w-px bg-signal-on z-20 pointer-events-none"
              style={{
                left: `${tToPct(playT)}%`,
                boxShadow: "0 0 6px 1px rgba(105,240,122,0.7)",
              }}
            />
          )}
          {effect.keyframes.map((k, i) => {
            const isActive = i === activeKf;
            return (
              <div
                key={i}
                onPointerDown={onPointerDown(i)}
                className={clsx(
                  "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-7 cursor-grab active:cursor-grabbing z-10",
                )}
                style={{
                  left: `${tToPct(k.t)}%`,
                  transition: dragging.current?.idx === i ? "none" : "left 80ms linear",
                }}
                title={`Keyframe ${i + 1} @ ${k.t}ms`}
              >
                <div
                  className={clsx(
                    "w-full h-full transition",
                    isActive ? "bg-amber-500" : "bg-ink-100 hover:bg-ink-50",
                  )}
                  style={{
                    clipPath: "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
                    boxShadow: isActive
                      ? "0 0 12px 1px rgba(255,180,84,0.6)"
                      : "0 0 4px 0 rgba(0,0,0,0.6)",
                  }}
                />
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 caps text-[8px] text-ink-300 whitespace-nowrap">
                  {k.t}
                </span>
              </div>
            );
          })}
          <span className="absolute bottom-0.5 left-1 caps text-ink-300">0</span>
          <span className="absolute bottom-0.5 right-1 caps text-ink-300">
            {effect.duration}ms
          </span>
        </div>

        {/* keyframe ops */}
        <div className="flex items-center gap-2">
          <button
            onClick={addKeyframe}
            className="caps px-3 py-1.5 border border-amber-500/40 text-amber-500 hover:bg-amber-500/10 transition"
          >
            + add
          </button>
          <button
            onClick={deleteKeyframe}
            disabled={effect.keyframes.length <= 1}
            className="caps px-3 py-1.5 border border-ink-400 text-ink-200 hover:text-signal-off hover:border-signal-off/60 disabled:opacity-30 disabled:hover:text-ink-200 disabled:hover:border-ink-400 transition"
          >
            × delete
          </button>
        </div>

        {/* duration */}
        <label className="flex items-center gap-2">
          <span className="caps text-ink-300">duration</span>
          <input
            type="number"
            value={effect.duration}
            onChange={(e) =>
              updateEffect({
                duration: Math.max(100, Math.min(60000, +e.target.value || 1000)),
              })
            }
            className="bg-ink-900 border border-ink-500 px-2 py-1 text-ink-50 focus:border-amber-500 outline-none w-24 font-mono text-sm tabular-nums"
            min={100}
            max={60000}
            step={100}
          />
          <span className="caps text-ink-300">ms</span>
        </label>

        {/* loop toggle */}
        <label className="flex items-center gap-2 caps text-ink-200 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={effect.loop}
            onChange={(e) => updateEffect({ loop: e.target.checked })}
            className="accent-amber-500"
          />
          loop
        </label>
      </div>
    </div>
  );
}
