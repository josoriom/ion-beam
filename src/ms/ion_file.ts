import { init, parseIon, type SampleFile } from 'msutils';
import { to_fetchable } from './remote';

const cache_size = 256 * 1024 * 1024;

export async function open_ion_file(url: string): Promise<SampleFile> {
  await init();
  const target = new URL(to_fetchable(url), window.location.origin);
  return parseIon(target, { maxCacheSize: cache_size });
}
