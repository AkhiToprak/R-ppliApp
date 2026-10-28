import type { CategoryId, Transaction } from "@/lib/types";

// Rule-based categoriser for Swiss bank bookings (DE / FR / IT / EN).
//
// How matching works
// - Booking texts are normalised: lower-case, accent-free, "ä"/"ae" -> "a", "ö"/"oe" -> "o",
//   "ü"/"ue" -> "u", "ß" -> "ss", "&" -> " and ", "+" -> " plus ", apostrophes dropped,
//   everything else that is not a-z/0-9 becomes a single space. Patterns go through the
//   very same normaliser, so "Zürich", "Zuerich" and "ZURICH" are one and the same.
// - Pattern syntax: plain words, a space inside a pattern matches an optional space
//   ("sun store" also matches "sunstore"). By default a pattern needs a non-letter on both
//   sides (digits are fine: "COOP4711" matches "coop"). A leading "~" allows letters in
//   front (compounds such as "Kantonsspital"), a trailing "~" allows letters behind
//   ("restaurant~" matches "Restaurants", "Restaurantbetrieb").
// - Rules are tried top to bottom, the first hit wins. Specific rules therefore come first
//   (Uber Eats before Uber, Coop Mobile before Coop, ...), generic keywords come last.
// - Brand rules apply to any sign (a positive amount is then a refund and keeps the
//   category). Generic keyword rules default to outflows only, because "Restaurant" on an
//   incoming payment says nothing; they opt in to both signs where that is meaningful.
// - Bare city names are never patterns ("Zürich", "Basel", "Genève" ...).

export interface RuleMatch {
  category: CategoryId;
  /** Pretty merchant name, only for brand rules. */
  merchant?: string;
}

type Sign = "any" | "neg";

interface RuleOptions {
  sign?: Sign;
  /** Raw regexes tested against the normalised text (no lookbehind: Safari < 16.4). */
  re?: RegExp[];
  /** If any of these match, the rule does not fire. */
  not?: RegExp[];
}

interface CompiledRule {
  /** null = "block": the text is recognised but deliberately left for the LLM. */
  category: CategoryId | null;
  merchant?: string;
  sign: Sign;
  tests: RegExp[];
  not: RegExp[];
}

// ---------------------------------------------------------------------------------------
// Normalisation + pattern compiler
// ---------------------------------------------------------------------------------------

