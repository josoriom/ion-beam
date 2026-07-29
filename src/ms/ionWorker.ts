import { calculateEic, type SampleFile } from "quantion";
import { openIonFile } from "./ionFile";
import { forgetSample, getTraffic, subscribe, watchSample } from "./traffic";
import type { WorkerScope } from "./workerMessages";

const worker = self as unknown as WorkerScope;

const files = new Map<string, SampleFile>();
const running = new Map<string, Set<Promise<void>>>();

subscribe(() => {
  worker.postMessage({ type: "traffic", traffic: getTraffic() });
});

function readError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function track(url: string, task: Promise<void>): void {
  const tasks = running.get(url) ?? new Set<Promise<void>>();
  tasks.add(task);
  running.set(url, tasks);
  task.finally(() => {
    tasks.delete(task);
    if (tasks.size === 0) running.delete(url);
  });
}

function waitForTasks(url: string): Promise<void> {
  const tasks = running.get(url);
  if (!tasks || tasks.size === 0) return Promise.resolve();
  return Promise.allSettled([...tasks]).then(() => undefined);
}

async function open(id: number, url: string): Promise<void> {
  watchSample(url);
  try {
    const file = await openIonFile(url);
    if (!files.has(url)) files.set(url, file);
    else file.dispose?.();
    worker.postMessage({ id, type: "opened" });
  } catch (error: unknown) {
    forgetSample(url);
    worker.postMessage({ id, type: "failed", message: readError(error) });
  }
}

async function readEic(
  id: number,
  url: string,
  mz: number,
  from: number,
  to: number,
  ppm: number,
  mzTol: number,
): Promise<void> {
  const file = files.get(url);
  if (!file) {
    worker.postMessage({ id, type: "failed", message: "the file is no longer open" });
    return;
  }
  const task = calculateEic(file, mz, { from, to }, ppm, mzTol)
    .then((eic) => {
      const x = new Float64Array(eic.x);
      const y = new Float64Array(eic.y);
      worker.postMessage({ id, type: "eic", x, y }, [x.buffer, y.buffer]);
    })
    .catch((error: unknown) => {
      worker.postMessage({ id, type: "failed", message: readError(error) });
    });
  track(url, task);
  await task;
}

function close(url: string): void {
  const file = files.get(url);
  files.delete(url);
  forgetSample(url);
  if (!file) return;
  waitForTasks(url).finally(() => {
    file.dispose?.();
  });
}

worker.addEventListener("message", (event) => {
  const ask = event.data;
  if (ask.type === "open") {
    void open(ask.id, ask.url);
    return;
  }
  if (ask.type === "eic") {
    void readEic(ask.id, ask.url, ask.mz, ask.from, ask.to, ask.ppm, ask.mzTol);
    return;
  }
  close(ask.url);
});
