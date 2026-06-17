import { memo, useState } from "react";
import { useAppDispatch, useAppState } from "../context/context";

export const ConfigPanel = memo(function ConfigPanel() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const [explore, set_explore] = useState(state.mz_text);

  return (
    <div className="config-panel">
      <div className="config-title">Configuration</div>

      <div className="config-row">
        <label className="config-field">
          <span className="config-label">Intensity</span>
          <input
            type="number"
            min={0}
            value={state.min_intensity}
            onChange={(event) =>
              dispatch({ type: "set_min_intensity", value: Number(event.target.value) })
            }
          />
        </label>
        <label className="config-field">
          <span className="config-label">Integral</span>
          <input
            type="number"
            min={0}
            value={state.min_integral}
            onChange={(event) =>
              dispatch({ type: "set_min_integral", value: Number(event.target.value) })
            }
          />
        </label>
        <label className="config-field">
          <span className="config-label">Width</span>
          <input
            type="number"
            min={0}
            value={state.min_width}
            onChange={(event) =>
              dispatch({ type: "set_min_width", value: Number(event.target.value) })
            }
          />
        </label>
        <label className="config-field">
          <span className="config-label">SNR</span>
          <input
            type="number"
            min={0}
            value={state.min_snr}
            onChange={(event) =>
              dispatch({ type: "set_min_snr", value: Number(event.target.value) })
            }
          />
        </label>
      </div>

      <div className="config-checks">
        <label className="config-check">
          <input
            type="checkbox"
            checked={state.auto_noise}
            onChange={() => dispatch({ type: "toggle_auto_noise" })}
          />
          <span>Auto noise</span>
        </label>
        <label className="config-check">
          <input
            type="checkbox"
            checked={state.auto_baseline}
            onChange={() => dispatch({ type: "toggle_auto_baseline" })}
          />
          <span>Auto baseline</span>
        </label>
        <label className="config-check">
          <input
            type="checkbox"
            checked={state.allow_overlap}
            onChange={() => dispatch({ type: "toggle_allow_overlap" })}
          />
          <span>Allow overlap</span>
        </label>
        <label className="config-check">
          <input
            type="checkbox"
            checked={state.annotate}
            onChange={() => dispatch({ type: "toggle_annotate" })}
          />
          <span>Annotate</span>
        </label>
        <label className="config-check">
          <input
            type="checkbox"
            checked={state.display_baseline}
            onChange={() => dispatch({ type: "toggle_display_baseline" })}
          />
          <span>Display baseline</span>
        </label>
        <label className="config-check">
          <input
            type="checkbox"
            checked={state.auto_peak_picking}
            onChange={() => dispatch({ type: "toggle_auto_peak_picking" })}
          />
          <span>Auto peak picking</span>
        </label>
      </div>

      <div className="config-title">EIC extraction</div>

      <div className="config-row">
        <label className="config-field">
          <span className="config-label">RT from</span>
          <input
            type="number"
            value={state.rt_from}
            onChange={(event) =>
              dispatch({ type: "set_rt_from", value: Number(event.target.value) })
            }
          />
        </label>
        <label className="config-field">
          <span className="config-label">RT to</span>
          <input
            type="number"
            value={state.rt_to}
            onChange={(event) => dispatch({ type: "set_rt_to", value: Number(event.target.value) })}
          />
        </label>
        <label className="config-field">
          <span className="config-label">ppm</span>
          <input
            type="number"
            value={state.ppm}
            onChange={(event) => dispatch({ type: "set_ppm", value: Number(event.target.value) })}
          />
        </label>
        <label className="config-field">
          <span className="config-label">Da</span>
          <input
            type="number"
            step="0.001"
            value={state.mz_tol}
            onChange={(event) =>
              dispatch({ type: "set_mz_tol", value: Number(event.target.value) })
            }
          />
        </label>
      </div>

      <div className="config-title">Explore m/z</div>

      <div className="config-explore">
        <input
          type="number"
          step="0.0001"
          value={explore}
          onChange={(event) => set_explore(event.target.value)}
        />
        <button
          type="button"
          className="run-button"
          onClick={() => dispatch({ type: "change_mz", value: explore })}
        >
          Run
        </button>
      </div>
    </div>
  );
});
