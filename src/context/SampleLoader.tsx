import { memo, useEffect, useRef, useState, type Dispatch } from "react";
import { closeFile, openFile, readEic } from "../ms/ionClient";
import { endQuery, startQuery } from "../ms/queryTimer";
import { eicKey, readError, type Action } from "./reducer";

interface SampleLoaderProps {
  url: string;
  mz: number | null;
  rtFrom: number;
  rtTo: number;
  ppm: number;
  mzTol: number;
  dispatch: Dispatch<Action>;
}

export const SampleLoader = memo(function SampleLoader({
  url,
  mz,
  rtFrom,
  rtTo,
  ppm,
  mzTol,
  dispatch,
}: SampleLoaderProps) {
  const [ready, setReady] = useState(false);
  const running = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    startQuery();
    openFile(url)
      .finally(endQuery)
      .then(() => {
        if (!live) return;
        setReady(true);
        dispatch({ type: "fileOpened", url });
      })
      .catch((error: unknown) => {
        if (live) {
          dispatch({ type: "fileFailed", url, message: readError(error) });
        }
      });
    return () => {
      live = false;
      setReady(false);
      closeFile(url);
      dispatch({ type: "fileClosed", url });
    };
  }, [url, dispatch]);

  useEffect(() => {
    if (!ready || mz === null) return;
    const key = eicKey(url, mz, { rtFrom, rtTo, ppm, mzTol });
    const started = running.current;
    if (started.has(key)) return;
    started.add(key);
    startQuery();
    readEic(url, mz, { from: rtFrom, to: rtTo }, ppm, mzTol)
      .finally(endQuery)
      .then((points) => {
        dispatch({ type: "eicReady", url, key, points });
      })
      .catch((error: unknown) => {
        dispatch({ type: "eicFailed", url, key, message: readError(error) });
      })
      .finally(() => {
        started.delete(key);
      });
  }, [ready, mz, url, rtFrom, rtTo, ppm, mzTol, dispatch]);

  return null;
});
