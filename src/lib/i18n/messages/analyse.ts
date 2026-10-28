import { defineMessages } from "../core";

const de = {
  metaTitle: "Kontoauszug analysieren",

  // Upload
  uploadTitle: "Wohin rollen deine Räppli?",
  uploadLead:
    "Lade deinen Kontoauszug hoch und sieh in Sekunden, wofür dein Geld draufgeht – mit Budget-Score, ehrlicher Kritik und konkreten Sparideen.",
  dropTitle: "Kontoauszug hierher ziehen",
  dropActive: "Loslassen – Räppli übernimmt!",
  dropBrowse: "Datei auswählen",
  dropOr: "oder",
  dropFormats: "CSV, CAMT-XML, Excel oder PDF",
  dropAria: "Kontoauszug hochladen. Enter drücken, um eine Datei auszuwählen, oder Datei hierher ziehen.",
  sampleButton: "Mit Beispieldaten testen",
  privacyTitle: "Bleibt bei dir",
  privacyNoLogin: "Kein Login, kein Konto, keine Cookies.",
  privacyBrowser: "Deine Datei wird direkt im Browser gelesen und nirgends gespeichert.",
  privacyServer: "Für Händlererkennung und Tipps gehen nur Buchungstexte und Summen kurz an unseren Server – verarbeitet, nicht gespeichert.",
  privacyGone: "Tab zu, alles weg.",
  exportHintsTitle: "Wie exportiere ich meinen Kontoauszug?",
  exportHintsLead: "Die Menüs heissen je nach Bank und App-Version etwas anders – so ungefähr findest du den Export:",
  hintUbs: "E-Banking → Konto wählen → Kontobewegungen → Exportieren (CSV) oder Kontoauszug als PDF.",
  hintPostfinance: "E-Finance → Konten → Bewegungen → Export als CSV, oder unter Dokumente den Kontoauszug als PDF.",
  hintRaiffeisen: "E-Banking → Konten → Kontoumsätze → Exportieren als CSV oder CAMT.053.",
  hintZkb: "eBanking → Konten → Kontobewegungen → Export als CSV oder Excel.",
  hintRevolut: "App → Konto → Kontoauszug → Format Excel/CSV oder PDF und Zeitraum wählen.",
  hintNeonYuh: "App → Konto bzw. Profil → Dokumente/Kontoauszüge → PDF oder CSV herunterladen.",

  // Processing
  processingTitle: "Räppli zählt nach …",
  stageRead: "Datei lesen",
  stageCategorise: "Händler erkennen",
  stageAnalyse: "Zahlen rechnen",
  stageProgress: "{done} von {total}",
  cancel: "Abbrechen",

  // Errors
  errorTitle: "Da hat's gehakt",
  error_unsupported_format:
    "Dieses Dateiformat kennen wir (noch) nicht. Exportiere den Auszug als CSV, CAMT-XML, Excel oder PDF.",
  error_empty: "Die Datei ist leer. Exportiere den Kontoauszug nochmals und lade ihn neu hoch.",
  error_no_transactions:
    "In dieser Datei haben wir keine Buchungen gefunden. Prüf den gewählten Zeitraum oder probier ein anderes Exportformat.",
  error_pdf_extraction_failed:
    "Aus diesem PDF konnten wir keine Buchungen lesen. Ein CSV-Export klappt meistens zuverlässiger.",
  error_file_too_large: "Die Datei ist zu gross. Wähl einen kürzeren Zeitraum, zum Beispiel 12 Monate, und lade sie nochmals hoch.",
  error_unknown: "Beim Auswerten ist etwas schiefgelaufen. Versuch es nochmals oder teste mit den Beispieldaten.",
  retry: "Nochmals versuchen",
  otherFile: "Andere Datei wählen",

  // Dashboard header
  dashTitle: "Dein Räppli-Check",
  periodLabel: "Zeitraum",
  sourceLabel: "Quelle",
  format_csv: "CSV",
  format_camt: "CAMT-XML",
  format_xlsx: "Excel",
  format_pdf: "PDF",
  format_sample: "Beispieldaten",
  txCount: "{count} Buchungen",
  restart: "Neu starten",

  // KPIs
  kpiIncome: "Einnahmen",
  kpiSpending: "Ausgaben",
  kpiSaved: "Gespart",
  kpiNet: "Übrig",
  kpiSavingsRate: "Sparquote",
  kpiDaily: "Pro Tag",
  kpiPerMonth: "Ø {amount} pro Monat",
  kpiNoIncome: "Keine Einnahmen erkannt",
  kpiNetHint: "nach Ausgaben und Sparen",
  kpiSavingsRateHint: "vom Einkommen nicht ausgegeben",
  kpiDailyHint: "Ø Ausgaben pro Kalendertag",

  // Score
  scoreTitle: "Budget-Score",
  scoreOutOf: "von 100",
  scoreAria: "Budget-Score: {score} von 100",
  thinking: "Räppli denkt nach …",
  fallbackBadge: "Basis-Analyse ohne KI",

  // Categories
  catTitle: "Wofür dein Geld draufgeht",
  catTotal: "Ausgaben total",
  catPerMonth: "Ø {amount}/Mt.",
  catOnlyIn: "nur im {month}",
  catOther: "Weitere Kategorien",
  catFilterHint: "Tipp auf eine Kategorie, um ihre Buchungen zu sehen.",
  catEmpty: "Keine Ausgaben in diesem Zeitraum.",

  // Monthly trend
  trendTitle: "Monat für Monat",
  trendSingleMonth: "Dein Auszug umfasst nur einen Monat. Für einen Verlauf lade einen längeren Zeitraum hoch.",
  showTable: "Als Tabelle",
  showChart: "Als Diagramm",
  colMonth: "Monat",

  // Merchants
  merchantsTitle: "Top-Händler",
  merchantsCount: "{count}×",
  merchantsEmpty: "Keine Händler erkannt.",

  // Recurring
  recurringTitle: "Wiederkehrende Zahlungen",
  recurringTotal: "Deine Fixkosten: {amount}/Monat",
  recurringEmpty: "Keine regelmässigen Zahlungen erkannt.",
  freq_weekly: "wöchentlich",
  freq_monthly: "monatlich",
  freq_quarterly: "vierteljährlich",
  freq_yearly: "jährlich",
  perMonthShort: "{amount}/Mt.",

  // Weekday
  weekdayTitle: "Ausgaben nach Wochentag",
  weekdayPeak: "Am meisten gibst du am {day} aus.",

  // Largest
  largestTitle: "Die grössten Brocken",
  largestEmpty: "Keine Ausgaben gefunden.",

  // Insights
  strengthsTitle: "Das läuft gut",
  weaknessesTitle: "Da hakt's",
  critiqueTitle: "Klartext von Räppli",
  critiqueSuggestion: "Vorschlag",
  critiquePerMonth: "{amount}/Monat",
  savingsTitle: "Sparideen",
  effort_easy: "einfach",
  effort_medium: "mittel",
  effort_hard: "aufwendig",
  savingsPotential: "Sparpotenzial",
  savingsPerMonth: "{amount}/Monat",
  savingsPerYear: "{amount}/Jahr",
  insightsEmpty: "Nichts Auffälliges gefunden.",
  insightsStale: "Du hast Kategorien geändert – die Tipps basieren noch auf den alten Zahlen.",
  refreshInsights: "Tipps aktualisieren",

  // Transactions
  txTitle: "Alle Buchungen",
  txSearch: "Händler oder Buchungstext suchen",
  txAllCategories: "Alle Kategorien",
  txColDate: "Datum",
  txColDesc: "Buchung",
  txColCategory: "Kategorie",
  txColAmount: "Betrag",
  txSortBy: "Sortieren nach {col}",
  txShowMore: "Mehr anzeigen ({count} weitere)",
  txEmpty: "Keine Buchungen gefunden.",
  txResults: "{count} Buchungen",
  txClearFilter: "Filter zurücksetzen",
  recatTitle: "Kategorie ändern",
  recatApplyAll: "Für alle Buchungen bei {merchant}",
  recatAria: "Kategorie von «{name}» ändern, aktuell: {category}",
  recatDone: "Kategorie geändert. Die Auswertung ist aktualisiert.",
  close: "Schliessen",

  // Disclaimer
  disclaimer:
    "Räppli verschafft dir einen Überblick und ist keine Finanzberatung. Kategorien, Score und Tipps entstehen automatisch und können danebenliegen – prüf wichtige Entscheide selbst oder hol dir eine Fachperson dazu.",
} as const;

