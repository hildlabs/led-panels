/**
 * Multi-panel preview / editor grid.
 *
 *   X 0 0 0 0 X X 0 0 0 0 X ...   (× NUM_PANELS)
 *   0 + + + + 0 0 + + + + 0
 *   0 + + + + 0 0 + + + + 0
 *   0 + + + + 0 0 + + + + 0
 *   0 + + + + 0 0 + + + + 0
 *   X 0 0 0 0 X X 0 0 0 0 X
 *
 *   X = panel corner (decorative)
 *   0 = physical LED (16 per panel, edge-mounted)
 *   + = inner diffuse cell (weighted from all 16 LEDs)
 */
import { NUM_PANELS, PANEL_LEDS } from "../effects/types";

export const GRID_ROWS = 6;
export const PANEL_COLS = 6;
export const GRID_COLS = PANEL_COLS * NUM_PANELS;
export const CELL_COUNT = GRID_ROWS * GRID_COLS;

export type CellKind = "led" | "corner" | "fill";

export type Cell = {
  /** flat cell index (row * GRID_COLS + col) */
  i: number;
  row: number;
  col: number;
  /** panel this cell belongs to (0..NUM_PANELS-1) */
  panel: number;
  /** local row, col within the panel (0..5) */
  panelRow: number;
  panelCol: number;
  kind: CellKind;
  /** firmware LED index 0..15 if kind === "led", else -1 */
  led: number;
};

/** Maps (panelRow, panelCol) within a single panel → firmware LED index 0..15 (or -1).
 *  Firmware order: bottom 0-3 (L→R), right 4-7 (B→T), top 8-11 (R→L), left 12-15 (T→B). */
function panelLedAt(panelRow: number, panelCol: number): number {
  // top row (row 0)
  if (panelRow === 0) {
    if (panelCol === 0 || panelCol === 5) return -1; // corners
    // top edge runs right→left: col 4 → 8, col 1 → 11
    return 8 + (4 - panelCol);
  }
  // bottom row (row 5)
  if (panelRow === 5) {
    if (panelCol === 0 || panelCol === 5) return -1; // corners
    // bottom edge runs left→right: col 1 → 0, col 4 → 3
    return panelCol - 1;
  }
  // middle rows: col 0 = left edge, col 5 = right edge
  if (panelCol === 0) {
    // left runs top→bottom: row 1 → 12, row 4 → 15
    return 11 + panelRow;
  }
  if (panelCol === 5) {
    // right runs bottom→top: row 4 → 4, row 1 → 7
    return 4 + (4 - panelRow);
  }
  return -1; // inner fill cell
}

function panelCornerAt(panelRow: number, panelCol: number): boolean {
  return (panelRow === 0 || panelRow === 5) && (panelCol === 0 || panelCol === 5);
}

export const CELLS: Cell[] = (() => {
  const out: Cell[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const panel = Math.floor(col / PANEL_COLS);
      const panelCol = col % PANEL_COLS;
      const panelRow = row;
      const led = panelLedAt(panelRow, panelCol);
      const corner = panelCornerAt(panelRow, panelCol);
      const kind: CellKind = led >= 0 ? "led" : corner ? "corner" : "fill";
      out.push({
        i: row * GRID_COLS + col,
        row,
        col,
        panel,
        panelRow,
        panelCol,
        kind,
        led,
      });
    }
  }
  return out;
})();

/** Inverse lookup: (panel, ledIdx) → flat cell index in the grid. */
export const LED_TO_CELL: number[][] = (() => {
  const out: number[][] = Array.from({ length: NUM_PANELS }, () =>
    new Array(PANEL_LEDS).fill(-1),
  );
  for (const c of CELLS) {
    if (c.kind === "led") out[c.panel][c.led] = c.i;
  }
  return out;
})();

/** Cells that are LEDs (the only ones the user can "paint" in the editor). */
export const LED_CELLS = CELLS.filter((c) => c.kind === "led");

/** Per-fill-cell weights from each of the 16 LEDs of the cell's panel.
 *  Used to render the "+" diffuse glow as a weighted sum of LED colors. */
import { ledLocalPositions } from "./led-geometry";

const RADIUS = 64;
const FALLOFF = 2.2;

/** Local coords inside a panel for a (panelRow, panelCol) cell. */
function cellLocalPos(panelRow: number, panelCol: number): [number, number] {
  // Map 6×6 grid to panel inner area (matches LED_INSET≈8 in led-geometry).
  // Panel is 100×100, inner extent ~84×84.
  const halfX = 100 / 2 - 8;
  const halfY = 100 / 2 - 8;
  const x = -halfX + (panelCol / (PANEL_COLS - 1)) * (halfX * 2);
  const y = halfY - (panelRow / (GRID_ROWS - 1)) * (halfY * 2);
  return [x, y];
}

export const FILL_WEIGHTS: number[][] = (() => {
  const localPts = ledLocalPositions();
  const out: number[][] = [];
  for (const c of CELLS) {
    if (c.kind !== "fill") {
      out.push([]);
      continue;
    }
    const [cx, cy] = cellLocalPos(c.panelRow, c.panelCol);
    const ws: number[] = [];
    for (let i = 0; i < PANEL_LEDS; i++) {
      const pt = localPts[i];
      const d = Math.hypot(pt.x - cx, pt.y - cy);
      const t = Math.min(1, d / RADIUS);
      ws.push(Math.pow(1 - t, FALLOFF));
    }
    out.push(ws);
  }
  return out;
})();

/** Compute the displayable RGB for a cell given a frame buffer.
 *  - led / corner cells return the LED's own color (corners are decorative; we pick
 *    the nearest corner LED's color so they don't read as dead).
 *  - fill cells return weighted average of all LEDs on the cell's panel. */
export function cellColor(
  cell: Cell,
  frame: Uint8Array,
  dim: number = 1,
): [number, number, number] {
  if (cell.kind === "led") {
    const o = (cell.panel * PANEL_LEDS + cell.led) * 3;
    return [frame[o] * dim, frame[o + 1] * dim, frame[o + 2] * dim];
  }
  if (cell.kind === "corner") {
    // Corner picks up adjacent LEDs (decorative tinting).
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < PANEL_LEDS; i++) {
      const o = (cell.panel * PANEL_LEDS + i) * 3;
      r += frame[o]; g += frame[o + 1]; b += frame[o + 2]; n++;
    }
    return [(r / n) * dim * 0.35, (g / n) * dim * 0.35, (b / n) * dim * 0.35];
  }
  // fill
  const w = FILL_WEIGHTS[cell.i];
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < PANEL_LEDS; i++) {
    const o = (cell.panel * PANEL_LEDS + i) * 3;
    r += frame[o] * w[i];
    g += frame[o + 1] * w[i];
    b += frame[o + 2] * w[i];
  }
  return [r * dim, g * dim, b * dim];
}
