/**
 * USER CUSTOM EFFECTS
 * ────────────────────────────────────────────────────────────
 * Add your own LED effects here — they show up in the Mode rack
 * automatically on the next `npm run build`.
 *
 * How to add one:
 *   1. Write a render function below using the helpers from "./types"
 *   2. Add an entry to the CUSTOM_EFFECTS array at the bottom
 *   3. (Optional) Add a matching case in led_panel/led_panel.ino
 *      so the physical panels show it too — without that, only the
 *      dashboard preview will animate.
 *
 * API:
 *   (frame, state, tMs, ctx) => void
 *
 *   - frame:  Uint8Array of length 192: four panels, 16 LEDs each, 3 bytes RGB.
 *             Panel p occupies bytes p*48 .. p*48+47.
 *   - state:  { mode, bri, speed, hue, sat }
 *             speed is the period in ms for a full cycle;
 *             hue/sat are 0..255 FastLED-style.
 *   - tMs:    elapsed ms since the effect started
 *   - ctx:    per-effect scratchpad object, persists across frames
 *
 * Helpers worth knowing:
 *   setLed(frame, panel, idx, r, g, b)  — write one LED
 *   addLed(...)                         — additive mix
 *   fadeAll(frame, amount)              — decay everything by `amount` (0-255)
 *   hsv2rgb(h, s, v) → [r, g, b]        — FastLED-style HSV (0..255 each)
 *   cubicwave8(x), easeInOutQuad(x)     — 0..255 wave helpers
 *   heatColor(h)                        — black-body palette
 *   rand8()                             — fast PRNG 0..255
 *
 * Example below: `rotator` spins a dot around each panel in opposite directions.
 */

import {
  fadeAll,
  hsv2rgb,
  setLed,
  PANEL_LEDS,
  type EffectDef,
  type EffectState,
} from "./types";

// ─── Example custom effect: dual rotating dots ──────────────────────────
const rotator = (frame: Uint8Array, s: EffectState, t: number) => {
  fadeAll(frame, 32);
  const phase = (t % s.speed) / s.speed;
  const idx = Math.floor(phase * PANEL_LEDS) % PANEL_LEDS;
  const [r, g, b] = hsv2rgb(s.hue, s.sat, 255);
  setLed(frame, 0, idx, r, g, b);
  setLed(frame, 1, (PANEL_LEDS - 1 - idx + PANEL_LEDS) % PANEL_LEDS, r, g, b);
};

// ─── Register your effects here ─────────────────────────────────────────
export const CUSTOM_EFFECTS: EffectDef[] = [
  { id: "rotator", label: "Rotator", blurb: "dual sweep", render: rotator },
];
