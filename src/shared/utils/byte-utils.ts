/**
 * Canonical Byte Array Concatenation Utility
 * Concatenates an array of Uint8Arrays into a single contiguous Uint8Array.
 */
export function concatByteArrays(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buf of buffers) {
    result.set(buf, offset);
    offset += buf.byteLength;
  }
  return result;
}
