// Deterministic, rule-based insights (no LLM). Used when no API key is configured,
// when the model fails, and directly by the client as a last resort.
// Pure & synchronous — safe in the browser and on the server.

import { categoryLabel } from "@/lib/categories";
import { formatMoney, formatPercent } from "@/lib/i18n/core";
import {
  NON_SPENDING_CATEGORIES,
  isSingleMonth,
  type Analysis,
  type CategoryId,
  type Critique,
  type InsightItem,
  type Insights,
  type Locale,
  type SavingOption,
} from "@/lib/types";

// Rough share-of-consumption-spending ranges for Swiss households. Heuristics, not statistics.
const TYPICAL_SHARE: Partial<Record<CategoryId, [number, number]>> = {
  housing: [0.25, 0.35],
  groceries: [0.1, 0.15],
  restaurants: [0.05, 0.1],
  transport: [0.03, 0.08],
  car: [0.05, 0.12],
  insurance: [0.08, 0.15],
  shopping: [0.05, 0.1],
  leisure: [0.04, 0.1],
  travel: [0.04, 0.1],
  telecom: [0.02, 0.04],
  utilities: [0.02, 0.06],
  subscriptions: [0, 0.03],
};

/** Categories we don't critique (not really discretionary or not actionable). */
const NO_CRITIQUE: readonly CategoryId[] = ["taxes", "children", "education", "savings", "transfers", "income", "other"];

type Persona = "saver" | "solid" | "onTrack" | "epicure" | "subs" | "shopper" | "traveller" | "freeSpirit" | "detective" | "empty";
type SavingKey = "restaurants" | "groceries" | "subscriptions" | "telecom" | "insurance" | "shopping" | "fees" | "transport" | "leisure" | "car";

type P = Record<string, string>;
type Tpl = (p: P) => string;
type ItemTpl = (p: P) => InsightItem;

interface Dict {
  perMonth: string;
  persona: Record<Persona, string>;
  /** One general sentence describing each persona type. */
  personaText: Record<Persona, string>;
  s: {
    highRate: ItemTpl; // rate, amount
    positive: ItemTpl; // rate, amount
    activeSaving: ItemTpl; // amount
    lowRestaurants: ItemTpl; // amount, share
    lowFees: InsightItem;
    lowCash: InsightItem;
    leanSubs: ItemTpl; // amount
    publicTransport: ItemTpl; // amount
    withinRange: ItemTpl; // cat, share
    reviewing: InsightItem;
  };
  w: {
    negative: ItemTpl; // amount
    thin: ItemTpl; // rate
    noIncome: InsightItem;
    restaurants: ItemTpl; // amount, share
    subs: ItemTpl; // amount
    fees: ItemTpl; // amount
    cash: ItemTpl; // amount, share
    aboveTypical: ItemTpl; // cat, share, typical
    fixedCosts: ItemTpl; // amount, share
    biggestLever: ItemTpl; // cat, amount
  };
  critiqueTitle: Tpl; // target, amount
  critiqueDetailCat: Tpl; // cat, share
  critiqueDetailMerchant: Tpl; // merchant, merchantAmount, cat, share
  critiqueTitleOnce: Tpl; // target, amount
  critiqueDetailMerchantOnce: Tpl; // merchant, merchantAmount, cat, share
  suggestion: Partial<Record<CategoryId, string>> & { default: string };
  saving: Record<SavingKey, { title: string; detail: Tpl }>; // amount
}

