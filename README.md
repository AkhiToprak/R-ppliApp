# Räppli 🪙

**Your budget, down to the last Rappen.** Upload a Swiss bank statement and get an instant breakdown of your spending: auto-categorised, charted and critiqued. No sign-up, nothing stored.

- **Formats:** CSV (UBS, PostFinance, Raiffeisen, ZKB, Kantonalbanken, Migros Bank, Revolut, neon, Yuh …), CAMT.053/054 XML, Excel, PDF
- **Categorisation:** 300+ Swiss merchant rules (Migros → groceries, SBB → public transport, CSS → insurance …), with an LLM via OpenRouter for everything the rules don't know
- **Insights:** budget score and persona, strengths and weaknesses, specific critique of spending points, and saving options with CHF estimates (LLM, with a rule-based fallback)
- **Languages:** Deutsch, Français, Italiano, English, detected from the browser's `Accept-Language`
- **Privacy:** parsing, categorisation rules and analysis run in the browser. Only merchant names and amounts are sent to the LLM, never names, IBANs or addresses. There is no database, no cookies and no storage, so closing the tab erases everything.

## Getting started

```bash
npm install
cp .env.example .env.local   # add your OpenRouter key
npm run dev
```

Open http://localhost:3000. You'll be redirected to `/de`, `/fr`, `/it` or `/en`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | – | OpenRouter key. Without it the app still works using rules and fallback insights. |
| `OPENROUTER_MODEL` | `google/gemini-2.5-flash-lite` | Any cheap model with JSON output |
| `OPENROUTER_FALLBACK_MODELS` | – | Optional comma-separated fallback models |
| `NEXT_PUBLIC_SITE_URL` | – | Sent as `HTTP-Referer` to OpenRouter |
| `OPENROUTER_ALLOW_DATA_COLLECTION` | – | By default only providers that don't retain or train on data are used. Set it to `1` if your model has no such provider. |

## Scripts

- `npm run dev`: start the dev server
- `npm run build` / `npm start`: production build
- `npm test`: unit tests (vitest) for the parsers, categoriser, analysis and LLM layer
- `npm run lint`: ESLint

## Architecture

```
src/
  proxy.ts                 locale detection → /{de|fr|it|en}
  app/[locale]/            landing page + /analyse (upload → processing → dashboard)
  app/api/                 categorise · insights · extract (OpenRouter, stateless)
  lib/parsers/             CSV / CAMT / XLSX / PDF → Transaction[]
  lib/categorise/          Swiss merchant rules + LLM batching
  lib/analysis/            totals, monthly trend, recurring payments, top merchants
  lib/llm/                 OpenRouter client, prompts, zod schemas, fallback insights
  lib/i18n/                dictionaries per feature, formatting (CHF, dates)
  components/              brand (coin logo), site chrome, landing, analyse dashboard
```

Räppli is not financial advice, just honest numbers.
