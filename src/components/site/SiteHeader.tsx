// CONTRACT (owned by the landing agent): sticky top bar with RappliLogo,
// language switcher (keeps the current path, swaps the /{locale} prefix) and CTA.
// `variant="dark"` = white-on-ink for black hero sections.
export function SiteHeader({ variant = "light" }: { variant?: "light" | "dark"; showCta?: boolean }) {
  return <header data-variant={variant} />;
}
