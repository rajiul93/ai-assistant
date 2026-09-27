"use client";

/** Tried in order until an image fits its share of the upload budget; still sharp enough to read text. */
const STEPS = [
  { maxSide: 2000, quality: 0.85 },
  { maxSide: 1700, quality: 0.8 },
  { maxSide: 1400, quality: 0.75 },
  { maxSide: 1200, quality: 0.7 },
];

function toBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Shrinks a photo in the browser so several fit in one message: re-encodes it as JPEG, stepping
 * down size/quality until it is under `targetBytes` (text stays legible — never below 1200px).
 * Small images are left as they are. Returns null if the image can't be decoded.
 */
export async function compressImage(file: File, targetBytes: number): Promise<{ blob: Blob; type: "image/jpeg" | "image/png" | "image/webp" } | null> {
  if (file.size <= targetBytes && /^image\/(jpeg|png|webp)$/.test(file.type)) return { blob: file, type: file.type as "image/jpeg" | "image/png" | "image/webp" };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return null;
  }
  let best: Blob | null = null;
  for (const step of STEPS) {
    const scale = Math.min(1, step.maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) break;
    // White behind transparent PNGs, so text on them stays readable as JPEG.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    best = await toBlob(canvas, step.quality);
    if (best && best.size <= targetBytes) break;
  }
  bitmap.close();
  return best ? { blob: best, type: "image/jpeg" } : null;
}
