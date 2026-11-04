import clsx from "clsx";
import type { Status } from "../lib/api";

export function ConnectionIndicator({ status }: { status: Status }) {
  const online = status.reachable && status.bridge?.connected;
  const bridgeUp = status.reachable;
  const state: "on" | "mid" | "off" = online ? "on" : bridgeUp ? "mid" : "off";
  const label =
    state === "on"
      ? "LINK · ONLINE"
      : state === "mid"
        ? "BRIDGE · NO DEVICE"
        : "LINK · OFFLINE";
  const detail = status.bridge?.port ?? "—";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 module-surface">
      <div className="relative flex items-center justify-center">
        <div
          className={clsx(
            "w-2.5 h-2.5 rounded-full",
            state === "on" && "bg-signal-on",
            state === "mid" && "bg-signal-mid",
            state === "off" && "bg-signal-off",
          )}
          style={{
            boxShadow:
              state === "on"
                ? "0 0 8px 2px rgba(105,240,122,0.55)"
                : state === "mid"
                  ? "0 0 8px 2px rgba(255,180,84,0.5)"
                  : "0 0 6px 1px rgba(199,74,60,0.45)",
          }}
        />
        {state === "on" && (
          <div className="absolute inset-0 rounded-full bg-signal-on/40 animate-ping" />
        )}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="caps text-ink-50">{label}</span>
        <span className="caps text-ink-300">{detail}</span>
      </div>
    </div>
  );
}