const de: Dict = {
  perMonth: "pro Monat",
  persona: {
    saver: "Sparfuchs",
    solid: "Budget-Profi",
    onTrack: "Auf Kurs",
    epicure: "Genussmensch",
    subs: "Abo-Sammler",
    shopper: "Shopping-Profi",
    traveller: "Fernweh-Typ",
    freeSpirit: "Lebenskünstler",
    detective: "Ausgaben-Detektiv",
    empty: "Unbeschriebenes Blatt",
  },
  personaText: {
    saver: "Du gibst weniger aus, als reinkommt, und legst regelmässig etwas zur Seite.",
    solid: "Dein Budget ist gut im Griff: Die Rechnung geht auf, und es bleibt etwas übrig.",
    onTrack: "Dein Budget geht auf – das Polster für Unvorhergesehenes darf aber noch wachsen.",
    epicure: "Gutes Essen ist dir etwas wert: Restaurants und Take-away machen einen grossen Teil deiner Ausgaben aus.",
    subs: "Streaming, Apps und Mitgliedschaften summieren sich bei dir zu einem stattlichen Abo-Posten.",
    shopper: "Shopping nimmt bei dir einen grossen Teil der Ausgaben ein.",
    traveller: "Reisen und Ferien sind dir wichtig und ein grosser Posten in deinem Budget.",
    freeSpirit: "Du lebst im Moment: Zurzeit geht mehr raus, als reinkommt.",
    detective: "Im Auszug sind keine Einnahmen zu sehen – darum schauen wir nur auf deine Ausgaben.",
    empty:
      "Für eine echte Auswertung hat es noch zu wenige Buchungen. Lade einen Kontoauszug über mindestens einen Monat hoch, dann gibt's konkrete Tipps.",
  },
  s: {
    highRate: (p) => ({ title: "Starke Sparquote", detail: `Du behältst ${p.rate} deines Einkommens – rund ${p.amount} pro Monat. Das ist ein richtig gutes Polster.` }),
    positive: (p) => ({ title: "Mehr rein als raus", detail: `Mit einer Sparquote von ${p.rate} bleiben dir im Schnitt ${p.amount} pro Monat.` }),
    activeSaving: (p) => ({ title: "Du sparst aktiv", detail: `Rund ${p.amount} pro Monat fliessen auf Spar-, Anlage- oder Vorsorgekonten wie die Säule 3a.` }),
    lowRestaurants: (p) => ({ title: "Auswärtsessen im Griff", detail: `Restaurants & Take-away machen nur ${p.share} deiner Ausgaben aus (${p.amount} pro Monat).` }),
    lowFees: { title: "Kaum Bankspesen", detail: "Für Kontoführung und Bancomat-Gebühren zahlst du praktisch nichts." },
    lowCash: { title: "Wenig Bargeld", detail: "Du zahlst fast alles digital – so siehst du genau, wohin dein Geld geht." },
    leanSubs: (p) => ({ title: "Schlanke Abos", detail: `Für Abos & Streaming gehen nur ${p.amount} pro Monat weg – kein Abo-Wildwuchs.` }),
    publicTransport: (p) => ({ title: "ÖV statt Auto", detail: `Keine Autokosten in Sicht: Für ÖV & Mobilität gibst du ${p.amount} pro Monat aus.` }),
    withinRange: (p) => ({ title: `${p.cat} im Rahmen`, detail: `Mit ${p.share} deiner Ausgaben liegst du bei ${p.cat} in einem für Schweizer Haushalte üblichen Bereich.` }),
    reviewing: { title: "Der erste Schritt ist gemacht", detail: "Wer seine Ausgaben anschaut, hat schon gewonnen – mit mehr Daten zeigen wir dir hier deine Stärken." },
  },
  w: {
    negative: (p) => ({ title: "Mehr raus als rein", detail: `Pro Monat fehlen im Schnitt ${p.amount}. Auf Dauer knabbert das am Ersparten.` }),
    thin: (p) => ({ title: "Dünnes Polster", detail: `Eine Sparquote von ${p.rate} lässt wenig Spielraum für Unerwartetes wie Zahnarzt oder Nebenkostenabrechnung.` }),
    noIncome: { title: "Keine Einnahmen ersichtlich", detail: "Im Auszug ist kein Lohn zu sehen – die Sparquote lässt sich so nicht beurteilen." },
    restaurants: (p) => ({ title: "Auswärtsessen läppert sich", detail: `${p.amount} pro Monat gehen an Restaurants & Take-away – ${p.share} deiner Ausgaben.` }),
    subs: (p) => ({ title: "Abo-Berg", detail: `Abos & Streaming kosten dich ${p.amount} pro Monat. Kleinvieh macht auch Mist.` }),
    fees: (p) => ({ title: "Unnötige Bankspesen", detail: `${p.amount} pro Monat für Bankspesen – Geld, für das du nichts bekommst.` }),
    cash: (p) => ({ title: "Viel Bargeld", detail: `${p.amount} pro Monat hebst du bar ab (${p.share} der Ausgaben) – wohin das Geld fliesst, bleibt im Dunkeln.` }),
    aboveTypical: (p) => ({ title: `${p.cat} über dem Üblichen`, detail: `Auf ${p.cat} entfallen ${p.share} deiner Ausgaben – in vielen Haushalten sind es eher ${p.typical}.` }),
    fixedCosts: (p) => ({ title: "Hohe Fixkosten", detail: `Wiederkehrende Zahlungen von ${p.amount} pro Monat binden ${p.share} deines Einkommens.` }),
    biggestLever: (p) => ({ title: `Grösster Hebel: ${p.cat}`, detail: `Mit ${p.amount} pro Monat ist das dein grösster variabler Posten – hier wirken kleine Änderungen am stärksten.` }),
  },
  critiqueTitle: (p) => `${p.target}: ${p.amount} pro Monat`,
  critiqueDetailCat: (p) => `Auf ${p.cat} entfallen ${p.share} deiner Ausgaben.`,
  critiqueDetailMerchant: (p) => `Allein bei ${p.merchant} landen ${p.merchantAmount} pro Monat; insgesamt gehen ${p.share} deiner Ausgaben an ${p.cat}.`,
  critiqueTitleOnce: (p) => `${p.target}: ${p.amount} einmalig`,
  critiqueDetailMerchantOnce: (p) => `Bei ${p.merchant} hast du einmalig ${p.merchantAmount} ausgegeben – das ist kein monatlicher Posten. Insgesamt gehen ${p.share} deiner Ausgaben an ${p.cat}.`,
  suggestion: {
    groceries: "Basics bei Denner, Aldi oder Lidl bzw. als M-Budget/Prix Garantie kaufen, Cumulus-/Supercard-Aktionen nutzen und abends bei Too Good To Go reinschauen.",
    restaurants: "Zwei, drei Mittagessen pro Woche selbst mitnehmen und Lieferdienste zur Ausnahme machen.",
    transport: "Rechne nach, ob sich Halbtax oder GA für dich lohnt – oder ob Sparbillette und ein Verbundabo günstiger kommen.",
    car: "Pendelstrecken mit dem ÖV vergleichen, Fahrgemeinschaften nutzen und die Autoversicherung jährlich vergleichen.",
    insurance: "Krankenkasse: Ein alternatives Modell (Telmed, Hausarzt) oder eine höhere Franchise prüfen – Wechsel jeweils bis Ende November.",
    telecom: "Vergleiche dein Abo mit Wingo, Yallo oder Digital Republic – oft gleiche Leistung für deutlich weniger als bei Swisscom & Co.",
    shopping: "48-Stunden-Regel vor Käufen über CHF 50 – und für Möbel, Velos oder Kleider zuerst im Brocki oder auf Ricardo/Tutti schauen.",
    leisure: "Fitness- und Freizeitabos auf echte Nutzung prüfen; Gemeinden und Vereine haben oft günstigere Angebote.",
    subscriptions: "Alle Abos auflisten, ungenutzte kündigen und Streamingdienste rotieren statt parallel bezahlen.",
    travel: "Früh buchen, Nebensaison nutzen und flexibel bei den Daten sein – das spart am meisten.",
    utilities: "Standby-Geräte abschalten, richtig lüften und die Nebenkostenabrechnung auf Fehler prüfen.",
    health: "Nach Generika fragen und alle Rechnungen konsequent bei der Krankenkasse einreichen.",
    fees: "Bargeld nur am Bancomat der eigenen Bank beziehen und Kontopakete vergleichen – viele Konten sind heute gratis.",
    cash: "Bargeldbezüge bündeln und lieber digital zahlen, damit du siehst, wohin das Geld fliesst.",
    housing: "Prüfe bei jeder Senkung des Referenzzinssatzes, ob dir eine Mietzinsreduktion zusteht.",
    default: "Schau dir diese Buchungen genauer an – oft versteckt sich hier Sparpotenzial.",
  },
  saving: {
    restaurants: { title: "Weniger auswärts essen", detail: (p) => `Zwei Lieferungen oder Restaurantbesuche pro Woche weniger bringen rund ${p.amount} pro Monat.` },
    groceries: { title: "Discounter & Eigenmarken", detail: (p) => `Grundnahrungsmittel bei Denner, Aldi oder Lidl bzw. als M-Budget/Prix Garantie sparen realistisch ${p.amount} pro Monat.` },
    subscriptions: { title: "Abo-Putz", detail: (p) => `Ungenutzte Abos kündigen und Streaming rotieren bringt etwa ${p.amount} pro Monat.` },
    telecom: { title: "Günstigeres Handy-Abo", detail: (p) => `Mit einem Abo von Wingo, Yallo oder Digital Republic liegen rund ${p.amount} pro Monat drin.` },
    insurance: { title: "Krankenkasse optimieren", detail: (p) => `Anderes Modell oder höhere Franchise: rund ${p.amount} pro Monat – Kündigung bis Ende November.` },
    shopping: { title: "Bewusster shoppen", detail: (p) => `Wunschliste statt Spontankauf und Secondhand (Brocki, Ricardo): etwa ${p.amount} pro Monat.` },
    fees: { title: "Bankspesen streichen", detail: (p) => `Gratiskonto und eigener Bancomat sparen ${p.amount} pro Monat.` },
    transport: { title: "Halbtax/GA durchrechnen", detail: (p) => `Das passende ÖV-Abo spart bei deinem Fahrverhalten schätzungsweise ${p.amount} pro Monat.` },
    leisure: { title: "Freizeit-Fixkosten prüfen", detail: (p) => `Ungenutzte Mitgliedschaften und Abos streichen: rund ${p.amount} pro Monat.` },
    car: { title: "Auto clever nutzen", detail: (p) => `Weniger Kurzstrecken, Fahrgemeinschaften und Versicherungsvergleich: etwa ${p.amount} pro Monat.` },
  },
};

