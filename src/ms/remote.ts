const remote_host = 'http://134.115.48.123';
const proxy_prefix = '/remote';

export function to_fetchable(url: string): string {
  if (import.meta.env.DEV && url.startsWith(remote_host)) {
    return proxy_prefix + url.slice(remote_host.length);
  }
  return url;
}
