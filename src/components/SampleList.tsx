import { memo, useMemo, useState } from "react";
import { useAppDispatch } from "../context/context";

interface SampleListProps {
  samples: string[];
  selectedSample: string | null;
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

export const SampleList = memo(function SampleList({
  samples,
  selectedSample,
}: SampleListProps) {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState("");
  const [matchCase, setMatchCase] = useState(false);

  const found = useMemo(
    () => filterNames(samples, query, matchCase),
    [samples, query, matchCase],
  );

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
            const isActive = name === selectedSample;
            return (
              <li key={name}>
                <button
                  type="button"
                  className={isActive ? "sample-item active" : "sample-item"}
                  title={name}
                  onClick={() => dispatch({ type: "pickSample", name })}
                >
                  {name}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
