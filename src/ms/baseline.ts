import { calculateBaseline } from "msutils";
import type { Point } from "./eic";

export function get_baseline(points: Point[]): Point[] {
  const intensities = new Float64Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    intensities[i] = points[i].y;
  }
  const baseline = calculateBaseline(intensities);
  const line: Point[] = new Array(points.length);
  for (let i = 0; i < points.length; i += 1) {
    line[i] = { x: points[i].x, y: baseline[i] ?? 0 };
  }
  return line;
}
