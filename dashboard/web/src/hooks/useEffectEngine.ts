import { useEffect, useRef } from "react";
import { effectById } from "../effects";
import { FRAME_BYTES, type EffectState } from "../effects/types";

/**
 * Runs the selected effect every animation frame, populating a shared
 * Uint8Array (frameRef.current) with one RGB triplet per LED. Also applies the
 * global brightness so preview intensity matches the LEDs.
 */
export function useEffectEngine(state: EffectState, frameRef: React.MutableRefObject<Uint8Array>) {
  const ctxRef = useRef<Record<string, unknown>>({});
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = now - start;
      const s = stateRef.current;
      const buf = frameRef.current;
      const eff = effectById(s.mode);
      eff.render(buf, s, t, ctxRef.current);
      // apply brightness (overall scale)
      if (s.bri < 255) {
        const k = s.bri / 255;
        for (let i = 0; i < FRAME_BYTES; i++) buf[i] = Math.floor(buf[i] * k);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frameRef]);

  // reset per-effect scratchpad on mode change
  useEffect(() => {
    ctxRef.current = {};
  }, [state.mode]);
}
