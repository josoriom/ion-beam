const hosts = [
  { origin: "http://134.115.48.123", prefix: "/remote" },
  { origin: "https://raw.githubusercontent.com", prefix: "/github-raw" },
  { origin: "https://api.github.com", prefix: "/github-api" },
];

export function toFetchable(url: string): string {
  if (!import.meta.env.DEV) return url;

  for (const host of hosts) {
    if (url.startsWith(host.origin)) {
      return host.prefix + url.slice(host.origin.length);
    }
  }
  return url;
}
