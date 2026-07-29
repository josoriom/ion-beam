import { produce } from "immer";
import type { PeakOptions } from "quantion";
import type { Point } from "../ms/eic";
import type { Peak } from "../ms/peaks";
import type { Compound } from "../data/compounds";
import { defaultMz, defaultPath, timeRange } from "../data/targets";
import { readPaths } from "../utilities/savedPaths";
import { isWideScreen } from "../utilities/screen";
import { toRawFolder } from "../ms/github";
export interface SamplesState {
  path: string;
  status: "ok" | "error";
  names?: string[];
  message?: string;
}

export interface FileState {
  url: string;
  status: "ok" | "error";
  message?: string;
}

export interface Outcome {
  key: string;
  status: "ok" | "error";
  points?: Point[];
  message?: string;
}

export interface Peaks {
  key: string;
  list: Peak[];
}

export interface AddedSample {
  name: string;
  styleIndex: number;
}

export interface State {
  path: string;
  savedPaths: string[];
  pickedSample: string | null;
  addedSamples: AddedSample[];
  mzText: string;
  pickedMz: number | null;
  pickedLabel: string | null;
  targetRt: number | null;
  wideScreen: boolean;
  samplesOpen: boolean;
  metabolitesOpen: boolean;
  inspectOpen: boolean;
  samplesWidth: number;
  metabolitesWidth: number;
  minIntensity: number;
  minIntegral: number;
  minWidth: number;
  minSnr: number;
  autoNoise: boolean;
  autoBaseline: boolean;
  allowOverlap: boolean;
  annotate: boolean;
  displayBaseline: boolean;
  autoPeakPicking: boolean;
  rtFrom: number;
  rtTo: number;
  ppm: number;
  mzTol: number;
  samples: SamplesState | null;
  files: Record<string, FileState>;
  outcomes: Record<string, Outcome>;
  peaks: Peaks | null;
}

const startPaths = readPaths([defaultPath]);
const startsWide = isWideScreen();

export const initialState: State = {
  path: startPaths[0] ?? "",
  savedPaths: startPaths,
  pickedSample: null,
  addedSamples: [],
  mzText: String(defaultMz),
  pickedMz: null,
  pickedLabel: null,
  targetRt: null,
  wideScreen: startsWide,
  samplesOpen: startsWide,
  metabolitesOpen: startsWide,
  inspectOpen: false,
  samplesWidth: 300,
  metabolitesWidth: 320,
  minIntensity: 500,
  minIntegral: 0,
  minWidth: 2,
  minSnr: 2,
  autoNoise: true,
  autoBaseline: true,
  allowOverlap: false,
  annotate: true,
  displayBaseline: false,
  autoPeakPicking: true,
  rtFrom: timeRange.from,
  rtTo: timeRange.to,
  ppm: 20,
  mzTol: 0.005,
  samples: null,
  files: {},
  outcomes: {},
  peaks: null,
};

export type Action =
  | { type: "reloadSamples" }
  | { type: "setPath"; path: string }
  | { type: "addPath"; path: string }
  | { type: "removePath"; path: string }
  | { type: "pickSample"; name: string }
  | { type: "toggleSample"; name: string }
  | { type: "changeMz"; value: string }
  | { type: "pickCompound"; compound: Compound }
  | { type: "setWideScreen"; wide: boolean }
  | { type: "toggleSamples" }
  | { type: "toggleMetabolites" }
  | { type: "toggleInspect" }
  | { type: "setSamplesWidth"; value: number }
  | { type: "setMetabolitesWidth"; value: number }
  | { type: "setMinIntensity"; value: number }
  | { type: "setMinIntegral"; value: number }
  | { type: "setMinWidth"; value: number }
  | { type: "setMinSnr"; value: number }
  | { type: "toggleAutoNoise" }
  | { type: "toggleAutoBaseline" }
  | { type: "toggleAllowOverlap" }
  | { type: "toggleAnnotate" }
  | { type: "toggleDisplayBaseline" }
  | { type: "toggleAutoPeakPicking" }
  | { type: "setRtFrom"; value: number }
  | { type: "setRtTo"; value: number }
  | { type: "setPpm"; value: number }
  | { type: "setMzTol"; value: number }
  | { type: "samplesLoaded"; path: string; names: string[] }
  | { type: "samplesFailed"; path: string; message: string }
  | { type: "fileOpened"; url: string }
  | { type: "fileFailed"; url: string; message: string }
  | { type: "fileClosed"; url: string }
  | { type: "eicReady"; url: string; key: string; points: Point[] }
  | { type: "eicFailed"; url: string; key: string; message: string }
  | { type: "peaksFound"; key: string; list: Peak[] };

