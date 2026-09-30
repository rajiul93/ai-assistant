/**
 * Cuts a photographed/scanned page into enlarged tiles for the AI to read.
 *
 * Vision models shrink every image so its short side is ~768 px, which blurs small Bangla print
 * (conjuncts, কার/ফলা) and the tiny answer marks. Sending the page as a few overlapping, enlarged
 * pieces keeps the print sharp. Two-column pages (most MCQ books) are split down the gutter so a
 * line is never cut in half.
 */

export type PageTiles = { tiles: string[]; columns: 1 | 2; rows: number };

function loadBitmap(file: Blob) {
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Finds the gap between two columns: the widest vertical strip near the middle with no print all
 * the way down — counting a thin ruled line, which many books draw there, as part of the gap.
 * Returns its middle x in the page's pixels, or null for a single-column page.
 */
function findGutter(bitmap: ImageBitmap): number | null {
  // Full resolution (up to 1600 px wide): a 1–2 px rule or a narrow gap vanishes when shrunk.
  const width = Math.min(bitmap.width, 1600);
  const height = Math.round((bitmap.height / bitmap.width) * width);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  // The page is looked at in horizontal bands: a banner, heading or footer running across both
  // columns fills the gap in a band or two, but never in most of them.
  const top = Math.round(height * 0.12);
  const bottom = Math.round(height * 0.96);
  const bands = 24;
  const bandHeight = (bottom - top) / bands;
  const from = Math.round(width * 0.36);
  const to = Math.round(width * 0.64);
  const blank = new Map<number, number>();
  const solid = new Map<number, number>();
  for (let x = from; x <= to; x++) {
    let blankBands = 0;
    let solidBands = 0;
    for (let band = 0; band < bands; band++) {
      const start = Math.round(top + band * bandHeight);
      const end = Math.round(top + (band + 1) * bandHeight);
      let dark = 0;
      for (let y = start; y < end; y++) {
        const index = (y * width + x) * 4;
        if (data[index] * 0.3 + data[index + 1] * 0.59 + data[index + 2] * 0.11 < 160) dark++;
      }
      const ratio = dark / Math.max(1, end - start);
      if (ratio < 0.02) blankBands++;
      else if (ratio > 0.6) solidBands++;
    }
    blank.set(x, blankBands / bands);
    solid.set(x, solidBands / bands);
  }
  // Many books rule a line between the columns: a thin column that is solid down most of the page.
  let rule: { start: number; length: number } | null = null;
  for (let x = Math.round(width * 0.4), start = -1; x <= Math.round(width * 0.6) + 1; x++) {
    if ((solid.get(x) ?? 0) >= 0.6) { if (start < 0) start = x; continue; }
    if (start >= 0 && x - start <= Math.max(4, width * 0.005)) { rule = { start, length: x - start }; break; }
    start = -1;
  }
  if (rule) return Math.round(((rule.start + rule.length / 2) / width) * bitmap.width);

  // Otherwise the widest strip that is blank in most bands; narrow ones are spaces inside a column
  // (after question numbers, between option pairs).
  let best: { start: number; length: number } | null = null;
  for (let x = from, start = -1; x <= to + 1; x++) {
    if (x <= to && (blank.get(x) ?? 0) >= 0.7) { if (start < 0) start = x; continue; }
    if (start >= 0 && (!best || x - start > best.length)) best = { start, length: x - start };
    start = -1;
  }
  if (!best || best.length < Math.max(12, width * 0.015)) return null;
  return Math.round(((best.start + best.length / 2) / width) * bitmap.width);
}

async function toBase64(canvas: OffscreenCanvas) {
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return btoa(binary);
}

/**
 * The page as `rows` bands per column, each enlarged so the text is about `targetWidth` pixels
 * across, with a little overlap so no line falls between two tiles.
 */
export async function pageTiles(file: Blob, { rows, targetWidth }: { rows: number; targetWidth: number }): Promise<PageTiles> {
  const bitmap = await loadBitmap(file);
  try {
    const gutter = findGutter(bitmap);
    const columns: Array<[number, number]> = gutter ? [[0, gutter + Math.round(bitmap.width * 0.01)], [gutter - Math.round(bitmap.width * 0.01), bitmap.width]] : [[0, bitmap.width]];
    const overlap = Math.round(bitmap.height * 0.035);
    const tiles: string[] = [];
    for (const [left, right] of columns) {
      for (let row = 0; row < rows; row++) {
        const top = Math.max(0, Math.round((row * bitmap.height) / rows) - overlap);
        const bottom = Math.min(bitmap.height, Math.round(((row + 1) * bitmap.height) / rows) + overlap);
        const scale = Math.min(4, Math.max(1, targetWidth / (right - left)));
        const canvas = new OffscreenCanvas(Math.round((right - left) * scale), Math.round((bottom - top) * scale));
        const context = canvas.getContext("2d");
        if (!context) continue;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(bitmap, left, top, right - left, bottom - top, 0, 0, canvas.width, canvas.height);
        tiles.push(await toBase64(canvas));
      }
    }
    return { tiles, columns: gutter ? 2 : 1, rows };
  } finally {
    bitmap.close();
  }
}
