import clsx from "clsx";
import type { CategoryId } from "@/lib/types";
import type { LandingT } from "@/lib/i18n/messages/landing";
import { CATEGORIES } from "@/lib/categories";
import { Reveal } from "./Reveal";

const ROW_A: [string, CategoryId][] = [
  ["Migros", "groceries"],
  ["Coop", "groceries"],
  ["SBB", "transport"],
  ["Swisscom", "telecom"],
  ["Galaxus", "shopping"],
  ["Denner", "groceries"],
  ["CSS", "insurance"],
  ["Netflix", "subscriptions"],
  ["ZVV", "transport"],
  ["Volg", "groceries"],
  ["Ochsner Sport", "leisure"],
  ["Uber Eats", "restaurants"],
];
const ROW_B: [string, CategoryId][] = [
  ["Digitec", "shopping"],
  ["Helsana", "insurance"],
  ["Lidl", "groceries"],
  ["Spotify", "subscriptions"],
  ["Manor", "shopping"],
  ["Aldi", "groceries"],
  ["Zalando", "shopping"],
  ["Sunrise", "telecom"],
  ["BLS", "transport"],
  ["Interdiscount", "shopping"],
  ["Coop Pronto", "groceries"],
  ["Mobility", "car"],
];

function Row({ items, reverse }: { items: [string, CategoryId][]; reverse?: boolean }) {
  // Content is rendered twice; the keyframes shift by -50% for a seamless loop.
  return (
    <div className="mask-fade-x flex overflow-hidden">
      <ul
        className={clsx(
          "flex w-max shrink-0 animate-marquee gap-3 pr-3 hover:[animation-play-state:paused]",
          reverse && "[animation-direction:reverse] [animation-duration:38s]",
        )}
      >
        {[...items, ...items].map(([name, cat], i) => (
          <li
            key={`${name}-${i}`}
            aria-hidden={i >= items.length ? true : undefined}
            className="flex items-center gap-3 rounded-full bg-paper py-3 pr-6 pl-3 ring-1 ring-ink/[0.07]"
          >
            <span className="size-3 rounded-full" style={{ background: CATEGORIES[cat].color }} />
            <span className="font-display text-xl font-bold tracking-tight whitespace-nowrap sm:text-2xl">{name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MerchantMarquee({ t }: { t: LandingT }) {
  return (
    <section aria-labelledby="merchants-title" className="bg-mist py-20 sm:py-24">
      <Reveal className="mx-auto mb-10 flex max-w-7xl flex-col gap-4 px-4 sm:px-6 md:flex-row md:items-end md:justify-between lg:px-8">
        <h2
          id="merchants-title"
          className="font-display text-[clamp(2.4rem,5vw,4rem)] leading-[0.95] font-extrabold tracking-[-0.04em]"
        >
          {t("merchantsTitle")}
        </h2>
        <p className="max-w-md text-lg leading-relaxed text-muted">{t("merchantsLead")}</p>
      </Reveal>
      <div className="space-y-3">
        <Row items={ROW_A} />
        <Row items={ROW_B} reverse />
      </div>
    </section>
  );
}
