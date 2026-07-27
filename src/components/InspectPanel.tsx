import { Fragment, memo, useEffect, useSyncExternalStore } from "react";
import { getTraffic, subscribe, type BlockCount, type RegionTraffic } from "../ms/traffic";
import type { SpecInfo } from "../ms/ionLayout";
import { formatBytes, formatCount, formatPercent } from "../utilities/format";
import { useDrag } from "../utilities/useDrag";
import { useAppDispatch } from "../context/context";

const groups = ["Header", "Index", "Metadata", "Blocks"];

export const InspectPanel = memo(function InspectPanel() {
  const dispatch = useAppDispatch();
  const traffic = useSyncExternalStore(subscribe, getTraffic);
  const { offset, onGrab, panelRef } = useDrag();

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
          <p className="inspect-sample">{traffic.sample ?? "Pick a sample"}</p>
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
          hint="Range requests served for this file"
        />
        <Total
          label="m/z window"
          value={traffic.mzWindow ? formatCount(traffic.mzWindow) : "—"}
          hint="Width of one m/z window, in m/z units"
        />
        <Total
          label="Block raw"
          value={traffic.blockSize ? formatBytes(traffic.blockSize) : "—"}
          hint="Target size of one block before compression, so it does not match the stored sizes below"
        />
      </div>

      <div className="inspect-body">
        {traffic.regions.length === 0 && (
          <p className="inspect-empty">Waiting for the file header…</p>
        )}
        {traffic.regions.length > 0 && (
          <p className="inspect-note">Sizes below are stored bytes, compressed</p>
        )}
        {groups.map((group) => (
          <Group key={group} name={group} regions={traffic.regions} />
        ))}
        {traffic.unmapped > 0 && (
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
    </div>
  );
});

function Total({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="inspect-total" title={hint}>
      <span className="inspect-total-label">{label}</span>
      <span className="inspect-total-value">{value}</span>
    </div>
  );
}

function Group({ name, regions }: { name: string; regions: RegionTraffic[] }) {
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
          {region.blocks && <BlockLine blocks={region.blocks} />}
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

function BlockLine({ blocks }: { blocks: BlockCount }) {
  return (
    <div
      className="inspect-sub"
      title="Blocks read so far and how much they unpack to. Blocks are freed after use, so this counts work done, not memory held."
    >
      <span>
        {formatCount(blocks.done)} / {formatCount(blocks.total)} blocks read
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
  const crc = spec.crc.toString(16).padStart(8, "0");

  if (region.verified === "ok") {
    return `CRC32 ${crc} matches the header — ${layout} verified byte-for-byte`;
  }
  if (region.verified === "bad") {
    return `CRC32 mismatch — downloaded bytes do not match the header (expected ${crc})`;
  }
  return `Not fully downloaded yet — will check CRC32 ${crc} against the header (${layout})`;
}

function describeLayout(spec: SpecInfo): string {
  if (spec.stride === null) return "compressed window directory";
  if (spec.count === null) return `${spec.stride}-byte records`;
  return `${spec.stride} B × ${formatCount(spec.count)} records`;
}
