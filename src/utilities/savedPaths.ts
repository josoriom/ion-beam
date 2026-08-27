const pathStore = "ion-beam.paths";
const offeredStore = "ion-beam.offeredPaths";

export function readPaths(defaults: string[]): string[] {
  const stored = readList(pathStore);
  const offered = readList(offeredStore) ?? [];
  writeList(offeredStore, [...new Set([...offered, ...defaults])]);
  if (stored === null) return defaults;
  const fresh = defaults.filter(
    (path) => !offered.includes(path) && !stored.includes(path),
  );
  return [...stored, ...fresh];
}

export function writePaths(paths: string[]): void {
  writeList(pathStore, paths);
}

function readList(key: string): string[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const list = JSON.parse(raw) as unknown;
    if (!Array.isArray(list)) return null;
    return list.filter((item): item is string => typeof item === "string");
  } catch {
    return null;
  }
}

function writeList(key: string, list: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    return;
  }
}
