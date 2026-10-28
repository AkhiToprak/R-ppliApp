import { isCamtXml } from "./camt";
import { decodeText } from "./encoding";

export type DetectedFormat = "csv" | "camt" | "xlsx" | "pdf";

function extension(fileName: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return m ? m[1].toLowerCase() : "";
}

function startsWith(bytes: Uint8Array, sig: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + sig.length) return false;
  return sig.every((b, i) => bytes[offset + i] === b);
}

function looksBinary(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 4096);
  let control = 0;
  let zeros = 0;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b === 0) zeros++;
    else if (b < 9 || (b > 13 && b < 32)) control++;
  }
  // UTF-16 text has many zeros but no other control chars
  if (zeros > 0 && control === 0 && zeros / n > 0.3) return false;
  return (control + zeros) / Math.max(n, 1) > 0.05;
}

/**
 * Detects the statement format from magic bytes / content, falling back to the file extension.
 * Returns null for unsupported content.
 */
export function detectFormat(fileName: string, data: ArrayBuffer | Uint8Array): DetectedFormat | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const ext = extension(fileName);

  // %PDF (allow some leading junk)
  const head = bytes.subarray(0, 1024);
  for (let i = 0; i + 4 <= head.length; i++) {
    if (head[i] === 0x25 && head[i + 1] === 0x50 && head[i + 2] === 0x44 && head[i + 3] === 0x46) return "pdf";
  }
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "xlsx"; // zip container (xlsx/ods)
  if (startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return "xlsx"; // OLE2 (xls)
  if (looksBinary(bytes)) return ext === "xls" || ext === "xlsx" ? "xlsx" : null;

  const text = decodeText(bytes.subarray(0, Math.min(bytes.length, 64 * 1024))).trimStart();
  if (text.startsWith("<")) {
    if (isCamtXml(text)) return "camt";
    if (/^<(?:!doctype html|html|table)\b/i.test(text) || /<table[\s>]/i.test(text.slice(0, 4000))) return "xlsx";
    return null;
  }
  if (ext === "pdf") return null; // claimed PDF without PDF header
  return "csv";
}