const fr: Dict = {
  perMonth: "par mois",
  persona: {
    saver: "Fourmi prévoyante",
    solid: "Pro du budget",
    onTrack: "Sur la bonne voie",
    epicure: "Épicurien",
    subs: "Collectionneur d'abos",
    shopper: "Accro du shopping",
    traveller: "Globe-trotter",
    freeSpirit: "Cigale insouciante",
    detective: "Détective des dépenses",
    empty: "Page blanche",
  },
  personaText: {
    saver: "Tu dépenses moins que ce qui rentre et tu mets régulièrement de l'argent de côté.",
    solid: "Ton budget est bien tenu : les comptes tournent et il reste quelque chose.",
    onTrack: "Ton budget tourne – mais le coussin pour les imprévus peut encore grandir.",
    epicure: "La bonne table compte pour toi : restaurants et plats à l'emporter pèsent lourd dans tes dépenses.",
    subs: "Streaming, apps et abonnements s'additionnent chez toi en un poste conséquent.",
    shopper: "Le shopping occupe une grande part de tes dépenses.",
    traveller: "Les voyages et les vacances comptent pour toi et pèsent lourd dans ton budget.",
    freeSpirit: "Tu vis l'instant présent : en ce moment, il sort plus d'argent qu'il n'en rentre.",
    detective: "Aucun revenu n'apparaît sur le relevé – on se concentre donc sur tes dépenses.",
    empty:
      "Il y a encore trop peu de transactions pour une vraie analyse. Importe un relevé couvrant au moins un mois et tu recevras des conseils concrets.",
  },
  s: {
    highRate: (p) => ({ title: "Excellent taux d'épargne", detail: `Tu gardes ${p.rate} de ton revenu – environ ${p.amount} par mois. Un très beau coussin.` }),
    positive: (p) => ({ title: "Plus d'entrées que de sorties", detail: `Avec un taux d'épargne de ${p.rate}, il te reste en moyenne ${p.amount} par mois.` }),
    activeSaving: (p) => ({ title: "Tu épargnes activement", detail: `Environ ${p.amount} par mois vont sur des comptes d'épargne, de placement ou de prévoyance comme le pilier 3a.` }),
    lowRestaurants: (p) => ({ title: "Restaurants sous contrôle", detail: `Restaurants & plats à l'emporter ne pèsent que ${p.share} de tes dépenses (${p.amount} par mois).` }),
    lowFees: { title: "Presque pas de frais bancaires", detail: "Tenue de compte et retraits au Bancomat ne te coûtent pratiquement rien." },
    lowCash: { title: "Peu d'espèces", detail: "Tu paies presque tout par voie numérique – tu sais exactement où va ton argent." },
    leanSubs: (p) => ({ title: "Abonnements légers", detail: `Abonnements & streaming ne te coûtent que ${p.amount} par mois – pas de prolifération.` }),
    publicTransport: (p) => ({ title: "Transports publics plutôt que voiture", detail: `Aucun frais de voiture en vue : tu dépenses ${p.amount} par mois en transports publics & mobilité.` }),
    withinRange: (p) => ({ title: `${p.cat} : dans la norme`, detail: `Avec ${p.share} de tes dépenses pour ${p.cat}, tu restes dans une fourchette habituelle pour un ménage suisse.` }),
    reviewing: { title: "Le premier pas est fait", detail: "Regarder ses dépenses, c'est déjà gagner – avec plus de données, on te montrera ici tes points forts." },
  },
  w: {
    negative: (p) => ({ title: "Plus de sorties que d'entrées", detail: `Il manque en moyenne ${p.amount} par mois. À la longue, cela grignote ton épargne.` }),
    thin: (p) => ({ title: "Coussin mince", detail: `Un taux d'épargne de ${p.rate} laisse peu de marge pour les imprévus comme le dentiste ou le décompte de charges.` }),
    noIncome: { title: "Aucun revenu visible", detail: "Aucun salaire n'apparaît sur le relevé – impossible d'évaluer ton taux d'épargne." },
    restaurants: (p) => ({ title: "Les restos, ça s'accumule", detail: `${p.amount} par mois partent en restaurants & plats à l'emporter – ${p.share} de tes dépenses.` }),
    subs: (p) => ({ title: "Montagne d'abonnements", detail: `Abonnements & streaming te coûtent ${p.amount} par mois. Les petits ruisseaux font les grandes rivières.` }),
    fees: (p) => ({ title: "Frais bancaires évitables", detail: `${p.amount} par mois de frais bancaires – de l'argent pour rien.` }),
    cash: (p) => ({ title: "Beaucoup d'espèces", detail: `Tu retires ${p.amount} par mois en liquide (${p.share} des dépenses) – difficile de savoir où il part.` }),
    aboveTypical: (p) => ({ title: `${p.cat} au-dessus de la moyenne`, detail: `${p.share} de tes dépenses vont à ${p.cat} – dans beaucoup de ménages, c'est plutôt ${p.typical}.` }),
    fixedCosts: (p) => ({ title: "Charges fixes élevées", detail: `Les paiements récurrents de ${p.amount} par mois absorbent ${p.share} de ton revenu.` }),
    biggestLever: (p) => ({ title: `Plus gros levier : ${p.cat}`, detail: `Avec ${p.amount} par mois, c'est ton plus gros poste variable – de petits changements y ont le plus d'effet.` }),
  },
  critiqueTitle: (p) => `${p.target} : ${p.amount} par mois`,
  critiqueDetailCat: (p) => `${p.share} de tes dépenses vont à ${p.cat}.`,
  critiqueDetailMerchant: (p) => `Rien que chez ${p.merchant}, ${p.merchantAmount} par mois ; au total, ${p.share} de tes dépenses vont à ${p.cat}.`,
  critiqueTitleOnce: (p) => `${p.target} : ${p.amount} en une fois`,
  critiqueDetailMerchantOnce: (p) => `Chez ${p.merchant}, tu as dépensé ${p.merchantAmount} en une fois – ce n'est pas une dépense mensuelle. Au total, ${p.share} de tes dépenses vont à ${p.cat}.`,
  suggestion: {
    groceries: "Acheter les produits de base chez Denner, Aldi ou Lidl, ou en M-Budget/Prix Garantie, profiter des actions Cumulus/Supercard et passer par Too Good To Go le soir.",
    restaurants: "Emporter son lunch deux ou trois fois par semaine et garder la livraison pour les exceptions.",
    transport: "Calcule si l'abonnement demi-tarif ou l'AG vaut la peine – ou si les billets dégriffés et un abonnement de communauté tarifaire reviennent moins cher.",
    car: "Comparer les trajets pendulaires en transports publics, faire du covoiturage et comparer l'assurance auto chaque année.",
    insurance: "Assurance maladie : examine un modèle alternatif (Telmed, médecin de famille) ou une franchise plus élevée – changement possible jusqu'à fin novembre.",
    telecom: "Compare ton abonnement avec Wingo, Yallo ou Digital Republic – souvent la même prestation pour nettement moins que chez Swisscom & Co.",
    shopping: "Règle des 48 heures avant tout achat de plus de CHF 50 – et pour les meubles, vélos ou vêtements, regarder d'abord en brocante ou sur Ricardo/Tutti.",
    leisure: "Vérifier l'usage réel des abonnements de fitness et de loisirs ; communes et associations proposent souvent moins cher.",
    subscriptions: "Lister tous les abonnements, résilier ceux qui ne servent pas et alterner les services de streaming au lieu de les cumuler.",
    travel: "Réserver tôt, voyager hors saison et rester flexible sur les dates – c'est là qu'on économise le plus.",
    utilities: "Éteindre les appareils en veille, bien aérer et vérifier le décompte de charges.",
    health: "Demander des génériques et envoyer systématiquement toutes les factures à l'assurance maladie.",
    fees: "Retirer uniquement aux Bancomat de ta banque et comparer les forfaits – beaucoup de comptes sont gratuits aujourd'hui.",
    cash: "Regrouper les retraits et payer plutôt par carte ou TWINT pour garder la vue d'ensemble.",
    housing: "À chaque baisse du taux de référence, vérifie si tu as droit à une baisse de loyer.",
    default: "Regarde ces transactions de plus près – il s'y cache souvent un potentiel d'économie.",
  },
  saving: {
    restaurants: { title: "Moins de restos", detail: (p) => `Deux livraisons ou sorties au resto de moins par semaine rapportent environ ${p.amount} par mois.` },
    groceries: { title: "Discount & marques propres", detail: (p) => `Les produits de base chez Denner, Aldi ou Lidl, ou en M-Budget/Prix Garantie : environ ${p.amount} par mois.` },
    subscriptions: { title: "Grand ménage des abos", detail: (p) => `Résilier les abonnements inutilisés et alterner le streaming : environ ${p.amount} par mois.` },
    telecom: { title: "Abonnement mobile moins cher", detail: (p) => `Avec Wingo, Yallo ou Digital Republic, environ ${p.amount} par mois d'économie.` },
    insurance: { title: "Optimiser l'assurance maladie", detail: (p) => `Autre modèle ou franchise plus élevée : environ ${p.amount} par mois – résiliation jusqu'à fin novembre.` },
    shopping: { title: "Shopping réfléchi", detail: (p) => `Liste d'envies plutôt qu'achats impulsifs, et seconde main (brocante, Ricardo) : environ ${p.amount} par mois.` },
    fees: { title: "Supprimer les frais bancaires", detail: (p) => `Compte gratuit et Bancomat de ta banque : ${p.amount} par mois.` },
    transport: { title: "Calculer demi-tarif/AG", detail: (p) => `Le bon abonnement de transports publics te ferait économiser environ ${p.amount} par mois.` },
    leisure: { title: "Revoir les loisirs fixes", detail: (p) => `Supprimer les abonnements et cotisations inutilisés : environ ${p.amount} par mois.` },
    car: { title: "Utiliser la voiture malin", detail: (p) => `Moins de petits trajets, covoiturage et comparaison d'assurance : environ ${p.amount} par mois.` },
  },
};

