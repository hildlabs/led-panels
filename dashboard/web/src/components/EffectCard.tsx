import { useEffect, useRef } from "react";
import clsx from "clsx";
import { effectById } from "../effects";
import { FRAME_BYTES, type EffectState } from "../effects/types";
import {
  CELLS,
  CELL_COUNT,
  GRID_COLS,
  GRID_ROWS,
  cellColor,
} from "../lib/grid";

type Props = {
  id: string;
  label: string;
  blurb: string;
  state: EffectState;
  active: boolean;
  onSelect: () => void;
  /** if true, render a chip badge marking this as a user-built keyframe effect */
  custom?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
};

const FILL_DIM = 0.45;

export function EffectCard({
  id,
  label,
  blurb,
  state,
  active,
  onSelect,
  custom,
  onEdit,
  onDelete,
}: Props) {
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const frame = new Uint8Array(FRAME_BYTES);
    const scratch: Record<string, unknown> = {};
    const eff = effectById(id);
    const start = performance.now();
    let raf = 0;
    let tickCount = 0;

    const tick = (now: number) => {
      tickCount++;
      if (tickCount % 2 === 0) {
        const t = now - start;
        frame.fill(0);
        eff.render(frame, { ...state, bri: 255 }, t, scratch);

        for (let c = 0; c < CELL_COUNT; c++) {
          const el = cellRefs.current[c];
          if (!el) continue;
          const cell = CELLS[c];
          const dim = cell.kind === "led" ? 1 : FILL_DIM;
          const [r, g, b] = cellColor(cell, frame, dim);
          el.style.backgroundColor = `rgb(${r | 0},${g | 0},${b | 0})`;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, state.hue, state.sat, state.speed]);

  return (
    <div
      onClick={onSelect}
      className={clsx(
        "group relative cursor-pointer select-none px-3 pt-2.5 pb-3 transition-all duration-150",
        "border-l-2",
        active
          ? "bg-ink-700/80 border-l-amber-500"
          : "bg-ink-800/40 border-l-transparent hover:bg-ink-700/40 hover:border-l-ink-300/40",
      )}
    >
      {/* header row */}
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-baseline gap-2 min-w-0 flex-1">
          <span
            className={clsx(
              "font-display font-semibold tracking-tight text-[13px] truncate",
              active ? "text-amber-500" : "text-ink-50",
            )}
          >
            {label}
          </span>
          <span className="caps text-ink-300 truncate">{blurb}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {custom && (
            <span className="caps text-[8px] text-amber-500/80 px-1 py-px border border-amber-500/40 leading-none">
              KF
            </span>
          )}
          {active && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-500"
              style={{ boxShadow: "0 0 6px 1px rgba(255,180,84,0.7)" }}
            />
          )}
          {custom && onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              title="edit"
              aria-label="edit effect"
              className="w-5 h-5 flex items-center justify-center text-ink-300 hover:text-amber-500 hover:bg-amber-500/10 transition border border-transparent hover:border-amber-500/40 leading-none"
            >
              ✎
            </button>
          )}
          {custom && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="delete"
              aria-label="delete effect"
              className="w-5 h-5 flex items-center justify-center text-ink-300 hover:text-signal-off hover:bg-signal-off/10 transition border border-transparent hover:border-signal-off/40 leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* preview grid: 24 cols × 6 rows */}
      <div
        className="relative grid gap-[2px]"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
        }}
      >
        {CELLS.map((cell, idx) => (
          <div
            key={idx}
            ref={(el) => {
              cellRefs.current[idx] = el;
            }}
            className={clsx(
              "rounded-[1px]",
              cell.kind === "corner" && "opacity-60",
            )}
            style={{
              backgroundColor: "#000",
              boxShadow:
                cell.kind === "led"
                  ? "inset 0 0 0 0.5px rgba(255,255,255,0.08)"
                  : undefined,
            }}
          />
        ))}
        {/* panel separators (subtle vertical hairlines between adjacent panels) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, transparent 0, transparent calc(100% / 4 - 1px), rgba(255,255,255,0.04) calc(100% / 4 - 1px), rgba(255,255,255,0.04) calc(100% / 4))",
          }}
        />
      </div>

    </div>
  );
}
