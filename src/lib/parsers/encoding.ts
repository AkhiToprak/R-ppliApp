/**
 * Decodes raw file bytes to text: honours BOMs (UTF-8 / UTF-16), tries strict UTF-8 and
 * falls back to windows-1252 (common for older Swiss e-banking exports).
 */
export function decodeText(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let text: string;
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = new TextDecoder("utf-16le").decode(bytes.subarray(2));
  } else if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    text = new TextDecoder("utf-16be").decode(bytes.subarray(2));
  } else if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    text = new TextDecoder("utf-8").decode(bytes.subarray(3));
  } else if (looksLikeUtf16Le(bytes)) {
    text = new TextDecoder("utf-16le").decode(bytes);
  } else {
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      text = new TextDecoder("windows-1252").decode(bytes);
    }
  }
  return text.replace(/^﻿/, "");
}

function looksLikeUtf16Le(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 512);
  if (n < 8) return false;
  let zerosOdd = 0;
  for (let i = 1; i < n; i += 2) if (bytes[i] === 0) zerosOdd++;
  return zerosOdd / (n / 2) > 0.6;
}
