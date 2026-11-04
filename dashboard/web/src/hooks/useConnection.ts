import { useEffect, useState } from "react";
import { fetchStatus, type Status } from "../lib/api";

export function useConnection(intervalMs = 3000): Status {
  const [s, setS] = useState<Status>({ reachable: false, bridge: null });
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const r = await fetchStatus();
      if (alive) setS(r);
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
  return s;
}
