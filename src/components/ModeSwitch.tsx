import { memo } from "react";
import { useAppDispatch, useAppState } from "../context/context";
import type { Mode } from "../context/reducer";

const modes: { value: Mode; label: string }[] = [
  { value: "eic", label: "Chromatogram" },
  { value: "imaging", label: "Imaging" },
];

export const ModeSwitch = memo(function ModeSwitch() {
  const state = useAppState();
  const dispatch = useAppDispatch();

  return (
    <div className="mode-switch">
      {modes.map((item) => (
        <button
          key={item.value}
          type="button"
          className={state.mode === item.value ? "mode-button active" : "mode-button"}
          onClick={() => dispatch({ type: "set_mode", mode: item.value })}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});
