import type { IonImage } from "msutils";

export interface RenderedImage {
  width: number;
  height: number;
  rgba: Uint8ClampedArray;
  low: number;
  high: number;
}

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function clamp_unit(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

export function jet(t: number): [number, number, number] {
  const four = 4 * t;
  const r = clamp_unit(Math.min(four - 1.5, -four + 4.5));
  const g = clamp_unit(Math.min(four - 0.5, -four + 3.5));
  const b = clamp_unit(Math.min(four + 0.5, -four + 2.5));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

export function render_ion_image(
  image: IonImage,
  low_q: number,
  high_q: number,
): RenderedImage {
  const { width, height, data, counts } = image;

  const present: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (counts[i] > 0) present.push(data[i]);
  }
  present.sort((a, b) => a - b);

  const low = quantile(present, low_q);
  const high = quantile(present, high_q);
  const span = high > low ? high - low : 1;

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    const p = i * 4;
    if (counts[i] === 0) {
      rgba[p + 3] = 0;
      continue;
    }
    const t = clamp_unit((data[i] - low) / span);
    const [r, g, b] = jet(t);
    rgba[p] = r;
    rgba[p + 1] = g;
    rgba[p + 2] = b;
    rgba[p + 3] = t <= 0 ? 0 : 255;
  }

  return { width, height, rgba, low, high };
}
