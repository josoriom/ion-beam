import { memo } from "react";
import type { Peak } from "../ms/peaks";

interface PeakTableProps {
  peaks: Peak[];
}

function formatAmount(value: number): string {
  return value.toExponential(2);
}

export const PeakTable = memo(function PeakTable({ peaks }: PeakTableProps) {
  return (
    <div className="peak-table">
      <div className="peak-head">
        <span className="peak-label">Peaks</span>
        <span className="peak-count">{peaks.length}</span>
      </div>
      {peaks.length === 0 ? (
        <p className="peak-empty">No peaks found</p>
      ) : (
        <div className="peak-scroll">
          <table className="peaks">
            <thead>
              <tr>
                <th>#</th>
                <th>RT</th>
                <th>Intensity</th>
                <th>Integral</th>
                <th>From</th>
                <th>To</th>
                <th>NP</th>
              </tr>
            </thead>
            <tbody>
              {peaks.map((peak, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>{peak.rt.toFixed(3)}</td>
                  <td>{formatAmount(peak.intensity)}</td>
                  <td>{formatAmount(peak.integral)}</td>
                  <td>{peak.from.toFixed(3)}</td>
                  <td>{peak.to.toFixed(3)}</td>
                  <td>{peak.nPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
