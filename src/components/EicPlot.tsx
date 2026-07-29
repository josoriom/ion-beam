import { memo, useEffect, useMemo, useRef, useState } from "react";
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
import type { Trace } from "../context/reducer";

const tallestPlot = 460;
const shortestPlot = 150;
const minWidth = 280;
const shareOfWidth = 0.55;
const shareOfScreen = 0.52;

function readPlotHeight(width: number, screenHeight: number): number {
  const fromWidth = Math.round(width * shareOfWidth);
  const fromScreen = Math.round(screenHeight * shareOfScreen);
  const wanted = Math.min(fromWidth, fromScreen);
  if (wanted > tallestPlot) return tallestPlot;
  if (wanted < shortestPlot) return shortestPlot;
  return wanted;
}

function useScreenHeight(): number {
  const [height, setHeight] = useState(() => globalThis.innerHeight || 800);

  useEffect(() => {
    const update = () => setHeight(globalThis.innerHeight);
    globalThis.addEventListener("resize", update);
    return () => globalThis.removeEventListener("resize", update);
  }, []);

  return height;
}
const traceWidth = 1.5;
const baselineStyle = { stroke: "#ef4444", strokeWidth: 2, strokeDasharray: "6 4" };
const peakFill = "rgba(51, 65, 85, 0.16)";
const peakStroke = "#334155";
const annotateStroke = "#2563eb";

interface LineStyle {
  stroke: string;
  strokeWidth: number;
}

function readLineStyles(traces: Trace[]): Record<string, LineStyle> {
  const styles: Record<string, LineStyle> = {};
  for (const trace of traces) {
    styles[trace.url] = { stroke: trace.color, strokeWidth: traceWidth };
  }
  return styles;
}

interface ChartProps {
  traces: Trace[];
  peaks: Peak[];
  baseline: Point[] | null;
  annotateRt: number | null;
  width: number;
  height: number;
}

function Chart({ traces, peaks, baseline, annotateRt, width, height }: ChartProps) {
  useAxisWheelZoom();
  const zoom = useAxisZoom();
  const lineStyles = useMemo(() => readLineStyles(traces), [traces]);

  return (
    <Plot width={width} height={height}>
      {traces.map((trace) => (
        <LineSeries
          key={trace.url}
          id={trace.url}
          label={trace.sample}
          data={trace.points}
          xAxis="x"
          yAxis="y"
          lineStyle={lineStyles[trace.url]}
        />
      ))}
      {baseline && (
        <LineSeries
          id="baseline"
          data={baseline}
          xAxis="x"
          yAxis="y"
          lineStyle={baselineStyle}
        />
      )}
      <Axis id="x" position="bottom" label="Time (min)" displayPrimaryGridLines={false} />
      <Axis id="y" position="left" label="Intensity" displayPrimaryGridLines />
      <Annotations>
        {annotateRt !== null && (
          <Annotation.Line
            x1={annotateRt}
            x2={annotateRt}
            y1={0}
            y2="100%"
            color={annotateStroke}
            strokeDasharray="5 4"
          />
        )}
        {peaks.flatMap((peak, index) => [
          <Annotation.Rectangle
            key={`box-${index}`}
            x1={peak.from}
            x2={peak.to}
            y1={0}
            y2={peak.intensity}
            color={peakFill}
          />,
          <Annotation.Line
            key={`apex-${index}`}
            x1={peak.rt}
            x2={peak.rt}
            y1={0}
            y2={peak.intensity}
            color={peakStroke}
            strokeDasharray="3 3"
          />,
        ])}
        {zoom.annotations}
      </Annotations>
    </Plot>
  );
}

interface EicPlotProps {
  traces: Trace[];
  peaks: Peak[];
  baseline: Point[] | null;
  annotateRt: number | null;
}

export const EicPlot = memo(function EicPlot({
  traces,
  peaks,
  baseline,
  annotateRt,
}: EicPlotProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(800);
  const screenHeight = useScreenHeight();

  useEffect(() => {
    const node = wrap.current;
    if (!node) return undefined;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured) setWidth(Math.max(minWidth, Math.floor(measured)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const height = readPlotHeight(width, screenHeight);
  const hasPoints = traces.some((trace) => trace.points.length > 0);
  return (
    <div ref={wrap} className="plot-wrap">
      <PlotController>
        {hasPoints ? (
          <Chart
            traces={traces}
            peaks={peaks}
            baseline={baseline}
            annotateRt={annotateRt}
            width={width}
            height={height}
          />
        ) : (
          <div className="plot-empty" style={{ height }}>
            No signal in this range
          </div>
        )}
      </PlotController>
    </div>
  );
});
