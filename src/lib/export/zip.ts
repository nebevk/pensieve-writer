/**
 * The files in a zip, as an OpenDocument file (.odt) holds them: listed at once, each read only when asked.
 * Stored and deflated files are read, all an office file uses, with the browser's own decompression, so no
 * zip library is needed.
 */
export type ZipFiles = Map<string, () => Promise<Uint8Array>>;

const END = 0x06054b50;
const ENTRY = 0x02014b50;
const LOCAL = 0x04034b50;

/** The files of a zip by their names; throws on something that isn't one. */
export function unzip(data: ArrayBuffer): ZipFiles {
  const bytes = new Uint8Array(data);
  const view = new DataView(data);
  // The central directory's end, found from the back: a comment of up to 64 KB may follow it.
  let end = -1;
  for (let at = bytes.length - 22; at >= Math.max(0, bytes.length - 22 - 0xffff); at -= 1) {
    if (view.getUint32(at, true) === END) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("This isn't a zip file.");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const names = new TextDecoder();
  const files: ZipFiles = new Map();
  for (let index = 0; index < count; index += 1) {
    if (view.getUint32(at, true) !== ENTRY) throw new Error("This zip file is damaged.");
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = names.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    files.set(name, async () => {
      if (view.getUint32(local, true) !== LOCAL) throw new Error("This zip file is damaged.");
      const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
      const packed = bytes.slice(start, start + size);
      if (method === 0) return packed;
      if (method === 8) return inflate(packed);
      throw new Error("This zip file is packed in a way Pensieve can't read.");
    });
  }
  return files;
}

async function inflate(packed: Uint8Array<ArrayBuffer>): Promise<Uint8Array> {
  const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
