# PocketPilot 🪙

An allowance coach for kids. Type in what you get each day, week, or month and PocketPilot shows:

- **What it really adds up to** - per day, week, month, year, and by the time you're 18.
- **What you can do with it** - a catalog of things kids save for, with how long each one takes at different savings rates, plus your own goals. Put money in, watch the bar fill, and mark it bought when you get there.
- **How to grow it** - a compound-growth simulator (piggy bank vs. savings vs. investing), the rule of 72, and the "family bank" idea.
- **What the daily stuff costs** - the snack / boba / in-app-purchase habit calculator: what it costs in a year and
  what that money would become if saved instead. Tap "I skipped it" each time you walk past, then bank the pile into
  your Save jar. Skipping only counts once the money actually moves, which is the whole lesson.
- **How to earn more** - age-appropriate ways to make money beyond an allowance, and a way to add them to your income.
- **A money log** - track what comes in and goes out, see where it goes, keep a weekly saving streak, and export to CSV. Moving money to the Save jar counts as a transfer, not a spend, so the balance stays honest.
- **Lessons** - six short money lessons, each with a three-question quiz and something to try this week.
- **Backup and restore** - download everything as one JSON file and load it back on another device. Restoring adds, it never overwrites.
- **Live prices** - search the web for today's price of anything, save it to the catalog, edit prices by hand, and keep a price history.
- **Any currency** - kids who use euros, pounds, rupees or yen see the catalog and web prices converted with live exchange rates (static fallback table when offline).
- **Deadlines** - "I want it by June" shows the weekly saving needed and whether the current plan is on track.
- **A year's shopping cart** - tap several things and see what share of a year's allowance they eat.

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

### Exchange rates

Catalog prices are in USD. When a kid's profile uses another currency the API converts on the way out using live rates from
[frankfurter.app](https://www.frankfurter.app) (free, no key, cached 24h in SQLite). If that is unreachable, a built-in
approximate table is used and the Prices page says so. `ENABLE_LIVE_FX=0` turns the live lookup off.

## Project layout

```
packages/core   Pure TypeScript money engine (no dependencies). Used by both server and web.
                money.ts        normalize daily/weekly/monthly, formatting, durations
                projections.ts  savings projection, compound growth, time-to-goal, habit cost, jar split
                priceParse.ts   pull prices out of text, robust median summary
                catalog.ts      goal + habit catalog with typical prices and search queries
                earn.ts         earning ideas by age
                insights.ts     plain-language observations, from the catalog and the kid's own log
                lessons.ts      six kid-sized money lessons with quizzes
                fx.ts           currency conversion and the fallback rate table
server          Express 5 + node:sqlite API
                routes/         profiles, goals, ledger, catalog + prices
                services/priceSearch/  provider chain (serpapi, brave, duckduckgo) with SQLite cache
                plan.ts         everything the dashboard needs, computed in one place
web             React 19 + Vite + React Router. Kid-friendly UI, light/dark, phone-friendly.
e2e             Playwright smoke tests against the built app, including a phone-width overflow check.
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
| POST | `/api/goals/:id/save` | put money toward a goal (logs it too) |
| POST | `/api/goals/:id/complete` | "I bought it": finishes the goal and records the purchase |
| GET/POST | `/api/profiles/:id/skips` | treats skipped but not yet banked |
| POST | `/api/profiles/:id/skips/bank` | move every pending skip into savings, optionally toward a goal |
| GET/POST | `/api/profiles/:id/ledger` | money in / out |
| GET | `/api/catalog?currency=EUR` | goal + habit catalog with current prices, converted |
| GET | `/api/fx` | exchange-rate source and date |
| GET | `/api/backup` | everything as one JSON file |
| GET | `/api/profiles/:id/backup` | one kid's data |
| POST | `/api/backup/restore` | load a backup file (adds, never overwrites) |
| POST | `/api/profiles/:id/ledger/allowance` | one-tap "I got my allowance" entry |
| GET | `/api/profiles/:id/ledger.csv` | download the log as CSV |
| GET | `/api/earn?age=10` | earning ideas |
| POST | `/api/prices/search` | `{ query, currency?, applyToKey?, fresh? }` search the web |
| PUT/DELETE | `/api/prices/:key` | set a price by hand / reset to catalog |
| GET | `/api/prices/:key/history` | price history |
| POST | `/api/prices/refresh` | refresh every catalog price from the web |

Price keys look like `goal:bike` or `habit:boba`.

## Docker

```bash
docker build -t pocketpilot .
docker run -p 3001:3001 -v pocketpilot-data:/data --env-file .env pocketpilot
```

## Scripts

```bash
npm test            # unit + API tests (vitest)
npm run typecheck   # all three packages
npm run build
npm run e2e         # Playwright smoke tests (run npm run build first)
```

## Accessibility

The app is built to pass WCAG 2.1 AA and the end-to-end suite enforces it with axe on every page, in
light and dark mode. Concretely:

- Every chart has a "Show the numbers" table with the same data, so nothing is locked behind colour.
- Colours are checked, not eyeballed: text and controls clear 4.5:1 on every surface they sit on.
- A skip link, visible focus rings, labelled form fields, and a `prefers-reduced-motion` rule.
- No page scrolls sideways at 390px wide, which a test also enforces.

## Notes on the numbers

- A year is 52 weeks, 12 months, 365 days. Daily allowances are multiplied by 365, weekly by 52, monthly by 12.
- Growth compounds monthly. The default 7% is a long-run stock market average, not a promise. The app says so.
- Catalog prices are typical US list prices as of the date in `CATALOG_LAST_REVIEWED`, meant to be refreshed from the web or edited.
- Goal progress ("I saved some") is tracked per goal and is separate from the money log, so a kid can track a goal without logging every transaction.
- The money log treats the Save jar as a pocket, not a purchase. Putting money toward a goal writes a `saving`
  entry that lowers neither the balance nor the "spent" total, and buying the goal takes that money back out of
  the jar and records the full price as the purchase. So the jar, the balance and the spending totals always agree.
- If purchases are logged but income never is, the balance goes negative and the log says so rather than hiding it.
- Skipping a treat is recorded but moves no money. It becomes savings only when banked, so the app never credits
  a child with money they did not actually set aside.
- Every figure the API returns is rounded to cents, so floating-point noise never reaches the screen.

## Privacy

Everything stays in the SQLite file on the machine running the server. Nothing is sent anywhere except the
price and exchange-rate lookups, which send only the search text (for example "kids mountain bike price"),
never a child's name, age, or amounts. Turn those off with `ENABLE_DDG_SEARCH=0` and `ENABLE_LIVE_FX=0`
and the app still works from the built-in catalog.