export function normaliseText(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " plus ")
    .replace(/ß/g, "ss")
    .replace(/æ/g, "ae")
    .replace(/œ/g, "oe")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’`´]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/([aou])e/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function compileWord(spec: string): RegExp {
  let s = spec;
  let left = true;
  let right = true;
  if (s.startsWith("~")) {
    left = false;
    s = s.slice(1);
  }
  if (s.endsWith("~")) {
    right = false;
    s = s.slice(0, -1);
  }
  const body = normaliseText(s)
    .split(" ")
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(" ?");
  return new RegExp((left ? "(?:^|[^a-z])" : "") + body + (right ? "(?![a-z])" : ""));
}

const RULES: CompiledRule[] = [];
let patternCount = 0;

function add(
  category: CategoryId | null,
  merchant: string | undefined,
  words: string[],
  defaultSign: Sign,
  opts: RuleOptions,
): void {
  const tests = [...words.map(compileWord), ...(opts.re ?? [])];
  patternCount += tests.length;
  RULES.push({
    category,
    merchant,
    sign: opts.sign ?? defaultSign,
    tests,
    not: opts.not ?? [],
  });
}

/** Known merchant: matches either sign (positive = refund). */
function brand(category: CategoryId, merchant: string, words: string[], opts: RuleOptions = {}): void {
  add(category, merchant, words, "any", opts);
}

/** Generic keyword: outflows only unless `sign: "any"`. No merchant name. */
function generic(category: CategoryId, words: string[], opts: RuleOptions = {}): void {
  add(category, undefined, words, "neg", opts);
}

/** Several unrelated brands of one category, each with its own display name. */
function multi(category: CategoryId, entries: [string, string[]][]): void {
  for (const [merchant, words] of entries) brand(category, merchant, words);
}

/** Keyword group that is meaningful for incoming payments as well. */
function genericAny(category: CategoryId, words: string[], opts: RuleOptions = {}): void {
  add(category, undefined, words, "any", opts);
}

/** Recognised but ambiguous: stop here and let the LLM decide. */
function block(words: string[], opts: RuleOptions = {}): void {
  add(null, undefined, words, "any", opts);
}

// ---------------------------------------------------------------------------------------
// A. Cross-cutting specifics (must precede the generic brand groups)
// ---------------------------------------------------------------------------------------

// Uber: "über" normalises to "uber", so a bare "uber" would match "Zahlung über CHF ...".
// Only match Uber with the markers that appear on real booking texts.
brand("restaurants", "Uber Eats", ["uber eats"]);
brand("subscriptions", "Uber One", ["uber one"]);
brand(
  "transport",
  "Uber",
  ["uber trip", "uber ride", "uber bv", "uber b v", "uber technologies", "help uber", "uber pending"],
  { re: [/^uber$/] },
);

// Mortgage interest must beat "Migros Bank" / "Raiffeisen" style names.
brand("housing", "Hypothek", ["hypothek~", "hypotheque~", "ipotec~"]);

// Bank-account fees that look like other things.
genericAny("fees", [
  "bargeldbezugsgebuhr",
  "bancomat gebuhr",
  "~bezugsgebuhr",
  "fremdwahrungsgebuhr",
  "fremdwahrungszuschlag",
  "bearbeitungsgebuhr",
  "wahrungsumrechnung",
  "wechselgebuhr",
  "frais de change",
  "frais de retrait",
  "frais de tenue de compte",
  "frais de compte",
  "frais bancaires",
  "spese bancarie",
  "spese di conto",
  "spese di tenuta conto",
  "spese di prelievo",
  "commissione di prelievo",
  "foreign transaction fee",
  "currency conversion fee",
  "atm fee",
]);

// Migros Bank: fees / transfers depending on the text, otherwise leave it to the LLM,
// but never fall through to "Migros" = groceries.
brand("fees", "Migros Bank", [], { re: [/migros bank.*(?:gebuhr|spesen|kontofuhrung|preis|zins|frais|commission)/] });
brand("transfers", "Migros Bank", [], {
  re: [/migros bank.*(?:ubertrag|uberweisung|dauerauftrag|virement|umbuchung|trasferimento)/],
});
block(["migros bank"]);

// Coop sub-brands.
brand("telecom", "Coop Mobile", ["coop mobile"]);
brand("health", "Coop Vitality", ["coop vitality"]);
brand("shopping", "Coop Bau+Hobby", ["coop bau plus hobby", "bau plus hobby", "coop bau hobby"]);
brand("shopping", "Coop City", ["coop city"]);
brand("restaurants", "Coop Restaurant", ["coop restaurant", "coop takeaway", "coop take away"]);
brand("insurance", "Coop Rechtsschutz", ["coop rechtsschutz"]);
brand("car", "Coop Pronto Tankstelle", ["coop mineralol~", "coop tankstelle~"], {
  re: [/coop pronto.*(?:tankstelle|benzin|treibstoff|tanken|carburant|station service)/],
});

// Migros sub-brands.
brand("leisure", "Migros Fitnesspark", ["migros fitness~", "fitnesspark"]);
brand("education", "Klubschule Migros", ["migros klubschule", "klubschule", "ecole club migros", "scuola club migros"]);
brand("groceries", "Migros Online", ["migros online", "leshop", "le shop"]);
brand("telecom", "M-Budget Mobile", ["m budget mobile", "mbudget mobile", "migros mobile"]);
brand("shopping", "Melectronics", ["melectronics", "m electronics"]);
brand("shopping", "Do it + Garden", ["do it plus garden", "doit plus garden", "do it garden", "doit garden"]);
brand("shopping", "SportXX", ["sportxx", "sport xx"]);
brand("shopping", "Micasa", ["micasa"]);
brand("restaurants", "Migros Restaurant", ["migros restaurant", "migros take away", "migros takeaway", "migros gastro"]);
brand("health", "Migros Apotheke", ["migros apotheke"]);
brand("travel", "Hotelplan", ["hotelplan", "hotel plan", "migros reisen"]);

// Galaxus / Digitec sub-brands.
brand("telecom", "Galaxus Mobile", ["galaxus mobile", "digitec mobile"]);

// Manor / Globus split between food and department store.
brand("groceries", "Manor Food", ["manor food"]);
brand("restaurants", "Manora", ["manora", "manor restaurant"]);
brand("groceries", "Globus Delicatessa", ["globus delicatessa", "globus feinkost", "globus food", "delicatessa"]);

// Swisscom TV products are subscriptions, the rest of Swisscom is telecom.
brand("subscriptions", "Blue (Swisscom)", [
  "swisscom blue",
  "swisscom tv",
  "blue tv",
  "blue entertainment",
  "blue video",
  "blue sport",
  "blue cinema",
  "blue plus",
]);

// TCS: insurance products vs. membership / patrol (car).
brand("insurance", "TCS Versicherung", [
  "tcs versicherung~",
  "tcs assurance~",
  "tcs assicurazione~",
  "tcs rechtsschutz",
  "tcs insurance",
  "tcs protection juridique",
]);

// Swiss Life 3a vs. insurance; Yuh invest vs. Yuh account.
brand("savings", "Swiss Life 3a", [], { re: [/swiss life.*(?:3a|saule|pilier|pilastro|vorsorge)/] });
brand("savings", "Yuh Invest", ["yuh invest", "yuh swissquote", "swissquote yuh"]);

// Apple / Google / Amazon / Microsoft / Disney split between shop and subscriptions.
brand("shopping", "Apple Store", ["apple store", "apple retail", "apple online store"]);
brand("subscriptions", "Apple", [
  "apple com bill",
  "apple services",
  "apple music",
  "apple tv",
  "apple one",
  "apple arcade",
  "icloud",
  "itunes",
  "app store",
]);
brand("subscriptions", "Google", [
  "google one",
  "google storage",
  "google workspace",
  "google gsuite",
  "google play",
  "google youtube",
  "google nest aware",
  "youtube premium",
  "youtube music",
  "youtubepremium",
]);
brand("subscriptions", "Amazon Prime", [
  "amazon prime",
  "prime video",
  "amazon music",
  "kindle unlimited",
  "amazon digital",
  "audible",
]);
brand("shopping", "Disney Store", ["disney store", "shopdisney"]);
brand("leisure", "Disneyland", ["disneyland~"]);

// Rental cars are "car", not travel.
brand("car", "Sixt", ["sixt"]);
brand("car", "Hertz", ["hertz"]);
brand("car", "Europcar", ["europcar"]);
brand("car", "Avis", ["avis rent~", "avis car~", "avis location", "avis budget", "avis autovermietung"]);

// Revolut plan fee / top-up and Twint top-up.
brand("fees", "Revolut", ["revolut premium", "revolut metal", "revolut plus", "revolut ultra", "revolut plan"]);

// ---------------------------------------------------------------------------------------
// B. Brand groups by category
// ---------------------------------------------------------------------------------------

// ---- groceries
brand("groceries", "Migrolino", ["migrolino"]);
brand("groceries", "Migros", ["migros", "migros m"]);
brand("groceries", "Coop Pronto", ["coop pronto"]);
brand("groceries", "Coop", ["coop", "coop ch", "coop home"]);
brand("groceries", "Denner", ["denner"]);
brand("groceries", "Aldi Suisse", ["aldi"]);
brand("groceries", "Lidl", ["lidl"]);
brand("groceries", "Volg", ["volg"]);
brand("groceries", "Spar", ["spar", "spar express", "spar supermarkt", "spar gourmet"], { not: [/spar und leih/] });
brand("groceries", "Landi", ["landi", "landi markt"]);
brand("groceries", "Alnatura", ["alnatura"]);
brand("groceries", "Avec", [], { re: [/(?:^|[^a-z])avec ?(?:box|now|shop|bahnhof|hb|station|express|\d)/] });
brand("groceries", "Aperto", ["aperto"]);
brand("groceries", "K Kiosk", ["k kiosk", "kkiosk", "valora kiosk"]);
brand("groceries", "Farmy", ["farmy"]);
brand("groceries", "Too Good To Go", ["too good to go", "toogoodtogo"]);
brand("groceries", "Primo", ["primo"], { not: [/primo piatto/] });
brand("groceries", "Pam", ["pam"]);
brand("groceries", "Usego", ["usego"]);
brand("groceries", "Otto's", ["ottos", "otto s"]);
brand("groceries", "Lindt", ["lindt"]);
brand("groceries", "Läderach", ["laderach"]);
brand("groceries", "Nespresso", ["nespresso"]);
brand("groceries", "Back-Factory", ["back factory", "backfactory"]);
brand("groceries", "Bio Partner", ["bio partner", "biopartner"]);
brand("groceries", "Fenaco", ["fenaco"]);

// ---- restaurants
brand("restaurants", "McDonald's", ["mc ?donald~", "mcdonalds"]);
brand("restaurants", "Burger King", ["burger king"]);
brand("restaurants", "Starbucks", ["starbucks"]);
brand("restaurants", "Vapiano", ["vapiano"]);
brand("restaurants", "Tibits", ["tibits"]);
brand("restaurants", "Hiltl", ["hiltl"]);
brand("restaurants", "Holy Cow", ["holy cow"]);
brand("restaurants", "Subway", ["subway"]);
brand("restaurants", "Just Eat", ["just eat", "eat ch", "takeaway com", "just eat takeaway"]);
brand("restaurants", "Smood", ["smood"]);
brand("restaurants", "Domino's", ["dominos", "domino s", "dominos pizza"]);
brand("restaurants", "Zizzi", ["zizzi"]);
brand("restaurants", "Nordsee", ["nordsee"]);
brand("restaurants", "Sprüngli", ["sprungli", "confiserie sprungli", "cafe sprungli"]);
brand("restaurants", "Brezelkönig", ["brezelkonig", "brezel konig"]);
brand("restaurants", "KFC", ["kfc", "kentucky fried chicken"]);
brand("restaurants", "Five Guys", ["five guys"]);
brand("restaurants", "Pizza Hut", ["pizza hut"]);
brand("restaurants", "Dunkin'", ["dunkin"]);
brand("restaurants", "Dean & David", ["dean and david"]);
brand("restaurants", "Ben & Jerry's", ["ben and jerrys"]);
brand("restaurants", "Balzac Coffee", ["balzac coffee"]);
brand("restaurants", "Coffee Fellows", ["coffee fellows"]);
brand("restaurants", "Le Pain Quotidien", ["le pain quotidien"]);
brand("restaurants", "Ditsch", ["ditsch"]);
brand("restaurants", "Foodora", ["foodora"]);
brand("restaurants", "Deliveroo", ["deliveroo"]);
brand("restaurants", "Wolt", ["wolt"]);
brand("restaurants", "Lieferando", ["lieferando"]);
brand("restaurants", "Candrian Catering", ["candrian"]);
brand("restaurants", "Tim Hortons", ["tim hortons"]);

// ---- transport
brand("transport", "SBB", ["sbb", "cff", "ffs", "sbb mobile", "sbb ticket"]);
brand("transport", "ZVV", ["zvv", "zurcher verkehrsverbund"]);
brand("transport", "BLT", ["baselland transport", "blt tarif", "blt ticket", "blt billett"]);
brand("transport", "BVB", ["bvb", "basler verkehrs betriebe"]);
brand("transport", "TPG", ["tpg", "transports publics genevois", "unireso"]);
brand("transport", "TL", ["transports publics lausannois", "tl lausanne", "tl abo", "tl billet"]);
brand("transport", "Bernmobil", ["bernmobil", "bern mobil"]);
brand("transport", "VBZ", ["vbz", "verkehrsbetriebe zurich"]);
brand("transport", "VBL", ["vbl luzern", "verkehrsbetriebe luzern"]);
brand("transport", "PostAuto", ["postauto~", "post auto", "carpostal", "autopostale", "car postal"]);
brand("transport", "Libero", ["libero tarif~", "libero abo", "libero ticket", "libero billett", "libero zone~"]);
brand("transport", "Passepartout", ["passepartout"]);
brand("transport", "Mobility", ["mobility", "mobility genossenschaft", "mobility carsharing"]);
brand("transport", "PubliBike", ["publibike", "publi bike"]);
brand("transport", "Bolt", ["bolt eu", "bolt ride~", "bolt trip~", "bolt technology"], { re: [/^bolt$/] });
brand("transport", "Lime", ["lime ride~", "lime bike", "lime scooter", "limebike", "neutron holdings"]);
brand("transport", "Tier", ["tier mobility", "tier scooter", "tier app"]);
brand("transport", "Free Now", ["free now", "freenow", "mytaxi"]);
brand("transport", "Lyft", ["lyft"]);
brand("transport", "BLS", ["bls", "bls ag"]);
brand("transport", "SOB", ["sudostbahn", "sob billet", "sob ticket", "sob abo"]);
brand("transport", "RhB", ["rhb", "ratische bahn", "rhatische bahn"]);
brand("transport", "Zentralbahn", ["zentralbahn"]);
brand("transport", "Thurbo", ["thurbo"]);
brand("transport", "TILO", ["tilo"]);
brand("transport", "Swiss Travel Pass", ["swiss travel pass", "swiss travel system", "swiss half fare"]);
brand("transport", "Halbtax / GA", ["halbtax~", "half fare", "generalabonnement", "ga travelcard", "demi tarif", "abonnement general"]);
brand("transport", "Matterhorn Gotthard Bahn", ["matterhorn gotthard"]);
brand("transport", "Verkehrsverbund", ["tarifverbund~", "verkehrsverbund~", "verkehrsbetriebe~", "tnw tarifverbund", "ostwind tarif~", "a welle"]);
multi("transport", [
  ["Donkey Republic", ["donkey republic"]],
  ["Nextbike", ["nextbike"]],
  ["Voi", ["voi technology"]],
]);
brand("transport", "Sharoo", ["sharoo"]);
brand("transport", "BlaBlaCar", ["blablacar", "bla bla car"]);

// ---- car
brand("car", "Shell", ["shell"]);
brand("car", "BP", ["bp", "bp tankstelle", "bp station", "bp connect"]);
brand("car", "Avia", ["avia"]);
brand("car", "Agrola", ["agrola"]);
brand("car", "Migrol", ["migrol", "migrol service"]);
brand("car", "Socar", ["socar"]);
brand("car", "Tamoil", ["tamoil"]);
brand("car", "Eni", ["eni", "eni station"]);
brand("car", "Esso", ["esso"]);
brand("car", "TCS", ["tcs", "touring club schweiz", "touring club suisse"]);
brand("car", "ParkingPay", ["parkingpay", "parking pay"]);
brand("car", "EasyPark", ["easypark", "easy park"]);
brand("car", "Parkster", ["parkster"]);
brand("car", "APCOA", ["apcoa"]);
genericAny("car", [
  "strassenverkehrsamt",
  "strassenverkehrs und schifffahrtsamt",
  "service des automobiles",
  "motorfahrzeugkontrolle",
  "motorfahrzeugsteuer~",
  "verkehrssteuer",
  "ufficio della circolazione",
  "mfk",
]);
genericAny("car", ["autobahnvignette", "vignette~", "e vignette", "evignette"]);
brand("car", "AMAG", ["amag", "amag retail", "amag import"]);
brand("car", "Emil Frey", ["emil frey"]);
brand("car", "Carglass", ["carglass", "autoglas"]);
genericAny("car", ["autogarage", "carrosserie~", "autowerkstatt", "pneuhaus", "vulco", "euromaster", "dekra"]);
genericAny("car", ["waschanlage~", "autowaschanlage", "waschstrasse", "car wash", "autowasch~", "lavage auto"]);
brand("car", "Tesla Supercharger", ["tesla supercharger", "supercharger"]);
multi("car", [
  ["Fastned", ["fastned"]],
  ["Ionity", ["ionity"]],
  ["Swisscharge", ["swisscharge"]],
  ["evpass", ["evpass"]],
  ["Plug'n Roll", ["plug n roll", "plugnroll"]],
  ["GoFast", ["gofast"]],
]);
genericAny("car", ["ladestation~", "ladesaule~"]);

// ---- housing
brand("housing", "Livit", ["livit"]);
brand("housing", "Wincasa", ["wincasa"]);
brand("housing", "Privera", ["privera"]);
brand("housing", "Fortimo", ["fortimo"]);
brand("housing", "Naef Immobilier", ["naef immobilier", "naef immo"]);
brand("housing", "Comptoir Immobilier", ["comptoir immobilier"]);
brand("housing", "HEV", ["hev schweiz", "hev zurich", "hev bern", "hauseigentumerverband"]);
brand("housing", "Mieterverband", ["mieterverband", "mieterinnen und mieterverband", "asloca"]);
multi("housing", [
  ["Flatfox", ["flatfox"]],
  ["Homegate", ["homegate"]],
  ["ImmoScout24", ["immoscout"]],
]);
brand("housing", "Swiss Life REIM", ["swiss life reim", "swiss life immobilien"]);

// ---- utilities
brand("utilities", "EWZ", ["ewz"]);
brand("utilities", "EKZ", ["ekz"]);
brand("utilities", "BKW", ["bkw"]);
brand("utilities", "CKW", ["ckw"]);
brand("utilities", "Romande Energie", ["romande energie"]);
brand("utilities", "SIG", ["services industriels de geneve", "sig geneve", "sig facture"]);
brand("utilities", "IWB", ["iwb"]);
brand("utilities", "ewb", ["ewb", "energie wasser bern"]);
brand("utilities", "Groupe E", ["groupe e"]);
brand("utilities", "AET", ["azienda elettrica ticinese", "aet ticino", "aet bellinzona", "aet fattura"]);
brand("utilities", "Primeo Energie", ["primeo"]);
brand("utilities", "Axpo", ["axpo"]);
brand("utilities", "Alpiq", ["alpiq"]);
brand("utilities", "Repower", ["repower"]);
brand("utilities", "EWL", ["ewl luzern", "ewl"]);
brand("utilities", "EBL", ["ebl"]);
brand("utilities", "AEW", ["aew energie", "aew"]);
brand("utilities", "St.Galler Stadtwerke", ["st galler stadtwerke", "sgsw", "stadtwerke~"]);
brand("utilities", "Energie 360°", ["energie 360", "erdgas zurich", "gasverbund"]);
brand("utilities", "Services Industriels", ["services industriels", "sil lausanne", "viteos", "sinergy", "ail lugano"]);
brand("utilities", "Energiedienst", ["energiedienst", "elektra"]);

// ---- telecom
brand("telecom", "Swisscom", ["swisscom", "swisscom schweiz", "swisscom shop", "bluewin"]);
brand("telecom", "Sunrise", ["sunrise", "sunrise upc", "upc", "upc cablecom", "cablecom"]);
brand("telecom", "Salt", ["salt", "salt mobile"]);
brand("telecom", "Yallo", ["yallo"]);
brand("telecom", "Wingo", ["wingo"]);
brand("telecom", "Quickline", ["quickline"]);
brand("telecom", "iWay", ["iway"]);
brand("telecom", "init7", ["init7", "fiber7"]);
brand("telecom", "Digital Republic", ["digital republic"]);
brand("telecom", "Lebara", ["lebara"]);
brand("telecom", "Lycamobile", ["lycamobile", "lyca mobile"]);
brand("telecom", "Green.ch", ["green ch"]);
brand("telecom", "Mobilezone", ["mobilezone"]);
brand("telecom", "Monzoon", ["monzoon"]);
brand("telecom", "Telekom", ["telekom"]);
brand("telecom", "Vodafone", ["vodafone"]);

// ---- insurance
brand("insurance", "CSS", ["css", "css versicherung"]);
brand("insurance", "Helsana", ["helsana"]);
brand("insurance", "Swica", ["swica"]);
brand("insurance", "Sanitas", ["sanitas"]);
brand("insurance", "Visana", ["visana"]);
brand("insurance", "Concordia", ["concordia"]);
brand("insurance", "KPT", ["kpt"]);
brand("insurance", "Groupe Mutuel", ["groupe mutuel", "avenir assurance", "mutuel assurance"]);
brand("insurance", "Assura", ["assura", "assura basis"]);
brand("insurance", "Atupri", ["atupri"]);
brand("insurance", "Sympany", ["sympany", "vivao sympany"]);
brand("insurance", "ÖKK", ["okk"]);
brand("insurance", "EGK", ["egk", "egk grundversicherungen"]);
brand("insurance", "Mobiliar", ["mobiliar", "die mobiliar", "schweizerische mobiliar"]);
brand("insurance", "AXA", ["axa", "axa winterthur"]);
brand("insurance", "Zurich Versicherung", ["zurich versicherung~", "zurich insurance", "zurich assurance~", "zurich gruppe"]);
brand("insurance", "Allianz", ["allianz", "allianz suisse"]);
brand("insurance", "Generali", ["generali"]);
brand("insurance", "Baloise", ["baloise", "basler versicherung~"]);
brand("insurance", "Helvetia", ["helvetia", "helvetia versicherung~"]);
brand("insurance", "Vaudoise", ["vaudoise"]);
brand("insurance", "Smile", ["smile versicherung~", "smile direct", "smile krankenversicherung"]);
brand("insurance", "Swiss Life", ["swiss life"]);
brand("insurance", "Pax", ["pax versicherung~", "pax schweizerische"]);
brand("insurance", "Agrisano", ["agrisano"]);
brand("insurance", "Aquilana", ["aquilana"]);
brand("insurance", "Sana24", ["sana24"]);
brand("insurance", "Wincare", ["wincare"]);
brand("insurance", "Galenos", ["galenos"]);
brand("insurance", "Easy Sana", ["easy sana", "easysana"]);
brand("insurance", "Emmental Versicherung", ["emmental versicherung~"]);
multi("insurance", [
  ["Protekta", ["protekta"]],
  ["Dextra", ["dextra rechtsschutz"]],
  ["Orion", ["orion rechtsschutz"]],
  ["CAP Rechtsschutz", ["cap rechtsschutz"]],
  ["Assista", ["assista"]],
]);
genericAny("insurance", ["ausgleichskasse~", "caisse de compensation", "cassa di compensazione", "ahv", "avs"]);

// ---- health
brand("health", "Amavita", ["amavita"]);
brand("health", "Sun Store", ["sun store", "sunstore"]);
brand("health", "TopPharm", ["toppharm"]);
brand("health", "Benu", ["benu"]);
brand("health", "Zur Rose", ["zur rose", "shop apotheke"]);
brand("health", "Medbase", ["medbase"]);
brand("health", "Santémed", ["santemed"]);
brand("health", "Fielmann", ["fielmann"]);
brand("health", "Visilab", ["visilab"]);
brand("health", "McOptik", ["mcoptik", "mc optik"]);
brand("health", "Kochoptik", ["kochoptik", "koch optik"]);
brand("health", "Hirslanden", ["hirslanden"]);
brand("health", "Medi24", ["medi24"]);
brand("health", "Swiss Medical Network", ["swiss medical network"]);
multi("health", [
  ["Unilabs", ["unilabs"]],
  ["Viollier", ["viollier"]],
  ["Dianalabs", ["dianalabs"]],
  ["Medisyn", ["medisyn"]],
  ["Labor Risch", ["labor risch"]],
  ["Synlab", ["synlab"]],
]);
genericAny("health", ["spitex~"]);
multi("health", [
  ["USZ", ["usz"]],
  ["CHUV", ["chuv"]],
  ["Inselspital", ["inselspital"]],
]);

// ---- shopping
brand("shopping", "Galaxus", ["galaxus", "digitec galaxus"]);
brand("shopping", "Digitec", ["digitec"]);
brand("shopping", "Zalando", ["zalando"]);
brand("shopping", "Manor", ["manor"]);
brand("shopping", "Globus", ["globus"]);
brand("shopping", "Jelmoli", ["jelmoli"]);
brand("shopping", "H&M", ["h and m", "hennes and mauritz"]);
brand("shopping", "Zara", ["zara"]);
brand("shopping", "Mango", ["mango"]);
brand("shopping", "Uniqlo", ["uniqlo"]);
brand("shopping", "C&A", ["c and a"]);
multi("shopping", [
  ["Pull&Bear", ["pull and bear"]],
  ["Bershka", ["bershka"]],
  ["Stradivarius", ["stradivarius"]],
  ["Massimo Dutti", ["massimo dutti"]],
]);
brand("shopping", "Primark", ["primark"]);
brand("shopping", "Esprit", ["esprit"]);
brand("shopping", "Ochsner Sport", ["ochsner sport", "ochsner shoes", "ochsner"]);
brand("shopping", "SportX", ["sportx", "sport x"]);
brand("shopping", "Decathlon", ["decathlon"]);
brand("shopping", "Intersport", ["intersport"]);
brand("shopping", "Athleticum", ["athleticum"]);
brand("shopping", "Transa", ["transa"]);
brand("shopping", "Mammut", ["mammut"]);
brand("shopping", "Globetrotter", ["globetrotter"]);
brand("shopping", "Interdiscount", ["interdiscount"]);
brand("shopping", "MediaMarkt", ["media markt", "mediamarkt"]);
brand("shopping", "Fust", ["fust"]);
brand("shopping", "Brack", ["brack", "brack ch"]);
brand("shopping", "Microspot", ["microspot"]);
brand("shopping", "Conrad", ["conrad electronic~"]);
brand("shopping", "Steg Electronics", ["steg electronics"]);
brand("shopping", "IKEA", ["ikea"]);
brand("shopping", "Pfister", ["pfister"]);
brand("shopping", "Interio", ["interio"]);
brand("shopping", "Livique", ["livique"]);
brand("shopping", "Lipo", ["lipo"]);
brand("shopping", "Conforama", ["conforama"]);
brand("shopping", "Maisons du Monde", ["maisons du monde"]);
brand("shopping", "XXXLutz", ["xxxlutz"]);
brand("shopping", "Jumbo", ["jumbo"]);
brand("shopping", "Hornbach", ["hornbach"]);
brand("shopping", "Bauhaus", ["bauhaus"]);
brand("shopping", "OBI", ["obi"]);
brand("shopping", "Orell Füssli", ["orell fussli"]);
brand("shopping", "Thalia", ["thalia"]);
brand("shopping", "Ex Libris", ["ex libris"]);
brand("shopping", "Payot", ["payot"]);
brand("shopping", "Amazon", ["amazon", "amzn", "amazon marketplace"]);
brand("shopping", "AliExpress", ["aliexpress", "alibaba"]);
brand("shopping", "Temu", ["temu"]);
brand("shopping", "Shein", ["shein"]);
brand("shopping", "Wish", ["wish com", "contextlogic"]);
brand("shopping", "eBay", ["ebay"]);
brand("shopping", "Etsy", ["etsy"]);
brand("shopping", "Tchibo", ["tchibo"]);
brand("shopping", "Müller", ["drogerie muller", "muller drogerie", "muller handels~", "muller schweiz", "muller filiale", "muller multimedia", "muller spielwaren"], {
  re: [/(?:^|[^a-z])muller ?\d/],
});
brand("shopping", "dm", ["dm drogerie markt", "dm drogeriemarkt", "dm schweiz"]);
brand("shopping", "Douglas", ["douglas"]);
brand("shopping", "Import Parfumerie", ["import parfumerie", "importparfumerie"]);
brand("shopping", "Sephora", ["sephora"]);
brand("shopping", "Marionnaud", ["marionnaud"]);
brand("shopping", "Lush", ["lush"]);
brand("shopping", "The Body Shop", ["body shop"]);
brand("shopping", "Yves Rocher", ["yves rocher"]);
brand("shopping", "Tally Weijl", ["tally weijl"]);
brand("shopping", "Bata", ["bata"]);
brand("shopping", "Dosenbach", ["dosenbach"]);
brand("shopping", "Vögele", ["charles vogele", "vogele shoes"]);
brand("shopping", "PKZ", ["pkz"]);
brand("shopping", "Snipes", ["snipes"]);
brand("shopping", "Calida", ["calida"]);
brand("shopping", "Freitag", ["freitag lab", "freitag shop", "freitag store", "freitag bags", "freitag ch"]);
brand("shopping", "Victorinox", ["victorinox"]);
brand("shopping", "Bucherer", ["bucherer"]);
brand("shopping", "Swatch", ["swatch"]);
genericAny("shopping", ["brockenhaus~", "brockenstube~", "brocki~", "brocante", "second hand", "secondhand"]);
brand("shopping", "Vinted", ["vinted"]);
brand("shopping", "Ricardo", ["ricardo ch", "ricardo ag"]);
brand("shopping", "Tutti", ["tutti ch"]);
brand("shopping", "Fressnapf", ["fressnapf"]);
brand("shopping", "Qualipet", ["qualipet"]);
brand("shopping", "Office World", ["office world", "officeworld"]);
brand("shopping", "Fleurop", ["fleurop"]);

// ---- leisure
brand("leisure", "Pathé", ["pathe", "pathe kino~"]);
brand("leisure", "Kitag", ["kitag"]);
brand("leisure", "Arena Cinemas", ["arena cinemas"]);
brand("leisure", "Ticketcorner", ["ticketcorner"]);
brand("leisure", "Starticket", ["starticket"]);
brand("leisure", "Eventfrog", ["eventfrog"]);
brand("leisure", "Eventim", ["eventim"]);
brand("leisure", "Activ Fitness", ["activ fitness"]);
brand("leisure", "Update Fitness", ["update fitness"]);
brand("leisure", "John Reed", ["john reed"]);
brand("leisure", "Holmes Place", ["holmes place"]);
brand("leisure", "Kieser", ["kieser"]);
brand("leisure", "Zermatt Bergbahnen", ["zermatt bergbahn~", "matterhorn paradise"]);
brand("leisure", "Laax", ["laax", "weisse arena"]);
brand("leisure", "Verbier", ["verbier", "televerbier", "4 vallees"]);
brand("leisure", "Saas-Fee", ["saas fee"]);
brand("leisure", "Titlis", ["titlis"]);
brand("leisure", "Jungfraubahnen", ["jungfraubahn~", "jungfraujoch"]);
brand("leisure", "Pilatus-Bahnen", ["pilatus bahn~"]);
genericAny("leisure", ["bergbahn~", "skilift~", "seilbahn~", "luftseilbahn~", "sesselbahn", "gondelbahn", "skipass", "skiticket", "telesiege", "remontees mecaniques"]);
brand("leisure", "Europa-Park", ["europa park", "europapark"]);
brand("leisure", "Connyland", ["connyland", "conny land"]);
brand("leisure", "Technorama", ["technorama"]);
brand("leisure", "Verkehrshaus", ["verkehrshaus"]);
brand("leisure", "Alpamare", ["alpamare"]);
brand("leisure", "Swisslos", ["swisslos", "loterie romande", "euromillions", "euro millions", "swiss lotto"]);
brand("leisure", "Steam", ["steampowered", "steam purchase", "steam games", "valve corp~"]);
brand("leisure", "PlayStation", ["playstation~", "sony interactive"]);
brand("leisure", "Nintendo", ["nintendo"]);
brand("leisure", "Xbox", ["xbox"]);
brand("leisure", "Epic Games", ["epic games"]);
brand("leisure", "Blizzard", ["blizzard", "battle net"]);
brand("leisure", "Riot Games", ["riot games"]);
brand("leisure", "Roblox", ["roblox"]);
genericAny("leisure", ["bowling~", "escape room~", "escaperoom~", "casino~"]);

// ---- subscriptions
brand("subscriptions", "Netflix", ["netflix"]);
brand("subscriptions", "Spotify", ["spotify"]);
brand("subscriptions", "Disney+", ["disney", "disney plus"]);
brand("subscriptions", "YouTube", ["youtube"]);
brand("subscriptions", "Zattoo", ["zattoo"]);
brand("subscriptions", "Teleboy", ["teleboy"]);
brand("subscriptions", "SkyShowtime", ["sky show", "skyshowtime", "sky ch"]);
brand("subscriptions", "Dropbox", ["dropbox"]);
brand("subscriptions", "Microsoft 365", ["microsoft 365", "office 365", "microsoft office", "onedrive", "microsoft 365 family"]);
brand("subscriptions", "Adobe", ["adobe"]);
brand("subscriptions", "OpenAI", ["openai", "chatgpt"]);
brand("subscriptions", "Anthropic", ["anthropic", "claude ai"]);
brand("subscriptions", "Midjourney", ["midjourney"]);
brand("subscriptions", "GitHub", ["github"]);
brand("subscriptions", "Notion", ["notion labs", "notion so"]);
brand("subscriptions", "Canva", ["canva"]);
brand("subscriptions", "1Password", ["1password"]);
multi("subscriptions", [
  ["NordVPN", ["nordvpn"]],
  ["ExpressVPN", ["expressvpn"]],
  ["Proton", ["protonvpn", "proton ag", "proton mail", "proton vpn"]],
  ["Surfshark", ["surfshark"]],
]);
brand("subscriptions", "Patreon", ["patreon"]);
brand("subscriptions", "Substack", ["substack"]);
brand("subscriptions", "NZZ", ["nzz", "neue zurcher zeitung"]);
brand("subscriptions", "Tages-Anzeiger", ["tages anzeiger", "tagesanzeiger"]);
brand("subscriptions", "Le Temps", ["le temps", "letemps"]);
brand("subscriptions", "Watson", ["watson ch", "watson plus"]);
brand("subscriptions", "Blick", ["blick plus", "blick ch"]);
multi("subscriptions", [
  ["24 heures", ["24 heures"]],
  ["Tribune de Genève", ["tribune de geneve"]],
  ["La Liberté", ["la liberte"]],
]);
brand("subscriptions", "Republik", ["republik ag", "republik ch"]);
brand("subscriptions", "Beobachter", ["beobachter"]);
brand("subscriptions", "Die Zeit", ["die zeit", "zeit online"]);
brand("subscriptions", "Der Spiegel", ["spiegel plus", "der spiegel"]);
brand("subscriptions", "New York Times", ["new york times", "nytimes"]);
brand("subscriptions", "Duolingo", ["duolingo"]);
brand("subscriptions", "Babbel", ["babbel"]);
brand("subscriptions", "Headspace", ["headspace"]);
brand("subscriptions", "Strava", ["strava"]);
multi("subscriptions", [
  ["Tinder", ["tinder"]],
  ["Bumble", ["bumble"]],
  ["Parship", ["parship"]],
  ["Badoo", ["badoo"]],
  ["Hinge", ["hinge"]],
]);
multi("subscriptions", [
  ["Deezer", ["deezer"]],
  ["Tidal", ["tidal"]],
  ["SoundCloud", ["soundcloud"]],
]);
brand("subscriptions", "DAZN", ["dazn"]);
brand("subscriptions", "Twitch", ["twitch"]);
brand("subscriptions", "Crunchyroll", ["crunchyroll"]);
brand("subscriptions", "Paramount+", ["paramount plus", "paramount"]);
brand("subscriptions", "RTL+", ["rtl plus"]);
multi("subscriptions", [
  ["Xbox Game Pass", ["game pass"]],
  ["PlayStation Plus", ["playstation plus"]],
  ["Nintendo Switch Online", ["nintendo switch online"]],
  ["EA Play", ["ea play"]],
]);
brand("subscriptions", "Grammarly", ["grammarly"]);
multi("subscriptions", [
  ["Evernote", ["evernote"]],
  ["Todoist", ["todoist"]],
]);
brand("subscriptions", "Infomaniak", ["infomaniak"]);
multi("subscriptions", [
  ["Hostpoint", ["hostpoint"]],
  ["cyon", ["cyon"]],
  ["Metanet", ["metanet"]],
  ["Hostinger", ["hostinger"]],
  ["Namecheap", ["namecheap"]],
  ["GoDaddy", ["godaddy"]],
  ["Swizzonic", ["swizzonic"]],
]);
brand("subscriptions", "Vercel", ["vercel"]);

// ---- travel
brand("travel", "easyJet", ["easyjet"]);
brand("travel", "Swiss", ["swiss international", "swiss com", "swiss air lines", "swiss airlines"]);
brand("travel", "Edelweiss", ["edelweiss", "edelweiss air"]);
brand("travel", "Ryanair", ["ryanair"]);
brand("travel", "Wizz Air", ["wizz air", "wizzair"]);
brand("travel", "Lufthansa", ["lufthansa"]);
brand("travel", "Eurowings", ["eurowings"]);
brand("travel", "Air France", ["air france"]);
brand("travel", "KLM", ["klm"]);
brand("travel", "British Airways", ["british airways"]);
brand("travel", "Iberia", ["iberia"]);
brand("travel", "Vueling", ["vueling"]);
brand("travel", "Turkish Airlines", ["turkish airlines"]);
brand("travel", "Emirates", ["emirates"]);
brand("travel", "Qatar Airways", ["qatar airways"]);
brand("travel", "Austrian Airlines", ["austrian airlines"]);
brand("travel", "ITA Airways", ["ita airways", "alitalia"]);
genericAny("travel", ["airways", "airlines"]);
brand("travel", "Booking.com", ["booking com", "booking bv"]);
brand("travel", "Airbnb", ["airbnb"]);
brand("travel", "Expedia", ["expedia"]);
brand("travel", "Hotels.com", ["hotels com"]);
multi("travel", [
  ["Trivago", ["trivago"]],
  ["Skyscanner", ["skyscanner"]],
  ["Kayak", ["kayak"]],
  ["Momondo", ["momondo"]],
  ["Opodo", ["opodo"]],
  ["eDreams", ["edreams"]],
]);
brand("travel", "TUI", ["tui", "tui suisse", "tui schweiz"]);
brand("travel", "Kuoni", ["kuoni", "dertour"]);
brand("travel", "Interhome", ["interhome"]);
brand("travel", "Hostelworld", ["hostelworld"]);
brand("travel", "FlixBus", ["flixbus", "flix bus", "flixtrain"]);
brand("travel", "Trenitalia", ["trenitalia", "italo treno", "frecciarossa"]);
brand("travel", "SNCF", ["sncf", "tgv lyria", "ouigo", "sncf connect"]);
brand("travel", "Deutsche Bahn", ["db bahn", "deutsche bahn", "bahn de"]);
brand("travel", "ÖBB", ["obb", "oebb"]);
multi("travel", [
  ["Eurostar", ["eurostar"]],
  ["Trainline", ["trainline"]],
  ["Omio", ["omio"]],
  ["Interrail", ["interrail", "eurail"]],
]);
brand("travel", "Reka", ["reka", "reka card", "reka geld"]);
brand("travel", "Hotelcard", ["hotelcard"]);
multi("travel", [
  ["Hilton", ["hilton"]],
  ["Marriott", ["marriott"]],
  ["Hyatt", ["hyatt"]],
  ["Radisson", ["radisson"]],
  ["Novotel", ["novotel"]],
  ["Best Western", ["best western"]],
  ["Holiday Inn", ["holiday inn"]],
  ["Motel One", ["motel one"]],
]);
multi("travel", [
  ["GetYourGuide", ["getyourguide"]],
  ["Viator", ["viator"]],
  ["Vrbo", ["vrbo"]],
]);
genericAny("travel", ["flughafen~", "airport~", "aeroport~", "aeroporto", "euroairport", "duty free"]);
genericAny("travel", ["campingplatz~", "camping~", "jugendherberge~", "youth hostel~"]);

// ---- education
brand("education", "ETH Zürich", ["eth zurich", "ethz"]);
brand("education", "EPFL", ["epfl", "eth lausanne"]);
brand("education", "Universität", ["uni", "uzh", "unizh", "universitat~", "universite~", "universita~", "unisg", "unil", "unige", "unibas", "unibe"]);
brand("education", "ZHAW", ["zhaw"]);
genericAny("education", ["zhdk", "fhnw", "hslu", "bfh", "supsi", "hes so", "hepia", "hevs", "phzh", "fachhochschule~", "hochschule~", "haute ecole~", "scuola universitaria"]);
multi("education", [
  ["Coursera", ["coursera"]],
  ["Udemy", ["udemy"]],
  ["edX", ["edx"]],
  ["Skillshare", ["skillshare"]],
  ["MasterClass", ["masterclass"]],
  ["LinkedIn Learning", ["linkedin learning"]],
  ["Lingoda", ["lingoda"]],
]);
genericAny("education", ["semestergebuhr~", "studiengebuhr~", "einschreibegebuhr", "immatrikulation~", "schulgeld", "schulmaterial", "schulbucher", "schulreise", "schullager"]);

// ---- children
brand("children", "Franz Carl Weber", ["franz carl weber", "fcw"]);
brand("children", "Smyths Toys", ["smyths", "toys r us"]);
brand("children", "Babywalz", ["babywalz", "baby walz"]);
multi("children", [
  ["Lego", ["lego"]],
  ["Playmobil", ["playmobil"]],
  ["Chicco", ["chicco"]],
]);
genericAny("children", ["kita", "kitas", "krippe~", "creche~", "asilo nido~", "kinderkrippe~", "kindertagesstatte~", "kinderhort~", "tagesfamilie~", "tagesmutter~", "tagesstruktur~", "mittagstisch~", "kinderbetreuung~", "garderie~", "accueil extrafamilial", "jardin denfants", "kindergarten~", "spielgruppe~", "babysitter~", "nounou~", "hort"]);
genericAny("children", ["spielwaren~", "jouets~", "giocattoli~"]);

// ---- taxes
brand("taxes", "Serafe", ["serafe", "billag"]);
genericAny("taxes", [
  "steueramt~",
  "steuerverwaltung~",
  "kantonale steuer~",
  "kantonssteuer~",
  "staatssteuer~",
  "gemeindesteuer~",
  "bundessteuer~",
  "quellensteuer~",
  "steuerrechnung~",
  "steuerzahlung~",
  "steuerbezug",
  "steuerbetreffnis",
  "administration fiscale",
  "service des contributions",
  "contributions publiques",
  "amministrazione delle contribuzioni",
  "ufficio delle contribuzioni",
  "divisione delle contribuzioni",
  "ufficio imposte",
  "impots",
  "impot~",
  "imposta~",
  "imposte",
  "estv",
  "eidgenossische steuerverwaltung",
  "tax administration",
]);
genericAny("taxes", ["zollverwaltung~", "bazg", "ezv", "douane suisse", "dogana"]);
genericAny("taxes", ["betreibungsamt~", "betreibung~", "office des poursuites", "ufficio di esecuzione", "staatsanwaltschaft~", "strafbefehl~"]);
genericAny("taxes", [
  "ordnungsbusse~",
  "verkehrsbusse~",
  "busse kantonspolizei",
  "busse stadtpolizei",
  "busse polizei",
  "bussenverfugung~",
  "bussenzentrale~",
  "bussgeld~",
  "amende~",
  "multa",
  "contravvenzione~",
  "kantonspolizei",
  "stadtpolizei",
  "police cantonale",
  "polizia cantonale",
]);
genericAny("taxes", ["gemeindeverwaltung~", "gemeindekasse~", "stadtkasse~", "stadtverwaltung~", "einwohnerkontrolle~", "gemeinde", "einwohnergemeinde~", "commune de", "ville de", "comune di", "citta di"]);

// ---- fees
genericAny("fees", [
  "kontofuhrung~",
  "kontogebuhr~",
  "kontoabschluss",
  "abschlussspesen",
  "bankgebuhr~",
  "bankspesen",
  "bankenspesen",
  "kartengebuhr~",
  "kreditkartengebuhr~",
  "jahresgebuhr~",
  "jahrespreis karte",
  "kartenpreis",
  "depotgebuhr~",
  "courtage",
  "zinsen soll",
  "sollzins~",
  "debitzins~",
  "kontouberzug",
  "uberziehungszins~",
  "uberziehungskommission",
  "kontopaket",
  "bankpaket",
  "preis fur bankdienstleistung~",
  "preis fur finanzdienstleistung~",
  "monatspreis konto",
  "interets debiteurs",
  "interessi debitori",
  "tenue de compte",
  "frais de",
  "frais",
  "spese di gestione",
  "spese conto",
  "commissioni",
  "bank fee~",
  "account fee",
  "monthly fee",
]);
generic("fees", ["spesen"]);

// ---- cash
genericAny("cash", [
  "bancomat~",
  "geldautomat~",
  "bargeldbezug",
  "bargeld~",
  "barbezug",
  "bargeldauszahlung",
  "postomat~",
  "retrait d especes",
  "retrait especes",
  "retrait dab",
  "retrait bancomat",
  "retrait",
  "distributeur",
  "prelievo~",
  "prelevamento",
  "atm",
  "cash withdrawal",
  "cash advance",
]);

// ---- savings
brand("savings", "VIAC", ["viac"]);
brand("savings", "frankly", ["frankly"]);
brand("savings", "finpension", ["finpension"]);
brand("savings", "Selma", ["selma finance", "selma ag", "selmafinance"]);
brand("savings", "True Wealth", ["true wealth", "truewealth"]);
brand("savings", "Swissquote", ["swissquote"]);
brand("savings", "Interactive Brokers", ["interactive brokers", "ibkr"]);
brand("savings", "Saxo", ["saxo bank", "degiro", "trade republic", "flatex", "etoro"]);
brand("savings", "Bitcoin Suisse", ["bitcoin suisse", "relai", "coinbase", "bitpanda", "binance", "bitcoin"]);
genericAny("savings", ["saule 3a", "saule 3 a", "pilier 3a", "pilier 3 a", "pilastro 3a", "pilastro 3 a", "3a konto", "3a vorsorge"], {
  re: [/(?:^|[^a-z0-9])3a(?![a-z0-9])/],
});
genericAny("savings", [
  "sparkonto~",
  "sparen",
  "sparplan~",
  "sparauftrag",
  "sparbeitrag",
  "sparrate~",
  "spareinlage~",
  "vorsorge~",
  "pensionskasse~",
  "caisse de pension~",
  "cassa pensione",
  "cassa pensioni",
  "freizugigkeit~",
  "libre passage",
  "libero passaggio",
  "bvg",
  "wertschriften~",
  "fondskauf",
  "aktienkauf",
  "etf",
  "epargne",
  "risparmio",
  "compte epargne",
  "conto risparmio",
  "savings",
]);

// ---- transfers
genericAny("transfers", [
  "ubertrag~",
  "kontoubertrag",
  "eigenubertrag",
  "umbuchung~",
  "virement interne",
  "virement entre comptes",
  "trasferimento interno",
  "trasferimento",
  "giroconto",
  "eigenes konto",
  "eigene konten",
  "eigener konto",
  "compte propre",
  "propre compte",
  "conto proprio",
  "revolut top up",
  "revolut topup",
  "top up",
  "topup",
  "twint aufladung",
  "twint charge",
  "twint top up",
  "twint geld laden",
  "twint prepaid",
  "wise payments",
  "wise europe",
  "transferwise",
  "wise transfer",
  "revolut",
  "neon switzerland",
  "neon bank",
  "yuh",
  "internal transfer",
  "own account",
]);

// ---------------------------------------------------------------------------------------
// C. Generic keywords (only after all brands). Order matters here too.
// ---------------------------------------------------------------------------------------

// groceries (specialist shops)
generic("groceries", [
  "backerei~",
  "boulangerie~",
  "panetteria~",
  "panificio~",
  "metzgerei~",
  "boucherie~",
  "macelleria~",
  "fleischerei~",
  "kaserei~",
  "fromagerie~",
  "formaggeria~",
  "molkerei~",
  "hofladen~",
  "bio markt",
  "biomarkt~",
  "bio laden",
  "bioladen~",
  "bio",
  "weinhandlung~",
  "vinothek~",
  "weinkellerei~",
  "getrankemarkt~",
  "getrankehandel~",
  "supermarkt~",
  "supermarche~",
  "supermercato~",
  "lebensmittel~",
  "wochenmarkt",
  "marktstand",
  "epicerie~",
  "alimentari",
  "~kiosk~",
  "gemuse~",
  "primeur",
  "ortofrutta",
]);

// restaurants (before hotel / taxi so "Hotel Restaurant" and "Pizza Taxi" resolve to food)
generic("restaurants", [
  "restaurant~",
  "ristorante~",
  "pizzeria~",
  "pizza~",
  "trattoria~",
  "osteria~",
  "brasserie~",
  "bistro~",
  "cafe~",
  "kaffee",
  "coffee",
  "tearoom~",
  "tea room~",
  "confiserie~",
  "konditorei~",
  "patisserie~",
  "pasticceria~",
  "gelateria~",
  "glacier",
  "kebab~",
  "doner~",
  "sushi~",
  "thai",
  "ramen",
  "wok",
  "burger bar",
  "imbiss~",
  "take away",
  "takeaway~",
  "gasthof~",
  "gasthaus~",
  "landgasthof~",
  "wirtshaus~",
  "beiz~",
  "pub",
  "mensa~",
  "kantine~",
  "catering~",
  "food truck",
  "street food",
  "bubble tea",
  "cantina",
  "bar",
], {
  not: [/(?:^|[^a-z])in bar(?:[^a-z]|$)/, /(?:^|[^a-z])bar (?:einzahlung|bezug|geld|zahlung|auszahlung)/],
});

// transport
generic("transport", ["taxi~", "taxizentrale", "billettautomat~", "fahrausweis~"]);

// housing
genericAny("housing", ["~miete", "mietzins~", "mietzahlung~", "mietkaution~", "mietzinsdepot", "mietwohnung~", "loyer~", "pigione~", "canone d affitto", "affitto~", "locazione"], {
  not: [/(?:auto|fahrzeug|wagen|ferien)miete/],
});
generic("housing", [
  "immobilien~",
  "liegenschaft~",
  "hausverwaltung~",
  "liegenschaftenverwaltung",
  "liegenschaftsverwaltung",
  "immobilienverwaltung",
  "verwaltung",
  "regie immobiliere",
  "regie",
  "gerance~",
  "immobiliare~",
  "amministrazione stabili",
  "stockwerkeigentum",
  "wohnungseigentum",
  "baugenossenschaft~",
  "wohnbaugenossenschaft~",
  "wohngenossenschaft~",
  "umzug~",
  "demenagement~",
  "trasloco~",
]);

// car
generic("car", [
  "parkhaus~",
  "parking~",
  "parkplatz~",
  "parkuhr~",
  "parkautomat~",
  "parkgebuhr~",
  "parkomat~",
  "parkscheibe",
  "tankstelle~",
  "tankstop",
  "benzin~",
  "carburant~",
  "station service",
  "stazione di servizio",
  "distributore benzina",
  "garage~",
  "autohaus~",
  "autoreparatur~",
  "reifen~",
  "pneu~",
  "mietwagen~",
  "autovermietung~",
  "location de voiture",
  "noleggio auto",
  "kfz",
  "autoversicherung~",
  "motorfahrzeugversicherung~",
  "kaskoversicherung~",
]);

// utilities
generic("utilities", [
  "nebenkosten~",
  "heizkosten~",
  "heizung~",
  "stromrechnung~",
  "strom",
  "elektrizitat~",
  "energie",
  "wasserversorgung~",
  "wasserwerk~",
  "abwasser~",
  "wasser",
  "kehricht~",
  "abfallgebuhr~",
  "sackgebuhr~",
  "entsorgung~",
  "fernwarme",
  "erdgas~",
  "charges locatives",
  "provision pour charges",
  "acompte charges",
  "spese accessorie",
  "acconto spese accessorie",
  "electricite",
  "elettricita",
  "service des eaux",
]);

// insurance (generic words)
genericAny("insurance", [
  "krankenkasse~",
  "krankenversicherung~",
  "kranken versicherung~",
  "caisse maladie",
  "caisse-maladie",
  "cassa malati",
  "cassa ammalati",
  "assurance maladie",
  "assicurazione malattia",
  "~versicherung~",
  "assurance~",
  "assicurazion~",
  "haftpflicht~",
  "hausrat~",
  "rechtsschutz~",
  "lebensversicherung~",
  "unfallversicherung~",
  "pramienrechnung~",
  "pramienzahlung~",
  "pramie krankenkasse",
  "primes d assurance",
  "prime d assurance",
  "premio assicurativo",
  "sozialversicherung~",
]);

// health
generic("health", [
  "apotheke~",
  "pharmacie~",
  "farmacia~",
  "drogerie~",
  "drogueria",
  "zahnarzt~",
  "zahnklinik~",
  "dentiste~",
  "dentista~",
  "dentaire",
  "dental~",
  "~arzt~",
  "medecin~",
  "medico",
  "docteur",
  "dr med",
  "praxis",
  "spital~",
  "~spital",
  "hopital~",
  "ospedale~",
  "klinik~",
  "clinique~",
  "clinica~",
  "physio~",
  "physiotherap~",
  "fisioterap~",
  "osteopath~",
  "chiropraktik~",
  "chiropractic",
  "massage~",
  "optik~",
  "optiker~",
  "optique~",
  "ottica",
  "ophtalmo~",
  "augenarzt~",
  "laboratoire~",
  "laboratorio~",
  "medizin~",
  "gesundheit~",
  "sante",
  "salute",
], {
  not: [/tierarzt/, /(?:^|[^a-z])(?:kantons|stadt)?spital ?(?:str|strasse|gasse|weg|rain|platz)/, /(?:^|[^a-z])labor day/],
});

// shopping (generic)
generic("shopping", [
  "boutique~",
  "parfumerie~",
  "bijouterie~",
  "juwelier~",
  "uhren~",
  "mobel~",
  "baumarkt~",
  "gartencenter~",
  "quincaillerie~",
  "ferramenta",
  "eisenwaren~",
  "buchhandlung~",
  "librairie~",
  "libreria",
  "papeterie~",
  "schreibwaren~",
  "kleider~",
  "schuhe~",
  "chaussures",
  "scarpe",
  "blumen~",
  "fleuriste",
  "florist~",
  "spielzeug~",
  "elektro~",
  "online shop",
  "webshop",
  "onlineshop",
]);

// leisure (generic)
generic("leisure", [
  "kino~",
  "cinema~",
  "cine",
  "fitness~",
  "fitnesscenter~",
  "gym",
  "hallenbad~",
  "freibad~",
  "schwimmbad~",
  "badi",
  "therme~",
  "thermalbad~",
  "wellness~",
  "museum~",
  "museen",
  "musee~",
  "museo",
  "kunsthaus~",
  "kunstmuseum~",
  "zoo",
  "tierpark~",
  "aquarium~",
  "botanischer garten",
  "minigolf~",
  "kletterhalle~",
  "boulderhalle~",
  "eishalle~",
  "eisbahn~",
  "golf",
  "golfclub~",
  "golfplatz~",
  "tennis~",
  "reitstall~",
  "tanzschule~",
  "theater~",
  "opernhaus~",
  "tonhalle~",
  "konzert~",
  "concert~",
  "festival~",
  "openair",
  "open air",
  "vereinsbeitrag~",
  "mitgliederbeitrag~",
  "sportverein~",
  "turnverein~",
  "skischule~",
]);

// travel (generic)
generic("travel", [
  "hotel~",
  "albergo~",
  "auberge~",
  "gasthof hotel",
  "ferienwohnung~",
  "ferienhaus~",
  "rifugio~",
  "berghaus~",
  "reisen",
  "voyages",
  "viaggi",
  "voyage",
  "reise~",
  "b and b",
]);

// education (generic)
generic("education", [
  "kurs",
  "kurse~",
  "~kurs",
  "cours de",
  "corso di",
  "corsi di",
  "~schule",
  "ecole",
  "scuola~",
  "weiterbildung~",
  "ausbildung~",
  "formation~",
  "formazione",
  "seminar~",
  "nachhilfe~",
  "lehrmittel",
  "lehrgang~",
  "gymnasium~",
  "kantonsschule~",
  "berufsschule~",
  "universitatsspital",
], {
  not: [
    /(?:^|[^a-z])(?:kurs|cours|corso) ?\d/,
    /(?:^|[^a-z])(?:kurs|cours|corso) (?:chf|eur|usd|gbp)/,
    /(?:wechsel|devisen|umrechnungs|tages|schluss|kassa|fremdwahrungs|ankaufs|verkaufs|mittel|borsen|aktien|bank|brief|geld|kapital|gewinn)kurs/,
    /universitatsspital/,
  ],
});

// fees (last resort)
genericAny("fees", ["gebuhr", "gebuhren", "spese"]);

// ---------------------------------------------------------------------------------------
// TWINT person-to-person payments
// ---------------------------------------------------------------------------------------

// "TWINT an Hans Muster", "Twint Geld senden an Anna Meier", "Twint von Max". The captured name
// must not look like a company, otherwise "Twint an Restaurant Rössli" would be a transfer.
const P2P_RE =
  /(?:^|[^a-z])twint (?:(?:geld|money|argent|soldi|zahlung|payment|paiement|pagamento|transfer|transfert) )?(?:(?:senden|gesendet|empfangen|erhalten|sent|received|envoye|recu|inviato|ricevuto) )?(?:an|von|de|da|a|to|from|vers|pour) ([a-z]+(?: [a-z]+){0,3})(?: [0-9]+)*$/;
const COMPANY_CUE_RE =
  /(?:^| )(?:ag|gmbh|sa|sarl|sagl|ltd|inc|co|kg|genossenschaft|restaurant|ristorante|cafe|bar|shop|store|apotheke|pharmacie|kiosk|garage|hotel|bahn|coop|migros|denner|volg|lidl|aldi|manor|sbb|cff|ffs|bio|metzgerei|backerei|boulangerie|kebab|pizzeria)(?: |$)/;

function isPersonToPerson(texts: string[]): boolean {
  for (const t of texts) {
    const m = P2P_RE.exec(t);
    if (m && !COMPANY_CUE_RE.test(m[1])) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------
// Income (positive amounts only)
// ---------------------------------------------------------------------------------------

const INCOME_WORDS = [
  "~lohn~",
  "salar~",
  "salaire~",
  "paie",
  "stipend~",
  "gehalt~",
  "salary",
  "wage",
  "wages",
  "payroll",
  "ahv",
  "avs",
  "iv",
  "alv",
  "rente~",
  "rendita~",
  "pension",
  "pensionskasse~",
  "caisse de pension~",
  "cassa pensione",
  "cassa pensioni",
  "bvg",
  "taggeld~",
  "arbeitslosen~",
  "chomage",
  "disoccupazione",
  "erwerbsersatz~",
  "ergänzungsleistung~",
  "kinderzulage~",
  "familienzulage~",
  "allocations familiales",
  "assegni familiari",
  "honorar~",
  "zinsgutschrift~",
  "habenzins~",
  "dividende~",
  "dividend",
  "interets crediteurs",
].map(compileWord);

// ---------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------

/** Number of individual patterns (words + regexes) in the dictionary. */
export const RULE_PATTERN_COUNT = patternCount + INCOME_WORDS.length + 2; // +2 = TWINT P2P regexes
/** Number of rules (groups of patterns). */
export const RULE_COUNT = RULES.length;

function candidateTexts(tx: Transaction): string[] {
  const out: string[] = [];
  for (const raw of [tx.counterparty, tx.description]) {
    if (!raw) continue;
    const n = normaliseText(raw);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

/** undefined = no rule matched, null = recognised but deliberately undecided. */
function matchText(text: string, positive: boolean): RuleMatch | null | undefined {
  for (const rule of RULES) {
    if (rule.sign === "neg" && positive) continue;
    if (!rule.tests.some((re) => re.test(text))) continue;
    if (rule.not.some((re) => re.test(text))) continue;
    if (rule.category === null) return null;
    return rule.merchant ? { category: rule.category, merchant: rule.merchant } : { category: rule.category };
  }
  return undefined;
}

/**
 * Categorise a transaction without any network call.
 * Looks at `counterparty` first and falls back to the raw `description`.
 * Returns null when the LLM should decide (unknown merchant, or an unknown incoming payment).
 */
export function categoriseByRules(tx: Transaction): RuleMatch | null {
  const texts = candidateTexts(tx);
  if (texts.length === 0) return null;
  const positive = tx.amount > 0;

  if (isPersonToPerson(texts)) return { category: "transfers" };
  if (positive && INCOME_WORDS.some((re) => texts.some((t) => re.test(t)))) return { category: "income" };

  for (const text of texts) {
    const hit = matchText(text, positive);
    if (hit !== undefined) return hit;
  }
  return null;
}
