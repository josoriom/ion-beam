import { memo } from "react";
import { useAppDispatch } from "../context/context";
import type { Trace } from "../context/reducer";
import { TraceSwatch } from "./TraceSwatch";

interface TraceLegendProps {
  traces: Trace[];
}

function readState(trace: Trace): string {
  if (trace.status === "loading") return "loading";
  if (trace.status === "failed") return "failed";
  return "";
}

export const TraceLegend = memo(function TraceLegend({ traces }: TraceLegendProps) {
  const dispatch = useAppDispatch();

  return (
    <ul className="trace-legend">
      {traces.map((trace) => {
        const state = readState(trace);
        return (
          <li key={trace.url} className="trace-item">
            <TraceSwatch color={trace.color} />
            <span className="trace-name" title={trace.sample}>
              {trace.sample}
            </span>
            {state && (
              <span
                className={trace.status === "failed" ? "trace-state failed" : "trace-state"}
                title={trace.message ?? ""}
              >
                {state}
              </span>
            )}
            {!trace.main && (
              <button
                type="button"
                className="trace-remove"
                title={`Remove ${trace.sample} from the chart`}
                onClick={() => dispatch({ type: "toggleSample", name: trace.sample })}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
});