const it: Dict = {
  perMonth: "al mese",
  persona: {
    saver: "Formica previdente",
    solid: "Mago del budget",
    onTrack: "Sulla buona strada",
    epicure: "Buongustaio",
    subs: "Collezionista di abbonamenti",
    shopper: "Re dello shopping",
    traveller: "Giramondo",
    freeSpirit: "Cicala spensierata",
    detective: "Detective delle spese",
    empty: "Pagina bianca",
  },
  personaText: {
    saver: "Spendi meno di quanto entra e metti regolarmente da parte qualcosa.",
    solid: "Il tuo budget è sotto controllo: i conti tornano e qualcosa avanza.",
    onTrack: "Il tuo budget regge – ma il cuscinetto per gli imprevisti può ancora crescere.",
    epicure: "Il buon cibo per te conta: ristoranti e take-away sono una bella fetta delle tue spese.",
    subs: "Streaming, app e abbonamenti si sommano in una voce di tutto rispetto.",
    shopper: "Lo shopping occupa una grande parte delle tue spese.",
    traveller: "Viaggi e vacanze sono importanti per te e pesano parecchio sul budget.",
    freeSpirit: "Vivi alla giornata: in questo periodo esce più di quanto entra.",
    detective: "Nell'estratto non risultano entrate – per questo guardiamo solo le spese.",
    empty:
      "Ci sono ancora troppo poche transazioni per una vera analisi. Carica un estratto conto di almeno un mese e riceverai consigli concreti.",
  },
  s: {
    highRate: (p) => ({ title: "Ottimo tasso di risparmio", detail: `Tieni da parte il ${p.rate} del tuo reddito – circa ${p.amount} al mese. Un bel cuscinetto.` }),
    positive: (p) => ({ title: "Entra più di quanto esce", detail: `Con un tasso di risparmio del ${p.rate} ti restano in media ${p.amount} al mese.` }),
    activeSaving: (p) => ({ title: "Risparmi attivamente", detail: `Circa ${p.amount} al mese vanno su conti di risparmio, d'investimento o di previdenza come il pilastro 3a.` }),
    lowRestaurants: (p) => ({ title: "Ristoranti sotto controllo", detail: `Ristoranti & take-away pesano solo il ${p.share} delle tue spese (${p.amount} al mese).` }),
    lowFees: { title: "Quasi nessuna spesa bancaria", detail: "Tenuta conto e prelievi al Bancomat non ti costano praticamente nulla." },
    lowCash: { title: "Pochi contanti", detail: "Paghi quasi tutto in digitale – così sai esattamente dove vanno i tuoi soldi." },
    leanSubs: (p) => ({ title: "Abbonamenti snelli", detail: `Abbonamenti & streaming ti costano solo ${p.amount} al mese – nessuna giungla di abbonamenti.` }),
    publicTransport: (p) => ({ title: "Mezzi pubblici invece dell'auto", detail: `Nessun costo auto in vista: per trasporti pubblici & mobilità spendi ${p.amount} al mese.` }),
    withinRange: (p) => ({ title: `${p.cat} nella norma`, detail: `Con il ${p.share} delle tue spese per ${p.cat} sei in una fascia abituale per un'economia domestica svizzera.` }),
    reviewing: { title: "Il primo passo è fatto", detail: "Chi guarda le proprie spese ha già vinto – con più dati ti mostreremo qui i tuoi punti forti." },
  },
  w: {
    negative: (p) => ({ title: "Esce più di quanto entra", detail: `Mancano in media ${p.amount} al mese. A lungo andare intacca i tuoi risparmi.` }),
    thin: (p) => ({ title: "Cuscinetto sottile", detail: `Un tasso di risparmio del ${p.rate} lascia poco margine per imprevisti come il dentista o il conguaglio delle spese accessorie.` }),
    noIncome: { title: "Nessuna entrata visibile", detail: "Nell'estratto non c'è nessuno stipendio – il tasso di risparmio non è valutabile." },
    restaurants: (p) => ({ title: "I pasti fuori si sommano", detail: `${p.amount} al mese vanno in ristoranti & take-away – il ${p.share} delle tue spese.` }),
    subs: (p) => ({ title: "Montagna di abbonamenti", detail: `Abbonamenti & streaming ti costano ${p.amount} al mese. Tanti pochi fanno un assai.` }),
    fees: (p) => ({ title: "Spese bancarie evitabili", detail: `${p.amount} al mese di spese bancarie – soldi per niente.` }),
    cash: (p) => ({ title: "Molti contanti", detail: `Prelevi ${p.amount} al mese in contanti (${p.share} delle spese) – difficile capire dove finiscono.` }),
    aboveTypical: (p) => ({ title: `${p.cat} sopra la media`, detail: `Per ${p.cat} va il ${p.share} delle tue spese – in molte economie domestiche è piuttosto ${p.typical}.` }),
    fixedCosts: (p) => ({ title: "Costi fissi elevati", detail: `I pagamenti ricorrenti di ${p.amount} al mese assorbono il ${p.share} del tuo reddito.` }),
    biggestLever: (p) => ({ title: `Leva principale: ${p.cat}`, detail: `Con ${p.amount} al mese è la tua voce variabile più grande – qui i piccoli cambiamenti contano di più.` }),
  },
  critiqueTitle: (p) => `${p.target}: ${p.amount} al mese`,
  critiqueDetailCat: (p) => `Per ${p.cat} va il ${p.share} delle tue spese.`,
  critiqueDetailMerchant: (p) => `Solo da ${p.merchant} finiscono ${p.merchantAmount} al mese; in totale il ${p.share} delle tue spese va a ${p.cat}.`,
  critiqueTitleOnce: (p) => `${p.target}: ${p.amount} una tantum`,
  critiqueDetailMerchantOnce: (p) => `Da ${p.merchant} hai speso ${p.merchantAmount} una tantum – non è una spesa mensile. In totale il ${p.share} delle tue spese va a ${p.cat}.`,
  suggestion: {
    groceries: "Comprare i prodotti di base da Denner, Aldi o Lidl, o in M-Budget/Prix Garantie, sfruttare le azioni Cumulus/Supercard e passare la sera da Too Good To Go.",
    restaurants: "Portarsi il pranzo da casa due o tre volte a settimana e riservare le consegne alle eccezioni.",
    transport: "Calcola se conviene l'abbonamento metà-prezzo o l'AG – o se biglietti risparmio e un abbonamento della comunità tariffale costano meno.",
    car: "Confrontare i tragitti casa-lavoro con i mezzi pubblici, condividere l'auto e confrontare ogni anno l'assicurazione auto.",
    insurance: "Cassa malati: valuta un modello alternativo (Telmed, medico di famiglia) o una franchigia più alta – cambio possibile entro fine novembre.",
    telecom: "Confronta il tuo abbonamento con Wingo, Yallo o Digital Republic – spesso stessa prestazione per molto meno che da Swisscom & Co.",
    shopping: "Regola delle 48 ore prima di ogni acquisto oltre CHF 50 – e per mobili, bici o vestiti guardare prima al mercatino dell'usato o su Ricardo/Tutti.",
    leisure: "Verificare l'uso reale di abbonamenti fitness e tempo libero; comuni e associazioni offrono spesso alternative più economiche.",
    subscriptions: "Elencare tutti gli abbonamenti, disdire quelli inutilizzati e alternare i servizi di streaming invece di pagarli tutti insieme.",
    travel: "Prenotare presto, viaggiare in bassa stagione ed essere flessibili sulle date – è lì che si risparmia di più.",
    utilities: "Spegnere gli apparecchi in standby, arieggiare bene e controllare il conguaglio delle spese accessorie.",
    health: "Chiedere i generici e inoltrare sempre tutte le fatture alla cassa malati.",
    fees: "Prelevare solo ai Bancomat della propria banca e confrontare i pacchetti – molti conti oggi sono gratuiti.",
    cash: "Raggruppare i prelievi e pagare piuttosto in digitale, per vedere dove vanno i soldi.",
    housing: "A ogni calo del tasso di riferimento, verifica se hai diritto a una riduzione dell'affitto.",
    default: "Guarda queste transazioni più da vicino – spesso nascondono un potenziale di risparmio.",
  },
  saving: {
    restaurants: { title: "Meno pasti fuori", detail: (p) => `Due consegne o cene al ristorante in meno a settimana valgono circa ${p.amount} al mese.` },
    groceries: { title: "Discount & marche proprie", detail: (p) => `Prodotti di base da Denner, Aldi o Lidl, o in M-Budget/Prix Garantie: circa ${p.amount} al mese.` },
    subscriptions: { title: "Pulizia degli abbonamenti", detail: (p) => `Disdire gli abbonamenti inutilizzati e alternare lo streaming: circa ${p.amount} al mese.` },
    telecom: { title: "Abbonamento mobile più economico", detail: (p) => `Con Wingo, Yallo o Digital Republic risparmi circa ${p.amount} al mese.` },
    insurance: { title: "Ottimizzare la cassa malati", detail: (p) => `Altro modello o franchigia più alta: circa ${p.amount} al mese – disdetta entro fine novembre.` },
    shopping: { title: "Shopping consapevole", detail: (p) => `Lista dei desideri invece di acquisti d'impulso, e usato (mercatino, Ricardo): circa ${p.amount} al mese.` },
    fees: { title: "Eliminare le spese bancarie", detail: (p) => `Conto gratuito e Bancomat della tua banca: ${p.amount} al mese.` },
    transport: { title: "Calcolare metà-prezzo/AG", detail: (p) => `L'abbonamento giusto ai mezzi pubblici ti farebbe risparmiare circa ${p.amount} al mese.` },
    leisure: { title: "Rivedere i costi fissi del tempo libero", detail: (p) => `Eliminare iscrizioni e abbonamenti inutilizzati: circa ${p.amount} al mese.` },
    car: { title: "Usare l'auto con astuzia", detail: (p) => `Meno tragitti brevi, auto condivisa e confronto assicurazioni: circa ${p.amount} al mese.` },
  },
};

