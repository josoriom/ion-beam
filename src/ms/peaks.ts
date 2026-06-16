import { findPeaks, type Peak, type PeakOptions } from "msutils";
import type { Point } from "./eic";

export type { Peak };

const default_options: PeakOptions = { autoNoise: true, autoBaseline: true };

export function get_peaks(points: Point[], options?: PeakOptions): Peak[] {
  const times = new Float64Array(points.length);
  const intensities = new Float64Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    times[i] = points[i].x;
    intensities[i] = points[i].y;
  }
  return findPeaks(times, intensities, { ...default_options, ...options });
}
