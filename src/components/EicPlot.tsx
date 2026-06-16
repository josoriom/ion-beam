import { memo, useEffect, useRef, useState } from "react";
import {
  Annotation,
  Annotations,
  Axis,
  LineSeries,
  Plot,
  PlotController,
  useAxisWheelZoom,
  useAxisZoom,
} from "react-plot";
import type { Point } from "../ms/eic";
import type { Peak } from "../ms/peaks";

const plot_height = 460;
const min_width = 320;
const line_style = { stroke: "#334155", strokeWidth: 1.5 };
const baseline_style = { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "6 4" };
const peak_fill = "rgba(51, 65, 85, 0.16)";
const peak_stroke = "#334155";

interface ChartProps {
  points: Point[];
  peaks: Peak[];
  baseline: Point[] | null;
  width: number;
}

function Chart({ points, peaks, baseline, width }: ChartProps) {
  useAxisWheelZoom();
  const zoom = useAxisZoom();

  return (
    <Plot width={width} height={plot_height}>
      <LineSeries data={points} xAxis="x" yAxis="y" lineStyle={line_style} />
      {baseline && <LineSeries data={baseline} xAxis="x" yAxis="y" lineStyle={baseline_style} />}
      <Axis id="x" position="bottom" label="Time (min)" displayPrimaryGridLines={false} />
      <Axis id="y" position="left" label="Intensity" displayPrimaryGridLines />
      <Annotations>
        {peaks.flatMap((peak, index) => [
          <Annotation.Rectangle
            key={`box-${index}`}
            x1={peak.from}
            x2={peak.to}
            y1={0}
            y2={peak.intensity}
            color={peak_fill}
          />,
          <Annotation.Line
            key={`apex-${index}`}
            x1={peak.rt}
            x2={peak.rt}
            y1={0}
            y2={peak.intensity}
            color={peak_stroke}
            strokeDasharray="3 3"
          />,
        ])}
        {zoom.annotations}
      </Annotations>
    </Plot>
  );
}

interface EicPlotProps {
  points: Point[];
  peaks: Peak[];
  baseline: Point[] | null;
}

export const EicPlot = memo(function EicPlot({ points, peaks, baseline }: EicPlotProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, set_width] = useState(800);

  useEffect(() => {
    const node = wrap.current;
    if (!node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) set_width(Math.max(min_width, Math.floor(measured)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const has_points = points.length > 0;
  return (
    <div ref={wrap} className="plot-wrap">
      {has_points ? (
        <PlotController>
          <Chart points={points} peaks={peaks} baseline={baseline} width={width} />
        </PlotController>
      ) : (
        <div className="plot-empty">No signal in this range</div>
      )}
    </div>
  );
});
