import ImageWorker from "./imageWorker?worker";
import type { RenderedImage } from "./ionImage";
import { applySnapshot, type Traffic } from "./traffic";

export interface ImageProgress {
  fetched: number;
  total: number;
  memory: number | null;
}

interface DoneMessage {
  id: number;
  type: "done";
  image: RenderedImage;
}

interface ProgressMessage {
  id: number;
  type: "progress";
  fetched: number;
  total: number;
  memory: number | null;
}

interface ErrorMessage {
  id: number;
  type: "error";
  message: string;
}

interface TrafficMessage {
  type: "traffic";
  traffic: Traffic;
}

type WorkerMessage = DoneMessage | ProgressMessage | ErrorMessage | TrafficMessage;

interface PendingRequest {
  resolve: (image: RenderedImage) => void;
  reject: (error: Error) => void;
  onProgress: (progress: ImageProgress) => void;
}

let worker: Worker | null = null;
let nextId = 1;
const pendingRequests = new Map<number, PendingRequest>();

function handleWorkerMessage(event: MessageEvent<WorkerMessage>): void {
  const message = event.data;
  if (message.type === "traffic") {
    applySnapshot(message.traffic);
    return;
  }
  const pending = pendingRequests.get(message.id);
  if (!pending) return;
  if (message.type === "progress") {
    pending.onProgress({ fetched: message.fetched, total: message.total, memory: message.memory });
    return;
  }
  pendingRequests.delete(message.id);
  if (message.type === "done") pending.resolve(message.image);
  else pending.reject(new Error(message.message));
}

function failAllPending(message: string): void {
  const error = new Error(message);
  for (const pending of pendingRequests.values()) pending.reject(error);
  pendingRequests.clear();
  worker = null;
}

function handleWorkerError(event: ErrorEvent): void {
  failAllPending(event.message || "worker crashed");
}

function handleWorkerMessageError(): void {
  failAllPending("worker sent an unreadable message");
}

function getWorker(): Worker {
  if (worker) return worker;
  const created = new ImageWorker();
  created.addEventListener("message", handleWorkerMessage);
  created.addEventListener("error", handleWorkerError);
  created.addEventListener("messageerror", handleWorkerMessageError);
  worker = created;
  return created;
}

export function requestImage(
  url: string,
  mz: number,
  tolerance: number,
  level: number,
  onProgress: (progress: ImageProgress) => void,
): Promise<RenderedImage> {
  const id = nextId++;
  const active = getWorker();
  return new Promise((resolve, reject) => {
    pendingRequests.set(id, { resolve, reject, onProgress });
    active.postMessage({ id, url, mz, tolerance, level });
  });
}
