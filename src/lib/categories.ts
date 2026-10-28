import type { CategoryId, Locale } from "@/lib/types";

export interface CategoryMeta {
  /** Chart / chip colour. */
  color: string;
  /** lucide-react icon name (PascalCase). */
  icon: string;
  label: Record<Locale, string>;
}

export const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  groceries: { color: "#ff7a1a", icon: "ShoppingBasket", label: { de: "Lebensmittel", fr: "Alimentation", it: "Spesa alimentare", en: "Groceries" } },
  restaurants: { color: "#ff3d8b", icon: "UtensilsCrossed", label: { de: "Restaurants & Take-away", fr: "Restaurants & à l'emporter", it: "Ristoranti & take-away", en: "Restaurants & take-away" } },
  transport: { color: "#1fb6ff", icon: "TrainFront", label: { de: "ÖV & Mobilität", fr: "Transports publics & mobilité", it: "Trasporti pubblici & mobilità", en: "Public transport & mobility" } },
  car: { color: "#3d5afe", icon: "Car", label: { de: "Auto & Benzin", fr: "Voiture & essence", it: "Auto & benzina", en: "Car & fuel" } },
  housing: { color: "#7b5cff", icon: "House", label: { de: "Wohnen & Miete", fr: "Logement & loyer", it: "Abitazione & affitto", en: "Housing & rent" } },
  utilities: { color: "#00a5a8", icon: "PlugZap", label: { de: "Energie & Nebenkosten", fr: "Énergie & charges", it: "Energia & spese accessorie", en: "Energy & utilities" } },
  telecom: { color: "#5ac8fa", icon: "Smartphone", label: { de: "Handy & Internet", fr: "Mobile & internet", it: "Cellulare & internet", en: "Phone & internet" } },
  insurance: { color: "#8e8ea0", icon: "ShieldCheck", label: { de: "Versicherungen", fr: "Assurances", it: "Assicurazioni", en: "Insurance" } },
  health: { color: "#19d3a2", icon: "HeartPulse", label: { de: "Gesundheit", fr: "Santé", it: "Salute", en: "Health" } },
  shopping: { color: "#ffc800", icon: "ShoppingBag", label: { de: "Shopping", fr: "Shopping", it: "Shopping", en: "Shopping" } },
  leisure: { color: "#ff5c5c", icon: "Ticket", label: { de: "Freizeit & Sport", fr: "Loisirs & sport", it: "Tempo libero & sport", en: "Leisure & sport" } },
  subscriptions: { color: "#c04dff", icon: "Repeat", label: { de: "Abos & Streaming", fr: "Abonnements & streaming", it: "Abbonamenti & streaming", en: "Subscriptions & streaming" } },
  travel: { color: "#00c2ff", icon: "Plane", label: { de: "Reisen & Ferien", fr: "Voyages & vacances", it: "Viaggi & vacanze", en: "Travel & holidays" } },
  education: { color: "#4caf50", icon: "GraduationCap", label: { de: "Bildung", fr: "Formation", it: "Formazione", en: "Education" } },
  children: { color: "#ff9ec7", icon: "Baby", label: { de: "Kinder & Familie", fr: "Enfants & famille", it: "Bambini & famiglia", en: "Kids & family" } },
  taxes: { color: "#b07d00", icon: "Landmark", label: { de: "Steuern & Gebühren", fr: "Impôts & taxes", it: "Imposte & tasse", en: "Taxes & levies" } },
  fees: { color: "#6b6b78", icon: "Receipt", label: { de: "Bankspesen", fr: "Frais bancaires", it: "Spese bancarie", en: "Bank fees" } },
  cash: { color: "#a0a0b0", icon: "Banknote", label: { de: "Bargeld", fr: "Espèces", it: "Contanti", en: "Cash" } },
  savings: { color: "#f2b705", icon: "PiggyBank", label: { de: "Sparen & Vorsorge", fr: "Épargne & prévoyance", it: "Risparmio & previdenza", en: "Savings & pension" } },
  transfers: { color: "#c8c8d4", icon: "ArrowLeftRight", label: { de: "Überträge", fr: "Virements internes", it: "Trasferimenti interni", en: "Transfers" } },
  income: { color: "#19d3a2", icon: "Wallet", label: { de: "Einnahmen", fr: "Revenus", it: "Entrate", en: "Income" } },
  other: { color: "#d0d0da", icon: "CircleHelp", label: { de: "Sonstiges", fr: "Divers", it: "Altro", en: "Other" } },
};

export function categoryLabel(id: CategoryId, locale: Locale): string {
  return CATEGORIES[id].label[locale];
}
