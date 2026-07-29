import { memo, useMemo, useState, type MouseEvent } from "react";
import { useAppDispatch } from "../context/context";
import { colorsBeforeRepeat } from "../context/reducer";
import { TraceSwatch } from "./TraceSwatch";

interface SampleListProps {
  samples: string[];
  mainSample: string | null;
  sampleColors: Record<string, string>;
}

function filterNames(names: string[], query: string, matchCase: boolean): string[] {
  const terms = query
    .split(";")
    .map((term) => term.trim())
    .filter((term) => term.length > 0);
  if (terms.length === 0) return names;
  const needles = matchCase ? terms : terms.map((term) => term.toLowerCase());
  return names.filter((name) => {
    const text = matchCase ? name : name.toLowerCase();
    return needles.every((needle) => text.includes(needle));
  });
}

function wantsToAdd(event: MouseEvent): boolean {
  return event.shiftKey || event.metaKey || event.ctrlKey;
}

function readAddHint(name: string, shown: boolean, colorsRepeat: boolean): string {
  if (shown) return `Remove ${name} from the chart`;
  if (colorsRepeat) return `Add ${name}, reusing a colour already on the chart`;
  return `Add ${name} to the chart`;
}

export const SampleList = memo(function SampleList({
  samples,
  mainSample,
  sampleColors,
}: SampleListProps) {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  const found = useMemo(
    () => filterNames(samples, query, matchCase),
    [samples, query, matchCase],
  );

  const colorsRepeat = Object.keys(sampleColors).length >= colorsBeforeRepeat;

  return (
    <div className="sample-panel">
      <div className="sample-filter">
        <input
          type="text"
          className="sample-filter-input"
          placeholder="Filter names (use ; for and)"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className={matchCase ? "case-button active" : "case-button"}
          title={matchCase ? "Match case is on" : "Match case is off"}
          aria-pressed={matchCase}
          onClick={() => setMatchCase((on) => !on)}
        >
          Aa
        </button>
      </div>

      {found.length === 0 ? (
        <p className="sample-empty">{query ? "No matches" : "No samples found"}</p>
      ) : (
        <ul className="sample-list">
          {found.map((name) => {
            const isMain = name === mainSample;
            const color = sampleColors[name];
            const shown = color !== undefined;
            return (
              <li key={name} className="sample-row">
                <button
                  type="button"
                  className={
                    isMain
                      ? "sample-item main"
                      : shown
                        ? "sample-item added"
                        : "sample-item"
                  }
                  title={`Show only ${name}`}
                  aria-pressed={shown}
                  onClick={(event) => {
                    if (wantsToAdd(event) && !isMain) {
                      dispatch({ type: "toggleSample", name });
                      return;
                    }
                    dispatch({ type: "pickSample", name });
                  }}
                >
                  <span className="sample-pen">
                    {color && <TraceSwatch color={color} />}
                  </span>
                  <span className="sample-name">{name}</span>
                </button>
                {!isMain && (
                  <button
                    type="button"
                    className={shown ? "sample-add on" : "sample-add"}
                    title={readAddHint(name, shown, colorsRepeat)}
                    aria-label={readAddHint(name, shown, colorsRepeat)}
                    aria-pressed={shown}
                    onClick={() => dispatch({ type: "toggleSample", name })}
                  >
                    {shown ? "−" : "+"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