const en: Dict = {
  perMonth: "per month",
  persona: {
    saver: "Thrifty fox",
    solid: "Budget pro",
    onTrack: "On track",
    epicure: "Bon vivant",
    subs: "Subscription collector",
    shopper: "Shopaholic",
    traveller: "Globetrotter",
    freeSpirit: "Free spirit",
    detective: "Spending detective",
    empty: "Blank slate",
  },
  personaText: {
    saver: "You spend less than you earn and regularly put money aside.",
    solid: "Your budget is under control: the numbers add up and there's something left over.",
    onTrack: "Your budget works out – but your cushion for the unexpected could still grow.",
    epicure: "Good food matters to you: restaurants and take-away make up a big share of your spending.",
    subs: "Streaming, apps and memberships add up to a sizeable subscriptions bill.",
    shopper: "Shopping takes up a big share of your spending.",
    traveller: "Travel and holidays matter to you and are a big item in your budget.",
    freeSpirit: "You live in the moment: right now more goes out than comes in.",
    detective: "No income shows up on the statement, so we're looking at your spending only.",
    empty:
      "There aren't enough transactions yet for a proper analysis. Upload a statement covering at least one month and you'll get concrete tips.",
  },
  s: {
    highRate: (p) => ({ title: "Strong savings rate", detail: `You keep ${p.rate} of your income – about ${p.amount} a month. That's a really healthy cushion.` }),
    positive: (p) => ({ title: "More in than out", detail: `With a savings rate of ${p.rate}, you have about ${p.amount} left over each month.` }),
    activeSaving: (p) => ({ title: "You save actively", detail: `About ${p.amount} a month goes into savings, investment or pension accounts such as pillar 3a (Säule 3a).` }),
    lowRestaurants: (p) => ({ title: "Eating out under control", detail: `Restaurants & take-away are only ${p.share} of your spending (${p.amount} per month).` }),
    lowFees: { title: "Hardly any bank fees", detail: "You pay practically nothing for account fees or ATM withdrawals." },
    lowCash: { title: "Little cash", detail: "You pay almost everything digitally – so you know exactly where your money goes." },
    leanSubs: (p) => ({ title: "Lean subscriptions", detail: `Subscriptions & streaming cost you only ${p.amount} per month – no subscription sprawl.` }),
    publicTransport: (p) => ({ title: "Public transport over car", detail: `No car costs in sight: you spend ${p.amount} a month on public transport & mobility.` }),
    withinRange: (p) => ({ title: `${p.cat} within range`, detail: `At ${p.share} of your spending, ${p.cat} sits in a range that's typical for Swiss households.` }),
    reviewing: { title: "First step done", detail: "Looking at your spending is half the battle – with more data we'll show your strengths here." },
  },
  w: {
    negative: (p) => ({ title: "More out than in", detail: `On average you're ${p.amount} short each month. Over time that eats into your savings.` }),
    thin: (p) => ({ title: "Thin cushion", detail: `A savings rate of ${p.rate} leaves little room for surprises like the dentist or the utilities statement.` }),
    noIncome: { title: "No income visible", detail: "No salary shows up on the statement, so your savings rate can't be assessed." },
    restaurants: (p) => ({ title: "Eating out adds up", detail: `${p.amount} a month goes to restaurants & take-away – ${p.share} of your spending.` }),
    subs: (p) => ({ title: "Subscription pile", detail: `Subscriptions & streaming cost you ${p.amount} a month. Small amounts add up.` }),
    fees: (p) => ({ title: "Avoidable bank fees", detail: `${p.amount} a month on bank fees – money for nothing.` }),
    cash: (p) => ({ title: "Lots of cash", detail: `You withdraw ${p.amount} a month in cash (${p.share} of spending) – where it goes stays a mystery.` }),
    aboveTypical: (p) => ({ title: `${p.cat} above typical`, detail: `${p.cat} makes up ${p.share} of your spending – many households are closer to ${p.typical}.` }),
    fixedCosts: (p) => ({ title: "High fixed costs", detail: `Recurring payments of ${p.amount} a month tie up ${p.share} of your income.` }),
    biggestLever: (p) => ({ title: `Biggest lever: ${p.cat}`, detail: `At ${p.amount} a month, this is your largest variable item – small changes here go furthest.` }),
  },
  critiqueTitle: (p) => `${p.target}: ${p.amount} per month`,
  critiqueDetailCat: (p) => `${p.cat} makes up ${p.share} of your spending.`,
  critiqueDetailMerchant: (p) => `${p.merchant} alone takes ${p.merchantAmount} a month; overall ${p.share} of your spending goes to ${p.cat}.`,
  critiqueTitleOnce: (p) => `${p.target}: ${p.amount} one-off`,
  critiqueDetailMerchantOnce: (p) => `You spent ${p.merchantAmount} at ${p.merchant} as a one-off – that's not a monthly cost. Overall ${p.share} of your spending goes to ${p.cat}.`,
  suggestion: {
    groceries: "Buy staples at Denner, Aldi or Lidl, or as M-Budget/Prix Garantie, use Cumulus/Supercard deals and check Too Good To Go in the evening.",
    restaurants: "Bring lunch from home two or three times a week and keep delivery for special occasions.",
    transport: "Work out whether a Halbtax (half-fare card) or GA pays off for you – or whether saver tickets and a regional pass are cheaper.",
    car: "Compare commutes by public transport, car-pool where possible and compare your car insurance every year.",
    insurance: "Health insurance (Krankenkasse): consider an alternative model (telemedicine, GP) or a higher deductible (Franchise) – switch by the end of November.",
    telecom: "Compare your plan with Wingo, Yallo or Digital Republic – often the same service for much less than Swisscom & co.",
    shopping: "Use a 48-hour rule for anything over CHF 50 – and check a Brocki (second-hand shop) or Ricardo/Tutti first for furniture, bikes or clothes.",
    leisure: "Check gym and leisure memberships against real use; municipalities and clubs often offer cheaper options.",
    subscriptions: "List all subscriptions, cancel unused ones and rotate streaming services instead of paying for them in parallel.",
    travel: "Book early, travel off-season and stay flexible on dates – that's where the biggest savings are.",
    utilities: "Switch off devices on standby, air rooms properly and check your utilities statement (Nebenkosten) for errors.",
    health: "Ask for generics and always submit every bill to your health insurer.",
    fees: "Only withdraw cash at your own bank's ATMs and compare account packages – many accounts are free today.",
    cash: "Bundle cash withdrawals and pay digitally instead, so you can see where the money goes.",
    housing: "Whenever the reference interest rate drops, check whether you're entitled to a rent reduction.",
    default: "Take a closer look at these transactions – there's often hidden savings potential here.",
  },
  saving: {
    restaurants: { title: "Eat out less", detail: (p) => `Two fewer deliveries or restaurant meals a week are worth about ${p.amount} a month.` },
    groceries: { title: "Discounters & own brands", detail: (p) => `Staples from Denner, Aldi or Lidl, or M-Budget/Prix Garantie: realistically ${p.amount} a month.` },
    subscriptions: { title: "Subscription clean-up", detail: (p) => `Cancel unused subscriptions and rotate streaming: about ${p.amount} a month.` },
    telecom: { title: "Cheaper mobile plan", detail: (p) => `With Wingo, Yallo or Digital Republic you could save about ${p.amount} a month.` },
    insurance: { title: "Optimise health insurance", detail: (p) => `Another model or a higher deductible: about ${p.amount} a month – switch by the end of November.` },
    shopping: { title: "Shop more consciously", detail: (p) => `A wish list instead of impulse buys, plus second-hand (Brocki, Ricardo): about ${p.amount} a month.` },
    fees: { title: "Cut bank fees", detail: (p) => `A free account and your own bank's ATMs save ${p.amount} a month.` },
    transport: { title: "Do the Halbtax/GA maths", detail: (p) => `The right public-transport pass could save you about ${p.amount} a month.` },
    leisure: { title: "Review fixed leisure costs", detail: (p) => `Drop unused memberships and subscriptions: about ${p.amount} a month.` },
    car: { title: "Use the car smarter", detail: (p) => `Fewer short trips, car-pooling and comparing insurance: about ${p.amount} a month.` },
  },
};

