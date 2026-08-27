const objectHost = "https://storage.googleapis.com";
const bucketEndpoint = "https://storage.googleapis.com/storage/v1/b";

export interface BucketFolder {
  bucket: string;
  prefix: string;
}

export function readBucketFolder(path: string): BucketFolder | null {
  if (!path.startsWith(`${objectHost}/`)) return null;
  const rest = path.slice(objectHost.length + 1);
  if (rest.startsWith("storage/v1/")) return null;
  const cut = rest.indexOf("/");
  const bucket = cut === -1 ? rest : rest.slice(0, cut);
  if (bucket.length === 0) return null;
  const folder = cut === -1 ? "" : rest.slice(cut + 1);
  return { bucket, prefix: withSlash(folder) };
}

export function isBucketFolder(path: string): boolean {
  return readBucketFolder(path) !== null;
}

export function toFolderPath(bucket: string, prefix: string): string {
  return `${objectHost}/${bucket}/${prefix}`;
}

export function toObjectUrl(bucket: string, name: string): string {
  const parts = name.split("/").map(encodeURIComponent).join("/");
  return `${objectHost}/${bucket}/${parts}`;
}

export function toListUrl(
  folder: BucketFolder,
  pageToken: string | null,
): string {
  const query = new URLSearchParams({
    delimiter: "/",
    maxResults: "1000",
    fields: "items(name),prefixes,nextPageToken",
  });
  if (folder.prefix.length > 0) query.set("prefix", folder.prefix);
  if (pageToken) query.set("pageToken", pageToken);
  return `${bucketEndpoint}/${encodeURIComponent(folder.bucket)}/o?${query.toString()}`;
}

export function readLastName(key: string): string {
  const clean = key.endsWith("/") ? key.slice(0, -1) : key;
  return clean.slice(clean.lastIndexOf("/") + 1);
}

function withSlash(value: string): string {
  if (value.length === 0) return "";
  return value.endsWith("/") ? value : `${value}/`;
}
