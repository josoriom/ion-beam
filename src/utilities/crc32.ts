const table = buildTable();

export function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) {
    value = table[(value ^ bytes[i]) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function buildTable(): Uint32Array {
  const result = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let value = n;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    result[n] = value >>> 0;
  }
  return result;
}