const DICTS: Record<Locale, Dict> = { de, fr, it, en };

const PERSONAS = Object.keys(de.persona) as Persona[];

/**
 * The same persona in `locale`, if `label` is one of Räppli's personas in any language:
 * "Thrifty fox" → "Sparfuchs". Personas are idioms, so a literal translation would miss.
 */
export function personaIn(label: string, locale: Locale): string | undefined {
  const key = label.trim().toLowerCase();
  for (const dict of Object.values(DICTS)) {
    const persona = PERSONAS.find((p) => dict.persona[p].toLowerCase() === key);
    if (persona) return DICTS[locale].persona[persona];
  }
  return undefined;
}

/** Every persona with its labels in all languages, e.g. `{ de: "Sparfuchs", fr: …, it: …, en: "Thrifty fox" }`. */
export function personaEquivalents(): Record<Locale, string>[] {
  return PERSONAS.filter((p) => p !== "empty").map((p) => ({ de: de.persona[p], fr: fr.persona[p], it: it.persona[p], en: en.persona[p] }));
}

// ---- metrics -------------------------------------------------------------------

interface CatStat {
  category: CategoryId;
  monthly: number;
  share: number;
  total: number;
  /** Only booked in one month: `monthly` is not a real monthly cost. */
  oneOff: boolean;
}

