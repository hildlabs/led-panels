import { useRef, useState, type PointerEvent as RPointerEvent } from "react";
import clsx from "clsx";

type Props = {
  label: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  /** optional color-strip underneath (e.g., hue preview) */
  gradient?: string;
  /** stronger accent color for fill (override default) */
  fillStyle?: string;
};

export function Slider({
  label,
  unit,
  value,
  min,
  max,
  onChange,
  format,
  gradient,
  fillStyle,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const handle = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const v = min + (x / rect.width) * (max - min);
    onChange(Math.round(v));
  };

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    handle(e.clientX);
  };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    if (dragging) handle(e.clientX);
  };
  const onUp = (e: RPointerEvent<HTMLDivElement>) => {
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
    setDragging(false);
  };

  return (
    <div className="module-surface p-4 flex flex-col gap-3 min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <span className="caps engraved">{label}</span>
        <span className="font-mono text-2xl text-ink-50 tabular-nums">
          {format ? format(value) : value}
          {unit && <span className="text-ink-200 text-sm ml-1">{unit}</span>}
        </span>
      </div>

      <div
        ref={trackRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        className={clsx(
          "relative h-8 rounded-sm cursor-grab select-none",
          dragging && "cursor-grabbing",
        )}
        style={{
          background: gradient ?? "linear-gradient(180deg, #0a0b10 0%, #060709 100%)",
          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.03)",
        }}
      >
        {/* fill (hidden when gradient is supplied, since gradient IS the scale) */}
        {!gradient && (
          <div
            className="absolute top-0 bottom-0 left-0 rounded-sm"
            style={{
              width: `${pct * 100}%`,
              background:
                fillStyle ??
                "linear-gradient(180deg, rgba(255,180,84,0.9), rgba(232,152,43,0.7))",
              boxShadow: "0 0 14px 0 rgba(255,180,84,0.4)",
            }}
          />
        )}

        {/* ticks */}
        <div className="absolute inset-0 flex items-center pointer-events-none">
          {[...Array(11)].map((_, i) => (
            <div key={i} className="flex-1 flex justify-center">
              <div
                className={clsx(
                  "w-px",
                  i % 5 === 0 ? "h-4 bg-ink-200/50" : "h-2 bg-ink-300/40",
                )}
              />
            </div>
          ))}
        </div>

        {/* thumb — looks like a fader cap */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
          style={{
            left: `${pct * 100}%`,
            transition: dragging ? "none" : "left 80ms linear",
          }}
        >
          <div
            className="w-[12px] h-10 rounded-[3px] relative"
            style={{
              background:
                "linear-gradient(180deg, #f5ead2 0%, #cdc2ac 45%, #9b927f 100%)",
              boxShadow:
                "0 3px 8px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.4), inset 0 -1px 0 rgba(0,0,0,0.4)",
            }}
          >
            <div className="absolute left-0 right-0 top-1/2 h-px bg-black/40" />
          </div>
        </div>
      </div>

      <div className="flex justify-between caps text-ink-300">
        <span>{min}</span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}
