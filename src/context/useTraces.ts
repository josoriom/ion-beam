import { useMemo } from "react";
import {
  selectOpenUrls,
  selectTraces,
  type State,
  type Trace,
} from "./reducer";

export function useOpenUrls(state: State): string[] {
  const { path, samples, pickedSample, addedSamples } = state;
  return useMemo(
    () => selectOpenUrls({ path, samples, pickedSample, addedSamples }),
    [path, samples, pickedSample, addedSamples],
  );
}

export function useTraces(state: State): Trace[] {
  const {
    path,
    samples,
    pickedSample,
    addedSamples,
    pickedMz,
    rtFrom,
    rtTo,
    ppm,
    mzTol,
    files,
    outcomes,
  } = state;
  return useMemo(
    () =>
      selectTraces({
        path,
        samples,
        pickedSample,
        addedSamples,
        pickedMz,
        rtFrom,
        rtTo,
        ppm,
        mzTol,
        files,
        outcomes,
      }),
    [
      path,
      samples,
      pickedSample,
      addedSamples,
      pickedMz,
      rtFrom,
      rtTo,
      ppm,
      mzTol,
      files,
      outcomes,
    ],
  );
}
