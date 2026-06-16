import { memo } from "react";
import { useAppDispatch } from "../context/context";

interface PeakConfigProps {
  open: boolean;
  min_intensity: number;
  min_width: number;
  min_snr: number;
  auto_noise: boolean;
  auto_baseline: boolean;
  display_baseline: boolean;
}

export const PeakConfig = memo(function PeakConfig({
  open,
  min_intensity,
  min_width,
  min_snr,
  auto_noise,
  auto_baseline,
  display_baseline,
}: PeakConfigProps) {
  const dispatch = useAppDispatch();
  return (
    <div className="config">
      <button
        type="button"
        className={open ? "config-toggle open" : "config-toggle"}
        title="Peak picking settings"
        onClick={() => dispatch({ type: "toggle_config" })}
      >
        ⚙ Settings
      </button>
      <div className={open ? "config-card open" : "config-card"}>
        <div className="config-row">
          <label className="config-field">
            <span className="config-label">Intensity</span>
            <input
              type="number"
              min={0}
              value={min_intensity}
              onChange={(event) =>
                dispatch({ type: "set_min_intensity", value: Number(event.target.value) })
              }
            />
          </label>
          <label className="config-field">
            <span className="config-label">Width</span>
            <input
              type="number"
              min={0}
              value={min_width}
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
              value={min_snr}
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
              checked={auto_noise}
              onChange={() => dispatch({ type: "toggle_auto_noise" })}
            />
            <span>Auto noise</span>
          </label>
          <label className="config-check">
            <input
              type="checkbox"
              checked={auto_baseline}
              onChange={() => dispatch({ type: "toggle_auto_baseline" })}
            />
            <span>Auto baseline</span>
          </label>
          <label className="config-check">
            <input
              type="checkbox"
              checked={display_baseline}
              onChange={() => dispatch({ type: "toggle_display_baseline" })}
            />
            <span>Display baseline</span>
          </label>
        </div>
      </div>
    </div>
  );
});
