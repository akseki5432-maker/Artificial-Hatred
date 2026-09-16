# PocketPilot 🪙

An allowance coach for kids. Type in what you get each day, week, or month and PocketPilot shows:

- **What it really adds up to** - per day, week, month, year, and by the time you're 18.
- **What you can do with it** - a catalog of things kids save for, with how long each one takes at different savings rates, plus your own goals.
- **How to grow it** - a compound-growth simulator (piggy bank vs. savings vs. investing), the rule of 72, and the "family bank" idea.
- **What the daily stuff costs** - the snack / boba / in-app-purchase habit calculator: what it costs in a year and what that money would become if saved instead.
- **How to earn more** - age-appropriate ways to make money beyond an allowance, and a way to add them to your income.
- **A money log** - track what comes in and goes out and see where it goes.
- **Live prices** - search the web for today's price of anything, save it to the catalog, edit prices by hand, and keep a price history.

## Quick start

Requires Node 22.13 or newer (uses the built-in SQLite module).

```bash
npm install --legacy-peer-deps
cp .env.example .env        # optional: add a search API key
npm run dev                 # API on :3001, web app on :5173
```

Open http://localhost:5173.

### Production

```bash
npm run build               # typechecks everything and builds web/dist
npm start                   # serves API + built web app on :3001
```

The database is a single SQLite file at `data/pocketpilot.db` (change with `POCKETPILOT_DB`).

## Online price search

The Prices page and the goal "Find the price online" button search the web and use the median price found.
Providers are tried in order and the first one that returns a price wins. Results are cached for `PRICE_CACHE_HOURS` (default 24).

| Provider | Needs | Notes |
|---|---|---|
| `serpapi` | `SERPAPI_KEY` | Google Shopping results with structured prices. Most reliable. |
| `brave` | `BRAVE_SEARCH_API_KEY` | Brave web search; prices are parsed from result snippets. |
| `duckduckgo` | nothing (`ENABLE_DDG_SEARCH=1`) | Reads DuckDuckGo's HTML results page. Free, but can be rate limited. |

Without any provider the app still works with the built-in catalog prices, and every price can be edited by hand.
Prices found online or set by hand are stored per catalog item with a full history.

## Project layout

```
packages/core   Pure TypeScript money engine (no dependencies). Used by both server and web.
                money.ts        normalize daily/weekly/monthly, formatting, durations
                projections.ts  savings projection, compound growth, time-to-goal, habit cost, jar split
                priceParse.ts   pull prices out of text, robust median summary
                catalog.ts      goal + habit catalog with typical prices and search queries
                earn.ts         earning ideas by age
                insights.ts     plain-language observations for the dashboard
server          Express 5 + node:sqlite API
                routes/         profiles, goals, ledger, catalog + prices
                services/priceSearch/  provider chain (serpapi, brave, duckduckgo) with SQLite cache
                plan.ts         everything the dashboard needs, computed in one place
web             React 19 + Vite + React Router. Kid-friendly UI, light/dark, phone-friendly.
```

## API

| Method | Path | What |
|---|---|---|
| GET | `/api/health` | provider status |
| GET/POST | `/api/profiles` | list / create a kid |
| GET/PUT/DELETE | `/api/profiles/:id` | one kid |
| GET | `/api/profiles/:id/plan` | all computed numbers, projections and insights |
| GET/POST | `/api/profiles/:id/income` | extra income sources |
| GET/POST | `/api/profiles/:id/goals` | goals (from the catalog by `catalogId`, or custom) |
| PUT/DELETE | `/api/goals/:id` | update progress, favorite, price |
| GET/POST | `/api/profiles/:id/ledger` | money in / out |
| GET | `/api/catalog` | goal + habit catalog with current prices |
| GET | `/api/earn?age=10` | earning ideas |
| POST | `/api/prices/search` | `{ query, currency?, applyToKey?, fresh? }` search the web |
| PUT/DELETE | `/api/prices/:key` | set a price by hand / reset to catalog |
| GET | `/api/prices/:key/history` | price history |
| POST | `/api/prices/refresh` | refresh every catalog price from the web |

Price keys look like `goal:bike` or `habit:boba`.

## Scripts

```bash
npm test            # unit + API tests (vitest)
npm run typecheck   # all three packages
npm run build
```

## Notes on the numbers

- A year is 52 weeks, 12 months, 365 days. Daily allowances are multiplied by 365, weekly by 52, monthly by 12.
- Growth compounds monthly. The default 7% is a long-run stock market average, not a promise. The app says so.
- Catalog prices are typical US list prices as of the date in `CATALOG_LAST_REVIEWED`, meant to be refreshed from the web or edited.
