import { produce } from "immer";
import type { PeakOptions, SampleFile } from "msutils";
import type { Point } from "../ms/eic";
import type { Peak } from "../ms/peaks";
import type { Compound } from "../data/compounds";
import { default_mz, default_path, time_range } from "../data/targets";

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

export interface State {
  path: string;
  picked_sample: string | null;
  mz_text: string;
  picked_label: string | null;
  target_rt: number | null;
  samples_open: boolean;
  metabolites_open: boolean;
  samples_width: number;
  metabolites_width: number;
  min_intensity: number;
  min_integral: number;
  min_width: number;
  min_snr: number;
  auto_noise: boolean;
  auto_baseline: boolean;
  allow_overlap: boolean;
  annotate: boolean;
  display_baseline: boolean;
  auto_peak_picking: boolean;
  rt_from: number;
  rt_to: number;
  ppm: number;
  mz_tol: number;
  samples: SamplesState | null;
  file: FileState | null;
  outcome: Outcome | null;
  peaks: Peaks | null;
}

export const initial_state: State = {
  path: default_path,
  picked_sample: null,
  mz_text: String(default_mz),
  picked_label: null,
  target_rt: null,
  samples_open: true,
  metabolites_open: true,
  samples_width: 300,
  metabolites_width: 320,
  min_intensity: 500,
  min_integral: 0,
  min_width: 2,
  min_snr: 2,
  auto_noise: true,
  auto_baseline: true,
  allow_overlap: false,
  annotate: true,
  display_baseline: false,
  auto_peak_picking: true,
  rt_from: time_range.from,
  rt_to: time_range.to,
  ppm: 20,
  mz_tol: 0.005,
  samples: null,
  file: null,
  outcome: null,
  peaks: null,
};

export type Action =
  | { type: "set_path"; path: string }
  | { type: "pick_sample"; name: string }
  | { type: "change_mz"; value: string }
  | { type: "pick_compound"; compound: Compound }
  | { type: "toggle_samples" }
  | { type: "toggle_metabolites" }
  | { type: "set_samples_width"; value: number }
  | { type: "set_metabolites_width"; value: number }
  | { type: "set_min_intensity"; value: number }
  | { type: "set_min_integral"; value: number }
  | { type: "set_min_width"; value: number }
  | { type: "set_min_snr"; value: number }
  | { type: "toggle_auto_noise" }
  | { type: "toggle_auto_baseline" }
  | { type: "toggle_allow_overlap" }
  | { type: "toggle_annotate" }
  | { type: "toggle_display_baseline" }
  | { type: "toggle_auto_peak_picking" }
  | { type: "set_rt_from"; value: number }
  | { type: "set_rt_to"; value: number }
  | { type: "set_ppm"; value: number }
  | { type: "set_mz_tol"; value: number }
  | { type: "samples_loaded"; path: string; names: string[] }
  | { type: "samples_failed"; path: string; message: string }
  | { type: "file_opened"; url: string; file: SampleFile }
  | { type: "file_failed"; url: string; message: string }
  | { type: "eic_ready"; key: string; points: Point[] }
  | { type: "eic_failed"; key: string; message: string }
  | { type: "peaks_found"; key: string; list: Peak[] };

const min_width = 220;
const max_width = 560;

function clamp_width(value: number): number {
  if (value < min_width) return min_width;
  if (value > max_width) return max_width;
  return value;
}

