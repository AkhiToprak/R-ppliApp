// ISO 20022 CAMT.052 / .053 / .054 parser (Swiss Payment Standards flavour).

import { XMLParser } from "fast-xml-parser";
import type { RawTransaction } from "./normalise";
import { StatementParseError } from "./errors";
import { parseAmount, parseDate } from "./values";

type Node = Record<string, unknown>;

const ARRAY_TAGS = new Set(["Stmt", "Ntfctn", "Rpt", "Ntry", "NtryDtls", "TxDtls", "Ustrd", "Strd", "AddtlTxInf"]);

export interface CamtParseOutput {
  transactions: RawTransaction[];
  bank?: string;
  currency?: string;
  warnings: string[];
}

function obj(v: unknown): Node | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Node) : undefined;
}

function arr(v: unknown): Node[] {
  if (v == null) return [];
  const list = Array.isArray(v) ? v : [v];
  return list.map((x) => (typeof x === "object" && x !== null ? (x as Node) : { "#text": x }));
}

function text(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v).trim();
  if (Array.isArray(v)) return v.map(text).filter(Boolean).join(" ");
  const o = v as Node;
  if ("#text" in o) return text(o["#text"]);
  return "";
}

function path(node: unknown, ...keys: string[]): unknown {
  let cur: unknown = node;
  for (const k of keys) {
    if (Array.isArray(cur)) cur = cur[0];
    const o = obj(cur);
    if (!o) return undefined;
    cur = o[k];
  }
  return cur;
}

function amountOf(node: unknown): { value: number; currency?: string } | null {
  if (node == null) return null;
  const o = obj(node);
  const raw = o ? text(o["#text"]) : text(node);
  const value = parseAmount(raw, ".");
  if (value === null) return null;
  const currency = o ? text(o["@_Ccy"]) || undefined : undefined;
  return { value: Math.abs(value), currency };
}

function dateOf(node: unknown): string | null {
  return parseDate(text(path(node, "Dt"))) ?? parseDate(text(path(node, "DtTm")));
}

/** Party name: camt.053.001.04 `Cdtr/Nm`, .001.08+ `Cdtr/Pty/Nm`. */
function partyName(parties: unknown, role: "Cdtr" | "Dbtr"): string {
  const ultimate = role === "Cdtr" ? "UltmtCdtr" : "UltmtDbtr";
  for (const key of [role, ultimate]) {
    const p = path(parties, key);
    const name = text(path(p, "Nm")) || text(path(p, "Pty", "Nm"));
    if (name) return name;
  }
  return "";
}

const BIC_BANKS: [RegExp, string][] = [
  [/^UBSW/, "UBS"],
  [/^POFI/, "PostFinance"],
  [/^RAIF/, "Raiffeisen"],
  [/^ZKBK/, "ZKB"],
  [/^CRES/, "Credit Suisse"],
  [/^MIGR/, "Migros Bank"],
  [/^BCVL/, "BCV"],
  [/^BCGE/, "BCGE"],
  [/^BSCT/, "BancaStato"],
  [/^SWQB/, "Swissquote"],
  [/^REVO/, "Revolut"],
  [/^HYPL/, "neon"],
];

// Swiss IBAN: CHkk IIIII … — institution id (clearing) at positions 5–9
function bankFromIban(iban: string): string | undefined {
  const m = /^CH\d{2}(\d{5})/.exec(iban.replace(/\s/g, ""));
  if (!m) return undefined;
  const iid = Number(m[1]);
  if (iid === 9000) return "PostFinance";
  if (iid === 700 || iid === 730) return "ZKB";
  if (iid >= 200 && iid <= 299) return "UBS";
  if (iid === 4835 || (iid >= 4000 && iid <= 4999)) return "Credit Suisse";
  if (iid >= 80000 && iid <= 82000) return "Raiffeisen";
  if (iid === 8401) return "Migros Bank";
  if (iid === 767) return "BCV";
  if (iid === 788) return "BCGE";
  if (iid === 764) return "BancaStato";
  if (iid === 8781) return "Swissquote";
  return undefined;
}

export function isCamtXml(text: string): boolean {
  const head = text.slice(0, 4000);
  return /camt\.0(5[234])/i.test(head) || /<(?:\w+:)?BkToCstmr(?:Stmt|DbtCdtNtfctn|AcctRpt)\b/.test(text.slice(0, 20000));
}

