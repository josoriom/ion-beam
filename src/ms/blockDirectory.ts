export interface Block {
  start: number;
  end: number;
  plain: number;
}

const entryBytes = 32;

export function readBlocks(bytes: Uint8Array, regionStart: number): Block[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = Math.floor(bytes.length / entryBytes);
  const blocks: Block[] = new Array(total);

  for (let i = 0; i < total; i += 1) {
    const at = i * entryBytes;
    const offset = Number(view.getBigUint64(at, true));
    const size = Number(view.getBigUint64(at + 8, true));
    const plain = Number(view.getBigUint64(at + 16, true));
    blocks[i] = {
      start: regionStart + offset,
      end: regionStart + offset + size,
      plain,
    };
  }

  blocks.sort((left, right) => left.start - right.start);
  return blocks;
}

export function findFirstBlock(blocks: Block[], at: number): number {
  let low = 0;
  let high = blocks.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (blocks[middle].end <= at) low = middle + 1;
    else high = middle;
  }
  return low;
}
