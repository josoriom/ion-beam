import {
  headerSize,
  readLayout,
  type Layout,
  type Region,
  type SpecInfo,
} from "./ionLayout";
import { crc32 } from "../utilities/crc32";
import { findFirstBlock, readBlocks, type Block } from "./blockDirectory";

export type Verified = "ok" | "bad" | null;

export interface BlockCount {
  done: number;
  total: number;
  plainDone: number;
  plainTotal: number;
}

export interface RegionTraffic {
  name: string;
  code: string;
  group: string;
  size: number;
  downloaded: number;
  spec: SpecInfo | null;
  verified: Verified;
  blocks: BlockCount | null;
}

export interface Traffic {
  sample: string | null;
  fileSize: number;
  blockSize: number;
  mzWindow: number;
  downloaded: number;
  unmapped: number;
  requests: number;
  regions: RegionTraffic[];
}

interface Range {
  start: number;
  end: number;
}

interface Served extends Range {
  total: number;
}

interface Check {
  region: number;
  crc: number;
  buffer: Uint8Array;
  covered: Range[];
  filled: number;
}

interface BlockSet {
  blocks: Block[];
  touched: Uint8Array;
  done: number;
  plainDone: number;
  plainTotal: number;
}

interface Tally {
  sample: string | null;
  fileSize: number;
  blockSize: number;
  mzWindow: number;
  downloaded: number;
  requests: number;
  regions: Region[];
  perRegion: number[];
  verified: Verified[];
  checks: Check[];
  waiting: Range[];
  blockSets: (BlockSet | null)[];
  waitingBlocks: Range[];
}

const publishDelay = 100;
const maxCheckBytes = 16 * 1024 * 1024;
const listeners = new Set<() => void>();

let tally = newTally(null);
let snapshot = buildSnapshot(tally);
let publishTimer = 0;
let watching = false;

export function trackSample(url: string | null): void {
  watchDownloads();
  tally = newTally(url === null ? null : readFileName(url));
  publish();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTraffic(): Traffic {
  return snapshot;
}

function newTally(sample: string | null): Tally {
  return {
    sample,
    fileSize: 0,
    blockSize: 0,
    mzWindow: 0,
    downloaded: 0,
    requests: 0,
    regions: [],
    perRegion: [],
    verified: [],
    checks: [],
    waiting: [],
    blockSets: [],
    waitingBlocks: [],
  };
}

function watchDownloads(): void {
  if (watching) return;
  watching = true;

  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await original(input, init);
    if (
      readFileName(readUrl(input)) === tally.sample &&
      readMethod(input, init) !== "HEAD"
    ) {
      await record(response, readAsked(input, init), tally);
    }
    return response;
  };
}

async function record(
  response: Response,
  asked: Range | null,
  active: Tally,
): Promise<void> {
  const served = readServed(response, asked);
  if (!served) return;

  active.requests += 1;
  active.downloaded += served.end - served.start;
  if (served.total > active.fileSize) active.fileSize = served.total;

  const startsAtHeader = served.start === 0 && served.end >= headerSize;
  if (active.regions.length === 0 && startsAtHeader) {
    const layout = await readHeaderLayout(response);
    if (layout && active === tally) applyLayout(active, layout);
  }

  addRange(active, served);
  if (overlapsCheck(active, served)) await verify(response, active, served);
  schedulePublish();
}

async function readHeaderLayout(response: Response): Promise<Layout | null> {
  try {
    const bytes = new Uint8Array(await response.clone().arrayBuffer());
    return readLayout(bytes);
  } catch {
    return null;
  }
}

function applyLayout(active: Tally, layout: Layout): void {
  active.regions = layout.regions;
  active.perRegion = new Array(layout.regions.length).fill(0);
  active.verified = new Array(layout.regions.length).fill(null);
  active.blockSets = new Array(layout.regions.length).fill(null);
  active.checks = openChecks(layout.regions);
  active.blockSize = layout.blockSize;
  active.mzWindow = layout.mzWindow;
  if (layout.fileSize > active.fileSize) active.fileSize = layout.fileSize;
  for (const range of active.waiting) countRange(active, range);
  active.waiting = [];
}

function openChecks(regions: Region[]): Check[] {
  const checks: Check[] = [];
  for (let i = 0; i < regions.length; i += 1) {
    const region = regions[i];
    if (region.spec && region.size <= maxCheckBytes) {
      checks.push({
        region: i,
        crc: region.spec.crc,
        buffer: new Uint8Array(region.size),
        covered: [],
        filled: 0,
      });
    }
  }
  return checks;
}

function addRange(active: Tally, range: Range): void {
  if (active.regions.length === 0) {
    active.waiting.push({ start: range.start, end: range.end });
    return;
  }
  countRange(active, range);
}

function countRange(active: Tally, range: Range): void {
  for (let i = 0; i < active.regions.length; i += 1) {
    const region = active.regions[i];
    const start = Math.max(range.start, region.start);
    const end = Math.min(range.end, region.start + region.size);
    if (end > start) active.perRegion[i] += end - start;
  }
  markBlocks(active, range);
}

function markBlocks(active: Tally, range: Range): void {
  let waiting = false;
  for (let i = 0; i < active.blockSets.length; i += 1) {
    const set = active.blockSets[i];
    if (set) markBlockSet(set, range);
    else if (active.regions[i].group === "Blocks" && active.regions[i].spec === null) waiting = true;
  }
  if (waiting) active.waitingBlocks.push({ start: range.start, end: range.end });
}

