import { memo } from "react";
import { useAppDispatch } from "../context/context";

interface PathInputProps {
  path: string;
  saved: string[];
}

export const PathInput = memo(function PathInput({ path, saved }: PathInputProps) {
  const dispatch = useAppDispatch();
  const clean = path.trim();
  const known = saved.includes(clean);

  return (
    <div className="path-input">
      <div className="path-input-row">
        <span className="path-input-label">Data folder URL</span>
        <input
          type="text"
          value={path}
          spellCheck={false}
          onChange={(event) => dispatch({ type: "setPath", path: event.target.value })}
        />
        <button
          type="button"
          className="path-button"
          title="Save this URL"
          disabled={clean.length === 0 || known}
          onClick={() => dispatch({ type: "addPath", path: clean })}
        >
          +
        </button>
        <button
          type="button"
          className="path-button"
          title="Remove this URL"
          disabled={!known}
          onClick={() => dispatch({ type: "removePath", path: clean })}
        >
          −
        </button>
        <button
          type="button"
          className="reload-button"
          title="Reload files"
          onClick={() => dispatch({ type: "reloadSamples" })}
        >
          ⟳
        </button>
      </div>

      {saved.length > 0 && (
        <div className="path-saved">
          <span className="path-saved-label">Saved</span>
          <select
            className="path-select"
            value={known ? clean : ""}
            onChange={(event) => dispatch({ type: "setPath", path: event.target.value })}
          >
            {!known && <option value="">Not saved yet</option>}
            {saved.map((url) => (
              <option key={url} value={url}>
                {url}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
});
