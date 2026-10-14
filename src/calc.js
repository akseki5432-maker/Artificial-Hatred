/*
 * Main Street Ledger: core financial math.
 * Pure functions with no DOM access, so they run in the browser and in Node tests.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.Ledger = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var WEEKS_PER_MONTH = 52 / 12;

  function num(v) {
    var n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // Price needed to hit a target gross margin (0.6 = 60%) on a given unit cost.
  function priceForMargin(unitCost, marginPct) {
    var cost = num(unitCost);
    var m = num(marginPct);
    if (m >= 1 || cost < 0) return null;
    return cost / (1 - m);
  }

  // Margin and markup are often confused by owners; show both.
  function marginAndMarkup(price, unitCost) {
    var p = num(price);
    var c = num(unitCost);
    return {
      margin: p > 0 ? (p - c) / p : null,
      markup: c > 0 ? (p - c) / c : null,
    };
  }

  // Core monthly picture from a business profile.
  function analyze(profile) {
    var price = num(profile.avgPrice);
    var varCost = num(profile.varCost);
    var sales = num(profile.salesPerMonth);
    var fixed = num(profile.fixedMonthly);
    var ownerPay = num(profile.ownerPay);
    var cash = num(profile.cashOnHand);

    var cm = price - varCost;
    var cmRatio = price > 0 ? cm / price : 0;
    var revenue = price * sales;
    var profit = cm * sales - fixed;
    var breakEvenUnits = cm > 0 ? fixed / cm : Infinity;
    var breakEvenRevenue = cm > 0 ? breakEvenUnits * price : Infinity;
    var marginOfSafety = sales > 0 && cm > 0 ? (sales - breakEvenUnits) / sales : -Infinity;
    var unitsForOwnerPay = cm > 0 ? (fixed + ownerPay) / cm : Infinity;
    var runwayMonths = profit < 0 ? cash / -profit : Infinity;
    var cashCoverMonths = fixed > 0 ? cash / fixed : Infinity;

    return {
      price: price,
      varCost: varCost,
      sales: sales,
      fixed: fixed,
      ownerPay: ownerPay,
      cash: cash,
      contributionMargin: cm,
      cmRatio: cmRatio,
      revenue: revenue,
      profit: profit,
      profitAfterOwnerPay: profit - ownerPay,
      breakEvenUnits: breakEvenUnits,
      breakEvenRevenue: breakEvenRevenue,
      breakEvenPerDay: breakEvenUnits / 30,
      marginOfSafety: marginOfSafety,
      unitsForOwnerPay: unitsForOwnerPay,
      runwayMonths: runwayMonths,
      cashCoverMonths: cashCoverMonths,
    };
  }

  /*
   * For each price change, how many sales can the business lose (or must it gain)
   * and still earn the same total contribution as today?
   */
  function priceChangeImpact(profile, pctChanges) {
    var price = num(profile.avgPrice);
    var varCost = num(profile.varCost);
    var sales = num(profile.salesPerMonth);
    var currentCM = price - varCost;
    var currentContribution = currentCM * sales;

    return pctChanges.map(function (pct) {
      var newPrice = price * (1 + pct);
      var newCM = newPrice - varCost;
      if (newCM <= 0 || sales <= 0) {
        return { pct: pct, newPrice: newPrice, salesNeeded: Infinity, salesChangePct: Infinity };
      }
      var salesNeeded = currentContribution / newCM;
      return {
        pct: pct,
        newPrice: newPrice,
        salesNeeded: salesNeeded,
        salesChangePct: (salesNeeded - sales) / sales,
      };
    });
  }

  /*
   * 13-week cash forecast. Revenue and variable costs scale with weekly growth;
   * fixed costs are spread evenly. Events are one-time {week, amount, label},
   * negative for spending and positive for inflows.
   */
  function cashForecast(profile, opts) {
    opts = opts || {};
    var weeks = opts.weeks || 13;
    var growth = num(opts.weeklyGrowth);
    var events = opts.events || [];

    var weeklySales = num(profile.salesPerMonth) / WEEKS_PER_MONTH;
    var weeklyFixed = num(profile.fixedMonthly) / WEEKS_PER_MONTH;
    var weeklyOwner = num(profile.ownerPay) / WEEKS_PER_MONTH;
    var cm = num(profile.avgPrice) - num(profile.varCost);

    var balance = num(profile.cashOnHand);
    var rows = [];
    var low = { week: 0, balance: balance };
    var firstNegativeWeek = null;

    for (var w = 1; w <= weeks; w++) {
      var s = weeklySales * Math.pow(1 + growth, w - 1);
      var inflow = s * num(profile.avgPrice);
      var outflow = s * num(profile.varCost) + weeklyFixed + weeklyOwner;
      var oneTime = 0;
      var labels = [];
      events.forEach(function (e) {
        if (Number(e.week) === w) {
          oneTime += num(e.amount);
          if (e.label) labels.push(e.label);
        }
      });
      var net = s * cm - weeklyFixed - weeklyOwner + oneTime;
      balance += net;
      rows.push({
        week: w,
        inflow: inflow,
        outflow: outflow,
        oneTime: oneTime,
        labels: labels,
        net: net,
        balance: balance,
      });
      if (balance < low.balance) low = { week: w, balance: balance };
      if (balance < 0 && firstNegativeWeek === null) firstNegativeWeek = w;
    }

    return { rows: rows, low: low, firstNegativeWeek: firstNegativeWeek, ending: balance };
  }

  /*
   * Traffic-light checks plus a plain-language recommendation for each.
   * status: "good" | "watch" | "risk"
   */
  function healthChecks(a) {
    var checks = [];

    if (a.contributionMargin <= 0) {
      checks.push({
        id: "cm",
        title: "Each sale loses money",
        status: "risk",
        detail: "The average price does not cover the cost of making the sale.",
        action: "Raise prices or cut per-sale costs before anything else. More sales will make losses bigger.",
      });
    } else if (a.cmRatio < 0.3) {
      checks.push({
        id: "cm",
        title: "Thin margin per sale",
        status: "watch",
        detail: "Only " + pct(a.cmRatio) + " of each sale is left after per-sale costs.",
        action: "Check supplier prices, portion sizes, and card-processing fees. Even a small price increase helps a lot here.",
      });
    } else {
      checks.push({
        id: "cm",
        title: "Healthy margin per sale",
        status: "good",
        detail: pct(a.cmRatio) + " of each sale goes toward fixed costs and profit.",
        action: "Protect it: re-check ingredient and supply costs every quarter.",
      });
    }

    if (a.profit < 0) {
      checks.push({
        id: "profit",
        title: "Losing money each month",
        status: "risk",
        detail: "Current sales are below break-even by " + whole(a.breakEvenUnits - a.sales) + " sales a month.",
        action: "Focus on the gap: about " + whole((a.breakEvenUnits - a.sales) / 30) + " more sales a day, or lower fixed costs.",
      });
    } else if (a.marginOfSafety < 0.15) {
      checks.push({
        id: "profit",
        title: "Close to break-even",
        status: "watch",
        detail: "Sales could fall only " + pct(a.marginOfSafety) + " before the business loses money.",
        action: "Build a cushion: a slow month could tip into a loss. Look for one repeatable way to add regular customers.",
      });
    } else {
      checks.push({
        id: "profit",
        title: "Comfortably above break-even",
        status: "good",
        detail: "Sales could fall " + pct(a.marginOfSafety) + " before the business loses money.",
        action: "Good position to test growth ideas without risking the basics.",
      });
    }

    if (a.ownerPay > 0) {
      if (a.profit >= a.ownerPay) {
        checks.push({
          id: "owner",
          title: "Owner pay is covered",
          status: "good",
          detail: "Profit covers the owner's target pay of " + money(a.ownerPay) + "/month.",
          action: "Pay yourself on a fixed schedule so it is treated like a real cost.",
        });
      } else {
        checks.push({
          id: "owner",
          title: "Owner is underpaid",
          status: "watch",
          detail: "Reaching the owner's target pay needs " + whole(a.unitsForOwnerPay) + " sales a month (now " + whole(a.sales) + ").",
          action: "Owners often skip their own pay to keep the doors open. Plan the price or volume change that closes this gap.",
        });
      }
    }

    if (a.profit < 0 && a.runwayMonths < 3) {
      checks.push({
        id: "cash",
        title: "Cash could run out soon",
        status: "risk",
        detail: "At the current loss rate, cash lasts about " + a.runwayMonths.toFixed(1) + " months.",
        action: "Talk to suppliers and the landlord about terms now, before it is urgent. Look into local small-business grants.",
      });
    } else if (a.cashCoverMonths < 1) {
      checks.push({
        id: "cash",
        title: "Thin cash cushion",
        status: "watch",
        detail: "Cash on hand covers less than one month of fixed costs.",
        action: "Set aside a small fixed amount each week until there is at least one month of fixed costs saved.",
      });
    } else {
      checks.push({
        id: "cash",
        title: "Cash cushion in place",
        status: "good",
        detail: "Cash on hand covers " + a.cashCoverMonths.toFixed(1) + " months of fixed costs.",
        action: "Aim for three months to handle surprises like a broken fridge or a slow season.",
      });
    }

    return checks;
  }

  /*
   * Product lineup analysis (menu engineering). Each item: {name, price, cost, units}
   * where units are sold per month. Items are sorted into four groups by
   * popularity (70% rule) and dollar margin versus the weighted average.
   */
  function itemAnalysis(items, targetMargin) {
    var target = targetMargin === undefined ? 0.6 : num(targetMargin);
    var clean = (items || []).filter(function (it) {
      return num(it.price) > 0 && num(it.units) >= 0;
    });
    var totalUnits = 0;
    var totalContribution = 0;
    var totalRevenue = 0;
    var totalCost = 0;
    clean.forEach(function (it) {
      totalUnits += num(it.units);
      totalContribution += (num(it.price) - num(it.cost)) * num(it.units);
      totalRevenue += num(it.price) * num(it.units);
      totalCost += num(it.cost) * num(it.units);
    });
    var n = clean.length;
    var avgMargin = totalUnits > 0 ? totalContribution / totalUnits : 0;
    var popularityCut = n > 0 ? 0.7 / n : 0;
    var repricingGain = 0;

    var rows = clean.map(function (it) {
      var price = num(it.price);
      var cost = num(it.cost);
      var units = num(it.units);
      var margin = price - cost;
      var marginPct = margin / price;
      var mix = totalUnits > 0 ? units / totalUnits : 0;
      var popular = mix >= popularityCut;
      var profitable = margin >= avgMargin;
      var group;
      if (margin <= 0) group = "loser";
      else if (popular && profitable) group = "star";
      else if (popular) group = "workhorse";
      else if (profitable) group = "puzzle";
      else group = "dog";

      var targetPrice = priceForMargin(cost, target);
      var gain = targetPrice !== null && targetPrice > price ? (targetPrice - price) * units : 0;
      repricingGain += gain;

      return {
        name: it.name || "Item",
        price: price,
        cost: cost,
        units: units,
        margin: margin,
        marginPct: marginPct,
        contribution: margin * units,
        contributionShare: totalContribution > 0 ? (margin * units) / totalContribution : 0,
        mix: mix,
        group: group,
        targetPrice: gain > 0 ? targetPrice : null,
        repricingGain: gain,
      };
    });

    rows.sort(function (a, b) { return b.contribution - a.contribution; });

    return {
      rows: rows,
      totalUnits: totalUnits,
      totalRevenue: totalRevenue,
      totalContribution: totalContribution,
      avgPrice: totalUnits > 0 ? totalRevenue / totalUnits : 0,
      avgCost: totalUnits > 0 ? totalCost / totalUnits : 0,
      avgMargin: avgMargin,
      target: target,
      repricingGain: repricingGain,
      losers: rows.filter(function (r) { return r.group === "loser"; }).length,
    };
  }

  var ITEM_GROUPS = {
    star: { label: "Star", advice: "Popular and profitable. Keep it, feature it, and don't discount it." },
    workhorse: { label: "Workhorse", advice: "Sells a lot but earns less per sale. A small price increase or a cheaper ingredient adds up fast." },
    puzzle: { label: "Puzzle", advice: "Earns well but doesn't sell much. Try better placement, a rename, or recommending it." },
    dog: { label: "Dog", advice: "Low sales and low margin. Consider dropping it or reworking it." },
    loser: { label: "Loses money", advice: "Costs more to make than it sells for. Fix the price or the recipe now." },
  };

  // Before/after comparison for a follow-up visit.
  function compareVisits(before, after) {
    var a = analyze(before);
    var b = analyze(after);
    var metrics = [
      { key: "price", label: "Average price", fmt: "money2", higherIsBetter: true },
      { key: "varCost", label: "Cost per sale", fmt: "money2", higherIsBetter: false },
      { key: "sales", label: "Sales per month", fmt: "whole", higherIsBetter: true },
      { key: "cmRatio", label: "Margin per sale (%)", fmt: "pct", higherIsBetter: true },
      { key: "profit", label: "Monthly profit", fmt: "money", higherIsBetter: true },
      { key: "breakEvenUnits", label: "Break-even sales", fmt: "whole", higherIsBetter: false },
      { key: "cash", label: "Cash on hand", fmt: "money", higherIsBetter: true },
    ];
    return metrics.map(function (m) {
      var x = a[m.key];
      var y = b[m.key];
      var delta = Number.isFinite(x) && Number.isFinite(y) ? y - x : null;
      var direction = delta === null || Math.abs(delta) < 1e-9 ? "same" : (delta > 0) === m.higherIsBetter ? "better" : "worse";
      return { key: m.key, label: m.label, fmt: m.fmt, before: x, after: y, delta: delta, direction: direction };
    });
  }

  function median(values) {
    var v = values.filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!v.length) return null;
    var mid = Math.floor(v.length / 2);
    return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  }

  /*
   * Anonymized findings across many saved checkups (exported JSON sessions).
   * Never returns business names.
   */
  function aggregate(sessions) {
    var valid = (sessions || []).filter(function (s) {
      return s && s.profile && num(s.profile.avgPrice) > 0 && num(s.profile.salesPerMonth) > 0;
    });
    var analyses = valid.map(function (s) { return analyze(s.profile); });
    var count = valid.length;
    var share = function (pred) {
      return count ? analyses.filter(pred).length / count : null;
    };

    var byType = {};
    valid.forEach(function (s) {
      var t = s.profile.businessType || "Other";
      byType[t] = (byType[t] || 0) + 1;
    });

    var itemsAnalyzed = 0;
    var losingItems = 0;
    var repricingGain = 0;
    valid.forEach(function (s) {
      if (s.items && s.items.length) {
        var ia = itemAnalysis(s.items, s.targetMargin);
        itemsAnalyzed += ia.rows.length;
        losingItems += ia.losers;
        repricingGain += ia.repricingGain;
      }
    });

    var followUps = valid.filter(function (s) { return s.baseline && s.baseline.profile; });
    var profitChanges = followUps.map(function (s) {
      return analyze(s.profile).profit - analyze(s.baseline.profile).profit;
    });

    return {
      count: count,
      skipped: (sessions || []).length - count,
      byType: byType,
      medianCmRatio: median(analyses.map(function (a) { return a.cmRatio; })),
      medianBreakEvenPerDay: median(analyses.map(function (a) { return a.breakEvenPerDay; })),
      medianMarginOfSafety: median(analyses.map(function (a) { return a.marginOfSafety; })),
      shareLosingMoney: share(function (a) { return a.profit < 0; }),
      shareThinMargin: share(function (a) { return a.cmRatio < 0.3; }),
      shareNearBreakEven: share(function (a) { return a.profit >= 0 && a.marginOfSafety < 0.15; }),
      shareUnderpaidOwner: share(function (a) { return a.ownerPay > 0 && a.profit < a.ownerPay; }),
      shareThinCash: share(function (a) { return a.cashCoverMonths < 1; }),
      itemsAnalyzed: itemsAnalyzed,
      losingItems: losingItems,
      repricingGain: repricingGain,
      followUps: followUps.length,
      improvedProfit: profitChanges.filter(function (d) { return d > 0; }).length,
      totalProfitChange: profitChanges.reduce(function (s, d) { return s + d; }, 0),
    };
  }

  function money(n) {
    if (!Number.isFinite(n)) return "—";
    var sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function money2(n) {
    if (!Number.isFinite(n)) return "—";
    var sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pct(n) {
    if (!Number.isFinite(n)) return "—";
    return (n * 100).toFixed(0) + "%";
  }

  function whole(n) {
    if (!Number.isFinite(n)) return "—";
    return Math.ceil(n).toLocaleString("en-US");
  }

  return {
    priceForMargin: priceForMargin,
    marginAndMarkup: marginAndMarkup,
    analyze: analyze,
    priceChangeImpact: priceChangeImpact,
    cashForecast: cashForecast,
    healthChecks: healthChecks,
    itemAnalysis: itemAnalysis,
    ITEM_GROUPS: ITEM_GROUPS,
    compareVisits: compareVisits,
    median: median,
    aggregate: aggregate,
    fmt: { money: money, money2: money2, pct: pct, whole: whole },
  };
});
