import { memo } from "react";
import { useAppState } from "../context/context";

export const ComputeProgress = memo(function ComputeProgress() {
  const progress = useAppState().image_progress;

  if (!progress || progress.total === 0) {
    return (
      <div className="compute">
        <div className="compute-bar">
          <div className="compute-fill" style={{ width: "0%" }} />
        </div>
        <p className="compute-label">Opening file…</p>
      </div>
    );
  }

  const percent = Math.floor((progress.fetched / progress.total) * 100);

  return (
    <div className="compute">
      <div className="compute-bar">
        <div className="compute-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="compute-label">
        Streaming {progress.fetched} / {progress.total} scans · {percent}%
      </p>
    </div>
  );
});