function metrics(a: Analysis) {
  const months = a.months > 0 ? a.months : 1;
  const totalSpending = Math.max(0, a.totalSpending);
  const spend: CatStat[] = a.byCategory
    .filter((c) => !NON_SPENDING_CATEGORIES.includes(c.category) && c.total > 0)
    .map((c) => ({
      category: c.category,
      monthly: c.monthlyAverage > 0 ? c.monthlyAverage : c.total / months,
      share: c.share > 0 ? c.share : totalSpending > 0 ? c.total / totalSpending : 0,
      total: c.total,
      oneOff: isSingleMonth(c, a),
    }))
    .sort((x, y) => y.monthly - x.monthly);
  const cat = (id: CategoryId): CatStat =>
    spend.find((c) => c.category === id) ?? { category: id, monthly: 0, share: 0, total: 0, oneOff: false };
  const regular = (id: CategoryId) => (cat(id).oneOff ? 0 : cat(id).monthly);

  const recurringSubs = a.recurring.filter((r) => r.category === "subscriptions").reduce((s, r) => s + r.monthlyCost, 0);
  const recurringFixed = a.recurring.filter((r) => !NON_SPENDING_CATEGORIES.includes(r.category)).reduce((s, r) => s + r.monthlyCost, 0);

  return {
    months,
    monthlyIncome: Math.max(0, a.totalIncome) / months,
    monthlySpending: totalSpending / months,
    monthlySaved: Math.max(0, a.totalSaved) / months,
    savingsRate: a.totalIncome > 0 && a.savingsRate !== null && Number.isFinite(a.savingsRate) ? a.savingsRate : null,
    spend,
    cat,
    regular,
    subscriptions: Math.max(regular("subscriptions"), recurringSubs),
    recurringFixed,
    hasData: a.transactionCount > 0 && (totalSpending > 0 || a.totalIncome > 0),
  };
}

type Metrics = ReturnType<typeof metrics>;

/** 0–100 budget health score from simple rules (exported for tests / UI reuse). */
export function fallbackScore(a: Analysis): number {
  const m = metrics(a);
  if (!m.hasData) return 50;
  const r = m.savingsRate;
  let s = r === null ? 55 : r >= 0.3 ? 88 : r >= 0.2 ? 80 : r >= 0.1 ? 68 : r >= 0.05 ? 58 : r >= 0 ? 50 : r >= -0.1 ? 35 : 22;
  const restaurants = m.cat("restaurants").share;
  if (restaurants > 0.15) s -= 6;
  else if (restaurants > 0.1) s -= 3;
  if (m.subscriptions > 100) s -= 4;
  else if (m.subscriptions > 50) s -= 2;
  if (m.cat("fees").monthly > 10) s -= 3;
  if (m.cat("cash").share > 0.15) s -= 3;
  if (m.monthlySaved > 0) s += 4;
  return Math.round(Math.min(98, Math.max(5, s)));
}

function personaOf(m: Metrics, score: number): Persona {
  const r = m.savingsRate;
  if (r !== null && r >= 0.2 && score >= 70) return "saver";
  if (m.cat("restaurants").share > 0.15) return "epicure";
  if (m.subscriptions >= 80) return "subs";
  if (m.cat("shopping").share > 0.2) return "shopper";
  if (m.cat("travel").share > 0.15) return "traveller";
  if (r !== null && r < 0) return "freeSpirit";
  if (r === null) return "detective";
  return r >= 0.1 ? "solid" : "onTrack";
}

const SAVING_RULES: { key: SavingKey; rate: number; min: number; effort: SavingOption["effort"] }[] = [
  { key: "restaurants", rate: 0.3, min: 40, effort: "medium" },
  { key: "groceries", rate: 0.15, min: 150, effort: "easy" },
  { key: "subscriptions", rate: 0.35, min: 25, effort: "easy" },
  { key: "telecom", rate: 0.4, min: 35, effort: "easy" },
  { key: "insurance", rate: 0.08, min: 150, effort: "medium" },
  { key: "shopping", rate: 0.2, min: 80, effort: "medium" },
  { key: "fees", rate: 0.8, min: 4, effort: "easy" },
  { key: "transport", rate: 0.15, min: 120, effort: "medium" },
  { key: "leisure", rate: 0.15, min: 100, effort: "medium" },
  { key: "car", rate: 0.1, min: 200, effort: "hard" },
];

const roundTo5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);

// ---- main ----------------------------------------------------------------------

