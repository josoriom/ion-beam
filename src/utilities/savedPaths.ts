const storeKey = "ion-beam.paths";

export function readPaths(fallback: string[]): string[] {
  try {
    const raw = localStorage.getItem(storeKey);
    if (!raw) return fallback;
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return fallback;
    const paths = list.filter((item): item is string => typeof item === "string");
    return paths.length > 0 ? paths : fallback;
  } catch {
    return fallback;
  }
}

export function writePaths(paths: string[]): void {
  try {
    localStorage.setItem(storeKey, JSON.stringify(paths));
  } catch {
    return;
  }
}
