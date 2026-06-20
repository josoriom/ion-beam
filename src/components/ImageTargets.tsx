import { memo, useState } from "react";
import { useAppDispatch, useAppState } from "../context/context";
import { image_key } from "../data/image_targets";
import { select_view } from "../context/reducer";

export const ImageTargets = memo(function ImageTargets() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const url = select_view(state).url;
  const [mz_text, set_mz_text] = useState("");

  function add_target() {
    const mz = Number(mz_text);
    if (!Number.isFinite(mz) || mz <= 0) return;
    dispatch({ type: "add_image_target", mz });
    set_mz_text("");
  }

  return (
    <div className="config-panel">
      <div className="config-title">Add m/z target</div>
      <div className="config-explore">
        <input
          type="number"
          step="0.0001"
          placeholder="m/z"
          value={mz_text}
          onChange={(event) => set_mz_text(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && add_target()}
        />
        <button type="button" className="run-button" onClick={add_target}>
          Add
        </button>
      </div>

      <div className="config-title">Targets</div>
      <ul className="image-target-list">
        {state.image_targets.map((target) => {
          const is_active = target.mz === state.selected_mz;
          const is_ready = url
            ? state.images[image_key(url, target.mz)]?.status === "ok"
            : false;
          return (
            <li key={target.id} className="image-target-row">
              <button
                type="button"
                className={is_active ? "image-target-pick active" : "image-target-pick"}
                onClick={() => dispatch({ type: "select_image_target", mz: target.mz })}
              >
                <span className="image-target-mz">m/z {target.mz}</span>
                {is_ready && <span className="image-target-ready" title="Already computed" />}
              </button>
              <button
                type="button"
                className="image-target-remove"
                title="Remove target"
                onClick={() => dispatch({ type: "remove_image_target", mz: target.mz })}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
});
