import { init, parseIon, getIonImage, type SampleFile } from "msutils";
import { render_ion_image } from "./ion_image";
import { to_fetchable } from "./remote";
import { high_quantile, low_quantile } from "../data/image_targets";

const cache_size = 256 * 1024 * 1024;

interface Job {
  id: number;
  url: string;
  mz: number;
  tolerance: number;
  level: number;
}

let open_url: string | null = null;
let open_file: SampleFile | null = null;
let chain: Promise<void> = Promise.resolve();

async function open(url: string): Promise<SampleFile> {
  if (url !== open_url) {
    open_file?.dispose?.();
    await init();
    const target = new URL(to_fetchable(url), self.location.origin);
    open_file = await parseIon(target, { maxCacheSize: cache_size });
    open_url = url;
  }
  return open_file as SampleFile;
}

async function run(job: Job): Promise<void> {
  try {
    const file = await open(job.url);
    const image = await getIonImage(file, job.mz, {
      tolerance: job.tolerance,
      level: job.level,
      onProgress: (fetched, total, heldBytes) => {
        self.postMessage({ id: job.id, type: "progress", fetched, total, memory: heldBytes });
      },
    });
    const rendered = render_ion_image(image, low_quantile, high_quantile);
    self.postMessage({ id: job.id, type: "done", image: rendered }, {
      transfer: [rendered.rgba.buffer],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ id: job.id, type: "error", message });
  }
}

self.onmessage = (event: MessageEvent<Job>) => {
  const job = event.data;
  chain = chain.then(() => run(job));
};