const minPanelWidth = 220;
const maxPanelWidth = 560;

const traceColors = [
  "#334155",
  "#0072b2",
  "#c48218",
  "#8b5500",
  "#9776fb",
  "#cf386d",
  "#009eaf",
  "#2841b9",
  "#851286",
  "#eb5485",
  "#a76c00",
  "#b13290",
  "#805ddf",
  "#9c0230",
  "#086e53",
  "#c364d9",
  "#bc1f4b",
  "#4252cd",
  "#0084ba",
  "#91056b",
  "#d64992",
  "#5aa04a",
  "#a91e76",
  "#7a28a2",
  "#bb42a4",
  "#01614d",
  "#b657cc",
  "#9a600b",
  "#8a4000",
  "#8c69ed",
  "#b6770b",
  "#c53c8e",
];

export const colorsBeforeRepeat = traceColors.length;

export function traceColor(styleIndex: number): string {
  return traceColors[styleIndex % traceColors.length];
}

function clampPanelWidth(value: number): number {
  if (value < minPanelWidth) return minPanelWidth;
  if (value > maxPanelWidth) return maxPanelWidth;
  return value;
}

function findFreeStyle(added: AddedSample[]): number {
  const taken = new Set(added.map((sample) => sample.styleIndex));
  let index = 1;
  while (taken.has(index)) index += 1;
  return index;
}

export function reducer(state: State, action: Action): State {
  return produce(state, (draft: State) => {
    switch (action.type) {
      case "reloadSamples":
        draft.samples = null;
        break;
      case "setPath":
        draft.path = action.path;
        draft.addedSamples = [];
        draft.pickedMz = null;
        draft.pickedLabel = null;
        draft.targetRt = null;
        break;
      case "addPath": {
        const path = action.path.trim();
        if (path.length > 0 && !draft.savedPaths.includes(path)) {
          draft.savedPaths.push(path);
        }
        break;
      }
      case "removePath": {
        draft.savedPaths = draft.savedPaths.filter((item) => item !== action.path);
        draft.path = "";
        draft.pickedSample = null;
        draft.addedSamples = [];
        draft.pickedMz = null;
        draft.pickedLabel = null;
        draft.targetRt = null;
        break;
      }
      case "pickSample":
        draft.pickedSample = action.name;
        draft.addedSamples = [];
        draft.samplesOpen = draft.wideScreen;
        break;
      case "setWideScreen":
        draft.wideScreen = action.wide;
        draft.samplesOpen = action.wide;
        draft.metabolitesOpen = action.wide;
        break;
      case "toggleSample": {
        if (action.name === draft.pickedSample) break;
        const at = draft.addedSamples.findIndex(
          (sample) => sample.name === action.name,
        );
        if (at !== -1) {
          draft.addedSamples.splice(at, 1);
          break;
        }
        const styleIndex = findFreeStyle(draft.addedSamples);
        draft.addedSamples.push({ name: action.name, styleIndex });
        break;
      }
      case "changeMz":
        draft.mzText = action.value;
        draft.pickedMz = readMz(action.value);
        draft.pickedLabel = null;
        draft.targetRt = null;
        break;
      case "pickCompound":
        draft.mzText = String(action.compound.mz);
        draft.pickedMz = action.compound.mz;
        draft.pickedLabel = action.compound.label;
        draft.targetRt = action.compound.rt;
        draft.metabolitesOpen = draft.wideScreen;
        break;
      case "toggleSamples":
        draft.samplesOpen = !draft.samplesOpen;
        break;
      case "toggleMetabolites":
        draft.metabolitesOpen = !draft.metabolitesOpen;
        break;
      case "toggleInspect":
        draft.inspectOpen = !draft.inspectOpen;
        break;
      case "setMinIntensity":
        draft.minIntensity = action.value;
        break;
      case "setMinIntegral":
        draft.minIntegral = action.value;
        break;
      case "setMinWidth":
        draft.minWidth = action.value;
        break;
      case "setMinSnr":
        draft.minSnr = action.value;
        break;
      case "toggleAutoNoise":
        draft.autoNoise = !draft.autoNoise;
        break;
      case "toggleAutoBaseline":
        draft.autoBaseline = !draft.autoBaseline;
        break;
      case "toggleAllowOverlap":
        draft.allowOverlap = !draft.allowOverlap;
        break;
      case "toggleAnnotate":
        draft.annotate = !draft.annotate;
        break;
      case "toggleDisplayBaseline":
        draft.displayBaseline = !draft.displayBaseline;
        break;
      case "toggleAutoPeakPicking":
        draft.autoPeakPicking = !draft.autoPeakPicking;
        break;
      case "setRtFrom":
        draft.rtFrom = action.value;
        break;
      case "setRtTo":
        draft.rtTo = action.value;
        break;
      case "setPpm":
        draft.ppm = action.value;
        break;
      case "setMzTol":
        draft.mzTol = action.value;
        break;
      case "setSamplesWidth":
        draft.samplesWidth = clampPanelWidth(action.value);
        break;
      case "setMetabolitesWidth":
        draft.metabolitesWidth = clampPanelWidth(action.value);
        break;
      case "samplesLoaded":
        draft.samples = {
          path: action.path,
          status: "ok",
          names: action.names,
        };
        break;
      case "samplesFailed":
        draft.samples = {
          path: action.path,
          status: "error",
          message: action.message,
        };
        break;
      case "fileOpened":
        draft.files[action.url] = { url: action.url, status: "ok" };
        break;
      case "fileFailed":
        draft.files[action.url] = {
          url: action.url,
          status: "error",
          message: action.message,
        };
        break;
      case "fileClosed":
        delete draft.files[action.url];
        delete draft.outcomes[action.url];
        break;
      case "eicReady":
        draft.outcomes[action.url] = {
          key: action.key,
          status: "ok",
          points: action.points,
        };
        break;
      case "eicFailed":
        draft.outcomes[action.url] = {
          key: action.key,
          status: "error",
          message: action.message,
        };
        break;
      case "peaksFound":
        draft.peaks = { key: action.key, list: action.list };
        break;
    }
  });
}

