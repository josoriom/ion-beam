import IonWorker from "./ionWorker?worker";
import type { Point } from "./eic";
import { applySnapshot } from "./traffic";
import type { AskWorker, WorkerSays } from "./workerMessages";

interface Waiting {
  resolve: (result: WorkerSays) => void;
  reject: (error: Error) => void;
}

const maxWorkers = 4;
const workers: Worker[] = [];
const waiting = new Map<number, Waiting>();
const workerForUrl = new Map<string, number>();

let nextId = 1;
let nextWorker = 0;

function poolSize(): number {
  const cores = navigator.hardwareConcurrency ?? 4;
  return Math.max(1, Math.min(maxWorkers, cores - 1));
}

function readMessage(at: number, event: MessageEvent<WorkerSays>): void {
  const says = event.data;
  if (says.type === "traffic") {
    applySnapshot(at, says.traffic);
    return;
  }
  const found = waiting.get(says.id);
  if (!found) return;
  waiting.delete(says.id);
  if (says.type === "failed") found.reject(new Error(says.message));
  else found.resolve(says);
}

function failEveryone(message: string): void {
  const error = new Error(message);
  for (const found of waiting.values()) found.reject(error);
  waiting.clear();
}

function workerAt(at: number): Worker {
  const found = workers[at];
  if (found) return found;
  const created = new IonWorker();
  created.addEventListener("message", (event: MessageEvent<WorkerSays>) => {
    readMessage(at, event);
  });
  created.addEventListener("error", (event: ErrorEvent) => {
    failEveryone(event.message || "the reader crashed");
  });
  created.addEventListener("messageerror", () => {
    failEveryone("the reader sent an unreadable message");
  });
  workers[at] = created;
  return created;
}

function ask(at: number, message: AskWorker & { id: number }): Promise<WorkerSays> {
  const worker = workerAt(at);
  return new Promise((resolve, reject) => {
    waiting.set(message.id, { resolve, reject });
    worker.postMessage(message);
  });
}

export async function openFile(url: string): Promise<void> {
  let at = workerForUrl.get(url);
  if (at === undefined) {
    at = nextWorker % poolSize();
    nextWorker += 1;
    workerForUrl.set(url, at);
  }
  await ask(at, { type: "open", id: nextId++, url });
}

export async function readEic(
  url: string,
  mz: number,
  range: { from: number; to: number },
  ppm: number,
  mzTol: number,
): Promise<Point[]> {
  const at = workerForUrl.get(url);
  if (at === undefined) throw new Error("the file is no longer open");
  const says = await ask(at, {
    type: "eic",
    id: nextId++,
    url,
    mz,
    from: range.from,
    to: range.to,
    ppm,
    mzTol,
  });
  if (says.type !== "eic") throw new Error("the reader answered the wrong question");
  const points: Point[] = new Array(says.x.length);
  for (let i = 0; i < says.x.length; i += 1) {
    points[i] = { x: says.x[i], y: says.y[i] };
  }
  return points;
}

export function closeFile(url: string): void {
  const at = workerForUrl.get(url);
  if (at === undefined) return;
  workerForUrl.delete(url);
  workerAt(at).postMessage({ type: "close", url });
}
