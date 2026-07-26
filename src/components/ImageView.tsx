import { memo } from "react";
import { useAppState } from "../context/context";
import { imageKey } from "../data/imageTargets";
import { selectView } from "../context/reducer";
import { IonImageCanvas } from "./IonImageCanvas";
import { ComputeProgress } from "./ComputeProgress";

export const ImageView = memo(function ImageView() {
  const state = useAppState();
  const { selectedMz } = state;
  const view = selectView(state);
  const fileName = view.activeSample;

  if (!fileName || !view.url) {
    return (
      <div className="image-view">
        <p className="image-empty">Pick a sample file on the left.</p>
      </div>
    );
  }

  if (selectedMz === null) {
    return (
      <div className="image-view">
        <p className="image-empty">Pick a target on the right to view its ion image.</p>
      </div>
    );
  }

  const target = state.imageTargets.find((item) => item.mz === selectedMz);
  const outcome = state.images[imageKey(view.url, selectedMz)];
  const image = outcome?.status === "ok" ? outcome.image : undefined;
  const hasPixels = image !== undefined && image.width > 0 && image.height > 0;

  return (
    <div className="image-view">
      <article className="image-stage">
        <header className="image-stage-head">
          <span className="image-stage-title">{target?.id ?? `mz_${selectedMz}`}</span>
          <span className="image-stage-mz">m/z {selectedMz}</span>
        </header>

        <div className="image-stage-body">
          {outcome?.status === "error" && (
            <p className="image-note image-error">{outcome.message}</p>
          )}
          {hasPixels && <IonImageCanvas image={image} />}
          {outcome?.status === "ok" && !hasPixels && (
            <p className="image-note">No pixels for this m/z</p>
          )}
          {(!outcome || outcome.status === "pending") && (
            <ComputeProgress key={`${fileName}|${selectedMz}`} />
          )}
        </div>

        <footer className="image-stage-foot">
          {fileName}
          {hasPixels &&
            ` · ${image.width}×${image.height} · clip ${image.low.toFixed(1)}–${image.high.toFixed(1)}`}
        </footer>
      </article>
    </div>
  );
});
