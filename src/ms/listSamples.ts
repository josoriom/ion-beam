import { toFetchable } from "./remote";
import { toListUrl, toRawFolder } from "./github";
import {
  folderMimeType,
  isDriveFolder,
  readFolderId,
  readKey,
  toFolderPath,
  toListUrl as toDriveListUrl,
  toMediaUrl,
} from "./drive";
import {
  isBucketFolder,
  readBucketFolder,
  readLastName,
  toFolderPath as toBucketPath,
  toListUrl as toBucketListUrl,
  toObjectUrl,
  type BucketFolder,
} from "./storage";

export type EntryKind = "sample" | "folder";

export interface Entry {
  name: string;
  url: string;
  kind: EntryKind;
}

interface ListedEntry {
  name?: string;
  type?: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
}

interface DrivePage {
  files?: DriveFile[];
  nextPageToken?: string;
}

interface BucketObject {
  name: string;
}

interface BucketPage {
  items?: BucketObject[];
  prefixes?: string[];
  nextPageToken?: string;
}

export async function getSamples(path: string): Promise<Entry[]> {
  if (isDriveFolder(path)) return getDriveEntries(path);
  if (isBucketFolder(path)) return getBucketEntries(path);
  return getWebEntries(path);
}

async function getBucketEntries(path: string): Promise<Entry[]> {
  const folder = readBucketFolder(path);
  if (!folder) throw new Error("that is not a Cloud Storage folder link");

  const entries: Entry[] = [];
  let pageToken: string | null = null;
  do {
    const page = await readBucketPage(folder, pageToken);
    for (const prefix of page.prefixes ?? []) {
      entries.push({
        name: readLastName(prefix),
        url: toBucketPath(folder.bucket, prefix),
        kind: "folder",
      });
    }
    for (const object of page.items ?? []) {
      if (object.name === folder.prefix) continue;
      if (!object.name.endsWith(".ion")) continue;
      entries.push({
        name: readLastName(object.name),
        url: toObjectUrl(folder.bucket, object.name),
        kind: "sample",
      });
    }
    pageToken = page.nextPageToken ?? null;
  } while (pageToken);

  return sortEntries(entries);
}

async function readBucketPage(
  folder: BucketFolder,
  pageToken: string | null,
): Promise<BucketPage> {
  const response = await fetch(toBucketListUrl(folder, pageToken));
  if (!response.ok) {
    throw new Error(await readBucketError(response));
  }
  return (await response.json()) as BucketPage;
}

async function readBucketError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    const message = body.error?.message;
    if (message) return `Cloud Storage answered ${response.status}: ${message}`;
  } catch {
    return `Cloud Storage answered ${response.status}`;
  }
  return `Cloud Storage answered ${response.status}`;
}

async function getDriveEntries(path: string): Promise<Entry[]> {
  const folderId = readFolderId(path);
  if (!folderId) throw new Error("that is not a Google Drive folder link");

  const key = readKey();
  if (key.length === 0) {
    throw new Error("this build has no Google Drive API key");
  }

  const entries: Entry[] = [];
  let pageToken: string | null = null;
  do {
    const page = await readDrivePage(folderId, key, pageToken);
    for (const file of page.files ?? []) {
      if (file.mimeType === folderMimeType) {
        entries.push({
          name: file.name,
          url: toFolderPath(file.id),
          kind: "folder",
        });
        continue;
      }
      if (!file.name.endsWith(".ion")) continue;
      entries.push({
        name: file.name,
        url: toMediaUrl(file.id, key),
        kind: "sample",
      });
    }
    pageToken = page.nextPageToken ?? null;
  } while (pageToken);

  return sortEntries(entries);
}

async function readDrivePage(
  folderId: string,
  key: string,
  pageToken: string | null,
): Promise<DrivePage> {
  const response = await fetch(toDriveListUrl(folderId, key, pageToken));
  if (!response.ok) {
    throw new Error(await readDriveError(response));
  }
  return (await response.json()) as DrivePage;
}

async function readDriveError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    const message = body.error?.message;
    if (message) return `Google Drive answered ${response.status}: ${message}`;
  } catch {
    return `Google Drive answered ${response.status}`;
  }
  return `Google Drive answered ${response.status}`;
}

async function getWebEntries(path: string): Promise<Entry[]> {
  const folder = toRawFolder(path);
  const response = await fetch(toFetchable(toListUrl(folder)));
  if (!response.ok) {
    throw new Error(`server answered ${response.status}`);
  }
  const text = await response.text();
  return sortEntries(readWebEntries(text, folder));
}

function readWebEntries(text: string, folder: string): Entry[] {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("[")) {
    const items = JSON.parse(trimmed) as (string | ListedEntry)[];
    const entries: Entry[] = [];
    for (const item of items) {
      const name = typeof item === "string" ? item : (item.name ?? "");
      const type = typeof item === "string" ? "file" : (item.type ?? "file");
      if (name.length === 0) continue;
      if (type === "dir") {
        entries.push({ name, url: withSlash(folder) + name, kind: "folder" });
        continue;
      }
      if (!name.endsWith(".ion")) continue;
      entries.push({ name, url: withSlash(folder) + name, kind: "sample" });
    }
    return entries;
  }

  const names = new Set<string>();
  for (const match of text.matchAll(/href="([^"?]+\.ion)"/gi)) {
    const href = decodeURIComponent(match[1]);
    names.add(href.slice(href.lastIndexOf("/") + 1));
  }
  return [...names].map((name) => ({
    name,
    url: withSlash(folder) + name,
    kind: "sample" as const,
  }));
}

function withSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function sortEntries(entries: Entry[]): Entry[] {
  return [...entries].sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === "folder" ? -1 : 1;
    return left.name.localeCompare(right.name);
  });
}
