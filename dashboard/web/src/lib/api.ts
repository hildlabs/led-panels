export type BridgeState = {
  mode: string;
  bri: number;
  speed: number;
  hue: number;
  sat: number;
};

export type Status = {
  reachable: boolean;
  bridge: { ok: boolean; connected: boolean; port: string | null } | null;
};

export async function fetchStatus(): Promise<Status> {
  try {
    const r = await fetch("/api/status", { cache: "no-store" });
    if (!r.ok) return { reachable: false, bridge: null };
    return (await r.json()) as Status;
  } catch {
    return { reachable: false, bridge: null };
  }
}

export async function fetchState(): Promise<BridgeState | null> {
  try {
    const r = await fetch("/api/state", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as BridgeState;
  } catch {
    return null;
  }
}

export async function patchState(patch: Partial<BridgeState>): Promise<void> {
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
  } catch {
    /* swallow: UI stays responsive, reconnect on next status ping */
  }
}

export async function postCommand(line: string): Promise<void> {
  try {
    await fetch("/api/command", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ line }),
    });
  } catch {
    /* swallow */
  }
}

const HEX = "0123456789abcdef";
export function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += HEX[b >> 4] + HEX[b & 0xf];
  }
  return out;
}
