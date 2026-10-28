import type { LandingT } from "@/lib/i18n/messages/landing";
import { Reveal } from "./Reveal";

// Each step takes a slice of the rainbow, so together they read as one gradient.
const STEP_GRADIENTS = [
  "linear-gradient(160deg, var(--color-pink), var(--color-orange))",
  "linear-gradient(160deg, var(--color-orange), var(--color-sun))",
  "linear-gradient(160deg, var(--color-mint), var(--color-sky))",
];

export function HowItWorks({ t }: { t: LandingT }) {
  const steps = [
    { title: t("step1Title"), text: t("step1Text") },
    { title: t("step2Title"), text: t("step2Text") },
    { title: t("step3Title"), text: t("step3Text") },
  ];

  return (
    <section id="how" aria-labelledby="how-title" className="scroll-mt-20 bg-paper py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2
            id="how-title"
            className="max-w-4xl font-display text-[clamp(2.75rem,7vw,6rem)] leading-[0.92] font-extrabold tracking-[-0.045em] text-balance"
          >
            {t("howTitle")}
          </h2>
        </Reveal>

        <ol className="mt-16 grid gap-4 md:grid-cols-3 lg:mt-24 lg:gap-6">
          {steps.map((s, i) => (
            <li key={s.title}>
              <Reveal delay={i * 0.14} className="flex h-full flex-col rounded-[2rem] bg-mist p-7 sm:p-9">
                <span
                  aria-hidden
                  className="-mt-2 block bg-clip-text font-display text-[8rem] leading-[0.8] font-extrabold tracking-[-0.06em] text-transparent sm:text-[10rem]"
                  style={{ backgroundImage: STEP_GRADIENTS[i] }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-10 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{s.title}</h3>
                <p className="mt-3 max-w-sm text-lg leading-relaxed text-muted">{s.text}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
