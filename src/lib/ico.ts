export interface IcoEntry {
  size: number;
  png: Uint8Array;
}

/**
 * Builds a PNG-compressed ICO container. PNG payloads are supported by all
 * modern browsers and Windows Vista+.
 */
export function buildIco(entries: IcoEntry[]): Uint8Array {
  if (entries.length === 0 || entries.length > 255) {
    throw new Error('An ICO must contain between 1 and 255 images.');
  }

  let offset = 6 + entries.length * 16;
  const totalLength = offset + entries.reduce((sum, entry) => sum + entry.png.length, 0);
  const output = new Uint8Array(totalLength);
  const view = new DataView(output.buffer);

  view.setUint16(0, 0, true);
  view.setUint16(2, 1, true);
  view.setUint16(4, entries.length, true);

  entries.forEach((entry, index) => {
    if (entry.size < 1 || entry.size > 256) {
      throw new Error('ICO image dimensions must be between 1 and 256 px.');
    }
    const directoryOffset = 6 + index * 16;
    output[directoryOffset] = entry.size === 256 ? 0 : entry.size;
    output[directoryOffset + 1] = entry.size === 256 ? 0 : entry.size;
    output[directoryOffset + 2] = 0;
    output[directoryOffset + 3] = 0;
    view.setUint16(directoryOffset + 4, 1, true);
    view.setUint16(directoryOffset + 6, 32, true);
    view.setUint32(directoryOffset + 8, entry.png.length, true);
    view.setUint32(directoryOffset + 12, offset, true);
    output.set(entry.png, offset);
    offset += entry.png.length;
  });

  return output;
}