const fr = {
  metaTitle: "Analyser un relevé de compte",

  // Upload
  uploadTitle: "Où roulent tes Räppli ?",
  uploadLead:
    "Charge ton relevé de compte et vois en quelques secondes où part ton argent – avec score budget, critique honnête et idées d'économies concrètes.",
  dropTitle: "Glisse ton relevé de compte ici",
  dropActive: "Lâche – Räppli s'en occupe !",
  dropBrowse: "Choisir un fichier",
  dropOr: "ou",
  dropFormats: "CSV, CAMT-XML, Excel ou PDF",
  dropAria: "Charger un relevé de compte. Appuie sur Entrée pour choisir un fichier ou glisse un fichier ici.",
  sampleButton: "Tester avec des données d'exemple",
  privacyTitle: "Reste chez toi",
  privacyNoLogin: "Pas de login, pas de compte, pas de cookies.",
  privacyBrowser: "Ton fichier est lu directement dans le navigateur et n'est enregistré nulle part.",
  privacyServer: "Pour reconnaître les commerçants et donner des conseils, seuls les libellés et les totaux sont brièvement envoyés à notre serveur – traités, pas enregistrés.",
  privacyGone: "Onglet fermé, tout disparaît.",
  exportHintsTitle: "Comment exporter mon relevé de compte ?",
  exportHintsLead: "Les menus portent des noms un peu différents selon la banque et la version de l'app – voici à peu près où trouver l'export :",
  hintUbs: "E-Banking → choisir le compte → Mouvements → Exporter (CSV) ou relevé de compte en PDF.",
  hintPostfinance: "E-Finance → Comptes → Mouvements → Export en CSV, ou sous Documents le relevé de compte en PDF.",
  hintRaiffeisen: "E-Banking → Comptes → Mouvements → Exporter en CSV ou CAMT.053.",
  hintZkb: "eBanking → Comptes → Mouvements → Export en CSV ou Excel.",
  hintRevolut: "App → Compte → Relevé → choisir le format Excel/CSV ou PDF et la période.",
  hintNeonYuh: "App → Compte ou profil → Documents/Relevés → télécharger en PDF ou CSV.",

  // Processing
  processingTitle: "Räppli recompte …",
  stageRead: "Lire le fichier",
  stageCategorise: "Reconnaître les commerçants",
  stageAnalyse: "Faire les calculs",
  stageProgress: "{done} sur {total}",
  cancel: "Annuler",

  // Errors
  errorTitle: "Ça a coincé",
  error_unsupported_format:
    "On ne connaît pas (encore) ce format de fichier. Exporte le relevé en CSV, CAMT-XML, Excel ou PDF.",
  error_empty: "Le fichier est vide. Exporte à nouveau le relevé de compte et recharge-le.",
  error_no_transactions:
    "Nous n'avons trouvé aucune opération dans ce fichier. Vérifie la période choisie ou essaie un autre format d'export.",
  error_pdf_extraction_failed:
    "Nous n'avons pas pu lire d'opérations dans ce PDF. Un export CSV fonctionne le plus souvent mieux.",
  error_file_too_large: "Le fichier est trop volumineux. Choisis une période plus courte, par exemple 12 mois, et recharge-le.",
  error_unknown: "Quelque chose s'est mal passé pendant l'analyse. Réessaie ou teste avec les données d'exemple.",
  retry: "Réessayer",
  otherFile: "Choisir un autre fichier",

  // Dashboard header
  dashTitle: "Ton check Räppli",
  periodLabel: "Période",
  sourceLabel: "Source",
  format_csv: "CSV",
  format_camt: "CAMT-XML",
  format_xlsx: "Excel",
  format_pdf: "PDF",
  format_sample: "Données d'exemple",
  txCount: "{count} opérations",
  restart: "Recommencer",

  // KPIs
  kpiIncome: "Revenus",
  kpiSpending: "Dépenses",
  kpiSaved: "Épargné",
  kpiNet: "Reste",
  kpiSavingsRate: "Taux d'épargne",
  kpiDaily: "Par jour",
  kpiPerMonth: "Ø {amount} par mois",
  kpiNoIncome: "Aucun revenu détecté",
  kpiNetHint: "après dépenses et épargne",
  kpiSavingsRateHint: "du revenu non dépensé",
  kpiDailyHint: "Ø des dépenses par jour calendaire",

  // Score
  scoreTitle: "Score budget",
  scoreOutOf: "sur 100",
  scoreAria: "Score budget : {score} sur 100",
  thinking: "Räppli réfléchit …",
  fallbackBadge: "Analyse de base sans IA",

  // Categories
  catTitle: "Où part ton argent",
  catTotal: "Total des dépenses",
  catPerMonth: "Ø {amount}/mois",
  catOnlyIn: "seulement en {month}",
  catOther: "Autres catégories",
  catFilterHint: "Touche une catégorie pour voir ses opérations.",
  catEmpty: "Aucune dépense sur cette période.",

  // Monthly trend
  trendTitle: "Mois après mois",
  trendSingleMonth: "Ton relevé ne couvre qu'un mois. Pour voir une évolution, charge une période plus longue.",
  showTable: "En tableau",
  showChart: "En graphique",
  colMonth: "Mois",

  // Merchants
  merchantsTitle: "Top commerçants",
  merchantsCount: "{count}×",
  merchantsEmpty: "Aucun commerçant reconnu.",

  // Recurring
  recurringTitle: "Paiements récurrents",
  recurringTotal: "Tes frais fixes : {amount}/mois",
  recurringEmpty: "Aucun paiement régulier détecté.",
  freq_weekly: "hebdomadaire",
  freq_monthly: "mensuel",
  freq_quarterly: "trimestriel",
  freq_yearly: "annuel",
  perMonthShort: "{amount}/mois",

  // Weekday
  weekdayTitle: "Dépenses par jour de la semaine",
  weekdayPeak: "C'est le {day} que tu dépenses le plus.",

  // Largest
  largestTitle: "Les plus gros morceaux",
  largestEmpty: "Aucune dépense trouvée.",

  // Insights
  strengthsTitle: "Ça roule",
  weaknessesTitle: "Ça coince",
  critiqueTitle: "Franc-parler de Räppli",
  critiqueSuggestion: "Suggestion",
  critiquePerMonth: "{amount}/mois",
  savingsTitle: "Idées d'économies",
  effort_easy: "facile",
  effort_medium: "moyen",
  effort_hard: "exigeant",
  savingsPotential: "Potentiel d'économies",
  savingsPerMonth: "{amount}/mois",
  savingsPerYear: "{amount}/an",
  insightsEmpty: "Rien de remarquable trouvé.",
  insightsStale: "Tu as modifié des catégories – les conseils reposent encore sur les anciens chiffres.",
  refreshInsights: "Actualiser les conseils",

  // Transactions
  txTitle: "Toutes les opérations",
  txSearch: "Chercher un commerçant ou un libellé",
  txAllCategories: "Toutes les catégories",
  txColDate: "Date",
  txColDesc: "Opération",
  txColCategory: "Catégorie",
  txColAmount: "Montant",
  txSortBy: "Trier par {col}",
  txShowMore: "Afficher plus ({count} de plus)",
  txEmpty: "Aucune opération trouvée.",
  txResults: "{count} opérations",
  txClearFilter: "Réinitialiser le filtre",
  recatTitle: "Changer la catégorie",
  recatApplyAll: "Pour toutes les opérations chez {merchant}",
  recatAria: "Changer la catégorie de «{name}», actuellement : {category}",
  recatDone: "Catégorie modifiée. L'analyse est à jour.",
  close: "Fermer",

  // Disclaimer
  disclaimer:
    "Räppli te donne une vue d'ensemble et ne constitue pas un conseil financier. Catégories, score et conseils sont générés automatiquement et peuvent se tromper – vérifie toi-même les décisions importantes ou fais-toi aider par un spécialiste.",
} as const;

