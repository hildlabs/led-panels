import { useRef } from "react";
import clsx from "clsx";
import {
  CELLS,
  GRID_COLS,
  GRID_ROWS,
  cellColor,
  type Cell,
} from "../../lib/grid";
import { NUM_PANELS } from "../../effects/types";
import type { BuilderState } from "../../hooks/useBuilderState";

type Props = {
  builder: BuilderState;
};

export function LedGridEditor({ builder }: Props) {
  const {
    kf,
    tool,
    selection,
    cellKey,
    applyTool,
    setSelection,
    liveFrame,
    activeKf,
    effect,
  } = builder;

  const isSelected = (c: Cell) =>
    c.kind === "led" && selection.has(cellKey(c.panel, c.led));

  const mouseDown = useRef(false);

  const onCellDown = (cell: Cell) => {
    if (cell.kind !== "led") return;
    if (tool === "rect") {
      setSelection((sel) => {
        const next = new Set(sel);
        const k = cellKey(cell.panel, cell.led);
        if (next.has(k)) next.delete(k);
        else next.add(k);
        return next;
      });
    } else {
      applyTool([{ panel: cell.panel, led: cell.led, kind: cell.kind }]);
    }
  };

  const onCellEnter = (cell: Cell) => {
    if (!mouseDown.current) return;
    if (cell.kind !== "led") return;
    if (tool === "rect") {
      setSelection((sel) => {
        const next = new Set(sel);
        next.add(cellKey(cell.panel, cell.led));
        return next;
      });
    } else if (tool === "pencil" || tool === "erase") {
      applyTool([{ panel: cell.panel, led: cell.led, kind: cell.kind }]);
    }
  };

  return (
    <div
      onPointerDown={() => (mouseDown.current = true)}
      onPointerUp={() => (mouseDown.current = false)}
      onPointerLeave={() => (mouseDown.current = false)}
      className="select-none p-6 bg-ink-900/60 border-t border-ink-500/70"
    >
      <div className="flex items-baseline justify-between mb-3">
        <span className="caps text-ink-100">
          paint · keyframe {activeKf + 1} / {effect.keyframes.length} · @ {kf.t}ms
        </span>
        <span className="caps text-ink-300">
          tool · {tool}{tool === "rect" ? ` · ${selection.size} sel` : ""}
        </span>
      </div>
      <div
        className="grid mx-auto"
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          gap: "4px",
          maxWidth: 1200,
          aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`,
        }}
      >
        {CELLS.map((cell) => {
          const dim = cell.kind === "led" ? 1 : 0.55;
          const [r, g, b] = cellColor(cell, liveFrame, dim);
          const panelDimmed = !kf.panels.includes(cell.panel);
          const [dr, dg, db] = panelDimmed
            ? [r * 0.18, g * 0.18, b * 0.18]
            : [r, g, b];
          const sel = isSelected(cell);
          return (
            <div
              key={cell.i}
              onPointerDown={() => onCellDown(cell)}
              onPointerEnter={() => onCellEnter(cell)}
              className={clsx(
                "relative transition-[box-shadow] duration-150",
                cell.kind === "led" && "cursor-crosshair",
                cell.kind === "led" && tool === "erase" && "hover:ring-1 hover:ring-signal-off",
                cell.kind === "led" && tool === "pencil" && "hover:ring-1 hover:ring-amber-500",
                cell.kind === "led" && tool === "rect" && "hover:ring-1 hover:ring-ink-100",
                cell.kind === "led" && tool === "fill" && "hover:ring-1 hover:ring-amber-500/60",
                cell.kind === "corner" && "opacity-50",
              )}
              style={{
                backgroundColor: `rgb(${dr | 0},${dg | 0},${db | 0})`,
                boxShadow:
                  cell.kind === "led"
                    ? sel
                      ? "inset 0 0 0 2px #ffb454, 0 0 12px 0 rgba(255,180,84,0.5)"
                      : "inset 0 0 0 1px rgba(255,255,255,0.10)"
                    : cell.kind === "fill"
                      ? "inset 0 0 0 1px rgba(255,255,255,0.02)"
                      : undefined,
                opacity: panelDimmed ? 0.5 : 1,
              }}
              title={
                cell.kind === "led"
                  ? `P${cell.panel + 1} · LED ${cell.led}`
                  : undefined
              }
            />
          );
        })}
      </div>

      {/* panel labels */}
      <div
        className="grid mx-auto mt-3"
        style={{
          gridTemplateColumns: `repeat(${NUM_PANELS}, 1fr)`,
          gap: "8px",
          maxWidth: 1200,
        }}
      >
        {Array.from({ length: NUM_PANELS }, (_, p) => p).map((p) => {
          const active = kf.panels.includes(p);
          return (
            <div
              key={p}
              className={clsx(
                "py-1 text-center border-t",
                active
                  ? "border-amber-500/60 text-amber-500"
                  : "border-ink-500 text-ink-300",
              )}
            >
              <span className="font-display font-semibold tracking-tight">
                PANEL {p + 1}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
