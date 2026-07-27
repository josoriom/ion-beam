export type RegionGroup = "Header" | "Index" | "Metadata" | "Blocks";

export interface SpecInfo {
  stride: number | null;
  count: number | null;
  crc: number;
}

export interface Region {
  name: string;
  code: string;
  group: RegionGroup;
  start: number;
  size: number;
  spec: SpecInfo | null;
  blocksFor: string | null;
}

export interface Layout {
  fileSize: number;
  blockSize: number;
  mzWindow: number;
  regions: Region[];
}

export const headerSize = 1024;

const signature = "IONIC";
const blockSizeAt = 16;
const mzWindowAt = 24;
const fileSizeAt = 400;
const spectrumCountAt = 256;
const chromatogramCountAt = 264;

interface Section {
  name: string;
  code: string;
  group: RegionGroup;
  at: number;
  stride?: number;
  countAt?: number;
  crcAt?: number;
  dirName?: string;
  blockCountAt?: number;
  dirCrcAt?: number;
}

const blockEntryBytes = 32;

const sections: Section[] = [
  { name: "Spectrum blocks", code: "packed_spectra", group: "Blocks", at: 208, dirName: "Spectrum block directory", blockCountAt: 240, dirCrcAt: 1000 },
  { name: "Chromatogram blocks", code: "packed_chroms", group: "Blocks", at: 224, dirName: "Chromatogram block directory", blockCountAt: 248, dirCrcAt: 1004 },
  { name: "Spectrum m/z windows", code: "A0", group: "Index", at: 32, crcAt: 968 },
  { name: "Spectrum summary", code: "A1", group: "Index", at: 48, stride: 80, countAt: spectrumCountAt, crcAt: 972 },
  { name: "Spectrum entries", code: "A2", group: "Index", at: 64, stride: 16, countAt: spectrumCountAt, crcAt: 976 },
  { name: "Spectrum addresses", code: "A3", group: "Index", at: 80, stride: 32, crcAt: 980 },
  { name: "Chromatogram windows", code: "B0", group: "Index", at: 96, crcAt: 984 },
  { name: "Chromatogram summary", code: "B1", group: "Index", at: 112, stride: 80, countAt: chromatogramCountAt, crcAt: 988 },
  { name: "Chromatogram entries", code: "B2", group: "Index", at: 128, stride: 16, countAt: chromatogramCountAt, crcAt: 992 },
  { name: "Chromatogram addresses", code: "B3", group: "Index", at: 144, stride: 32, crcAt: 996 },
  { name: "Spectrum metadata", code: "C", group: "Metadata", at: 160 },
  { name: "Chromatogram metadata", code: "D", group: "Metadata", at: 176 },
  { name: "Global metadata", code: "E", group: "Metadata", at: 192 },
];

export function readLayout(header: Uint8Array): Layout | null {
  if (header.length < headerSize || !hasSignature(header)) return null;

  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const regions: Region[] = [
    {
      name: "File header",
      code: "header",
      group: "Header",
      start: 0,
      size: headerSize,
      spec: null,
      blocksFor: null,
    },
  ];

  for (const section of sections) {
    const start = readSize(view, section.at);
    const size = readSize(view, section.at + 8);
    if (size <= 0) continue;
    if (section.blockCountAt !== undefined) {
      pushBlockRegions(view, regions, section, start, size);
    } else {
      regions.push({
        name: section.name,
        code: section.code,
        group: section.group,
        start,
        size,
        spec: readSpec(view, section),
        blocksFor: null,
      });
    }
  }

  regions.sort((left, right) => left.start - right.start);
  return {
    fileSize: readSize(view, fileSizeAt),
    blockSize: readSize(view, blockSizeAt),
    mzWindow: view.getUint32(mzWindowAt, true),
    regions,
  };
}

function pushBlockRegions(
  view: DataView,
  regions: Region[],
  section: Section,
  start: number,
  size: number,
): void {
  const blockCount = section.blockCountAt === undefined ? 0 : readSize(view, section.blockCountAt);
  const dirSize = blockCount * blockEntryBytes;
  const payloadSize = Math.max(0, size - dirSize);

  regions.push({
    name: section.name,
    code: section.code,
    group: "Blocks",
    start,
    size: payloadSize,
    spec: null,
    blocksFor: null,
  });

  if (section.dirName === undefined || section.dirCrcAt === undefined || dirSize === 0) return;
  regions.push({
    name: section.dirName,
    code: "",
    group: "Blocks",
    start: start + payloadSize,
    size: dirSize,
    spec: { stride: blockEntryBytes, count: blockCount, crc: view.getUint32(section.dirCrcAt, true) },
    blocksFor: section.name,
  });
}

function readSpec(view: DataView, section: Section): SpecInfo | null {
  if (section.crcAt === undefined) return null;
  const stride = section.stride ?? null;
  const count = section.countAt === undefined ? null : readSize(view, section.countAt);
  return { stride, count, crc: view.getUint32(section.crcAt, true) };
}

function hasSignature(header: Uint8Array): boolean {
  for (let i = 0; i < signature.length; i += 1) {
    if (header[i] !== signature.charCodeAt(i)) return false;
  }
  return true;
}

function readSize(view: DataView, at: number): number {
  return Number(view.getBigUint64(at, true));
}
