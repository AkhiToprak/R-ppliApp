import { afterEach, describe, expect, it, vi } from "vitest";
import type { CategoriseRequest, CategoriseResponse, Transaction } from "@/lib/types";
import { categoriseTransactions, merchantKey, recategorise } from "./index";

let counter = 0;
function tx(description: string, amount = -20, counterparty?: string): Transaction {
  counter += 1;
  return { id: `t${counter}`, date: "2025-03-14", description, counterparty, amount, currency: "CHF" };
}

type Handler = (req: CategoriseRequest) => CategoriseResponse | Promise<CategoriseResponse>;

/** Letters-only unique token that no rule can match, e.g. 0 -> "zqaaa". */
function unique(i: number): string {
  let n = i;
  let out = "";
  for (let k = 0; k < 3; k++) {
    out += String.fromCharCode(97 + (n % 26));
    n = Math.floor(n / 26);
  }
  return `zq${out}`;
}

function mockFetch(handler: Handler) {
  const fn = vi.fn(async (_url: string, init?: RequestInit) => {
    const req = JSON.parse(String(init?.body)) as CategoriseRequest;
    const body = await handler(req);
    return { ok: true, status: 200, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("categoriseTransactions: rules only", () => {
  it("does not call the API when every transaction is matched by a rule", async () => {
    const fetchFn = mockFetch(() => ({ results: [] }));
    const progress = vi.fn();
    const out = await categoriseTransactions(
      [tx("Einkauf MIGROS M ZUERICH HB"), tx("TWINT *SBB CFF FFS"), tx("Gutschrift Lohn Muster AG", 5000)],
      "de",
      progress,
    );
    expect(fetchFn).not.toHaveBeenCalled();
    expect(progress).not.toHaveBeenCalled();
    expect(out.map((t) => t.category)).toEqual(["groceries", "transport", "income"]);
    expect(out.every((t) => t.categorySource === "rule")).toBe(true);
  });

  it("fills in the merchant name when the counterparty is empty", async () => {
    const out = await categoriseTransactions(
      [tx("Paiement carte COOP-1234 LAUSANNE"), tx("Karte Migros", -5, "Migros Wiedikon"), tx("Netflix", -15, "  ")],
      "fr",
    );
    expect(out[0].counterparty).toBe("Coop");
    expect(out[1].counterparty).toBe("Migros Wiedikon");
    expect(out[2].counterparty).toBe("Netflix");
  });

  it("does not mutate its input", async () => {
    const input = [tx("Migros")];
    await categoriseTransactions(input, "de");
    expect(input[0].category).toBeUndefined();
  });
});

describe("categoriseTransactions: LLM path", () => {
  it("deduplicates by merchant key and maps results back with source llm", async () => {
    const fetchFn = mockFetch((req) => ({
      results: req.items.map((i) => ({ key: i.key, category: "health" as const, merchant: "Dr. Muster" })),
    }));
    const out = await categoriseTransactions(
      [tx("Zahlung Praxisgemeinschaft Muster 1234", -80), tx("Zahlung Praxisgemeinschaft Muster 5678", -120), tx("Migros")],
      "de",
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/categorise");
    expect(init.method).toBe("POST");
    const sent = JSON.parse(String(init.body)) as CategoriseRequest;
    expect(sent.locale).toBe("de");
    expect(sent.items).toHaveLength(1);
    expect(out[0].category).toBe("health");
    expect(out[1].category).toBe("health");
    expect(out[0].categorySource).toBe("llm");
    expect(out[0].counterparty).toBe("Dr. Muster");
    expect(out[2].categorySource).toBe("rule");
  });

  it("keeps incoming and outgoing bookings of the same name apart", async () => {
    const fetchFn = mockFetch((req) => ({ results: req.items.map((i) => ({ key: i.key, category: "other" as const })) }));
    await categoriseTransactions([tx("Anna Beispiel", -50), tx("Anna Beispiel", 50)], "de");
    const sent = JSON.parse(String((fetchFn.mock.calls[0][1] as RequestInit).body)) as CategoriseRequest;
    expect(sent.items).toHaveLength(2);
  });

  it("splits into batches of at most 80 and reports progress", async () => {
    const txs = Array.from({ length: 170 }, (_, i) => tx(`Unbekannt ${unique(i)} Laden`));
    const sizes: number[] = [];
    mockFetch((req) => {
      sizes.push(req.items.length);
      return { results: req.items.map((i) => ({ key: i.key, category: "leisure" as const })) };
    });
    const progress = vi.fn();
    const out = await categoriseTransactions(txs, "de", progress);
    expect(sizes.sort((a, b) => b - a)).toEqual([80, 80, 10]);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(80);
    expect(progress).toHaveBeenCalledWith(0, 3);
    expect(progress).toHaveBeenLastCalledWith(3, 3);
    expect(out.every((t) => t.category === "leisure" && t.categorySource === "llm")).toBe(true);
  });

  it("runs at most two batches concurrently", async () => {
    const txs = Array.from({ length: 400 }, (_, i) => tx(`Laden ${unique(i)}`));
    let inFlight = 0;
    let maxInFlight = 0;
    mockFetch(async (req) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return { results: req.items.map((i) => ({ key: i.key, category: "other" as const })) };
    });
    await categoriseTransactions(txs, "en");
    expect(maxInFlight).toBe(2);
  });

  it("rejects unknown categories and keys, and income for outflows", async () => {
    mockFetch((req) => ({
      results: [
        { key: req.items[0].key, category: "spaceships" as never },
        { key: "nope", category: "health" as const },
        { key: req.items[1].key, category: "income" as const },
        { key: req.items[2].key, category: "income" as const },
      ],
    }));
    const out = await categoriseTransactions([tx("Foo Qux", -10), tx("Baz Qux", -10), tx("Quux Corge", 10)], "en");
    expect(out[0]).toMatchObject({ category: "other", categorySource: "fallback" });
    expect(out[1]).toMatchObject({ category: "other", categorySource: "llm" });
    expect(out[2]).toMatchObject({ category: "income", categorySource: "llm" });
  });

  it("skips transactions already categorised by rule or llm", async () => {
    const fetchFn = mockFetch(() => ({ results: [] }));
    const pre: Transaction = { ...tx("Foo Qux"), category: "travel", categorySource: "rule" };
    const out = await categoriseTransactions([pre], "de");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(out[0].category).toBe("travel");
  });
});

describe("categoriseTransactions: fallback", () => {
  it("falls back to other when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const progress = vi.fn();
    const out = await categoriseTransactions([tx("Foo Qux"), tx("Migros"), tx("Baz Qux")], "de", progress);
    expect(out.map((t) => t.category)).toEqual(["other", "groceries", "other"]);
    expect(out.map((t) => t.categorySource)).toEqual(["fallback", "rule", "fallback"]);
    expect(progress).toHaveBeenLastCalledWith(1, 1);
  });

  it("falls back on HTTP errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const out = await categoriseTransactions([tx("Foo Qux")], "de");
    expect(out[0]).toMatchObject({ category: "other", categorySource: "fallback" });
  });

  it("falls back on malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("bad json");
        },
      }),
    );
    const out = await categoriseTransactions([tx("Foo Qux")], "de");
    expect(out[0]).toMatchObject({ category: "other", categorySource: "fallback" });
  });

  it("falls back when the response has no results array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ error: "x" }) }));
    const out = await categoriseTransactions([tx("Foo Qux")], "de");
    expect(out[0].category).toBe("other");
  });

  it("falls back for descriptions without any letters", async () => {
    const fetchFn = mockFetch(() => ({ results: [] }));
    const out = await categoriseTransactions([tx("12345 / 678")], "de");
    expect(fetchFn).not.toHaveBeenCalled();
    expect(out[0]).toMatchObject({ category: "other", categorySource: "fallback" });
  });
});