export function buildFallbackInsights(analysis: Analysis, locale: Locale): Insights {
  const t = DICTS[locale] ?? DICTS.de;
  const m = metrics(analysis);
  const money = (n: number) => formatMoney(n, locale, { decimals: 0, currency: /^[A-Z]{3}$/.test(analysis.currency) ? analysis.currency : "CHF" });
  const pct = (n: number) => formatPercent(n, locale);
  const label = (id: CategoryId) => categoryLabel(id, locale);

  if (!m.hasData) {
    return {
      score: 50,
      persona: t.persona.empty,
      personaText: t.personaText.empty,
      strengths: [t.s.reviewing],
      weaknesses: [],
      critiques: [],
      savings: [],
      source: "fallback",
    };
  }

  const score = fallbackScore(analysis);
  const rate = m.savingsRate;
  const persona = personaOf(m, score);

  // Strengths
  const strengths: InsightItem[] = [];
  if (rate !== null && rate >= 0.2) strengths.push(t.s.highRate({ rate: pct(rate), amount: money(m.monthlyIncome * rate) }));
  else if (rate !== null && rate > 0) strengths.push(t.s.positive({ rate: pct(rate), amount: money(m.monthlyIncome * rate) }));
  if (m.monthlySaved >= 20) strengths.push(t.s.activeSaving({ amount: money(m.monthlySaved) }));
  const restaurants = m.cat("restaurants");
  if (m.monthlySpending > 0 && restaurants.share < 0.07 && !restaurants.oneOff) strengths.push(t.s.lowRestaurants({ amount: money(restaurants.monthly), share: pct(restaurants.share) }));
  if (m.cat("car").monthly < 20 && m.regular("transport") > 0) strengths.push(t.s.publicTransport({ amount: money(m.cat("transport").monthly) }));
  if (m.subscriptions > 0 && m.subscriptions < 30) strengths.push(t.s.leanSubs({ amount: money(m.subscriptions) }));
  if (m.cat("fees").monthly < 2) strengths.push(t.s.lowFees);
  if (m.cat("cash").share < 0.05) strengths.push(t.s.lowCash);
  for (const c of m.spend.slice(0, 3)) {
    const range = TYPICAL_SHARE[c.category];
    if (range && c.share >= range[0] && c.share <= range[1] && c.monthly >= 50) {
      strengths.push(t.s.withinRange({ cat: label(c.category), share: pct(c.share) }));
      break;
    }
  }
  if (strengths.length === 0) strengths.push(t.s.reviewing);

  // Weaknesses
  const weaknesses: InsightItem[] = [];
  if (rate === null) weaknesses.push(t.w.noIncome);
  else if (rate < 0) weaknesses.push(t.w.negative({ amount: money(-rate * m.monthlyIncome) }));
  else if (rate < 0.1) weaknesses.push(t.w.thin({ rate: pct(rate) }));
  if (restaurants.share > 0.12 && !restaurants.oneOff) weaknesses.push(t.w.restaurants({ amount: money(restaurants.monthly), share: pct(restaurants.share) }));
  if (m.subscriptions > 50) weaknesses.push(t.w.subs({ amount: money(m.subscriptions) }));
  if (m.regular("fees") > 5) weaknesses.push(t.w.fees({ amount: money(m.regular("fees")) }));
  const cash = m.cat("cash");
  if (cash.share > 0.1 && !cash.oneOff) weaknesses.push(t.w.cash({ amount: money(cash.monthly), share: pct(cash.share) }));
  for (const c of m.spend.slice(0, 4)) {
    const range = TYPICAL_SHARE[c.category];
    if (c.category === "restaurants" || c.category === "subscriptions") continue; // covered above
    if (range && c.share > range[1] * 1.25 && c.monthly >= 50) {
      weaknesses.push(t.w.aboveTypical({ cat: label(c.category), share: pct(c.share), typical: `${pct(range[0])}–${pct(range[1])}` }));
      break;
    }
  }
  if (m.monthlyIncome > 0 && m.recurringFixed / m.monthlyIncome > 0.6) {
    weaknesses.push(t.w.fixedCosts({ amount: money(m.recurringFixed), share: pct(m.recurringFixed / m.monthlyIncome) }));
  }
  if (weaknesses.length === 0) {
    const lever = m.spend.find((c) => !c.oneOff && !NO_CRITIQUE.includes(c.category) && c.category !== "housing" && c.category !== "insurance");
    if (lever) weaknesses.push(t.w.biggestLever({ cat: label(lever.category), amount: money(lever.monthly) }));
  }

  // Critiques: largest actionable categories, those above typical first.
  const above = (c: CatStat) => {
    const range = TYPICAL_SHARE[c.category];
    return range ? c.share > range[1] : false;
  };
  const critiques: Critique[] = m.spend
    .filter((c) => !NO_CRITIQUE.includes(c.category) && c.monthly >= 20 && (c.category !== "housing" || above(c)))
    .sort((x, y) => Number(above(y)) - Number(above(x)) || y.monthly - x.monthly)
    .slice(0, 4)
    .map((c): Critique => {
      const merchant = analysis.topMerchants.find((mt) => mt.category === c.category && mt.total > 0);
      const suggestion = t.suggestion[c.category] ?? t.suggestion.default;
      // Charged in only one month of a multi-month statement (a hotel stay, a flight):
      // spreading it over the period would invent a monthly cost, so show the total instead.
      if (merchant && isSingleMonth(merchant, analysis) && merchant.total >= 10) {
        const p = { merchant: merchant.name, merchantAmount: money(merchant.total), cat: label(c.category), share: pct(c.share) };
        return {
          title: t.critiqueTitleOnce({ target: merchant.name, amount: money(merchant.total) }),
          detail: t.critiqueDetailMerchantOnce(p),
          target: merchant.name,
          category: c.category,
          suggestion,
        };
      }
      if (c.oneOff) {
        return {
          title: t.critiqueTitleOnce({ target: label(c.category), amount: money(c.total) }),
          detail: t.critiqueDetailCat({ cat: label(c.category), share: pct(c.share) }),
          target: label(c.category),
          category: c.category,
          suggestion,
        };
      }
      const merchantMonthly = merchant ? merchant.total / m.months : 0;
      const useMerchant = merchant && merchantMonthly >= 10;
      return {
        title: t.critiqueTitle({ target: useMerchant ? merchant.name : label(c.category), amount: money(useMerchant ? merchantMonthly : c.monthly) }),
        detail: useMerchant
          ? t.critiqueDetailMerchant({ merchant: merchant.name, merchantAmount: money(merchantMonthly), cat: label(c.category), share: pct(c.share) })
          : t.critiqueDetailCat({ cat: label(c.category), share: pct(c.share) }),
        target: useMerchant ? merchant.name : label(c.category),
        category: c.category,
        amount: Math.round(useMerchant ? merchantMonthly : c.monthly),
        suggestion,
      };
    });

  // Saving options
  const savings: SavingOption[] = SAVING_RULES.map((rule) => {
    // A saving "per month" only exists for spending that recurs, so single-month categories count as 0.
    const monthly = rule.key === "subscriptions" ? m.subscriptions : m.regular(rule.key);
    if (monthly < rule.min) return null;
    const amount = roundTo5(monthly * rule.rate);
    return { title: t.saving[rule.key].title, detail: t.saving[rule.key].detail({ amount: money(amount) }), monthlySaving: amount, effort: rule.effort };
  })
    .filter((s): s is SavingOption => s !== null)
    .sort((x, y) => y.monthlySaving - x.monthlySaving)
    .slice(0, 5);

  return {
    score,
    persona: t.persona[persona],
    personaText: t.personaText[persona],
    strengths: strengths.slice(0, 4),
    weaknesses: weaknesses.slice(0, 4),
    critiques,
    savings,
    source: "fallback",
  };
}
