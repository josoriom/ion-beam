import { memo, useEffect, useState } from "react";
import { useAppState } from "../context/context";

interface Memory {
  used: number;
  limit: number;
}

function read_memory(): Memory | null {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number };
  };
  if (!perf.memory) return null;
  return { used: perf.memory.usedJSHeapSize, limit: perf.memory.jsHeapSizeLimit };
}

export const RamMeter = memo(function RamMeter() {
  const worker_memory = useAppState().image_progress?.memory ?? null;
  const [main, set_main] = useState<Memory | null>(read_memory);

  useEffect(() => {
    const id = window.setInterval(() => set_main(read_memory()), 500);
    return () => window.clearInterval(id);
  }, []);

  const used = worker_memory ?? main?.used ?? null;
  const limit = main?.limit ?? null;
  if (used === null || limit === null) return null;

  const used_mb = Math.round(used / 1048576);
  const limit_mb = Math.round(limit / 1048576);
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  const where = worker_memory !== null ? "worker" : "app";

  return (
    <div className="ram-meter">
      <div className="ram-meter-bar">
        <div
          className={over ? "ram-meter-fill over" : "ram-meter-fill"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="ram-meter-label">
        RAM {used_mb} / {limit_mb} MB · {where}
      </span>
    </div>
  );
});