export function parseCamt(xml: string): CamtParseOutput {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNSPrefix: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => ARRAY_TAGS.has(name),
  });
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch (err) {
    throw new StatementParseError("unsupported_format", "Invalid XML.", { cause: err });
  }
  const document = obj(doc.Document) ?? doc;
  const root =
    obj(document.BkToCstmrStmt) ?? obj(document.BkToCstmrDbtCdtNtfctn) ?? obj(document.BkToCstmrAcctRpt);
  if (!root) throw new StatementParseError("unsupported_format", "XML is not an ISO 20022 camt.052/053/054 document.");

  const statements = [...arr(root.Stmt), ...arr(root.Ntfctn), ...arr(root.Rpt)];
  const warnings: string[] = [];
  const out: RawTransaction[] = [];
  let bank: string | undefined;
  let currency: string | undefined;
  let pending = 0;
  let mismatched = 0;

  for (const stmt of statements) {
    const acct = obj(stmt.Acct);
    currency ??= text(path(acct, "Ccy")) || undefined;
    if (!bank) {
      const bic = text(path(acct, "Svcr", "FinInstnId", "BICFI")) || text(path(acct, "Svcr", "FinInstnId", "BIC"));
      bank = BIC_BANKS.find(([re]) => re.test(bic))?.[1];
      bank ??= bankFromIban(text(path(acct, "Id", "IBAN")));
      bank ??= text(path(acct, "Svcr", "FinInstnId", "Nm")) || undefined;
    }

    for (const ntry of arr(stmt.Ntry)) {
      const status = text(path(ntry, "Sts", "Cd")) || text(ntry.Sts);
      if (status && !/^(BOOK|BOOKED)$/i.test(status)) {
        pending++;
        continue;
      }
      const amt = amountOf(ntry.Amt);
      if (!amt) {
        warnings.push("Skipped a CAMT entry without a readable amount.");
        continue;
      }
      const sign = text(ntry.CdtDbtInd).toUpperCase() === "DBIT" ? -1 : 1;
      const date = dateOf(ntry.BookgDt) ?? dateOf(ntry.ValDt);
      if (!date) {
        warnings.push("Skipped a CAMT entry without a booking date.");
        continue;
      }
      const entryCcy = amt.currency ?? currency;
      const addtl = text(ntry.AddtlNtryInf);
      const txs = arr(ntry.NtryDtls).flatMap((d) => arr(d.TxDtls));

      const describe = (tx: Node | undefined, txSign: number) => {
        const parties = tx ? tx.RltdPties : undefined;
        const name = parties ? partyName(parties, txSign < 0 ? "Cdtr" : "Dbtr") || partyName(parties, txSign < 0 ? "Dbtr" : "Cdtr") : "";
        const rmt = tx ? obj(tx.RmtInf) : undefined;
        const ustrd = rmt ? arr(rmt.Ustrd).map(text).filter(Boolean).join(" ") : "";
        const addtlTx = tx ? arr(tx.AddtlTxInf).map(text).filter(Boolean).join(" ") : "";
        const parts = [addtl, name, ustrd, addtlTx].filter((p, i, a) => p && a.indexOf(p) === i);
        return { description: parts.join("; "), counterparty: name || undefined };
      };

      const txAmount = (tx: Node) =>
        amountOf(tx.Amt) ?? amountOf(path(tx, "AmtDtls", "TxAmt", "Amt")) ?? amountOf(path(tx, "AmtDtls", "InstdAmt", "Amt"));

      if (txs.length > 1) {
        const parts = txs.map((tx) => ({ tx, amt: txAmount(tx) }));
        const ok =
          parts.every((p) => p.amt && (!p.amt.currency || !entryCcy || p.amt.currency === entryCcy)) &&
          Math.abs(parts.reduce((s, p) => s + (p.amt?.value ?? 0), 0) - amt.value) < 0.05;
        if (ok) {
          for (const { tx, amt: a } of parts) {
            const ind = text(tx.CdtDbtInd).toUpperCase();
            const txSign = ind === "DBIT" ? -1 : ind === "CRDT" ? 1 : sign;
            const { description, counterparty } = describe(tx, txSign);
            out.push({ date, amount: txSign * a!.value, currency: entryCcy, description, counterparty });
          }
          continue;
        }
        mismatched++;
      }
      const { description, counterparty } = describe(txs.length === 1 ? txs[0] : undefined, sign);
      out.push({ date, amount: sign * amt.value, currency: entryCcy, description: description || addtl, counterparty });
    }
  }

  if (pending) warnings.push(`Skipped ${pending} pending/information-only CAMT entr${pending === 1 ? "y" : "ies"}.`);
  if (mismatched) warnings.push(`${mismatched} batch entr${mismatched === 1 ? "y" : "ies"} kept as one total because the details did not add up.`);
  return { transactions: out, bank, currency, warnings };
}
