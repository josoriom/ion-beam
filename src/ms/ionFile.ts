import { init, parseIon, type SampleFile } from "quantion";
import { toFetchable } from "./remote";

const cacheSize = 256 * 1024 * 1024;

export async function openIonFile(url: string): Promise<SampleFile> {
  await init();
  const target = new URL(toFetchable(url), window.location.origin);
  return parseIon(target, { maxCacheSize: cacheSize });
}
