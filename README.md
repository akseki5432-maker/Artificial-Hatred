# Main Street Ledger

**A free 30-minute financial checkup for small local businesses.**

Most corner cafés, salons, and food trucks don't have a CFO. Many owners don't know their break-even point, whether they could raise prices, or whether their cash will last through a slow month. Main Street Ledger is a free tool that a student consultant can walk through with an owner. At the end, the owner keeps a one-page report.

## What it does

| Section | Question it answers |
|---|---|
| Monthly snapshot | Am I actually making money? How many sales a day do I need to break even? |
| Health check | Traffic-light checks (margin, break-even cushion, owner pay, cash), each with a plain-language next step |
| Price change table | If I raise prices 10%, how many customers can I lose and still earn the same? |
| Price for a target margin | What should I charge for this item? (It also shows the difference between margin and markup.) |
| Product lineup | Which items actually earn the money? Which ones cost more to make than they sell for? (Star / Workhorse / Puzzle / Dog, with suggested prices) |
| 13-week cash forecast | Will cash dip below zero when the tax payment or equipment repair hits? |
| Progress since first visit | Save a baseline at the first visit; at the 30-day follow-up, see what changed (profit, margin, break-even, cash) |
| One-page report | Print or save as PDF for the owner to keep |

**Findings dashboard** (`findings.html`): Load the saved files from every checkup and get anonymized patterns across all the businesses you served. It shows common problems, products losing money, the total repricing opportunity, and the profit change after follow-ups. It also writes a plain-text findings brief you can paste. Business names never appear in the results.

**Works offline:** After the first visit, the site loads with no internet connection, which is useful in a shop with bad Wi-Fi. On a phone, you can also add it to your home screen.

**Privacy:** Everything runs in the browser. There is no server, account, or tracking. Numbers are saved only on the device you're using, and you can export or import them as a file if you want.

## Run it

Open `index.html` (homepage) or `tool.html` (checkup tool) in any browser. There's no build step.

### Put it online (free)

See [`docs/WEBSITE.md`](docs/WEBSITE.md) for step-by-step instructions. Options include Cloudflare Pages (`main-street-ledger.pages.dev`), GitHub Pages, and connecting your own domain. It also covers the settings in `src/site.js`: the request form link, contact email, and playbook link.

## Run the tests

```bash
node --test tests/calc.test.js
```

All the math is in `src/calc.js` as pure functions, with no DOM access, so it can be tested in Node.

## Project layout

```
index.html           public homepage for business owners
tool.html            the checkup tool
404.html             not-found page
findings.html        anonymized findings across many checkups
sw.js, manifest.webmanifest, icon.svg   offline support and home-screen install
src/calc.js          financial math (break-even, pricing, lineup, cash forecast, health checks, follow-up comparison, aggregation)
src/app.js           checkup UI wiring and chart
src/findings.js      findings dashboard UI
src/site.js, site.css   homepage settings and styles
src/styles.css       styles, including dark mode and print layout
tests/calc.test.js   unit tests
docs/WEBSITE.md      how to put the site online with a free address
docs/PLAYBOOK.md     how to run this as a real consulting program, plus Common App wording
docs/impact-log.csv  template for tracking businesses served and outcomes
```

## Disclaimer

Main Street Ledger is an educational tool. Its results are estimates, not accounting, tax, or legal advice.
