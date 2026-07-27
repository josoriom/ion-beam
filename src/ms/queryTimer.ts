export interface Query {
  startedAt: number | null;
  endedAt: number | null;
}

const idle: Query = { startedAt: null, endedAt: null };
const listeners = new Set<() => void>();

let query = idle;
let running = 0;

export function startQuery(): void {
  if (running === 0) query = { startedAt: performance.now(), endedAt: null };
  running += 1;
  publish();
}

export function endQuery(): void {
  if (running === 0) return;
  running -= 1;
  if (running === 0 && query.startedAt !== null) {
    query = { startedAt: query.startedAt, endedAt: performance.now() };
  }
  publish();
}

export function resetQuery(): void {
  running = 0;
  query = idle;
  publish();
}

export function subscribeQuery(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getQuery(): Query {
  return query;
}

function publish(): void {
  for (const listener of listeners) listener();
}
