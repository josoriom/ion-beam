import { init, parseIon, getIonImage, type SampleFile } from "quantion";
import { renderIonImage } from "./ionImage";
import { toFetchable } from "./remote";
import { highQuantile, lowQuantile } from "../data/imageTargets";
import { trackSample, subscribe, getTraffic } from "./traffic";

const cacheSize = 256 * 1024 * 1024;

interface Job {
  id: number;
  url: string;
  mz: number;
  tolerance: number;
  level: number;
}

let openUrl: string | null = null;
let openFile: SampleFile | null = null;
let chain: Promise<void> = Promise.resolve();

subscribe(() => {
  self.postMessage({ type: "traffic", traffic: getTraffic() });
});

async function open(url: string): Promise<SampleFile> {
  if (url !== openUrl) {
    const previousFile = openFile;
    openFile = null;
    openUrl = null;
    previousFile?.dispose?.();
    trackSample(url);
    await init();
    const target = new URL(toFetchable(url), self.location.origin);
    const parsedFile = await parseIon(target, { maxCacheSize: cacheSize });
    openFile = parsedFile;
    openUrl = url;
  }
  return openFile as SampleFile;
}

async function run(job: Job): Promise<void> {
  try {
    const file = await open(job.url);
    const image = await getIonImage(file, job.mz, {
      tolerance: job.tolerance,
      level: job.level,
      onProgress: (fetched, total, heldBytes) => {
        self.postMessage({
          id: job.id,
          type: "progress",
          fetched,
          total,
          memory: heldBytes,
        });
      },
    });
    const rendered = renderIonImage(image, lowQuantile, highQuantile);
    self.postMessage(
      { id: job.id, type: "done", image: rendered },
      {
        transfer: [rendered.rgba.buffer],
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    self.postMessage({ id: job.id, type: "error", message });
  }
}

self.onmessage = (event: MessageEvent<Job>) => {
  const job = event.data;
  chain = chain.then(() => run(job));
};
