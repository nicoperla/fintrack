/** What an uploaded file really is, from its first bytes: the browser's word isn't enough. */
export type SniffedType =
  "image/jpeg" | "image/png" | "image/gif" | "image/webp" | "application/pdf";

export function sniffType(bytes: Uint8Array): SniffedType | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    Buffer.from(bytes.subarray(8, 12)).toString("latin1") === "WEBP"
  ) {
    return "image/webp";
  }
  if (starts(0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}