const it = {
  metaTitle: "Analizza l'estratto conto",

  // Upload
  uploadTitle: "Dove rotolano i tuoi Räppli?",
  uploadLead:
    "Carica il tuo estratto conto e scopri in pochi secondi dove va a finire il tuo denaro – con punteggio budget, critica sincera e idee concrete per risparmiare.",
  dropTitle: "Trascina qui l'estratto conto",
  dropActive: "Rilascia – ci pensa Räppli!",
  dropBrowse: "Scegli un file",
  dropOr: "oppure",
  dropFormats: "CSV, CAMT-XML, Excel o PDF",
  dropAria: "Carica l'estratto conto. Premi Invio per scegliere un file oppure trascina un file qui.",
  sampleButton: "Prova con dati di esempio",
  privacyTitle: "Resta da te",
  privacyNoLogin: "Nessun login, nessun conto, nessun cookie.",
  privacyBrowser: "Il tuo file viene letto direttamente nel browser e non viene salvato da nessuna parte.",
  privacyServer: "Per riconoscere i commercianti e dare consigli, solo i testi dei movimenti e i totali vengono inviati brevemente al nostro server – elaborati, non salvati.",
  privacyGone: "Scheda chiusa, tutto sparito.",
  exportHintsTitle: "Come esporto il mio estratto conto?",
  exportHintsLead: "I menu hanno nomi un po' diversi a seconda della banca e della versione dell'app – più o meno così trovi l'esportazione:",
  hintUbs: "E-Banking → scegli il conto → Movimenti → Esporta (CSV) oppure estratto conto in PDF.",
  hintPostfinance: "E-Finance → Conti → Movimenti → Esporta come CSV, oppure sotto Documenti l'estratto conto in PDF.",
  hintRaiffeisen: "E-Banking → Conti → Movimenti → Esporta come CSV o CAMT.053.",
  hintZkb: "eBanking → Conti → Movimenti → Esporta come CSV o Excel.",
  hintRevolut: "App → Conto → Estratto conto → scegli il formato Excel/CSV o PDF e il periodo.",
  hintNeonYuh: "App → Conto o profilo → Documenti/Estratti conto → scarica come PDF o CSV.",

  // Processing
  processingTitle: "Räppli sta contando …",
  stageRead: "Leggere il file",
  stageCategorise: "Riconoscere i commercianti",
  stageAnalyse: "Fare i calcoli",
  stageProgress: "{done} di {total}",
  cancel: "Annulla",

  // Errors
  errorTitle: "Qualcosa si è inceppato",
  error_unsupported_format:
    "Questo formato di file non lo conosciamo (ancora). Esporta l'estratto come CSV, CAMT-XML, Excel o PDF.",
  error_empty: "Il file è vuoto. Esporta di nuovo l'estratto conto e ricaricalo.",
  error_no_transactions:
    "In questo file non abbiamo trovato nessun movimento. Controlla il periodo scelto o prova un altro formato di esportazione.",
  error_pdf_extraction_failed:
    "Da questo PDF non siamo riusciti a leggere alcun movimento. Un'esportazione CSV di solito funziona meglio.",
  error_file_too_large: "Il file è troppo grande. Scegli un periodo più breve, per esempio 12 mesi, e ricaricalo.",
  error_unknown: "Qualcosa è andato storto durante l'analisi. Riprova oppure prova con i dati di esempio.",
  retry: "Riprova",
  otherFile: "Scegli un altro file",

  // Dashboard header
  dashTitle: "Il tuo check Räppli",
  periodLabel: "Periodo",
  sourceLabel: "Fonte",
  format_csv: "CSV",
  format_camt: "CAMT-XML",
  format_xlsx: "Excel",
  format_pdf: "PDF",
  format_sample: "Dati di esempio",
  txCount: "{count} movimenti",
  restart: "Ricomincia",

  // KPIs
  kpiIncome: "Entrate",
  kpiSpending: "Uscite",
  kpiSaved: "Risparmiato",
  kpiNet: "Rimasto",
  kpiSavingsRate: "Tasso di risparmio",
  kpiDaily: "Al giorno",
  kpiPerMonth: "Ø {amount} al mese",
  kpiNoIncome: "Nessuna entrata riconosciuta",
  kpiNetHint: "dopo uscite e risparmio",
  kpiSavingsRateHint: "del reddito non speso",
  kpiDailyHint: "Ø uscite per giorno di calendario",

  // Score
  scoreTitle: "Punteggio budget",
  scoreOutOf: "su 100",
  scoreAria: "Punteggio budget: {score} su 100",
  thinking: "Räppli sta pensando …",
  fallbackBadge: "Analisi di base senza IA",

  // Categories
  catTitle: "Dove va a finire il tuo denaro",
  catTotal: "Uscite totali",
  catPerMonth: "Ø {amount}/mese",
  catOnlyIn: "solo a {month}",
  catOther: "Altre categorie",
  catFilterHint: "Tocca una categoria per vederne i movimenti.",
  catEmpty: "Nessuna uscita in questo periodo.",

  // Monthly trend
  trendTitle: "Mese per mese",
  trendSingleMonth: "Il tuo estratto copre un solo mese. Per vedere un andamento, carica un periodo più lungo.",
  showTable: "Come tabella",
  showChart: "Come grafico",
  colMonth: "Mese",

  // Merchants
  merchantsTitle: "Top commercianti",
  merchantsCount: "{count}×",
  merchantsEmpty: "Nessun commerciante riconosciuto.",

  // Recurring
  recurringTitle: "Pagamenti ricorrenti",
  recurringTotal: "I tuoi costi fissi: {amount}/mese",
  recurringEmpty: "Nessun pagamento regolare riconosciuto.",
  freq_weekly: "settimanale",
  freq_monthly: "mensile",
  freq_quarterly: "trimestrale",
  freq_yearly: "annuale",
  perMonthShort: "{amount}/mese",

  // Weekday
  weekdayTitle: "Uscite per giorno della settimana",
  weekdayPeak: "Spendi di più il {day}.",

  // Largest
  largestTitle: "I bocconi più grossi",
  largestEmpty: "Nessuna uscita trovata.",

  // Insights
  strengthsTitle: "Qui va bene",
  weaknessesTitle: "Qui si inceppa",
  critiqueTitle: "Parole chiare da Räppli",
  critiqueSuggestion: "Suggerimento",
  critiquePerMonth: "{amount}/mese",
  savingsTitle: "Idee per risparmiare",
  effort_easy: "facile",
  effort_medium: "medio",
  effort_hard: "impegnativo",
  savingsPotential: "Potenziale di risparmio",
  savingsPerMonth: "{amount}/mese",
  savingsPerYear: "{amount}/anno",
  insightsEmpty: "Non abbiamo trovato nulla di particolare.",
  insightsStale: "Hai cambiato delle categorie – i consigli si basano ancora sui vecchi numeri.",
  refreshInsights: "Aggiorna i consigli",

  // Transactions
  txTitle: "Tutti i movimenti",
  txSearch: "Cerca commerciante o testo del movimento",
  txAllCategories: "Tutte le categorie",
  txColDate: "Data",
  txColDesc: "Movimento",
  txColCategory: "Categoria",
  txColAmount: "Importo",
  txSortBy: "Ordina per {col}",
  txShowMore: "Mostra altri ({count} in più)",
  txEmpty: "Nessun movimento trovato.",
  txResults: "{count} movimenti",
  txClearFilter: "Azzera il filtro",
  recatTitle: "Cambia categoria",
  recatApplyAll: "Per tutti i movimenti presso {merchant}",
  recatAria: "Cambia la categoria di «{name}», attuale: {category}",
  recatDone: "Categoria cambiata. L'analisi è aggiornata.",
  close: "Chiudi",

  // Disclaimer
  disclaimer:
    "Räppli ti dà una panoramica e non costituisce una consulenza finanziaria. Categorie, punteggio e consigli nascono in automatico e possono sbagliare – verifica da solo le decisioni importanti o rivolgiti a un esperto.",
} as const;