function markBlockSet(set: BlockSet, range: Range): void {
  const blocks = set.blocks;
  for (let i = findFirstBlock(blocks, range.start); i < blocks.length; i += 1) {
    if (blocks[i].start >= range.end) break;
    if (set.touched[i]) continue;
    set.touched[i] = 1;
    set.done += 1;
    set.plainDone += blocks[i].plain;
  }
}

function openBlockSet(active: Tally, check: Check): void {
  const directory = active.regions[check.region];
  if (directory.blocksFor === null) return;

  const target = active.regions.findIndex((region) => region.name === directory.blocksFor);
  if (target < 0) return;

  const blocks = readBlocks(check.buffer, active.regions[target].start);
  let plainTotal = 0;
  for (const block of blocks) plainTotal += block.plain;

  const set: BlockSet = {
    blocks,
    touched: new Uint8Array(blocks.length),
    done: 0,
    plainDone: 0,
    plainTotal,
  };
  active.blockSets[target] = set;
  for (const range of active.waitingBlocks) markBlockSet(set, range);
  if (active.blockSets.every((entry, index) => entry !== null || !isBlockPayload(active, index))) {
    active.waitingBlocks = [];
  }
}

function isBlockPayload(active: Tally, index: number): boolean {
  const region = active.regions[index];
  return region.group === "Blocks" && region.spec === null;
}

function overlapsCheck(active: Tally, range: Range): boolean {
  return active.checks.some((check) => {
    const region = active.regions[check.region];
    return range.end > region.start && range.start < region.start + region.size;
  });
}

async function verify(response: Response, active: Tally, range: Range): Promise<void> {
  let payload: Uint8Array;
  try {
    payload = new Uint8Array(await response.clone().arrayBuffer());
  } catch {
    return;
  }
  if (active !== tally) return;

  active.checks = active.checks.filter((check) =>
    fillCheck(active, check, range.start, payload),
  );
}

function fillCheck(
  active: Tally,
  check: Check,
  rangeStart: number,
  payload: Uint8Array,
): boolean {
  const region = active.regions[check.region];
  const start = Math.max(rangeStart, region.start);
  const end = Math.min(rangeStart + payload.length, region.start + region.size);
  if (end <= start) return true;

  const source = payload.subarray(start - rangeStart, end - rangeStart);
  check.buffer.set(source, start - region.start);
  addCovered(check, start - region.start, end - region.start);

  if (check.filled < region.size) return true;

  const passed = crc32(check.buffer) === check.crc;
  active.verified[check.region] = passed ? "ok" : "bad";
  if (passed) openBlockSet(active, check);
  return false;
}

function addCovered(check: Check, from: number, to: number): void {
  check.covered.push({ start: from, end: to });
  check.covered.sort((left, right) => left.start - right.start);

  const merged: Range[] = [];
  let filled = 0;
  for (const range of check.covered) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      if (range.end > last.end) last.end = range.end;
    } else {
      merged.push({ start: range.start, end: range.end });
    }
  }
  for (const range of merged) filled += range.end - range.start;

  check.covered = merged;
  check.filled = filled;
}

function readServed(response: Response, asked: Range | null): Served | null {
  const contentRange = response.headers.get("Content-Range");
  const match = contentRange ? /bytes (\d+)-(\d+)\/(\d+)/.exec(contentRange) : null;
  if (match) {
    if (response.status !== 206) return null;
    return {
      start: Number(match[1]),
      end: Number(match[2]) + 1,
      total: Number(match[3]),
    };
  }

  const length = Number(response.headers.get("Content-Length"));
  if (!Number.isFinite(length) || length <= 0) return null;

  if (response.status === 206) {
    if (!asked) return null;
    return { start: asked.start, end: asked.start + length, total: 0 };
  }

  if (response.status !== 200) return null;
  return { start: 0, end: length, total: length };
}

function readMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method.toUpperCase();
  return "GET";
}

function readAsked(input: RequestInfo | URL, init?: RequestInit): Range | null {
  const header = readRangeHeader(input, init);
  const match = header ? /bytes=(\d+)-(\d+)/.exec(header) : null;
  if (!match) return null;
  return { start: Number(match[1]), end: Number(match[2]) + 1 };
}

function readRangeHeader(
  input: RequestInfo | URL,
  init?: RequestInit,
): string | null {
  if (init?.headers) {
    const value = new Headers(init.headers).get("Range");
    if (value) return value;
  }
  if (input instanceof Request) return input.headers.get("Range");
  return null;
}

function readUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function readFileName(url: string): string {
  const path = url.split("?")[0];
  const parts = path.split("/");
  return decodeURIComponent(parts[parts.length - 1]);
}

function schedulePublish(): void {
  if (publishTimer) return;
  publishTimer = globalThis.setTimeout(() => {
    publishTimer = 0;
    publish();
  }, publishDelay);
}

function publish(): void {
  snapshot = buildSnapshot(tally);
  for (const listener of listeners) listener();
}

function buildSnapshot(source: Tally): Traffic {
  let mapped = 0;
  const regions = source.regions.map((region, index) => {
    mapped += source.perRegion[index];
    const set = source.blockSets[index];
    return {
      name: region.name,
      code: region.code,
      group: region.group,
      size: region.size,
      downloaded: source.perRegion[index],
      spec: region.spec,
      verified: source.verified[index],
      blocks: set
        ? {
            done: set.done,
            total: set.blocks.length,
            plainDone: set.plainDone,
            plainTotal: set.plainTotal,
          }
        : null,
    };
  });

  return {
    sample: source.sample,
    fileSize: source.fileSize,
    blockSize: source.blockSize,
    mzWindow: source.mzWindow,
    downloaded: source.downloaded,
    unmapped: Math.max(0, source.downloaded - mapped),
    requests: source.requests,
    regions,
  };
}
