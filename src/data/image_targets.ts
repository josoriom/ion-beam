export interface ImageTarget {
  id: string;
  mz: number;
}

export const tolerance_percent = 0.125;

export const image_level = 0;

export const low_quantile = 0.05;

export const high_quantile = 0.99;

export const default_image_targets: ImageTarget[] = [
  { id: "mz_2302", mz: 2302 },
  { id: "mz_4808", mz: 4808 },
  { id: "mz_7901", mz: 7901 },
  { id: "mz_4328", mz: 4328 },
];

export function target_id(mz: number): string {
  return `mz_${mz}`;
}

export function target_tolerance(mz: number): number {
  return (mz * tolerance_percent) / 100;
}

export function image_key(url: string, mz: number): string {
  return `${url}|${mz}`;
}
