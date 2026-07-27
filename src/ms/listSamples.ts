import { toFetchable } from "./remote";
import { toListUrl, toRawFolder } from "./github";

interface NamedEntry {
  name?: string;
}

export async function getSamples(path: string): Promise<string[]> {
  const response = await fetch(toFetchable(toListUrl(toRawFolder(path))));
  if (!response.ok) {
    throw new Error(`server answered ${response.status}`);
  }
  const text = await response.text();
  return readIonNames(text);
}

function readIonNames(text: string): string[] {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[")) {
    const items = JSON.parse(trimmed) as (string | NamedEntry)[];
    const names = items.map((item) =>
      typeof item === "string" ? item : (item.name ?? ""),
    );
    return names.filter((name) => name.endsWith(".ion")).sort();
  }

  const names = new Set<string>();
  for (const match of text.matchAll(/href="([^"?]+\.ion)"/gi)) {
    const href = decodeURIComponent(match[1]);
    names.add(href.slice(href.lastIndexOf("/") + 1));
  }
  return [...names].sort();
}
