import type { Traffic } from "./traffic";

export type AskWorker =
  | { type: "open"; id: number; url: string; name: string }
  | {
      type: "eic";
      id: number;
      url: string;
      mz: number;
      from: number;
      to: number;
      ppm: number;
      mzTol: number;
    }
  | { type: "close"; url: string };

export interface WorkerScope {
  postMessage(message: WorkerSays, transfer?: Transferable[]): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<AskWorker>) => void,
  ): void;
}

export type WorkerSays =
  | { id: number; type: "opened" }
  | { id: number; type: "eic"; x: Float64Array; y: Float64Array }
  | { id: number; type: "failed"; message: string }
  | { type: "traffic"; traffic: Traffic };
