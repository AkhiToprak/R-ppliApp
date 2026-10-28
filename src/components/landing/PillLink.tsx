import Link from "next/link";
import { ArrowRight } from "lucide-react";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

type Tone = "ink" | "paper" | "outline-dark" | "outline-light";

const TONES: Record<Tone, { pill: string; dot: string }> = {
  ink: { pill: "bg-ink text-paper hover:bg-ink-soft", dot: "bg-paper text-ink" },
  paper: { pill: "bg-paper text-ink hover:bg-mist", dot: "bg-ink text-paper" },
  "outline-dark": {
    pill: "text-paper ring-1 ring-inset ring-paper/30 hover:bg-paper/10 hover:ring-paper/60",
    dot: "bg-paper/15 text-paper",
  },
  "outline-light": {
    pill: "text-ink ring-1 ring-inset ring-ink/20 hover:bg-ink/5 hover:ring-ink/50",
    dot: "bg-ink/10 text-ink",
  },
};

/**
 * Pill-shaped call to action. The arrow sits in its own disc and nudges right on
 * hover / keyboard focus — the one micro-interaction every button shares.
 */
export function PillLink({
  href,
  children,
  tone = "ink",
  size = "lg",
  arrow = true,
  className,
  ...rest
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  size?: "md" | "lg";
  arrow?: boolean;
  className?: string;
} & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  const t = TONES[tone];
  return (
    <Link
      href={href}
      className={clsx(
        "group focus-ring inline-flex items-center justify-center gap-3 rounded-full font-semibold whitespace-nowrap transition-colors duration-200",
        size === "lg" ? "h-14 pl-7 text-base sm:h-16 sm:text-lg" : "h-11 pl-5 text-sm",
        arrow ? (size === "lg" ? "pr-2" : "pr-1.5") : size === "lg" ? "pr-7" : "pr-5",
        t.pill,
        className,
      )}
      {...rest}
    >
      <span>{children}</span>
      {arrow && (
        <span
          aria-hidden
          className={clsx(
            "grid shrink-0 place-items-center rounded-full",
            size === "lg" ? "size-10 sm:size-12" : "size-8",
            t.dot,
          )}
        >
          <ArrowRight
            className={clsx(
              "transition-transform duration-300 ease-out group-hover:translate-x-1 group-focus-visible:translate-x-1 motion-reduce:transition-none",
              size === "lg" ? "size-5" : "size-4",
            )}
            strokeWidth={2.5}
          />
        </span>
      )}
    </Link>
  );
}
