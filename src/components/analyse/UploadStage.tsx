"use client";

import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronDown, CloudUpload, Download, EyeOff, Lock, MonitorSmartphone, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import { RappliCoin } from "@/components/brand/RappliCoin";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import { EASE_OUT, staggerChild, staggerParent } from "./ui";

const ACCEPT = ".csv,.txt,.xml,.xlsx,.xls,.pdf";

const BANK_HINTS = [
  { bank: "UBS", key: "hintUbs" },
  { bank: "PostFinance", key: "hintPostfinance" },
  { bank: "Raiffeisen", key: "hintRaiffeisen" },
  { bank: "ZKB", key: "hintZkb" },
  { bank: "Revolut", key: "hintRevolut" },
  { bank: "neon / Yuh", key: "hintNeonYuh" },
] as const;

export function UploadStage({ onFile, onSample }: { onFile: (file: File) => void; onSample: () => void }) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [hintsOpen, setHintsOpen] = useState(false);
  const hintsId = useId();
  const dragDepth = useRef(0);

  const pick = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <motion.div variants={staggerParent} initial="hidden" animate="show" className="space-y-6 sm:space-y-8">
      <motion.header variants={staggerChild} className="max-w-4xl">
        <h1 className="font-display text-[2.6rem] leading-[0.95] font-extrabold tracking-tight text-balance sm:text-6xl lg:text-7xl">
          {t("uploadTitle")}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted sm:mt-6 sm:text-xl">{t("uploadLead")}</p>
      </motion.header>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-12">
        {/* Drop zone */}
        <motion.div variants={staggerChild} className="lg:col-span-7">
          <div
            role="button"
            tabIndex={0}
            aria-label={t("dropAria")}
            onClick={() => inputRef.current?.click()}
            onKeyDown={onKeyDown}
            onDragEnter={(e) => {
              e.preventDefault();
              dragDepth.current++;
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => {
              dragDepth.current = Math.max(0, dragDepth.current - 1);
              if (dragDepth.current === 0) setDragging(false);
            }}
            onDrop={onDrop}
            className={clsx(
              "group relative isolate flex min-h-[22rem] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-[2.5rem] px-6 py-10 text-center transition-colors duration-300 outline-none sm:min-h-[26rem]",
              "focus-visible:ring-4 focus-visible:ring-coin focus-visible:ring-offset-4",
              dragging ? "bg-ink text-paper" : "bg-mist text-ink hover:bg-fog/70",
            )}
          >
            {/* Animated rainbow rim while dragging */}
            <span
              aria-hidden
              className={clsx(
                "pointer-events-none absolute inset-0 -z-10 rounded-[2.5rem] transition-opacity duration-300",
                dragging ? "opacity-100" : "opacity-0",
              )}
            >
              <span className="absolute inset-0 rounded-[2.5rem] bg-rainbow" />
              <span className="absolute inset-[5px] rounded-[2.2rem] bg-ink" />
            </span>
            <span
              aria-hidden
              className={clsx(
                "pointer-events-none absolute inset-3 rounded-[2rem] border-2 border-dashed transition-colors sm:inset-4",
                dragging ? "border-transparent" : "border-ink/15 group-hover:border-ink/30",
              )}
            />

            <motion.span
              aria-hidden
              className="mb-6 block"
              animate={dragging ? { y: -10, rotate: -12, scale: 1.12 } : { y: [0, -12, 0], rotate: [0, 4, 0], scale: 1 }}
              transition={
                dragging
                  ? { type: "spring", stiffness: 300, damping: 15 }
                  : { duration: 4.5, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <RappliCoin size={112} animated />
            </motion.span>

            <span className="font-display text-2xl leading-tight font-extrabold sm:text-3xl">
              {dragging ? t("dropActive") : t("dropTitle")}
            </span>
            <span className={clsx("mt-2 text-sm", dragging ? "text-paper/70" : "text-muted")}>{t("dropOr")}</span>
            <span
              aria-hidden
              className={clsx(
                "mt-3 inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold transition-transform group-hover:scale-[1.03]",
                dragging ? "bg-paper text-ink" : "bg-ink text-paper",
              )}
            >
              <CloudUpload size={18} />
              {t("dropBrowse")}
            </span>
            <span className={clsx("mt-5 text-sm", dragging ? "text-paper/70" : "text-muted")}>{t("dropFormats")}</span>

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPT}
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                pick(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onSample}
              className="inline-flex items-center gap-2 rounded-full bg-coin px-6 py-3 font-semibold text-ink transition hover:bg-coin-light focus-visible:ring-4 focus-visible:ring-ink/30 focus-visible:outline-none active:scale-[0.98]"
            >
              <Sparkles size={18} aria-hidden />
              {t("sampleButton")}
            </button>
            <a
              href="/samples/beispiel-kontoauszug.csv"
              download
              className="inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold text-ink underline-offset-4 hover:underline focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none"
            >
              <Download size={16} aria-hidden />
              {t("sampleDownload")}
            </a>
          </div>
        </motion.div>

        {/* Privacy */}
        <motion.aside
          variants={staggerChild}
          aria-labelledby="privacy-title"
          className="relative overflow-hidden rounded-[2.5rem] bg-ink p-7 text-paper sm:p-9 lg:col-span-5"
        >
          <h2 id="privacy-title" className="relative font-display text-3xl font-extrabold sm:text-4xl">
            {t("privacyTitle")}
          </h2>
          <ul className="relative mt-6 space-y-5">
            {[
              { icon: Lock, text: t("privacyNoLogin") },
              { icon: MonitorSmartphone, text: t("privacyBrowser") },
              { icon: EyeOff, text: t("privacyServer") },
              { icon: X, text: t("privacyGone") },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-paper/10">
                  <Icon size={18} aria-hidden className="text-coin-light" />
                </span>
                <span className="pt-2 text-paper/85">{text}</span>
              </li>
            ))}
          </ul>
        </motion.aside>
      </div>

      {/* Export hints */}
      <motion.section variants={staggerChild} className="rounded-[2rem] border border-fog">
        <h2>
          <button
            type="button"
            aria-expanded={hintsOpen}
            aria-controls={hintsId}
            onClick={() => setHintsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-4 rounded-[2rem] px-6 py-5 text-left font-display text-xl font-bold focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none sm:px-8 sm:text-2xl"
          >
            {t("exportHintsTitle")}
            <motion.span animate={{ rotate: hintsOpen ? 180 : 0 }} className="grid size-10 shrink-0 place-items-center rounded-full bg-mist">
              <ChevronDown size={20} aria-hidden />
            </motion.span>
          </button>
        </h2>
        <AnimatePresence initial={false}>
          {hintsOpen && (
            <motion.div
              id={hintsId}
              key="hints"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="px-6 pb-7 sm:px-8">
                <p className="max-w-2xl text-muted">{t("exportHintsLead")}</p>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" lang={locale}>
                  {BANK_HINTS.map(({ bank, key }) => (
                    <div key={bank} className="rounded-3xl bg-mist p-5">
                      <dt className="font-display text-lg font-bold">{bank}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-ink/75">{t(key)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </motion.div>
  );
}
