import { memo } from "react";

interface TraceSwatchProps {
  color: string;
}

export const TraceSwatch = memo(function TraceSwatch({ color }: TraceSwatchProps) {
  return <span className="trace-swatch" style={{ background: color }} />;
});