export type PeakSettings = Pick<
  State,
  | "minIntensity"
  | "minIntegral"
  | "minWidth"
  | "minSnr"
  | "autoNoise"
  | "autoBaseline"
  | "allowOverlap"
>;

export function peakOptions(settings: PeakSettings): PeakOptions {
  return {
    minIntensity: settings.minIntensity,
    minIntegral: settings.minIntegral,
    minPeakWidthPoints: settings.minWidth,
    minSnr: settings.minSnr,
    autoNoise: settings.autoNoise,
    autoBaseline: settings.autoBaseline,
    allowOverlap: settings.allowOverlap,
  };
}

export type EicSettings = Pick<State, "rtFrom" | "rtTo" | "ppm" | "mzTol">;

export function eicKey(
  url: string,
  mz: number,
  settings: EicSettings,
): string {
  return `${url}|${mz}|${settings.rtFrom}|${settings.rtTo}|${settings.ppm}|${settings.mzTol}`;
}

export function readMz(value: string): number | null {
  const mz = Number(value);
  return Number.isFinite(mz) && mz > 0 ? mz : null;
}

export function readError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function withSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export function activePath(state: State): string {
  return state.path;
}

const emptyNames: string[] = [];
const emptyPoints: Point[] = [];
const emptyPeaks: Peak[] = [];
const emptyUrls: string[] = [];
const emptyTraces: Trace[] = [];

export type TraceStatus = "idle" | "loading" | "ready" | "failed";

export interface Trace {
  sample: string;
  url: string;
  color: string;
  main: boolean;
  status: TraceStatus;
  points: Point[];
  message?: string;
}

export type SelectionInput = Pick<
  State,
  "path" | "samples" | "pickedSample" | "addedSamples"
>;

export type TraceInput = SelectionInput &
  EicSettings &
  Pick<State, "pickedMz" | "files" | "outcomes">;

