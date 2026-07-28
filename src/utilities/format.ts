const units = ["B", "KB", "MB", "GB"];
const step = 1024;

export function formatBytes(value: number): string {
  let size = value;
  let unit = 0;
  while (size >= step && unit < units.length - 1) {
    size /= step;
    unit += 1;
  }
  const digits = unit === 0 || size >= 100 ? 0 : 1;
  return `${size.toFixed(digits)} ${units[unit]}`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("en-US");
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(3)} s`;
}

export function formatPercent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  const percent = (part / whole) * 100;
  if (percent > 0 && percent < 0.1) return "<0.1%";
  return `${percent.toFixed(percent >= 10 ? 0 : 1)}%`;
}
