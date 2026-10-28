// Server-only OpenRouter client. NEVER import this from client components:
// it reads OPENROUTER_API_KEY from process.env (inside functions, at request time).
//
// Privacy: request/response contents are never logged — only status codes and timings.

import { z } from "zod";
import { extractJSON } from "./json";

export { extractJSON } from "./json";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const DEFAULT_MODEL = "google/gemini-2.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 25_000;

/** Thrown when no OPENROUTER_API_KEY is configured. Routes map this to 503 / fallback. */
export class LLMUnavailableError extends Error {
  constructor() {
    super("llm_unavailable");
    this.name = "LLMUnavailableError";
  }
}

export type LLMErrorKind = "http" | "timeout" | "network" | "invalid" | "aborted";

/** Any other failure talking to the model (HTTP error, timeout, unusable output). */
export class LLMError extends Error {
  constructor(
    readonly kind: LLMErrorKind,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

export function isLLMConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim());
}

export interface ChatJSONOptions<T> {
  system: string;
  user: string;
  /** Validates (and may coerce) the parsed JSON. */
  schema: z.ZodType<T>;
  /**
   * Clean schema describing the desired wire format, used to build the OpenRouter
   * `json_schema` response format. Defaults to `schema`. Pass `false` to only use `json_object`.
   */
  wireSchema?: z.ZodType | false;
  /** Name for the json_schema response format (a-z, 0-9, _). */
  schemaName?: string;
  maxTokens?: number;
  temperature?: number;
  /** Per-attempt timeout. Default 25 s. */
  timeoutMs?: number;
  /** Overall budget across the retry. Default 1.4 × timeoutMs. */
  budgetMs?: number;
  /** Aborts the call (e.g. the incoming request's signal). */
  signal?: AbortSignal;
  /** Short label for logs, e.g. "insights". */
  label?: string;
}

type Message = { role: "system" | "user" | "assistant"; content: string };

// Models that rejected `json_schema` in this process — skip straight to json_object next time.
const jsonSchemaUnsupported = new Set<string>();

function getConfig() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new LLMUnavailableError();
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;
  const fallbacks = (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter((m) => m && m !== model);
  const referer = process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://rappli.ch";
  // Default: only route to providers that don't retain/train on prompts.
  const allowDataCollection = process.env.OPENROUTER_ALLOW_DATA_COLLECTION === "1";
  return { apiKey, model, fallbacks: [...new Set(fallbacks)], referer, allowDataCollection };
}

function toJSONSchema(schema: z.ZodType): Record<string, unknown> | null {
  try {
    const js = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" }) as Record<string, unknown>;
    delete js.$schema;
    return js;
  } catch {
    return null;
  }
}

/** Sends a chat completion and returns validated JSON. One retry on invalid JSON / schema errors. */
export async function chatJSON<T>(opts: ChatJSONOptions<T>): Promise<T> {
  const cfg = getConfig();
  const label = opts.label ?? "llm";
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const deadline = Date.now() + (opts.budgetMs ?? Math.round(timeoutMs * 1.4));

  const wire = opts.wireSchema === false ? null : toJSONSchema(opts.wireSchema ?? opts.schema);
  let useJsonSchema = wire !== null && !jsonSchemaUnsupported.has(cfg.model);

  const messages: Message[] = [
    { role: "system", content: opts.system },
    { role: "user", content: opts.user },
  ];

  let lastProblem = "";
  for (let attempt = 1; attempt <= 2; attempt++) {
    const remaining = deadline - Date.now();
    if (attempt > 1 && remaining < 4_000) break;
    const attemptTimeout = attempt === 1 ? timeoutMs : Math.min(timeoutMs, remaining);

    let content: string;
    try {
      content = await callOnce(cfg, messages, opts, useJsonSchema ? wire : null, attemptTimeout, label, attempt);
    } catch (err) {
      // The model/provider rejected structured output → degrade to plain JSON mode once.
      if (useJsonSchema && err instanceof LLMError && err.kind === "http" && (err.status === 400 || err.status === 422)) {
        jsonSchemaUnsupported.add(cfg.model);
        useJsonSchema = false;
        content = await callOnce(cfg, messages, opts, null, Math.max(1_000, Math.min(timeoutMs, deadline - Date.now())), label, attempt);
      } else {
        throw err;
      }
    }

    let parsed: unknown;
    try {
      parsed = extractJSON(content);
    } catch {
      lastProblem = "The reply was not valid JSON (it may have been truncated).";
      messages.push(
        { role: "assistant", content: content.slice(0, 8_000) },
        { role: "user", content: `${lastProblem} Reply again with ONLY one complete, valid JSON object — no prose, no code fences. Keep it shorter if needed.` },
      );
      continue;
    }

    const result = opts.schema.safeParse(parsed);
    if (result.success) return result.data;

    lastProblem = z.prettifyError(result.error).slice(0, 1_500);
    messages.push(
      { role: "assistant", content: content.slice(0, 8_000) },
      { role: "user", content: `Your JSON did not match the required schema:\n${lastProblem}\nReply again with ONLY the corrected JSON object.` },
    );
  }

  console.warn(`[llm] ${label} invalid output after retry`);
  throw new LLMError("invalid", "invalid_model_output");
}

