import * as THREE from "three";
import { NUM_PANELS } from "../effects/types";

// Panel outer dimensions (square.stl bounding box)
export const PANEL_W = 100;
export const PANEL_H = 100;
export const PANEL_D = 31.2;

// Inset of the inner LED ring (where the LEDs physically sit).
// The STL is a chevron panel with an inner frame — this approximates the inner rim.
export const LED_INSET = 8;
// LED_Z_REL: 0 = flat back wall, 1 = chevron front peaks.
// LEDs sit just off the flat back wall, pointing forward into the chevron.
export const LED_Z_REL = 0.12;

// Gap between neighbouring panels on screen
export const PANEL_GAP = 3;

/**
 * Local (per-panel) LED positions, matching firmware indexing:
 *   0..3   bottom (left → right)
 *   4..7   right  (bottom → top)
 *   8..11  top    (right → left)
 *   12..15 left   (top → bottom)
 */
export function ledLocalPositions(): THREE.Vector3[] {
  const halfW = PANEL_W / 2;
  const halfH = PANEL_H / 2;
  const innerHalfW = halfW - LED_INSET;
  const innerHalfH = halfH - LED_INSET;
  const z = (LED_Z_REL - 0.5) * PANEL_D;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const slot = (i: number) => (i + 0.5) / 4; // 0.125, 0.375, 0.625, 0.875

  const pts: THREE.Vector3[] = [];
  // 0..3 bottom, left → right
  for (let i = 0; i < 4; i++) {
    pts.push(new THREE.Vector3(
      lerp(-innerHalfW, innerHalfW, slot(i)),
      -innerHalfH,
      z,
    ));
  }
  // 4..7 right, bottom → top
  for (let i = 0; i < 4; i++) {
    pts.push(new THREE.Vector3(
      innerHalfW,
      lerp(-innerHalfH, innerHalfH, slot(i)),
      z,
    ));
  }
  // 8..11 top, right → left
  for (let i = 0; i < 4; i++) {
    pts.push(new THREE.Vector3(
      lerp(innerHalfW, -innerHalfW, slot(i)),
      innerHalfH,
      z,
    ));
  }
  // 12..15 left, top → bottom
  for (let i = 0; i < 4; i++) {
    pts.push(new THREE.Vector3(
      -innerHalfW,
      lerp(innerHalfH, -innerHalfH, slot(i)),
      z,
    ));
  }
  return pts;
}

/** X offset per panel — panels are laid out in a horizontal row, centered. */
export function panelXOffset(panel: number, total: number = NUM_PANELS): number {
  const step = PANEL_W + PANEL_GAP;
  return (panel - (total - 1) / 2) * step;
}

/** Total horizontal extent of the panel rig. */
export function rigWidth(total: number = NUM_PANELS): number {
  return total * PANEL_W + (total - 1) * PANEL_GAP;
}
