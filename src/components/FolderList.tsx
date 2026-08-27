import { memo } from "react";
import { useAppDispatch } from "../context/context";
import type { Entry } from "../ms/listSamples";

interface FolderListProps {
  folders: Entry[];
  canGoUp: boolean;
}

export const FolderList = memo(function FolderList({
  folders,
  canGoUp,
}: FolderListProps) {
  const dispatch = useAppDispatch();
  if (!canGoUp && folders.length === 0) return null;

  return (
    <div className="folder-list">
      {canGoUp && (
        <button
          type="button"
          className="folder-item back"
          title="Go back to the folder above"
          onClick={() => dispatch({ type: "goUp" })}
        >
          <span className="folder-mark">↑</span>
          <span className="folder-name">Back</span>
        </button>
      )}
      {folders.map((folder) => (
        <button
          key={folder.url}
          type="button"
          className="folder-item"
          title={`Open ${folder.name}`}
          onClick={() => dispatch({ type: "openFolder", path: folder.url })}
        >
          <span className="folder-mark">›</span>
          <span className="folder-name">{folder.name}</span>
        </button>
      ))}
    </div>
  );
});