async function callOnce(
  cfg: ReturnType<typeof getConfig>,
  messages: Message[],
  opts: ChatJSONOptions<unknown>,
  jsonSchema: Record<string, unknown> | null,
  timeoutMs: number,
  label: string,
  attempt: number,
): Promise<string> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const signal = opts.signal ? AbortSignal.any([timeoutSignal, opts.signal]) : timeoutSignal;

  const body: Record<string, unknown> = {
    model: cfg.model,
    messages,
    max_tokens: opts.maxTokens ?? 2_000,
    temperature: opts.temperature ?? 0.3,
    response_format: jsonSchema
      ? { type: "json_schema", json_schema: { name: opts.schemaName ?? "response", strict: false, schema: jsonSchema } }
      : { type: "json_object" },
  };
  if (cfg.fallbacks.length > 0) body.models = [cfg.model, ...cfg.fallbacks];
  if (!cfg.allowDataCollection) body.provider = { data_collection: "deny" };

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": cfg.referer,
        "X-Title": "Räppli",
      },
      body: JSON.stringify(body),
      signal,
      cache: "no-store",
    });
  } catch (err) {
    const ms = Date.now() - started;
    if (timeoutSignal.aborted) {
      console.warn(`[llm] ${label} timeout ms=${ms} attempt=${attempt}`);
      throw new LLMError("timeout", "llm_timeout");
    }
    if (opts.signal?.aborted) throw new LLMError("aborted", "llm_aborted");
    console.warn(`[llm] ${label} network_error ms=${ms} attempt=${attempt} (${err instanceof Error ? err.name : "unknown"})`);
    throw new LLMError("network", "llm_network_error");
  }

  const ms = Date.now() - started;
  console.info(`[llm] ${label} status=${res.status} ms=${ms} attempt=${attempt}${jsonSchema ? " schema" : ""}`);

  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new LLMError("http", `llm_http_${res.status}`, res.status);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new LLMError("invalid", "llm_bad_envelope");
  }
  const content = readContent(data);
  if (content === null) {
    // OpenRouter can return 200 with an `error` object (e.g. upstream provider failure).
    const code = (data as { error?: { code?: unknown } })?.error?.code;
    console.warn(`[llm] ${label} empty_completion code=${typeof code === "number" ? code : "-"}`);
    throw new LLMError("http", "llm_empty_completion", typeof code === "number" ? code : 502);
  }
  return content;
}

function readContent(data: unknown): string | null {
  const choice = (data as { choices?: { message?: { content?: unknown } }[] })?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content === "string") return content.trim() ? content : null;
  if (Array.isArray(content)) {
    const text = content
      .map((p) => (p && typeof p === "object" && "text" in p && typeof p.text === "string" ? p.text : ""))
      .join("");
    return text.trim() ? text : null;
  }
  return null;
}
