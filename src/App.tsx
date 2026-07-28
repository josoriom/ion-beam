import { useMemo } from "react";
import { compounds } from "./data/compounds";
import { getPeaks } from "./ms/peaks";
import { getBaseline } from "./ms/baseline";
import { PathInput } from "./components/PathInput";
import { SampleList } from "./components/SampleList";
import { CompoundList } from "./components/CompoundList";
import { ConfigPanel } from "./components/ConfigPanel";
import { EicPlot } from "./components/EicPlot";
import { PeakTable } from "./components/PeakTable";
import { ResizeHandle } from "./components/ResizeHandle";
import { InspectPanel } from "./components/InspectPanel";
import { useAppDispatch, useAppState } from "./context/context";
import { activePath, peakOptions, selectView } from "./context/reducer";
import "./App.css";

function App() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const view = selectView(state);

  const baseline = useMemo(
    () => (state.displayBaseline && view.eicReady ? getBaseline(view.points) : null),
    [state.displayBaseline, view.eicReady, view.points],
  );

  const annotateRt = state.annotate && state.targetRt !== null ? state.targetRt : null;

  function runPeakPicking() {
    if (!view.eicReady) return;
    const list = getPeaks(view.points, peakOptions(state));
    dispatch({ type: "peaksFound", key: `${view.url}|${view.mz}`, list });
  }

  return (
    <div className="app">
      <aside
        className={state.samplesOpen ? "sidebar left" : "sidebar left closed"}
        style={state.samplesOpen ? { width: state.samplesWidth } : undefined}
      >
        <div className="sidebar-head">
          {state.samplesOpen && <span className="sidebar-label">Samples</span>}
          {state.samplesOpen && (
            <span className="sidebar-count">{view.samples.length}</span>
          )}
          <button
            type="button"
            className="sidebar-toggle"
            title={state.samplesOpen ? "Hide samples" : "Show samples"}
            onClick={() => dispatch({ type: "toggleSamples" })}
          >
            {state.samplesOpen ? "‹" : "›"}
          </button>
        </div>
        {state.samplesOpen && (
          <div className="sidebar-body">
            {view.samplesFailed && (
              <p className="banner banner-error">Could not list samples: {view.samplesMessage}</p>
            )}
            {view.samplesLoading && <p className="banner">Loading samples…</p>}
            {!view.samplesLoading && !view.samplesFailed && (
              <SampleList samples={view.samples} selectedSample={view.activeSample} />
            )}
          </div>
        )}
      </aside>

      {state.samplesOpen && (
        <ResizeHandle
          onResize={(cursorX) => dispatch({ type: "setSamplesWidth", value: cursorX })}
        />
      )}

      <main className="content">
        <header className="content-head">
          <div className="content-head-text">
            <h1 className="content-title">Extracted ion chromatogram</h1>
            <p className="content-sub" title={view.activeSample ?? ""}>
              {view.activeSample
                ? `${view.activeSample} · m/z ${state.mzText}`
                : "Pick a sample"}
            </p>
          </div>
          {!state.autoPeakPicking && (
            <button
              type="button"
              className="run-button"
              disabled={!view.eicReady}
              onClick={runPeakPicking}
            >
              ▶ Run peak picking
            </button>
          )}
        </header>

        <div className="content-path">
          <PathInput path={activePath(state)} saved={state.savedPaths} />
        </div>

        <div className="content-body">
          {view.activeSample && (
            <section className="plot-card">
              {view.mz === null && (
                <p className="banner">Pick a metabolite or enter an m/z to load blocks</p>
              )}
              {view.fileFailed && (
                <p className="banner banner-error">Could not read the file: {view.fileMessage}</p>
              )}
              {view.eicFailed && (
                <p className="banner banner-error">
                  Could not build the chromatogram: {view.eicMessage}
                </p>
              )}
              {view.eicLoading && <p className="banner">Building the chromatogram…</p>}
              {view.eicReady && (
                <EicPlot
                  points={view.points}
                  peaks={view.peaks}
                  baseline={baseline}
                  annotateRt={annotateRt}
                />
              )}
            </section>
          )}

          {view.peaksReady && <PeakTable peaks={view.peaks} />}
        </div>

      </main>

      {state.metabolitesOpen && (
        <ResizeHandle
          onResize={(cursorX) =>
            dispatch({ type: "setMetabolitesWidth", value: window.innerWidth - cursorX })
          }
        />
      )}

      <aside
        className={state.metabolitesOpen ? "sidebar right" : "sidebar right closed"}
        style={state.metabolitesOpen ? { width: state.metabolitesWidth } : undefined}
      >
        <div className="sidebar-head">
          <button
            type="button"
            className="sidebar-toggle"
            title={state.metabolitesOpen ? "Hide metabolites" : "Show metabolites"}
            onClick={() => dispatch({ type: "toggleMetabolites" })}
          >
            {state.metabolitesOpen ? "›" : "‹"}
          </button>
          {state.metabolitesOpen && (
            <span className="sidebar-label">Metabolites</span>
          )}
          {state.metabolitesOpen && (
            <span className="sidebar-count">{compounds.length}</span>
          )}
        </div>
        {state.metabolitesOpen && (
          <div className="sidebar-body">
            <ConfigPanel />
            <CompoundList compounds={compounds} selectedLabel={state.pickedLabel} />
          </div>
        )}
      </aside>

      <button
        type="button"
        className={state.inspectOpen ? "inspect-fab active" : "inspect-fab"}
        title="Show downloaded bytes"
        onClick={() => dispatch({ type: "toggleInspect" })}
      >
        Inspect
      </button>
      {state.inspectOpen && <InspectPanel />}
    </div>
  );
}

export default App;
