import { describe, expect, it } from "vitest";
import { parseStatementData } from "./index";

const CAMT053 = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.04">
  <BkToCstmrStmt>
    <GrpHdr><MsgId>MSG1</MsgId><CreDtTm>2026-08-01T06:00:00</CreDtTm></GrpHdr>
    <Stmt>
      <Id>STMT1</Id>
      <Acct>
        <Id><IBAN>CH9300762011623852957</IBAN></Id>
        <Ccy>CHF</Ccy>
        <Svcr><FinInstnId><BICFI>ZKBKCHZZ80A</BICFI></FinInstnId></Svcr>
      </Acct>
      <Ntry>
        <Amt Ccy="CHF">6800.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-07-25</Dt></BookgDt>
        <ValDt><Dt>2026-07-25</Dt></ValDt>
        <AddtlNtryInf>Gutschrift</AddtlNtryInf>
        <NtryDtls><TxDtls>
          <Amt Ccy="CHF">6800.00</Amt>
          <CdtDbtInd>CRDT</CdtDbtInd>
          <RltdPties><Dbtr><Nm>Alpenblick Software AG</Nm></Dbtr><Cdtr><Nm>Max Muster</Nm></Cdtr></RltdPties>
          <RmtInf><Ustrd>Lohn Juli 2026</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">45.30</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-07-03</Dt></BookgDt>
        <ValDt><Dt>2026-07-03</Dt></ValDt>
        <AddtlNtryInf>Einkauf ZKB Visa Debit Karte Nr. xxxx 1234, MIGROS M ZUERICH HB ZUERICH</AddtlNtryInf>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">300.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>BOOK</Sts>
        <BookgDt><Dt>2026-07-05</Dt></BookgDt>
        <AddtlNtryInf>Sammelauftrag E-Banking</AddtlNtryInf>
        <NtryDtls>
          <Btch><NbOfTxs>2</NbOfTxs></Btch>
          <TxDtls>
            <AmtDtls><TxAmt><Amt Ccy="CHF">100.00</Amt></TxAmt></AmtDtls>
            <CdtDbtInd>DBIT</CdtDbtInd>
            <RltdPties><Cdtr><Nm>Swisscom (Schweiz) AG</Nm></Cdtr></RltdPties>
            <RmtInf><Ustrd>Rechnung 07/2026</Ustrd></RmtInf>
          </TxDtls>
          <TxDtls>
            <Amt Ccy="CHF">200.00</Amt>
            <CdtDbtInd>DBIT</CdtDbtInd>
            <RltdPties><Cdtr><Pty><Nm>Sunrise GmbH</Nm></Pty></Cdtr></RltdPties>
          </TxDtls>
        </NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="CHF">10.00</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <Sts>PDNG</Sts>
        <BookgDt><Dt>2026-07-31</Dt></BookgDt>
      </Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

const enc = (s: string) => new TextEncoder().encode(s);

describe("CAMT.053", () => {
  it("parses entries, signs, parties and batch details", async () => {
    const res = await parseStatementData(enc(CAMT053), "statement.xml");
    expect(res.format).toBe("camt");
    expect(res.bank).toBe("ZKB");
    expect(res.currency).toBe("CHF");
    expect(res.transactions.map((t) => [t.date, t.amount, t.counterparty])).toEqual([
      ["2026-07-03", -45.3, "Migros Zürich HB"],
      ["2026-07-05", -100, "Swisscom (Schweiz) AG"],
      ["2026-07-05", -200, "Sunrise GmbH"],
      ["2026-07-25", 6800, "Alpenblick Software AG"],
    ]);
    expect(res.transactions[3].description).toContain("Lohn Juli 2026");
    expect(res.warnings.join(" ")).toMatch(/pending/);
  });

  it("keeps a batch as one entry when the details do not add up", async () => {
    const res = await parseStatementData(enc(CAMT053.replace("<Amt Ccy=\"CHF\">200.00</Amt>", "<Amt Ccy=\"CHF\">150.00</Amt>")), "s.xml");
    expect(res.transactions.some((t) => t.amount === -300)).toBe(true);
  });

  it("detects CAMT by content regardless of extension (camt.054, namespace prefixes)", async () => {
    const camt054 = `<?xml version="1.0"?>
<ns:Document xmlns:ns="urn:iso:std:iso:20022:tech:xsd:camt.054.001.08">
 <ns:BkToCstmrDbtCdtNtfctn><ns:Ntfctn>
  <ns:Acct><ns:Id><ns:IBAN>CH5604835012345678009</ns:IBAN></ns:Id></ns:Acct>
  <ns:Ntry>
   <ns:Amt Ccy="CHF">12.00</ns:Amt><ns:CdtDbtInd>DBIT</ns:CdtDbtInd>
   <ns:Sts><ns:Cd>BOOK</ns:Cd></ns:Sts>
   <ns:BookgDt><ns:DtTm>2026-07-09T10:00:00</ns:DtTm></ns:BookgDt>
   <ns:AddtlNtryInf>TWINT *Kafi Dihei</ns:AddtlNtryInf>
  </ns:Ntry>
 </ns:Ntfctn></ns:BkToCstmrDbtCdtNtfctn>
</ns:Document>`;
    const res = await parseStatementData(enc(camt054), "notification.txt");
    expect(res.format).toBe("camt");
    expect(res.bank).toBe("Credit Suisse");
    expect(res.transactions).toHaveLength(1);
    expect(res.transactions[0]).toMatchObject({ date: "2026-07-09", amount: -12, counterparty: "Kafi Dihei" });
  });

  it("rejects non-CAMT XML", async () => {
    await expect(parseStatementData(enc("<?xml version='1.0'?><foo/>"), "x.xml")).rejects.toMatchObject({
      code: "unsupported_format",
    });
  });
});