export function reducer(state: State, action: Action): State {
  return produce(state, (draft: State) => {
    switch (action.type) {
      case "set_path":
        draft.path = action.path;
        break;
      case "pick_sample":
        draft.picked_sample = action.name;
        break;
      case "change_mz":
        draft.mz_text = action.value;
        draft.picked_label = null;
        draft.target_rt = null;
        break;
      case "pick_compound":
        draft.mz_text = String(action.compound.mz);
        draft.picked_label = action.compound.label;
        draft.target_rt = action.compound.rt;
        break;
      case "toggle_samples":
        draft.samples_open = !draft.samples_open;
        break;
      case "toggle_metabolites":
        draft.metabolites_open = !draft.metabolites_open;
        break;
      case "set_min_intensity":
        draft.min_intensity = action.value;
        break;
      case "set_min_integral":
        draft.min_integral = action.value;
        break;
      case "set_min_width":
        draft.min_width = action.value;
        break;
      case "set_min_snr":
        draft.min_snr = action.value;
        break;
      case "toggle_auto_noise":
        draft.auto_noise = !draft.auto_noise;
        break;
      case "toggle_auto_baseline":
        draft.auto_baseline = !draft.auto_baseline;
        break;
      case "toggle_allow_overlap":
        draft.allow_overlap = !draft.allow_overlap;
        break;
      case "toggle_annotate":
        draft.annotate = !draft.annotate;
        break;
      case "toggle_display_baseline":
        draft.display_baseline = !draft.display_baseline;
        break;
      case "toggle_auto_peak_picking":
        draft.auto_peak_picking = !draft.auto_peak_picking;
        break;
      case "set_rt_from":
        draft.rt_from = action.value;
        break;
      case "set_rt_to":
        draft.rt_to = action.value;
        break;
      case "set_ppm":
        draft.ppm = action.value;
        break;
      case "set_mz_tol":
        draft.mz_tol = action.value;
        break;
      case "set_samples_width":
        draft.samples_width = clamp_width(action.value);
        break;
      case "set_metabolites_width":
        draft.metabolites_width = clamp_width(action.value);
        break;
      case "samples_loaded":
        draft.samples = { path: action.path, status: "ok", names: action.names };
        break;
      case "samples_failed":
        draft.samples = { path: action.path, status: "error", message: action.message };
        break;
      case "file_opened":
        draft.file = { url: action.url, status: "ok", file: action.file };
        break;
      case "file_failed":
        draft.file = { url: action.url, status: "error", message: action.message };
        break;
      case "eic_ready":
        draft.outcome = { key: action.key, status: "ok", points: action.points };
        break;
      case "eic_failed":
        draft.outcome = { key: action.key, status: "error", message: action.message };
        break;
      case "peaks_found":
        draft.peaks = { key: action.key, list: action.list };
        break;
    }
  });
}

export type PeakSettings = Pick<
  State,
  | "min_intensity"
  | "min_integral"
  | "min_width"
  | "min_snr"
  | "auto_noise"
  | "auto_baseline"
  | "allow_overlap"
>;

export function peak_options(settings: PeakSettings): PeakOptions {
  return {
    minIntensity: settings.min_intensity,
    minIntegral: settings.min_integral,
    minPeakWidthPoints: settings.min_width,
    minSnr: settings.min_snr,
    autoNoise: settings.auto_noise,
    autoBaseline: settings.auto_baseline,
    allowOverlap: settings.allow_overlap,
  };
}

export function read_error(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export function with_slash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

const empty_names: string[] = [];
const empty_points: Point[] = [];
const empty_peaks: Peak[] = [];

export interface View {
  samples_ready: boolean;
  samples_failed: boolean;
  samples_loading: boolean;
  samples: string[];
  samples_message?: string;
  active_sample: string | null;
  url: string | null;
  file: SampleFile | null;
  file_failed: boolean;
  file_message?: string;
  mz: number;
  mz_valid: boolean;
  eic_ready: boolean;
  eic_failed: boolean;
  eic_loading: boolean;
  points: Point[];
  eic_message?: string;
  peaks: Peak[];
  peaks_ready: boolean;
}

export function select_view(state: State): View {
  const samples_at_path = state.samples?.path === state.path;
  const samples_ready = Boolean(samples_at_path && state.samples?.status === "ok");
  const samples_failed = Boolean(samples_at_path && state.samples?.status === "error");
  const samples_loading = !samples_ready && !samples_failed;
  const samples = samples_ready ? (state.samples?.names ?? empty_names) : empty_names;

  const active_sample =
    state.picked_sample && samples.includes(state.picked_sample)
      ? state.picked_sample
      : (samples[0] ?? null);
  const url = active_sample ? with_slash(state.path) + active_sample : null;

  const file_at_url = state.file?.url === url;
  const file_ready = Boolean(file_at_url && state.file?.status === "ok");
  const file_failed = Boolean(file_at_url && state.file?.status === "error");
  const file = file_ready ? (state.file?.file ?? null) : null;

  const mz = Number(state.mz_text);
  const mz_valid = Number.isFinite(mz) && mz > 0;

  const result =
    state.outcome && state.outcome.key === `${url}|${mz}` ? state.outcome : null;
  const eic_ready = Boolean(file && mz_valid && result?.status === "ok");
  const eic_failed = Boolean(file && result?.status === "error");
  const eic_loading = Boolean(file && mz_valid && !eic_ready && !eic_failed);
  const points = result?.points ?? empty_points;

  const peaks_ready = Boolean(state.peaks && state.peaks.key === `${url}|${mz}`);
  const peaks = peaks_ready ? (state.peaks?.list ?? empty_peaks) : empty_peaks;

  return {
    samples_ready,
    samples_failed,
    samples_loading,
    samples,
    samples_message: state.samples?.message,
    active_sample,
    url,
    file,
    file_failed,
    file_message: state.file?.message,
    mz,
    mz_valid,
    eic_ready,
    eic_failed,
    eic_loading,
    points,
    eic_message: result?.message,
    peaks,
    peaks_ready,
  };
}