function readNames(input: SelectionInput): string[] {
  if (input.samples?.path !== input.path) return emptyNames;
  if (input.samples.status !== "ok") return emptyNames;
  return input.samples.names ?? emptyNames;
}

function readMainSample(input: SelectionInput, names: string[]): string | null {
  if (input.pickedSample && names.includes(input.pickedSample)) {
    return input.pickedSample;
  }
  return names[0] ?? null;
}

function readShownSamples(
  input: SelectionInput,
  names: string[],
  main: string,
): AddedSample[] {
  const shown: AddedSample[] = [{ name: main, styleIndex: 0 }];
  for (const added of input.addedSamples) {
    if (added.name === main) continue;
    if (!names.includes(added.name)) continue;
    shown.push(added);
  }
  return shown;
}

function readTraceStatus(
  mz: number | null,
  file: FileState | undefined,
  outcome: Outcome | undefined,
): TraceStatus {
  if (mz === null) return "idle";
  if (file?.status === "error") return "failed";
  if (outcome?.status === "error") return "failed";
  if (outcome?.status === "ok") return "ready";
  return "loading";
}

export function selectOpenUrls(input: SelectionInput): string[] {
  const names = readNames(input);
  const main = readMainSample(input, names);
  if (!main) return emptyUrls;
  const folder = withSlash(toRawFolder(input.path));
  return readShownSamples(input, names, main).map(
    (shown) => folder + shown.name,
  );
}

export function selectTraces(input: TraceInput): Trace[] {
  const names = readNames(input);
  const main = readMainSample(input, names);
  if (!main) return emptyTraces;
  const folder = withSlash(toRawFolder(input.path));
  const mz = input.pickedMz;

  return readShownSamples(input, names, main).map((shown) => {
    const url = folder + shown.name;
    const file = input.files[url];
    const stored = input.outcomes[url];
    const outcome =
      mz !== null && stored?.key === eicKey(url, mz, input) ? stored : undefined;
    return {
      sample: shown.name,
      url,
      color: traceColor(shown.styleIndex),
      main: shown.name === main,
      status: readTraceStatus(mz, file, outcome),
      points: outcome?.points ?? emptyPoints,
      message: file?.status === "error" ? file.message : outcome?.message,
    };
  });
}

export interface View {
  samplesReady: boolean;
  samplesFailed: boolean;
  samplesLoading: boolean;
  samples: string[];
  samplesMessage?: string;
  mainSample: string | null;
  mainUrl: string | null;
  mainKey: string | null;
  mainPoints: Point[];
  mainReady: boolean;
  mz: number | null;
  peaks: Peak[];
  peaksReady: boolean;
}

export function selectView(state: State): View {
  const path = activePath(state);
  const samplesAtPath = state.samples?.path === path;
  const samplesReady = Boolean(samplesAtPath && state.samples?.status === "ok");
  const samplesFailed = Boolean(
    samplesAtPath && state.samples?.status === "error",
  );
  const samplesLoading = !samplesReady && !samplesFailed;
  const samples = samplesReady
    ? (state.samples?.names ?? emptyNames)
    : emptyNames;

  const mainSample = readMainSample(state, samples);
  const mainUrl = mainSample
    ? withSlash(toRawFolder(path)) + mainSample
    : null;

  const mz = state.pickedMz;
  const mainKey =
    mainUrl !== null && mz !== null ? eicKey(mainUrl, mz, state) : null;
  const stored = mainUrl === null ? undefined : state.outcomes[mainUrl];
  const outcome =
    mainKey !== null && stored?.key === mainKey ? stored : undefined;
  const mainReady = outcome?.status === "ok";
  const mainPoints = outcome?.points ?? emptyPoints;

  const peaksReady = Boolean(
    mainKey !== null && state.peaks?.key === mainKey,
  );
  const peaks = peaksReady ? (state.peaks?.list ?? emptyPeaks) : emptyPeaks;

  return {
    samplesReady,
    samplesFailed,
    samplesLoading,
    samples,
    samplesMessage: state.samples?.message,
    mainSample,
    mainUrl,
    mainKey,
    mainPoints,
    mainReady,
    mz,
    peaks,
    peaksReady,
  };
}
