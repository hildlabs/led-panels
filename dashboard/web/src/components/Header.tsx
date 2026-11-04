import { ConnectionIndicator } from "./ConnectionIndicator";
import type { Status } from "../lib/api";

export function Header({
  status,
  accentCss,
}: {
  status: Status;
  accentCss: string;
}) {
  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-ink-500 bg-ink-800/70 backdrop-blur-sm">
      <div className="flex items-baseline gap-4">
        <div
          className="w-2 h-7 rounded-[1px]"
          style={{ background: accentCss, boxShadow: `0 0 14px 0 ${accentCss}` }}
        />
        <div className="flex items-baseline gap-3">
          <span
            className="font-display font-extrabold tracking-tight text-ink-50 text-xl leading-none"
            style={{ letterSpacing: "-0.01em" }}
          >
            LED-PANEL
          </span>
          <span className="caps text-ink-200">MKII · NODE 01</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden md:flex flex-col items-end">
          <span className="caps text-ink-300">FIRMWARE</span>
          <span className="font-mono text-xs text-ink-100">v0.2 · ws2812b · 64 px</span>
        </div>
        <ConnectionIndicator status={status} />
      </div>
    </header>
  );
}
