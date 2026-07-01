import { useEffect, useReducer, type ReactNode } from "react";
import type { SampleFile } from "msutils";
import { getSamples } from "../ms/listSamples";
import { openIonFile } from "../ms/ionFile";
import { getEic } from "../ms/eic";
import { getPeaks } from "../ms/peaks";
import { requestImage, type ImageProgress } from "../ms/imageClient";
import { imageKey, imageLevel, targetTolerance } from "../data/imageTargets";
import { DispatchContext, StateContext } from "./context";
import {
  activePath,
  initialState,
  peakOptions,
  readError,
  reducer,
  selectView,
} from "./reducer";

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const { mode, selectedMz, images, samples } = state;

  const {
    rtFrom,
    rtTo,
    ppm,
    mzTol,
    autoPeakPicking,
    minIntensity,
    minIntegral,
    minWidth,
    minSnr,
    autoNoise,
    autoBaseline,
    allowOverlap,
  } = state;
  const path = activePath(state);
  const { url, file, mz, mzValid, eicReady, points } = selectView(state);

  useEffect(() => {
    if (samples && samples.path === path) return undefined;
    let active = true;
    getSamples(path)
      .then((names) => {
        if (active) dispatch({ type: "samplesLoaded", path, names });
      })
      .catch((error: unknown) => {
        if (active)
          dispatch({ type: "samplesFailed", path, message: readError(error) });
      });
    return () => {
      active = false;
    };
  }, [path, samples]);

  useEffect(() => {
    if (mode !== "eic" || !url) return undefined;
    let active = true;
    let opened: SampleFile | null = null;
    openIonFile(url)
      .then((file) => {
        if (!active) {
          file.dispose?.();
          return;
        }
        opened = file;
        dispatch({ type: "fileOpened", url, file });
      })
      .catch((error: unknown) => {
        if (active)
          dispatch({ type: "fileFailed", url, message: readError(error) });
      });
    return () => {
      active = false;
      opened?.dispose?.();
    };
  }, [mode, url]);

  useEffect(() => {
    if (!file || !mzValid) return undefined;
    const key = `${url}|${mz}`;
    let active = true;
    getEic(file, mz, { from: rtFrom, to: rtTo }, ppm, mzTol)
      .then((result) => {
        if (active) dispatch({ type: "eicReady", key, points: result.points });
      })
      .catch((error: unknown) => {
        if (active)
          dispatch({ type: "eicFailed", key, message: readError(error) });
      });
    return () => {
      active = false;
    };
  }, [file, mz, mzValid, url, rtFrom, rtTo, ppm, mzTol]);

  useEffect(() => {
    if (!autoPeakPicking || !eicReady) return;
    const options = peakOptions({
      minIntensity,
      minIntegral,
      minWidth,
      minSnr,
      autoNoise,
      autoBaseline,
      allowOverlap,
    });
    const list = getPeaks(points, options);
    dispatch({ type: "peaksFound", key: `${url}|${mz}`, list });
  }, [
    autoPeakPicking,
    eicReady,
    points,
    url,
    mz,
    minIntensity,
    minIntegral,
    minWidth,
    minSnr,
    autoNoise,
    autoBaseline,
    allowOverlap,
  ]);

  useEffect(() => {
    if (mode !== "imaging" || !url || selectedMz === null) return undefined;
    const key = imageKey(url, selectedMz);
    if (images[key]) return undefined;

    let active = true;
    let lastPercent = -1;
    const onProgress = (progress: ImageProgress) => {
      if (!active) return;
      const percent =
        progress.total > 0
          ? Math.floor((progress.fetched / progress.total) * 100)
          : 0;
      if (percent === lastPercent) return;
      lastPercent = percent;
      dispatch({
        type: "imageProgress",
        fetched: progress.fetched,
        total: progress.total,
        memory: progress.memory,
      });
    };
    requestImage(
      url,
      selectedMz,
      targetTolerance(selectedMz),
      imageLevel,
      onProgress,
    )
      .then((image) => {
        if (active)
          dispatch({ type: "imageReady", url, mz: selectedMz, image });
      })
      .catch((error: unknown) => {
        if (active)
          dispatch({
            type: "imageFailed",
            url,
            mz: selectedMz,
            message: readError(error),
          });
      });
    return () => {
      active = false;
    };
  }, [mode, url, selectedMz, images]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
