import { memo } from "react";
import { useAppDispatch } from "../context/context";

interface PathInputProps {
  path: string;
}

export const PathInput = memo(function PathInput({ path }: PathInputProps) {
  const dispatch = useAppDispatch();
  return (
    <div className="path-input">
      <span className="path-input-label">Data folder URL</span>
      <div className="path-input-row">
        <input
          type="text"
          value={path}
          spellCheck={false}
          onChange={(event) => dispatch({ type: "set_path", path: event.target.value })}
        />
        <button
          type="button"
          className="reload-button"
          title="Reload files"
          onClick={() => dispatch({ type: "reload_samples" })}
        >
          ⟳
        </button>
      </div>
    </div>
  );
});
