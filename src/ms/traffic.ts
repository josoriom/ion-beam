import { headerSize, readLayout, type Layout, type Region } from "./ionLayout";
import { crc32 } from "../utilities/crc32";
import { findFirstBlock, readBlocks, type Block } from "./blockDirectory";

export type Verified = "ok" | "bad" | null;

export interface BlockCount {
  samples: number;
  done: number;
  total: number;
  plainDone: number;
  plainTotal: number;
}

export interface RegionSpec {
  stride: number | null;
  count: number | null;
  crc: number | null;
}

export interface RegionTraffic {
  name: string;
  code: string;
  group: string;
  samples: number;
  size: number;
  downloaded: number;
  spec: RegionSpec | null;
  verified: Verified;
  blocks: BlockCount | null;
}

export interface Traffic {
  samples: string[];
  pending: number;
  fileSize: number;
  blockSize: number;
  blockSizeMixed: boolean;
  mzWindow: number;
  mzWindowMixed: boolean;
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
  sample: string;
  live: boolean;
  readingHeader: boolean;
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

export const memoryBudget = 1024 * 1024 * 1024;

const publishDelay = 100;
const maxCheckBytes = 16 * 1024 * 1024;
const listeners = new Set<() => void>();

const tallies = new Map<string, Tally>();
const labels = new Map<string, string>();
const parts = new Map<number, Traffic>();

let snapshot = mergeTraffic([]);
let publishTimer = 0;

watchDownloads();

export function watchSample(url: string, name?: string): void {
  const sample = readFileName(url);
  if (name) labels.set(sample, name);
  if (tallies.has(sample)) return;
  tallies.set(sample, newTally(sample));
  publish();
}

export function forgetSample(url: string): void {
  const sample = readFileName(url);
  const found = tallies.get(sample);
  if (!found) return;
  found.live = false;
  tallies.delete(sample);
  labels.delete(sample);
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

function newTally(sample: string): Tally {
  return {
    sample,
    live: true,
    readingHeader: false,
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
  const original = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const response = await original(input, init);
    const watched = tallies.get(readFileName(readUrl(input)));
    if (watched && readMethod(input, init) !== "HEAD") {
      record(response.clone(), readAsked(input, init), watched).catch(
        () => undefined,
      );
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
  if (active.regions.length === 0 && !active.readingHeader && startsAtHeader) {
    active.readingHeader = true;
    const layout = await readHeaderLayout(response);
    active.readingHeader = false;
    if (layout && active.live) applyLayout(active, layout);
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
  if (!active.live) return;

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
  const own = [...tallies.values()].map(tallyTraffic);
  snapshot = mergeTraffic([...own, ...parts.values()]);
  for (const listener of listeners) listener();
}

function mergeVerified(carried: Verified, next: Verified): Verified {
  if (carried === "bad" || next === "bad") return "bad";
  if (carried === null || next === null) return null;
  return "ok";
}

function startSpec(region: Region): RegionSpec | null {
  if (!region.spec) return null;
  return {
    stride: region.spec.stride,
    count: region.spec.count,
    crc: region.spec.crc,
  };
}

function addBlockCounts(
  carried: BlockCount | null,
  next: BlockCount,
): BlockCount {
  if (!carried) return { ...next };
  return {
    samples: carried.samples + next.samples,
    done: carried.done + next.done,
    total: carried.total + next.total,
    plainDone: carried.plainDone + next.plainDone,
    plainTotal: carried.plainTotal + next.plainTotal,
  };
}

function addSpecs(
  carried: RegionSpec | null,
  next: RegionSpec | null,
): RegionSpec | null {
  if (!next) return carried;
  if (!carried) return { ...next };
  return {
    stride: carried.stride ?? next.stride,
    count:
      carried.count === null || next.count === null
        ? null
        : carried.count + next.count,
    crc: null,
  };
}

function tallyTraffic(source: Tally): Traffic {
  const regions: RegionTraffic[] = [];
  let mapped = 0;

  for (let index = 0; index < source.regions.length; index += 1) {
    const region = source.regions[index];
    const downloaded = source.perRegion[index];
    const set = source.blockSets[index];
    mapped += downloaded;
    regions.push({
      name: region.name,
      code: region.code,
      group: region.group,
      samples: 1,
      size: region.size,
      downloaded,
      spec: startSpec(region),
      verified: source.verified[index],
      blocks: set
        ? {
            samples: 1,
            done: set.done,
            total: set.blocks.length,
            plainDone: set.plainDone,
            plainTotal: set.plainTotal,
          }
        : null,
    });
  }

  const known = source.regions.length > 0;
  return {
    samples: [labels.get(source.sample) ?? source.sample],
    pending: known ? 0 : 1,
    fileSize: source.fileSize,
    blockSize: source.blockSize,
    blockSizeMixed: false,
    mzWindow: source.mzWindow,
    mzWindowMixed: false,
    downloaded: source.downloaded,
    unmapped: known ? Math.max(0, source.downloaded - mapped) : 0,
    requests: source.requests,
    regions,
  };
}

export function mergeTraffic(parts: Traffic[]): Traffic {
  const regions = new Map<string, RegionTraffic>();
  const samples: string[] = [];
  let pending = 0;
  let fileSize = 0;
  let downloaded = 0;
  let requests = 0;
  let unmapped = 0;
  let blockSize = 0;
  let blockSizeMixed = false;
  let mzWindow = 0;
  let mzWindowMixed = false;

  for (const part of parts) {
    samples.push(...part.samples);
    pending += part.pending;
    fileSize += part.fileSize;
    downloaded += part.downloaded;
    requests += part.requests;
    unmapped += part.unmapped;

    if (part.blockSize) {
      if (blockSize === 0) blockSize = part.blockSize;
      else if (blockSize !== part.blockSize) blockSizeMixed = true;
    }
    if (part.blockSizeMixed) blockSizeMixed = true;
    if (part.mzWindow) {
      if (mzWindow === 0) mzWindow = part.mzWindow;
      else if (mzWindow !== part.mzWindow) mzWindowMixed = true;
    }
    if (part.mzWindowMixed) mzWindowMixed = true;

    for (const region of part.regions) {
      const carried = regions.get(region.name);
      if (!carried) {
        regions.set(region.name, {
          ...region,
          spec: region.spec ? { ...region.spec } : null,
          blocks: region.blocks ? { ...region.blocks } : null,
        });
        continue;
      }
      carried.samples += region.samples;
      carried.size += region.size;
      carried.downloaded += region.downloaded;
      carried.verified = mergeVerified(carried.verified, region.verified);
      carried.spec = addSpecs(carried.spec, region.spec);
      if (region.blocks) {
        carried.blocks = addBlockCounts(carried.blocks, region.blocks);
      }
    }
  }

  samples.sort();
  return {
    samples,
    pending,
    fileSize,
    blockSize,
    blockSizeMixed,
    mzWindow,
    mzWindowMixed,
    downloaded,
    unmapped,
    requests,
    regions: [...regions.values()],
  };
}

export function applySnapshot(at: number, traffic: Traffic): void {
  parts.set(at, traffic);
  publish();
}
