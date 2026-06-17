import { useEffect, useReducer, type ReactNode } from "react";
import type { SampleFile } from "msutils";
import { get_samples } from "../ms/list_samples";
import { open_ion_file } from "../ms/ion_file";
import { get_eic } from "../ms/eic";
import { get_peaks } from "../ms/peaks";
import { DispatchContext, StateContext } from "./context";
import { initial_state, peak_options, read_error, reducer, select_view } from "./reducer";

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(reducer, initial_state);

  const {
    path,
    rt_from,
    rt_to,
    ppm,
    mz_tol,
    auto_peak_picking,
    min_intensity,
    min_integral,
    min_width,
    min_snr,
    auto_noise,
    auto_baseline,
    allow_overlap,
  } = state;
  const { url, file, mz, mz_valid, eic_ready, points } = select_view(state);

  useEffect(() => {
    let active = true;
    get_samples(path)
      .then((names) => {
        if (active) dispatch({ type: "samples_loaded", path, names });
      })
      .catch((error: unknown) => {
        if (active) dispatch({ type: "samples_failed", path, message: read_error(error) });
      });
    return () => {
      active = false;
    };
  }, [path]);

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    let opened: SampleFile | null = null;
    open_ion_file(url)
      .then((file) => {
        if (!active) {
          file.dispose?.();
          return;
        }
        opened = file;
        dispatch({ type: "file_opened", url, file });
      })
      .catch((error: unknown) => {
        if (active) dispatch({ type: "file_failed", url, message: read_error(error) });
      });
    return () => {
      active = false;
      opened?.dispose?.();
    };
  }, [url]);

  useEffect(() => {
    if (!file || !mz_valid) return undefined;
    const key = `${url}|${mz}`;
    let active = true;
    get_eic(file, mz, { from: rt_from, to: rt_to }, ppm, mz_tol)
      .then((result) => {
        if (active) dispatch({ type: "eic_ready", key, points: result.points });
      })
      .catch((error: unknown) => {
        if (active) dispatch({ type: "eic_failed", key, message: read_error(error) });
      });
    return () => {
      active = false;
    };
  }, [file, mz, mz_valid, url, rt_from, rt_to, ppm, mz_tol]);

  useEffect(() => {
    if (!auto_peak_picking || !eic_ready) return;
    const options = peak_options({
      min_intensity,
      min_integral,
      min_width,
      min_snr,
      auto_noise,
      auto_baseline,
      allow_overlap,
    });
    const list = get_peaks(points, options);
    dispatch({ type: "peaks_found", key: `${url}|${mz}`, list });
  }, [
    auto_peak_picking,
    eic_ready,
    points,
    url,
    mz,
    min_intensity,
    min_integral,
    min_width,
    min_snr,
    auto_noise,
    auto_baseline,
    allow_overlap,
  ]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}