describe("merchantKey and recategorise", () => {
  it("lower-cases and strips digits", () => {
    expect(merchantKey({ description: "x", counterparty: "Foo Qux 1234" })).toBe("foo qux");
    expect(merchantKey({ description: "Karte Nr. 99 Café Zeit" })).toBe("karte nr café zeit");
  });

  it("recategorises a single transaction", () => {
    const a = tx("Foo", -1, "Cafe Bar 1");
    const b = tx("Foo", -2, "Cafe Bar 2");
    const out = recategorise([a, b], a.id, "leisure");
    expect(out[0]).toMatchObject({ category: "leisure", categorySource: "rule" });
    expect(out[1].category).toBeUndefined();
    expect(a.category).toBeUndefined();
  });

  it("can apply to every transaction of the same merchant and sign", () => {
    const a = tx("Foo", -1, "Cafe Bar 1");
    const b = tx("Foo", -2, "Cafe Bar 2");
    const c = tx("Foo", 3, "Cafe Bar 3");
    const d = tx("Foo", -4, "Other Place");
    const out = recategorise([a, b, c, d], a.id, "leisure", true);
    expect(out.map((t) => t.category)).toEqual(["leisure", "leisure", undefined, undefined]);
    expect(out[1].categorySource).toBe("rule");
  });

  it("returns a copy for unknown ids", () => {
    const a = tx("Foo");
    const out = recategorise([a], "missing", "leisure");
    expect(out).toEqual([a]);
    expect(out).not.toBe(undefined);
  });
});
