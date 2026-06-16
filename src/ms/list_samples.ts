import { to_fetchable } from './remote';

export async function get_samples(path: string): Promise<string[]> {
  const response = await fetch(to_fetchable(path));
  if (!response.ok) {
    throw new Error(`server answered ${response.status}`);
  }
  const text = await response.text();
  return read_ion_names(text);
}

function read_ion_names(text: string): string[] {
  const trimmed = text.trimStart();
  if (trimmed.startsWith('[')) {
    const items = JSON.parse(trimmed) as string[];
    return items.filter((name) => name.endsWith('.ion')).sort();
  }

  const names = new Set<string>();
  for (const match of text.matchAll(/href="([^"?]+\.ion)"/gi)) {
    const href = decodeURIComponent(match[1]);
    names.add(href.slice(href.lastIndexOf('/') + 1));
  }
  return [...names].sort();
}
