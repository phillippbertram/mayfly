import { encode, QrCodeDataType } from "uqr";

export interface QrMatrix {
  size: number;
  /** Data modules, excluding the three finder patterns. */
  modules: [number, number][];
}

export function qrMatrix(text: string): QrMatrix {
  const result = encode(text, { ecc: "M", border: 0 });
  const modules: [number, number][] = [];
  for (let y = 0; y < result.size; y++) {
    for (let x = 0; x < result.size; x++) {
      if (result.data[y]?.[x] && result.types[y]?.[x] !== QrCodeDataType.Position) {
        modules.push([x, y]);
      }
    }
  }
  return { size: result.size, modules };
}

export function finderOrigins(size: number): [number, number][] {
  return [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
}

/** Renders the QR code to a PNG with a white quiet zone, identical in both themes. */
export function qrPng(text: string, pixels = 1024): Promise<Blob> {
  const { size, modules } = qrMatrix(text);
  const quiet = 4;
  const total = size + quiet * 2;
  const scale = pixels / total;
  const canvas = document.createElement("canvas");
  canvas.width = pixels;
  canvas.height = pixels;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas is unavailable."));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, pixels, pixels);
  ctx.fillStyle = "#17191d";
  for (const [x, y] of modules) {
    ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, Math.ceil(scale), Math.ceil(scale));
  }
  for (const [fx, fy] of finderOrigins(size)) {
    const ox = (fx + quiet) * scale;
    const oy = (fy + quiet) * scale;
    ctx.beginPath();
    ctx.roundRect(ox, oy, 7 * scale, 7 * scale, 2 * scale);
    ctx.roundRect(ox + scale, oy + scale, 5 * scale, 5 * scale, 1.4 * scale);
    ctx.fill("evenodd");
    ctx.beginPath();
    ctx.roundRect(ox + 2 * scale, oy + 2 * scale, 3 * scale, 3 * scale, 0.9 * scale);
    ctx.fill();
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("PNG export failed."))));
  });
}

export async function copyQrImage(text: string): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": qrPng(text) })]);
}
