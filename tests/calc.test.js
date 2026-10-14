const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/calc.js");

const cafe = {
  avgPrice: 10,
  varCost: 4,
  salesPerMonth: 2000,
  fixedMonthly: 9000,
  ownerPay: 3000,
  cashOnHand: 6000,
};

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test("priceForMargin turns a target margin into a price", () => {
  close(L.priceForMargin(4, 0.6), 10);
  assert.equal(L.priceForMargin(4, 1), null);
});

test("marginAndMarkup distinguishes the two", () => {
  const r = L.marginAndMarkup(10, 4);
  close(r.margin, 0.6);
  close(r.markup, 1.5);
});

test("analyze computes break-even and margin of safety", () => {
  const a = L.analyze(cafe);
  close(a.contributionMargin, 6);
  close(a.profit, 3000);
  close(a.breakEvenUnits, 1500);
  close(a.breakEvenRevenue, 15000);
  close(a.marginOfSafety, 0.25);
  close(a.unitsForOwnerPay, 2000);
  assert.equal(a.runwayMonths, Infinity);
});

test("analyze reports runway when losing money", () => {
  const a = L.analyze({ ...cafe, salesPerMonth: 1000 });
  close(a.profit, -3000);
  close(a.runwayMonths, 2);
});

test("analyze handles price below cost", () => {
  const a = L.analyze({ ...cafe, avgPrice: 3 });
  assert.equal(a.breakEvenUnits, Infinity);
  assert.equal(L.healthChecks(a)[0].status, "risk");
});

test("priceChangeImpact: +10% price lets you lose ~14% of sales", () => {
  const [up, down] = L.priceChangeImpact(cafe, [0.1, -0.1]);
  close(up.salesNeeded, 12000 / 7);
  close(up.salesChangePct, 12000 / 7 / 2000 - 1);
  close(down.salesNeeded, 2400);
  close(down.salesChangePct, 0.2);
});

test("cashForecast tracks balance, low point and events", () => {
  const f = L.cashForecast(cafe, {
    weeks: 13,
    events: [{ week: 3, amount: -10000, label: "New oven" }],
  });
  assert.equal(f.rows.length, 13);
  // Weekly net before events: (3000 profit - 3000 owner pay) / month = 0
  close(f.rows[0].net, 0);
  close(f.rows[2].balance, -4000);
  assert.equal(f.firstNegativeWeek, 3);
  assert.equal(f.low.week, 3);
  assert.deepEqual(f.rows[2].labels, ["New oven"]);
});

test("healthChecks flags a business close to break-even", () => {
  const a = L.analyze({ ...cafe, salesPerMonth: 1600 });
  const profit = L.healthChecks(a).find((c) => c.id === "profit");
  assert.equal(profit.status, "watch");
});

test("formatters handle non-finite values", () => {
  assert.equal(L.fmt.money(Infinity), "—");
  assert.equal(L.fmt.money(-1234.4), "-$1,234");
  assert.equal(L.fmt.pct(0.256), "26%");
});

const lineup = [
  { name: "Latte", price: 5, cost: 1.2, units: 900 },
  { name: "Drip coffee", price: 2.5, cost: 0.9, units: 1200 },
  { name: "Avocado toast", price: 9, cost: 3, units: 120 },
  { name: "Muffin", price: 3, cost: 3.2, units: 300 },
  { name: "Tea", price: 3, cost: 1.8, units: 40 },
];

test("itemAnalysis groups items and finds losers", () => {
  const r = L.itemAnalysis(lineup, 0.6);
  const by = Object.fromEntries(r.rows.map((x) => [x.name, x.group]));
  assert.equal(by["Latte"], "star");
  assert.equal(by["Drip coffee"], "workhorse");
  assert.equal(by["Avocado toast"], "puzzle");
  assert.equal(by["Muffin"], "loser");
  assert.equal(by["Tea"], "dog");
  assert.equal(r.losers, 1);
  assert.equal(r.rows[0].name, "Latte"); // sorted by contribution
  close(r.totalUnits, 2560);
});

test("itemAnalysis repricing gain only counts items below target", () => {
  const r = L.itemAnalysis([{ name: "A", price: 2, cost: 1, units: 100 }, { name: "B", price: 10, cost: 1, units: 100 }], 0.6);
  // A needs price 2.5 for 60% margin: gain 0.5 * 100
  close(r.repricingGain, 50);
  assert.equal(r.rows.find((x) => x.name === "B").targetPrice, null);
});

test("itemAnalysis ignores empty rows", () => {
  const r = L.itemAnalysis([{ name: "", price: "", cost: "", units: "" }]);
  assert.equal(r.rows.length, 0);
  assert.equal(r.avgPrice, 0);
});

test("compareVisits labels changes as better or worse", () => {
  const after = { ...cafe, avgPrice: 11, cashOnHand: 5000 };
  const rows = Object.fromEntries(L.compareVisits(cafe, after).map((r) => [r.key, r]));
  assert.equal(rows.price.direction, "better");
  assert.equal(rows.profit.direction, "better");
  close(rows.profit.delta, 2000);
  assert.equal(rows.breakEvenUnits.direction, "better");
  assert.equal(rows.cash.direction, "worse");
  assert.equal(rows.sales.direction, "same");
});

test("median handles odd, even and empty lists", () => {
  assert.equal(L.median([3, 1, 2]), 2);
  assert.equal(L.median([4, 1, 2, 3]), 2.5);
  assert.equal(L.median([]), null);
});

test("aggregate summarizes sessions without names", () => {
  const sessions = [
    { profile: { ...cafe, businessName: "Secret A", businessType: "Food & drink" }, items: lineup },
    { profile: { ...cafe, businessName: "Secret B", salesPerMonth: 1000, businessType: "Salon / beauty" },
      baseline: { profile: { ...cafe, salesPerMonth: 900 } } },
    { profile: { businessName: "Empty" } },
  ];
  const a = L.aggregate(sessions);
  assert.equal(a.count, 2);
  assert.equal(a.skipped, 1);
  assert.equal(a.shareLosingMoney, 0.5);
  assert.equal(a.losingItems, 1);
  assert.equal(a.followUps, 1);
  assert.equal(a.improvedProfit, 1);
  close(a.totalProfitChange, 600);
  assert.deepEqual(a.byType, { "Food & drink": 1, "Salon / beauty": 1 });
  assert.ok(!JSON.stringify(a).includes("Secret"));
});
