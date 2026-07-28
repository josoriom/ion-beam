import { useEffect, useReducer, useRef, type ReactNode } from "react";
import type { SampleFile } from "quantion";
import { getSamples } from "../ms/listSamples";
import { openIonFile } from "../ms/ionFile";
import { getEic } from "../ms/eic";
import { getPeaks } from "../ms/peaks";
import { trackSample } from "../ms/traffic";
import { endQuery, resetQuery, startQuery } from "../ms/queryTimer";
import { writePaths } from "../utilities/savedPaths";
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

function trackEicTask(
  tasks: Map<SampleFile, Set<Promise<void>>>,
  file: SampleFile,
  task: Promise<void>,
) {
  const running = tasks.get(file) ?? new Set<Promise<void>>();
  running.add(task);
  tasks.set(file, running);
  task.finally(() => {
    running.delete(task);
    if (running.size === 0) tasks.delete(file);
  });
}

function waitForEicTasks(
  tasks: Map<SampleFile, Set<Promise<void>>>,
  file: SampleFile,
): Promise<void> {
  const running = tasks.get(file);
  if (!running || running.size === 0) return Promise.resolve();
  return Promise.allSettled([...running]).then(() => undefined);
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const { samples, savedPaths } = state;

  useEffect(() => {
    writePaths(savedPaths);
  }, [savedPaths]);

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
  const { url, file, mz, eicReady, points } = selectView(state);

  const eicTasksByFile = useRef(new Map<SampleFile, Set<Promise<void>>>());

  useEffect(() => {
    if (samples && samples.path === path) return undefined;
    if (path.trim().length === 0) {
      dispatch({ type: "samplesLoaded", path, names: [] });
      return undefined;
    }
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
    trackSample(url);
    resetQuery();
  }, [url]);

  useEffect(() => {
    if (!url) return undefined;
    let active = true;
    let opened: SampleFile | null = null;
    const tasks = eicTasksByFile.current;
    startQuery();
    openIonFile(url)
      .finally(endQuery)
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
      const target = opened;
      if (!target) return;
      dispatch({ type: "fileClosed", url });
      waitForEicTasks(tasks, target).finally(() => {
        target.dispose?.();
      });
    };
  }, [url]);

  useEffect(() => {
    if (!file || mz === null) return undefined;
    const key = `${url}|${mz}`;
    let active = true;
    startQuery();
    const task = getEic(file, mz, { from: rtFrom, to: rtTo }, ppm, mzTol)
      .finally(endQuery)
      .then((result) => {
        if (active) dispatch({ type: "eicReady", key, points: result.points });
      })
      .catch((error: unknown) => {
        if (active)
          dispatch({ type: "eicFailed", key, message: readError(error) });
      });
    trackEicTask(eicTasksByFile.current, file, task);
    return () => {
      active = false;
    };
  }, [file, mz, url, rtFrom, rtTo, ppm, mzTol]);

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

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
