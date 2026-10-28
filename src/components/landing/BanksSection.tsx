import type { LandingT } from "@/lib/i18n/messages/landing";
import { Reveal } from "./Reveal";

export function BanksSection({ t }: { t: LandingT }) {
  const banks = [
    "UBS",
    "PostFinance",
    "Raiffeisen",
    "ZKB",
    t("bankCantonal"),
    "Migros Bank",
    "Valiant",
    "Revolut",
    "neon",
    "Yuh",
  ];
  const formats = [
    { name: "CSV", ext: ".csv", text: t("fmtCsvText"), tint: "var(--color-mint)" },
    { name: "CAMT.053", ext: "XML", text: t("fmtCamtText"), tint: "var(--color-sky)" },
    { name: "Excel", ext: ".xlsx", text: t("fmtXlsxText"), tint: "var(--color-sun)" },
    { name: "PDF", ext: ".pdf", text: t("fmtPdfText"), tint: "var(--color-pink)" },
  ];

  return (
    <section id="banks" aria-labelledby="banks-title" className="scroll-mt-20 bg-paper py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.15fr] lg:gap-20">
          <Reveal>
            <h2
              id="banks-title"
              className="font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance"
            >
              {t("banksTitle")}
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted">{t("banksLead")}</p>
          </Reveal>

          <Reveal delay={0.1} className="lg:pt-4">
            <ul className="flex flex-wrap gap-2.5 sm:gap-3">
              {banks.map((b) => (
                <li
                  key={b}
                  className="rounded-full bg-mist px-5 py-3 font-display text-xl font-bold tracking-tight sm:px-6 sm:py-3.5 sm:text-2xl"
                >
                  {b}
                </li>
              ))}
              <li className="rounded-full px-5 py-3 text-lg font-semibold text-muted ring-1 ring-ink/15 ring-inset sm:py-3.5">
                {t("bankMore")}
              </li>
            </ul>
          </Reveal>
        </div>

        <h3 className="mt-20 font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:mt-28">{t("formatsTitle")}</h3>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {formats.map((f, i) => (
            <li key={f.name}>
              <Reveal delay={i * 0.08} className="h-full">
                <div
                  className="flex h-full flex-col rounded-[2rem] p-7"
                  style={{ background: `color-mix(in oklab, ${f.tint} 18%, white)` }}
                >
                  <span className="w-fit rounded-full bg-paper px-3 py-1 text-xs font-bold text-ink/70">{f.ext}</span>
                  <p className="mt-10 font-display text-4xl font-extrabold tracking-[-0.04em] sm:text-5xl lg:text-4xl xl:text-5xl">{f.name}</p>
                  <p className="mt-3 leading-relaxed text-ink/70">{f.text}</p>
                </div>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
