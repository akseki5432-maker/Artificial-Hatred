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
