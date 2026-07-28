import { produce } from "immer";
import type { PeakOptions, SampleFile } from "quantion";
import type { Point } from "../ms/eic";
import type { Peak } from "../ms/peaks";
import type { RenderedImage } from "../ms/ionImage";
import type { Compound } from "../data/compounds";
import {
  defaultMz,
  defaultPath,
  imagingPath,
  timeRange,
} from "../data/targets";
import { readPaths } from "../utilities/savedPaths";
import { toRawFolder } from "../ms/github";
import {
  defaultImageTargets,
  imageKey,
  targetId,
  type ImageTarget,
} from "../data/imageTargets";

export type Mode = "eic" | "imaging";

export interface SamplesState {
  path: string;
  status: "ok" | "error";
  names?: string[];
  message?: string;
}

export interface FileState {
  url: string;
  status: "ok" | "error";
  file?: SampleFile;
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

export interface ImageOutcome {
  status: "ok" | "error" | "pending";
  image?: RenderedImage;
  message?: string;
}

export interface ImageProgress {
  fetched: number;
  total: number;
  memory: number | null;
}

export interface State {
  mode: Mode;
  imageTargets: ImageTarget[];
  selectedMz: number | null;
  images: Record<string, ImageOutcome>;
  imageProgress: ImageProgress | null;
  path: string;
  imagePath: string;
  savedPaths: string[];
  pickedSample: string | null;
  mzText: string;
  pickedMz: number | null;
  pickedLabel: string | null;
  targetRt: number | null;
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
  file: FileState | null;
  outcome: Outcome | null;
  peaks: Peaks | null;
}

const startPaths = readPaths([defaultPath]);

export const initialState: State = {
  mode: "eic",
  imageTargets: defaultImageTargets,
  selectedMz: null,
  images: {},
  imageProgress: null,
  path: startPaths[0] ?? "",
  imagePath: imagingPath,
  savedPaths: startPaths,
  pickedSample: null,
  mzText: String(defaultMz),
  pickedMz: null,
  pickedLabel: null,
  targetRt: null,
  samplesOpen: true,
  metabolitesOpen: true,
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
  file: null,
  outcome: null,
  peaks: null,
};

export type Action =
  | { type: "setMode"; mode: Mode }
  | { type: "reloadSamples" }
  | { type: "addImageTarget"; mz: number }
  | { type: "removeImageTarget"; mz: number }
  | { type: "selectImageTarget"; mz: number }
  | {
      type: "imageProgress";
      fetched: number;
      total: number;
      memory: number | null;
    }
  | { type: "imageRequested"; url: string; mz: number }
  | { type: "imageReady"; url: string; mz: number; image: RenderedImage }
  | { type: "imageFailed"; url: string; mz: number; message: string }
  | { type: "setPath"; path: string }
  | { type: "addPath"; path: string }
  | { type: "removePath"; path: string }
  | { type: "pickSample"; name: string }
  | { type: "changeMz"; value: string }
  | { type: "pickCompound"; compound: Compound }
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
  | { type: "fileOpened"; url: string; file: SampleFile }
  | { type: "fileFailed"; url: string; message: string }
  | { type: "fileClosed"; url: string }
  | { type: "eicReady"; key: string; points: Point[] }
  | { type: "eicFailed"; key: string; message: string }
  | { type: "peaksFound"; key: string; list: Peak[] };

const minPanelWidth = 220;
const maxPanelWidth = 560;

function clampPanelWidth(value: number): number {
  if (value < minPanelWidth) return minPanelWidth;
  if (value > maxPanelWidth) return maxPanelWidth;
  return value;
}

export function reducer(state: State, action: Action): State {
  return produce(state, (draft: State) => {
    switch (action.type) {
      case "setMode":
        draft.mode = action.mode;
        break;
      case "reloadSamples":
        draft.samples = null;
        break;
      case "addImageTarget": {
        const exists = draft.imageTargets.some(
          (target) => target.mz === action.mz,
        );
        if (!exists) {
          draft.imageTargets.push({ id: targetId(action.mz), mz: action.mz });
        }
        draft.selectedMz = action.mz;
        draft.imageProgress = null;
        break;
      }
      case "removeImageTarget":
        draft.imageTargets = draft.imageTargets.filter(
          (target) => target.mz !== action.mz,
        );
        if (draft.selectedMz === action.mz) draft.selectedMz = null;
        break;
      case "selectImageTarget":
        draft.selectedMz = action.mz;
        draft.imageProgress = null;
        break;
      case "imageProgress":
        draft.imageProgress = {
          fetched: action.fetched,
          total: action.total,
          memory: action.memory,
        };
        break;
      case "imageRequested":
        draft.images[imageKey(action.url, action.mz)] = { status: "pending" };
        break;
      case "imageReady":
        draft.images[imageKey(action.url, action.mz)] = {
          status: "ok",
          image: action.image,
        };
        draft.imageProgress = null;
        break;
      case "imageFailed":
        draft.images[imageKey(action.url, action.mz)] = {
          status: "error",
          message: action.message,
        };
        draft.imageProgress = null;
        break;
      case "setPath":
        if (draft.mode === "imaging") draft.imagePath = action.path;
        else draft.path = action.path;
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
        if (draft.mode === "imaging") draft.imagePath = "";
        else draft.path = "";
        draft.pickedSample = null;
        draft.pickedMz = null;
        draft.pickedLabel = null;
        draft.targetRt = null;
        break;
      }
      case "pickSample":
        draft.pickedSample = action.name;
        draft.pickedMz = null;
        draft.pickedLabel = null;
        draft.targetRt = null;
        break;
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
        draft.file = { url: action.url, status: "ok", file: action.file };
        break;
      case "fileFailed":
        draft.file = {
          url: action.url,
          status: "error",
          message: action.message,
        };
        break;
      case "fileClosed":
        if (draft.file?.url === action.url) draft.file = null;
        break;
      case "eicReady":
        draft.outcome = {
          key: action.key,
          status: "ok",
          points: action.points,
        };
        break;
      case "eicFailed":
        draft.outcome = {
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
  return state.mode === "imaging" ? state.imagePath : state.path;
}

const emptyNames: string[] = [];
const emptyPoints: Point[] = [];
const emptyPeaks: Peak[] = [];

export interface View {
  samplesReady: boolean;
  samplesFailed: boolean;
  samplesLoading: boolean;
  samples: string[];
  samplesMessage?: string;
  activeSample: string | null;
  url: string | null;
  file: SampleFile | null;
  fileFailed: boolean;
  fileMessage?: string;
  mz: number | null;
  eicReady: boolean;
  eicFailed: boolean;
  eicLoading: boolean;
  points: Point[];
  eicMessage?: string;
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

  const activeSample =
    state.pickedSample && samples.includes(state.pickedSample)
      ? state.pickedSample
      : (samples[0] ?? null);
  const url = activeSample ? withSlash(toRawFolder(path)) + activeSample : null;

  const fileAtUrl = state.file?.url === url;
  const fileReady = Boolean(fileAtUrl && state.file?.status === "ok");
  const fileFailed = Boolean(fileAtUrl && state.file?.status === "error");
  const file = fileReady ? (state.file?.file ?? null) : null;

  const mz = state.pickedMz;
  const result =
    state.outcome && state.outcome.key === `${url}|${mz}`
      ? state.outcome
      : null;
  const eicReady = Boolean(file && mz !== null && result?.status === "ok");
  const eicFailed = Boolean(file && mz !== null && result?.status === "error");
  const eicLoading = Boolean(file && mz !== null && !eicReady && !eicFailed);
  const points = result?.points ?? emptyPoints;

  const peaksReady = Boolean(state.peaks && state.peaks.key === `${url}|${mz}`);
  const peaks = peaksReady ? (state.peaks?.list ?? emptyPeaks) : emptyPeaks;

  return {
    samplesReady,
    samplesFailed,
    samplesLoading,
    samples,
    samplesMessage: state.samples?.message,
    activeSample,
    url,
    file,
    fileFailed,
    fileMessage: state.file?.message,
    mz,
    eicReady,
    eicFailed,
    eicLoading,
    points,
    eicMessage: result?.message,
    peaks,
    peaksReady,
  };
}
