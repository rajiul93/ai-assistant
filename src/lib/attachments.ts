/** Files the assistant can read: images and PDFs only. Gemini reads both natively. */
export const ATTACHMENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"] as const;
export type AttachmentType = (typeof ATTACHMENT_TYPES)[number];
export const ATTACHMENT_ACCEPT = ATTACHMENT_TYPES.join(",");
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type Attachment = { name: string; mimeType: AttachmentType; size: number; /** base64, no data: prefix */ data: string };

export function isAllowedType(type: string): type is AttachmentType {
  return (ATTACHMENT_TYPES as readonly string[]).includes(type);
}

/** The real type from the file's first bytes — never trust the name or the browser's claim alone. */
export function sniffType(bytes: Uint8Array): AttachmentType | null {
  const ascii = (start: number, text: string) => [...text].every((char, index) => bytes[start + index] === char.charCodeAt(0));
  if (ascii(0, "%PDF-")) return "application/pdf";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && ascii(1, "PNG")) return "image/png";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (ascii(4, "ftyp")) {
    const brand = String.fromCharCode(...bytes.slice(8, 12));
    if (/^(heic|heix|hevc|heim|heis)$/.test(brand)) return "image/heic";
    if (/^(mif1|msf1)$/.test(brand)) return "image/heif";
  }
  return null;
}

export function formatBytes(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
