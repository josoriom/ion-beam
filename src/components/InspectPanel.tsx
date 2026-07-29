import { Fragment, memo, useEffect, useState, useSyncExternalStore } from "react";
import {
  getTraffic,
  memoryBudget,
  subscribe,
  type BlockCount,
  type RegionSpec,
  type RegionTraffic,
} from "../ms/traffic";
import { getQuery, subscribeQuery } from "../ms/queryTimer";
import { formatBytes, formatCount, formatPercent, formatSeconds } from "../utilities/format";
import { useDrag } from "../utilities/useDrag";
import { useAppDispatch } from "../context/context";

const groups = ["Header", "Index", "Metadata", "Blocks"];

function nameSamples(samples: string[]): string {
  if (samples.length === 0) return "Pick a sample";
  if (samples.length === 1) return samples[0];
  return `${samples.length} samples`;
}

function countSamples(count: number): string {
  return count === 1 ? "1 sample" : `${count} samples`;
}

function readShared(
  value: number,
  mixed: boolean,
  format: (value: number) => string,
): string {
  if (mixed) return "mixed";
  return value ? format(value) : "—";
}

export const InspectPanel = memo(function InspectPanel() {
  const dispatch = useAppDispatch();
  const traffic = useSyncExternalStore(subscribe, getTraffic);
  const { offset, onGrab, panelRef } = useDrag();
  const overBudget = traffic.downloaded > memoryBudget;

  function close() {
    dispatch({ type: "toggleInspect" });
  }

  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatch({ type: "toggleInspect" });
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [dispatch]);

  return (
    <div
      className="inspect-panel"
      ref={panelRef}
      role="dialog"
      aria-label="Downloaded bytes"
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
      <header className="inspect-head" onPointerDown={onGrab}>
        <div className="inspect-head-text">
          <h2 className="inspect-title">Downloaded bytes</h2>
          <p className="inspect-sample" title={traffic.samples.join(", ")}>
            {nameSamples(traffic.samples)}
          </p>
        </div>
        <button type="button" className="inspect-close" title="Close" onClick={close}>
          ×
        </button>
      </header>

      <div className="inspect-summary">
        <Total
          label="Downloaded"
          value={formatBytes(traffic.downloaded)}
          hint="Bytes pulled over the network, as stored in the file"
        />
        <Total
          label="of"
          value={formatBytes(traffic.fileSize)}
          hint="Total file size on disk, compressed"
        />
        <Total
          label="Read"
          value={formatPercent(traffic.downloaded, traffic.fileSize)}
          hint="Share of the stored file already downloaded"
        />
        <Total
          label="Requests"
          value={formatCount(traffic.requests)}
          hint="Range requests served across every sample on the chart"
        />
        <Total
          label="m/z window"
          value={readShared(traffic.mzWindow, traffic.mzWindowMixed, formatCount)}
          hint="Width of one m/z window, in m/z units"
        />
        <Total
          label="Block raw"
          value={readShared(traffic.blockSize, traffic.blockSizeMixed, formatBytes)}
          hint="Target size of one block before compression, so it does not match the stored sizes below"
        />
      </div>

      <div className="inspect-body">
        {traffic.samples.length > 0 && (
          <p
            className={overBudget ? "inspect-note warn" : "inspect-note"}
            title="Compressed bytes kept for the open samples. Removing a sample frees its share. What quantion unpacks inside WebAssembly is not included and cannot be read from here."
          >
            Holding {formatBytes(traffic.downloaded)} of compressed bytes · budget{" "}
            {formatBytes(memoryBudget)}
          </p>
        )}
        {traffic.regions.length === 0 && traffic.samples.length > 0 && (
          <p className="inspect-empty">Waiting for the file header…</p>
        )}
        {traffic.regions.length > 0 && (
          <p className="inspect-note">Sizes below are stored bytes, compressed</p>
        )}
        {traffic.regions.length > 0 && traffic.pending > 0 && (
          <p className="inspect-note">
            {countSamples(traffic.pending)} not counted below yet, still reading the header
          </p>
        )}
        {groups.map((group) => (
          <Group
            key={group}
            name={group}
            regions={traffic.regions}
            loaded={traffic.samples.length}
          />
        ))}
        {traffic.regions.length > 0 && traffic.unmapped > 0 && (
          <section className="inspect-group">
            <h3 className="inspect-group-title">
              <span>Other</span>
              <span className="inspect-group-total">{formatBytes(traffic.unmapped)}</span>
            </h3>
            <div className="inspect-row">
              <span className="inspect-row-dot" />
              <span className="inspect-row-code" />
              <span className="inspect-row-name">Trailer and gaps</span>
              <div className="inspect-row-bar" />
              <span className="inspect-row-bytes">{formatBytes(traffic.unmapped)}</span>
              <span className="inspect-row-size" />
            </div>
          </section>
        )}
      </div>

      <QueryTime />
    </div>
  );
});

