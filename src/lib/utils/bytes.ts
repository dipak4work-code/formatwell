/** UTF-8 byte length of a string. Safe in both window and worker contexts. */
export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