const en = {
  metaTitle: "Analyse your bank statement",

  // Upload
  uploadTitle: "Where are your Räppli rolling off to?",
  uploadLead:
    "Upload your bank statement and see in seconds where your money goes – with a budget score, honest critique and concrete saving ideas.",
  dropTitle: "Drag your bank statement here",
  dropActive: "Let go – Räppli takes over!",
  dropBrowse: "Choose a file",
  dropOr: "or",
  dropFormats: "CSV, CAMT-XML, Excel or PDF",
  dropAria: "Upload bank statement. Press Enter to choose a file, or drag a file here.",
  sampleButton: "Try with sample data",
  privacyTitle: "Stays with you",
  privacyNoLogin: "No login, no account, no cookies.",
  privacyBrowser: "Your file is read right in the browser and isn't stored anywhere.",
  privacyServer: "To recognise merchants and give tips, only transaction descriptions and totals briefly go to our server – processed, not stored.",
  privacyGone: "Close the tab and it's all gone.",
  exportHintsTitle: "How do I export my bank statement?",
  exportHintsLead: "Menus are named slightly differently depending on your bank and app version – this is roughly where to find the export:",
  hintUbs: "E-Banking → choose account → Transactions → Export (CSV) or statement as PDF.",
  hintPostfinance: "E-Finance → Accounts → Transactions → Export as CSV, or find the statement as PDF under Documents.",
  hintRaiffeisen: "E-Banking → Accounts → Transactions → Export as CSV or CAMT.053.",
  hintZkb: "eBanking → Accounts → Transactions → Export as CSV or Excel.",
  hintRevolut: "App → Account → Statement → choose Excel/CSV or PDF format and a period.",
  hintNeonYuh: "App → Account or profile → Documents/Statements → download as PDF or CSV.",

  // Processing
  processingTitle: "Räppli is counting …",
  stageRead: "Reading file",
  stageCategorise: "Recognising merchants",
  stageAnalyse: "Crunching numbers",
  stageProgress: "{done} of {total}",
  cancel: "Cancel",

  // Errors
  errorTitle: "Something snagged",
  error_unsupported_format:
    "We don't recognise this file format (yet). Export the statement as CSV, CAMT-XML, Excel or PDF.",
  error_empty: "The file is empty. Export the bank statement again and upload it anew.",
  error_no_transactions:
    "We couldn't find any transactions in this file. Check the selected period or try a different export format.",
  error_pdf_extraction_failed:
    "We couldn't read any transactions from this PDF. A CSV export usually works more reliably.",
  error_file_too_large: "The file is too large. Choose a shorter period, for example 12 months, and upload it again.",
  error_unknown: "Something went wrong during analysis. Try again or test with the sample data.",
  retry: "Try again",
  otherFile: "Choose another file",

  // Dashboard header
  dashTitle: "Your Räppli check",
  periodLabel: "Period",
  sourceLabel: "Source",
  format_csv: "CSV",
  format_camt: "CAMT-XML",
  format_xlsx: "Excel",
  format_pdf: "PDF",
  format_sample: "Sample data",
  txCount: "{count} transactions",
  restart: "Start over",

  // KPIs
  kpiIncome: "Income",
  kpiSpending: "Spending",
  kpiSaved: "Saved",
  kpiNet: "Left over",
  kpiSavingsRate: "Savings rate",
  kpiDaily: "Per day",
  kpiPerMonth: "avg. {amount} per month",
  kpiNoIncome: "No income detected",
  kpiNetHint: "after spending and saving",
  kpiSavingsRateHint: "of income not spent",
  kpiDailyHint: "avg. spending per calendar day",

  // Score
  scoreTitle: "Budget score",
  scoreOutOf: "out of 100",
  scoreAria: "Budget score: {score} out of 100",
  thinking: "Räppli is thinking …",
  fallbackBadge: "Basic analysis without AI",

  // Categories
  catTitle: "Where your money goes",
  catTotal: "Total spending",
  catPerMonth: "avg. {amount}/mo",
  catOnlyIn: "only in {month}",
  catOther: "Other categories",
  catFilterHint: "Tap a category to see its transactions.",
  catEmpty: "No spending in this period.",

  // Monthly trend
  trendTitle: "Month by month",
  trendSingleMonth: "Your statement covers just one month. To see a trend, upload a longer period.",
  showTable: "As table",
  showChart: "As chart",
  colMonth: "Month",

  // Merchants
  merchantsTitle: "Top merchants",
  merchantsCount: "{count}×",
  merchantsEmpty: "No merchants recognised.",

  // Recurring
  recurringTitle: "Recurring payments",
  recurringTotal: "Your fixed costs: {amount}/month",
  recurringEmpty: "No regular payments detected.",
  freq_weekly: "weekly",
  freq_monthly: "monthly",
  freq_quarterly: "quarterly",
  freq_yearly: "yearly",
  perMonthShort: "{amount}/mo",

  // Weekday
  weekdayTitle: "Spending by weekday",
  weekdayPeak: "You spend the most on {day}.",

  // Largest
  largestTitle: "The biggest chunks",
  largestEmpty: "No spending found.",

  // Insights
  strengthsTitle: "Going well",
  weaknessesTitle: "Needs work",
  critiqueTitle: "Straight talk from Räppli",
  critiqueSuggestion: "Suggestion",
  critiquePerMonth: "{amount}/month",
  savingsTitle: "Saving ideas",
  effort_easy: "easy",
  effort_medium: "medium",
  effort_hard: "demanding",
  savingsPotential: "Saving potential",
  savingsPerMonth: "{amount}/month",
  savingsPerYear: "{amount}/year",
  insightsEmpty: "Nothing out of the ordinary found.",
  insightsStale: "You changed some categories – the tips are still based on the old numbers.",
  refreshInsights: "Refresh tips",

  // Transactions
  txTitle: "All transactions",
  txSearch: "Search merchant or description",
  txAllCategories: "All categories",
  txColDate: "Date",
  txColDesc: "Transaction",
  txColCategory: "Category",
  txColAmount: "Amount",
  txSortBy: "Sort by {col}",
  txShowMore: "Show more ({count} more)",
  txEmpty: "No transactions found.",
  txResults: "{count} transactions",
  txClearFilter: "Clear filter",
  recatTitle: "Change category",
  recatApplyAll: "For all transactions at {merchant}",
  recatAria: "Change category of “{name}”, currently: {category}",
  recatDone: "Category changed. The analysis is updated.",
  close: "Close",

  // Disclaimer
  disclaimer:
    "Räppli gives you an overview and is not financial advice. Categories, score and tips are generated automatically and can be wrong – check important decisions yourself or consult a professional.",
} as const;

export const analyseMessages = defineMessages({ de, fr, it, en });

export type AnalyseMessageKey = keyof typeof de;
