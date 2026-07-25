import { calculateEic, type SampleFile } from "quantion";

export interface Point {
  x: number;
  y: number;
}

export async function getEic(
  file: SampleFile,
  mz: number,
  range: { from: number; to: number },
  ppm: number,
  mzTol: number,
): Promise<{ points: Point[] }> {
  const eic = await calculateEic(file, mz, range, ppm, mzTol);
  return { points: toPoints(eic.x, eic.y) };
}

function toPoints(x: Float64Array, y: Float64Array): Point[] {
  const points: Point[] = new Array(x.length);
  for (let i = 0; i < x.length; i += 1) {
    points[i] = { x: x[i], y: y[i] };
  }
  return points;
}
