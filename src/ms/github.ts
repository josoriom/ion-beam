const pageHost = "https://github.com";
const rawHost = "https://raw.githubusercontent.com";
const apiHost = "https://api.github.com";

export function isRawFolder(path: string): boolean {
  return path.startsWith(rawHost);
}

export function toRawFolder(path: string): string {
  if (!path.startsWith(pageHost)) return path;

  const parts = path.slice(pageHost.length).split("/").filter(Boolean);
  if (parts.length < 4 || parts[2] !== "tree") return path;

  const owner = parts[0];
  const repo = parts[1];
  const branch = parts[3];
  const folder = parts.slice(4).join("/");
  return `${rawHost}/${owner}/${repo}/${branch}/${folder}`;
}

export function toListUrl(path: string): string {
  if (!isRawFolder(path)) return path;

  const parts = path.slice(rawHost.length).split("/").filter(Boolean);
  if (parts.length < 3) return path;

  const owner = parts[0];
  const repo = parts[1];
  const branch = parts[2];
  const folder = parts.slice(3).join("/");
  return `${apiHost}/repos/${owner}/${repo}/contents/${folder}?ref=${branch}`;
}
