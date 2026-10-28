"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Search, X } from "lucide-react";
import clsx from "clsx";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatMoney } from "@/lib/i18n/core";
import { useLocale, useT } from "@/lib/i18n/client";
import { analyseMessages } from "@/lib/i18n/messages/analyse";
import { CATEGORY_IDS, type CategoryId, type Transaction } from "@/lib/types";
import { merchantKey } from "@/lib/categorise";
import { merchantName } from "./model";
import { Card, CardTitle, CategoryBadge, EASE_OUT } from "./ui";

const PAGE = 50;
type SortKey = "date" | "amount";

export function TransactionsTable({
  transactions,
  filter,
  onFilterChange,
  onRecategorise,
}: {
  transactions: Transaction[];
  filter: CategoryId | null;
  onFilterChange: (id: CategoryId | null) => void;
  onRecategorise: (txId: string, category: CategoryId, applyToMerchant: boolean) => void;
}) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [shown, setShown] = useState({ key: "", count: PAGE });
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [announce, setAnnounce] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);
  const searchId = useId();
  const selectId = useId();

  const label = (id: CategoryId) => CATEGORIES[id].label[locale];

  const present = useMemo(() => {
    const set = new Set<CategoryId>(transactions.map((tx) => tx.category ?? "other"));
    if (filter) set.add(filter);
    const name = (id: CategoryId) => CATEGORIES[id].label[locale];
    return [...set].sort((a, b) => name(a).localeCompare(name(b), locale));
  }, [transactions, filter, locale]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = transactions.filter(
      (tx) =>
        (!filter || (tx.category ?? "other") === filter) &&
        (!q || tx.description.toLowerCase().includes(q) || (tx.counterparty ?? "").toLowerCase().includes(q)),
    );
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) =>
      sort.key === "date" ? dir * a.date.localeCompare(b.date) || dir * (a.amount - b.amount) : dir * (a.amount - b.amount),
    );
  }, [transactions, filter, query, sort]);

  const pageKey = `${filter ?? ""}|${query}|${sort.key}|${sort.dir}`;
  const count = shown.key === pageKey ? shown.count : PAGE;
  const visible = rows.slice(0, count);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const sameMerchant = editing
    ? transactions.filter((tx) => tx.amount > 0 === editing.amount > 0 && merchantKey(tx) === merchantKey(editing)).length
    : 0;

  const closeDialog = () => {
    setEditing(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  };

  return (
    <Card id="transactions" labelledBy="tx-title" className="scroll-mt-24">
      <CardTitle id="tx-title" aside={<p className="text-sm text-muted tabular-nums">{t("txResults", { count: rows.length })}</p>}>
        {t("txTitle")}
      </CardTitle>

      {/* Filters: one row above the table */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label htmlFor={searchId} className="relative flex-1">
          <span className="sr-only">{t("txSearch")}</span>
          <Search size={17} aria-hidden className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("txSearch")}
            autoComplete="off"
            className="w-full rounded-full border border-transparent bg-paper py-3 pr-4 pl-11 text-sm outline-none placeholder:text-muted focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-coin/40"
          />
        </label>
        <div className="relative sm:w-64">
          <label htmlFor={selectId} className="sr-only">
            {t("txColCategory")}
          </label>
          <select
            id={selectId}
            value={filter ?? ""}
            onChange={(e) => onFilterChange((e.target.value || null) as CategoryId | null)}
            className={clsx(
              "w-full appearance-none rounded-full border py-3 pr-10 pl-4 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-coin/40",
              filter ? "border-ink bg-ink text-paper" : "border-transparent bg-paper",
            )}
          >
            <option value="">{t("txAllCategories")}</option>
            {present.map((id) => (
              <option key={id} value={id}>
                {label(id)}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden className={clsx("pointer-events-none absolute top-1/2 right-4 -translate-y-1/2", filter && "text-paper")} />
        </div>
        {(filter || query) && (
          <button
            type="button"
            onClick={() => {
              onFilterChange(null);
              setQuery("");
            }}
            className="inline-flex items-center gap-1.5 self-start rounded-full px-3 py-2 text-sm font-semibold text-muted hover:text-ink focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none sm:self-auto"
          >
            <X size={15} aria-hidden />
            {t("txClearFilter")}
          </button>
        )}
      </div>

      <div className="-mx-2 overflow-x-auto px-2 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[40rem] border-separate border-spacing-y-1.5 text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <SortHeader label={t("txColDate")} active={sort.key === "date"} dir={sort.dir} onClick={() => toggleSort("date")} sortLabel={t("txSortBy", { col: t("txColDate") })} />
              <th scope="col" className="px-3 py-2 font-semibold">{t("txColDesc")}</th>
              <th scope="col" className="px-3 py-2 font-semibold">{t("txColCategory")}</th>
              <SortHeader
                label={t("txColAmount")}
                active={sort.key === "amount"}
                dir={sort.dir}
                onClick={() => toggleSort("amount")}
                sortLabel={t("txSortBy", { col: t("txColAmount") })}
                align="right"
              />
            </tr>
          </thead>
          <LayoutGroup>
            <tbody>
              {visible.map((tx) => {
                const cat = tx.category ?? "other";
                return (
                  <motion.tr key={tx.id} layout="position" transition={{ duration: 0.35, ease: EASE_OUT }} className="bg-paper">
                    <td className="rounded-l-2xl px-3 py-3 whitespace-nowrap text-muted tabular-nums">{formatDate(tx.date, locale)}</td>
                    <td className="max-w-[18rem] px-3 py-3">
                      <p className="truncate font-semibold" title={merchantName(tx)}>{merchantName(tx)}</p>
                      {tx.counterparty && tx.description !== tx.counterparty && (
                        <p className="truncate text-xs text-muted" title={tx.description}>{tx.description}</p>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={(e) => {
                          triggerRef.current = e.currentTarget;
                          setEditing(tx);
                        }}
                        aria-haspopup="dialog"
                        aria-label={t("recatAria", { name: merchantName(tx), category: label(cat) })}
                        className="group inline-flex max-w-[14rem] items-center gap-1.5 rounded-full py-1 pr-2 pl-2.5 text-xs font-semibold text-ink transition hover:ring-2 hover:ring-ink/20 focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none"
                        style={{ background: `${CATEGORIES[cat].color}26` }}
                      >
                        <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: CATEGORIES[cat].color }} />
                        <motion.span key={cat} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="truncate">
                          {label(cat)}
                        </motion.span>
                        <ChevronDown size={13} aria-hidden className="shrink-0 opacity-50 group-hover:opacity-100" />
                      </button>
                    </td>
                    <td
                      className={clsx(
                        "rounded-r-2xl px-3 py-3 text-right font-bold whitespace-nowrap tabular-nums",
                        tx.amount > 0 && "text-emerald-700",
                      )}
                    >
                      {formatMoney(tx.amount, locale, { currency: tx.currency, sign: tx.amount > 0 })}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </LayoutGroup>
        </table>
      </div>

      {rows.length === 0 && <p className="py-8 text-center text-sm text-muted">{t("txEmpty")}</p>}

      {rows.length > count && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setShown({ key: pageKey, count: count + PAGE })}
            className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-paper transition hover:bg-ink-soft focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none active:scale-[0.98]"
          >
            {t("txShowMore", { count: Math.min(PAGE, rows.length - count) })}
          </button>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <AnimatePresence>
        {editing && (
          <CategoryDialog
            key="dialog"
            tx={editing}
            sameMerchant={sameMerchant}
            onClose={closeDialog}
            onPick={(category, applyAll) => {
              onRecategorise(editing.id, category, applyAll);
              setAnnounce(`${t("recatDone")} ${label(category)}`);
              closeDialog();
            }}
          />
        )}
      </AnimatePresence>
    </Card>
  );
}

function SortHeader({
  label,
  sortLabel,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortLabel: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={clsx("px-3 py-2 font-semibold", align === "right" && "text-right")}
    >
      <button
        type="button"
        onClick={onClick}
        title={sortLabel}
        className={clsx(
          "inline-flex items-center gap-1 rounded-full px-1 py-0.5 hover:text-ink focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none",
          active && "text-ink",
        )}
      >
        {label}
        <Icon size={13} aria-hidden />
      </button>
    </th>
  );
}

/* ---------------------------------------------------------------- dialog */

function CategoryDialog({
  tx,
  sameMerchant,
  onClose,
  onPick,
}: {
  tx: Transaction;
  sameMerchant: number;
  onClose: () => void;
  onPick: (category: CategoryId, applyAll: boolean) => void;
}) {
  const t = useT(analyseMessages);
  const locale = useLocale();
  const [applyAll, setApplyAll] = useState(sameMerchant > 1);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const current = tx.category ?? "other";
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("[data-current='true']")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
      if (e.key === "Tab" && panelRef.current) {
        // Minimal focus trap.
        const els = panelRef.current.querySelectorAll<HTMLElement>("button, input");
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 60 }}
        transition={{ type: "spring", stiffness: 420, damping: 36 }}
        className="relative flex max-h-[88dvh] w-full flex-col rounded-t-[2rem] bg-paper p-5 shadow-2xl sm:max-w-xl sm:rounded-[2rem] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-2xl font-extrabold">
              {t("recatTitle")}
            </h2>
            <p className="mt-1 truncate text-sm text-muted">
              {merchantName(tx)} · {formatMoney(tx.amount, locale, { currency: tx.currency })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-mist hover:bg-fog focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none"
          >
            <X size={18} aria-hidden />
          </button>
        </div>

        {sameMerchant > 1 && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-mist px-4 py-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={applyAll}
              onChange={(e) => setApplyAll(e.target.checked)}
              className="size-5 shrink-0 accent-ink"
            />
            <span className="min-w-0">
              {t("recatApplyAll", { merchant: merchantName(tx) })} <span className="font-normal text-muted">({sameMerchant})</span>
            </span>
          </label>
        )}

        <ul className="-mx-1 mt-4 grid grid-cols-1 gap-1.5 overflow-y-auto px-1 pb-1 min-[420px]:grid-cols-2">
          {CATEGORY_IDS.map((id) => (
            <li key={id}>
              <button
                type="button"
                data-current={id === current}
                aria-pressed={id === current}
                onClick={() => onPick(id, applyAll)}
                className={clsx(
                  "flex w-full items-center gap-3 rounded-2xl p-2 text-left text-sm font-semibold transition focus-visible:ring-4 focus-visible:ring-coin focus-visible:outline-none",
                  id === current ? "bg-mist ring-2 ring-ink" : "hover:bg-mist",
                )}
              >
                <CategoryBadge id={id} size={32} />
                <span className="min-w-0 truncate">{CATEGORIES[id].label[locale]}</span>
              </button>
            </li>
          ))}
        </ul>
      </motion.div>
    </div>
  );
}
