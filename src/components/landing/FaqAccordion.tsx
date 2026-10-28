"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useState } from "react";
import { Plus } from "lucide-react";
import clsx from "clsx";

export interface FaqItem {
  q: string;
  a: string;
  /** Optional short hints, e.g. per bank. */
  list?: { label: string; text: string }[];
}

/** Accordion: one item open at a time, height animates, fully keyboard operable. */
export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const reduce = useReducedMotion();
  const baseId = useId();

  return (
    <ul className="divide-y divide-ink/10 border-y border-ink/10">
      {items.map((item, i) => {
        const isOpen = open === i;
        const btnId = `${baseId}-q${i}`;
        const panelId = `${baseId}-a${i}`;
        return (
          <li key={item.q}>
            <h3>
              <button
                id={btnId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group focus-ring flex w-full items-center justify-between gap-6 rounded-2xl py-6 text-left sm:py-7"
              >
                <span className="font-display text-xl font-bold tracking-tight sm:text-2xl lg:text-[1.7rem]">{item.q}</span>
                <span
                  aria-hidden
                  className={clsx(
                    "grid size-11 shrink-0 place-items-center rounded-full transition-colors duration-300",
                    isOpen ? "bg-ink text-paper" : "bg-paper text-ink group-hover:bg-fog",
                  )}
                >
                  <Plus
                    className={clsx("size-5 transition-transform duration-300", isOpen && "rotate-45")}
                    strokeWidth={2.5}
                  />
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  key="panel"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: reduce ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="max-w-3xl pb-7 sm:pr-14 text-lg leading-relaxed text-ink/75">
                    <p>{item.a}</p>
                    {item.list && (
                      <dl className="mt-4 grid gap-x-6 gap-y-2 text-base sm:grid-cols-[auto_1fr]">
                        {item.list.map((row) => (
                          <div key={row.label} className="contents">
                            <dt className="font-bold text-ink">{row.label}</dt>
                            <dd className="mb-2 sm:mb-0">{row.text}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
