const folderPrefix = "https://drive.google.com/drive/folders/";
const filesEndpoint = "https://www.googleapis.com/drive/v3/files";

export const folderMimeType = "application/vnd.google-apps.folder";

export function readFolderId(path: string): string | null {
  if (!path.startsWith(folderPrefix)) return null;
  const id = path.slice(folderPrefix.length).split(/[/?#]/)[0];
  return id.length > 0 ? id : null;
}

export function isDriveFolder(path: string): boolean {
  return readFolderId(path) !== null;
}

export function toFolderPath(id: string): string {
  return folderPrefix + id;
}

export function readKey(): string {
  return (import.meta.env.VITE_DRIVE_API_KEY ?? "").trim();
}

export function toListUrl(
  folderId: string,
  key: string,
  pageToken: string | null,
): string {
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "nextPageToken, files(id, name, mimeType)",
    orderBy: "folder, name",
    pageSize: "1000",
    key,
  });
  if (pageToken) query.set("pageToken", pageToken);
  return `${filesEndpoint}?${query.toString()}`;
}

export function toMediaUrl(fileId: string, key: string): string {
  return `${filesEndpoint}/${fileId}?alt=media&key=${encodeURIComponent(key)}`;
}