function QueryTime() {
  const query = useSyncExternalStore(subscribeQuery, getQuery);
  const [tick, setTick] = useState(() => performance.now());
  const busy = query.startedAt !== null && query.endedAt === null;

  useEffect(() => {
    if (!busy) return undefined;
    const id = window.setInterval(() => setTick(performance.now()), 50);
    return () => window.clearInterval(id);
  }, [busy]);

  const elapsed =
    query.startedAt === null ? 0 : Math.max(0, (query.endedAt ?? tick) - query.startedAt);

  return (
    <footer className="inspect-foot" title="Time from the click until every request and computation finished">
      <span className="inspect-foot-label">Query time</span>
      <span className={busy ? "inspect-foot-value busy" : "inspect-foot-value"}>
        {formatSeconds(elapsed)}
      </span>
    </footer>
  );
}

function Total({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="inspect-total" title={hint}>
      <span className="inspect-total-label">{label}</span>
      <span className="inspect-total-value">{value}</span>
    </div>
  );
}

function Group({
  name,
  regions,
  loaded,
}: {
  name: string;
  regions: RegionTraffic[];
  loaded: number;
}) {
  const rows = regions.filter((region) => region.group === name);
  if (rows.length === 0) return null;

  const downloaded = rows.reduce((sum, region) => sum + region.downloaded, 0);

  return (
    <section className="inspect-group">
      <h3 className="inspect-group-title">
        <span>{name}</span>
        <span className="inspect-group-total">{formatBytes(downloaded)}</span>
      </h3>
      {rows.map((region) => (
        <Fragment key={region.name}>
          <Row region={region} />
          {region.blocks && <BlockLine blocks={region.blocks} loaded={loaded} />}
        </Fragment>
      ))}
    </section>
  );
}

function Row({ region }: { region: RegionTraffic }) {
  const percent = region.size > 0 ? Math.min(100, (region.downloaded / region.size) * 100) : 0;
  const full = region.downloaded >= region.size;

  return (
    <div className="inspect-row">
      <span className="inspect-row-dot">{region.spec && <SpecDot region={region} />}</span>
      <span className="inspect-row-code">
        {region.code.length >= 1 && region.code.length <= 2 && <span>{region.code}</span>}
      </span>
      <span className="inspect-row-name" title={region.name}>
        {region.name}
      </span>
      <div className="inspect-row-bar">
        <div
          className={full ? "inspect-row-fill full" : "inspect-row-fill"}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="inspect-row-bytes">{formatBytes(region.downloaded)}</span>
      <span className="inspect-row-size">/ {formatBytes(region.size)}</span>
    </div>
  );
}

function BlockLine({ blocks, loaded }: { blocks: BlockCount; loaded: number }) {
  return (
    <div
      className="inspect-sub"
      title="Blocks read so far and how much they unpack to, added up over every sample whose directory has arrived. Blocks are freed after use, so this counts work done, not memory held."
    >
      <span>
        {formatCount(blocks.done)} / {formatCount(blocks.total)} blocks read
        {blocks.samples < loaded && ` · ${countSamples(blocks.samples)}`}
      </span>
      <span className="inspect-sub-raw">
        {formatBytes(blocks.plainDone)} / {formatBytes(blocks.plainTotal)} unpacked
      </span>
    </div>
  );
}

function SpecDot({ region }: { region: RegionTraffic }) {
  const state = region.verified === null ? "wait" : region.verified;
  return <span className={`spec-dot ${state}`} title={describeSpec(region)} />;
}

function describeSpec(region: RegionTraffic): string {
  const spec = region.spec;
  if (!spec) return "";

  const layout = describeLayout(spec);
  if (spec.crc === null) {
    const over = countSamples(region.samples);
    if (region.verified === "ok") {
      return `Every CRC32 matches the header — ${layout} verified byte-for-byte over ${over}`;
    }
    if (region.verified === "bad") {
      return `CRC32 mismatch on at least one of ${over} — downloaded bytes do not match the header`;
    }
    return `Not fully downloaded yet on all of ${over} — each CRC32 is checked against its own header (${layout})`;
  }

  const crc = spec.crc.toString(16).padStart(8, "0");
  if (region.verified === "ok") {
    return `CRC32 ${crc} matches the header — ${layout} verified byte-for-byte`;
  }
  if (region.verified === "bad") {
    return `CRC32 mismatch — downloaded bytes do not match the header (expected ${crc})`;
  }
  return `Not fully downloaded yet — will check CRC32 ${crc} against the header (${layout})`;
}

function describeLayout(spec: RegionSpec): string {
  if (spec.stride === null) return "compressed window directory";
  if (spec.count === null) return `${spec.stride}-byte records`;
  return `${spec.stride} B × ${formatCount(spec.count)} records`;
}
