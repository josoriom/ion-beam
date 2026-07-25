import { findPeaks, type Peak, type PeakOptions } from "quantion";
import type { Point } from "./eic";

export type { Peak };

const defaultOptions: PeakOptions = { autoNoise: true, autoBaseline: true };

export function getPeaks(points: Point[], options?: PeakOptions): Peak[] {
  if (points.length < 3) return [];
  const times = new Float64Array(points.length);
  const intensities = new Float64Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    times[i] = points[i].x;
    intensities[i] = points[i].y;
  }
  return findPeaks(times, intensities, { ...defaultOptions, ...options });
}
