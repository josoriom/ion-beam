import { memo } from "react";
import { useAppState } from "../context/context";
import { image_key } from "../data/image_targets";
import { select_view } from "../context/reducer";
import { IonImageCanvas } from "./IonImageCanvas";
import { ComputeProgress } from "./ComputeProgress";

export const ImageView = memo(function ImageView() {
  const state = useAppState();
  const { selected_mz } = state;
  const view = select_view(state);
  const file_name = view.active_sample;

  if (!file_name || !view.url) {
    return (
      <div className="image-view">
        <p className="image-empty">Pick a sample file on the left.</p>
      </div>
    );
  }

  if (selected_mz === null) {
    return (
      <div className="image-view">
        <p className="image-empty">Pick a target on the right to view its ion image.</p>
      </div>
    );
  }

  const target = state.image_targets.find((item) => item.mz === selected_mz);
  const outcome = state.images[image_key(view.url, selected_mz)];
  const image = outcome?.status === "ok" ? outcome.image : undefined;
  const has_pixels = image !== undefined && image.width > 0 && image.height > 0;

  return (
    <div className="image-view">
      <article className="image-stage">
        <header className="image-stage-head">
          <span className="image-stage-title">{target?.id ?? `mz_${selected_mz}`}</span>
          <span className="image-stage-mz">m/z {selected_mz}</span>
        </header>

        <div className="image-stage-body">
          {outcome?.status === "error" && (
            <p className="image-note image-error">{outcome.message}</p>
          )}
          {has_pixels && <IonImageCanvas image={image} />}
          {outcome?.status === "ok" && !has_pixels && (
            <p className="image-note">No pixels for this m/z</p>
          )}
          {!outcome && <ComputeProgress key={`${file_name}|${selected_mz}`} />}
        </div>

        <footer className="image-stage-foot">
          {file_name}
          {has_pixels &&
            ` · ${image.width}×${image.height} · clip ${image.low.toFixed(1)}–${image.high.toFixed(1)}`}
        </footer>
      </article>
    </div>
  );
});
