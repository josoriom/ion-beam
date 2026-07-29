import { useEffect, useReducer, type ReactNode } from "react";
import { getSamples } from "../ms/listSamples";
import { getPeaks } from "../ms/peaks";
import { writePaths } from "../utilities/savedPaths";
import { watchWideScreen } from "../utilities/screen";
import { DispatchContext, StateContext } from "./context";
import { SampleLoader } from "./SampleLoader";
import { useOpenUrls } from "./useTraces";
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

  const { samples, savedPaths } = state;

  useEffect(() => {
    writePaths(savedPaths);
  }, [savedPaths]);

  useEffect(
    () => watchWideScreen((wide) => dispatch({ type: "setWideScreen", wide })),
    [],
  );

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
  const { mainKey, mainPoints, mainReady, mz } = selectView(state);
  const openUrls = useOpenUrls(state);

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
    if (!autoPeakPicking || !mainReady || mainKey === null) return;
    const options = peakOptions({
      minIntensity,
      minIntegral,
      minWidth,
      minSnr,
      autoNoise,
      autoBaseline,
      allowOverlap,
    });
    const list = getPeaks(mainPoints, options);
    dispatch({ type: "peaksFound", key: mainKey, list });
  }, [
    autoPeakPicking,
    mainReady,
    mainPoints,
    mainKey,
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
        {openUrls.map((url) => (
          <SampleLoader
            key={url}
            url={url}
            mz={mz}
            rtFrom={rtFrom}
            rtTo={rtTo}
            ppm={ppm}
            mzTol={mzTol}
            dispatch={dispatch}
          />
        ))}
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  );
}
