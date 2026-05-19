/** Convert a Uint8Array to a plain ArrayBuffer (useful for APIs that only accept ArrayBuffer). */
export function uint8ArrayToArrayBuffer(u8: Uint8Array): ArrayBuffer {
  const out = new ArrayBuffer(u8.byteLength);
  new Uint8Array(out).set(u8);
  return out;
}
