// Robust JSON extraction from LLM replies (pure, no I/O — safe anywhere).

/**
 * Parses JSON from a model reply: strips ``` fences / prose around the object,
 * tolerates trailing commas and repairs output that was cut off mid-array.
 * Throws SyntaxError if nothing usable is found.
 */
export function extractJSON(text: string): unknown {
  let s = text.replace(/^﻿/, "").trim();

  const fenced = s.match(/```[a-zA-Z]*\s*\n?([\s\S]*?)```/);
  if (fenced) s = fenced[1].trim();
  else if (s.startsWith("```")) s = s.replace(/^```[a-zA-Z]*\s*/, ""); // unterminated fence (truncated reply)

  const direct = tryParse(s);
  if (direct.ok) return direct.value;

  const start = s.search(/[{[]/);
  if (start === -1) throw new SyntaxError("no JSON found");
  const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
  if (end > start) {
    const slice = s.slice(start, end + 1);
    const sliced = tryParse(slice);
    if (sliced.ok) return sliced.value;
    const noTrailingCommas = tryParse(removeTrailingCommas(slice));
    if (noTrailingCommas.ok) return noTrailingCommas.value;
  }

  const repaired = repairTruncatedJSON(s.slice(start));
  if (repaired.ok) return repaired.value;
  throw new SyntaxError("invalid JSON");
}

function tryParse(s: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(s) };
  } catch {
    return { ok: false };
  }
}

/** Removes `,` directly before `}` / `]` outside of strings. */
export function removeTrailingCommas(s: string): string {
  let out = "";
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      out += ch;
      if (ch === "\\") {
        out += s[i + 1] ?? "";
        i++;
      } else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    if (ch === ",") {
      let j = i + 1;
      while (j < s.length && /\s/.test(s[j])) j++;
      if (s[j] === "}" || s[j] === "]") continue;
    }
    out += ch;
  }
  return out;
}

/**
 * Repairs JSON that was truncated (e.g. max_tokens reached): cuts back to the
 * last complete object/array and closes the still-open brackets.
 */
export function repairTruncatedJSON(s: string): { ok: true; value: unknown } | { ok: false } {
  const stack: string[] = [];
  const cuts: { index: number; open: string }[] = [];
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (ch === "\\") i++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      if (stack.length === 0) break;
      cuts.push({ index: i + 1, open: stack.join("") });
    }
  }
  for (let k = cuts.length - 1, tries = 0; k >= 0 && tries < 40; k--, tries++) {
    const { index, open } = cuts[k];
    const closers = open
      .split("")
      .reverse()
      .map((c) => (c === "{" ? "}" : "]"))
      .join("");
    const attempt = tryParse(removeTrailingCommas(s.slice(0, index) + closers));
    if (attempt.ok) return attempt;
  }
  return { ok: false };
}
