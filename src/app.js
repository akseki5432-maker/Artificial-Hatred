/* Main Street Ledger: UI wiring. All math lives in calc.js. */
(function () {
  "use strict";

  var L = window.Ledger;
  var f = L.fmt;
  var STORAGE_KEY = "msl-session-v1";
  var PRICE_STEPS = [-0.1, -0.05, 0, 0.05, 0.1, 0.15];

  var SAMPLE = {
    profile: {
      businessName: "Corner Café (sample)",
      businessType: "Food & drink",
      visitDate: "",
      avgPrice: 9.5,
      varCost: 3.6,
      salesPerMonth: 2100,
      fixedMonthly: 9800,
      ownerPay: 3500,
      cashOnHand: 7500,
    },
    growth: 0.5,
    events: [
      { week: 4, amount: -2400, label: "Espresso machine repair" },
      { week: 9, amount: -3000, label: "Quarterly tax payment" },
      { week: 11, amount: 1800, label: "Catering deposit" },
    ],
    items: [
      { name: "Latte", price: 5.25, cost: 1.3, units: 820 },
      { name: "Drip coffee", price: 2.75, cost: 0.95, units: 640 },
      { name: "Breakfast sandwich", price: 8.5, cost: 3.9, units: 310 },
      { name: "Blueberry muffin", price: 3.25, cost: 3.4, units: 260 },
      { name: "Avocado toast", price: 11, cost: 3.6, units: 70 },
      { name: "Chai latte", price: 5, cost: 2.6, units: 45 },
    ],
    targetMargin: 60,
    notes: "",
  };

  var form = document.getElementById("profile-form");
  var eventsEl = document.getElementById("events");
  var growthEl = document.getElementById("growth");
  var notesEl = document.getElementById("consultant-notes");
  var itemsBody = document.querySelector("#items-table tbody");
  var targetEl = document.getElementById("target-margin");
  var baseline = null;

  // ---------- state ----------

  function readProfile() {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      data[el.name] = el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value;
    });
    return data;
  }

  function readEvents() {
    return Array.prototype.map.call(eventsEl.querySelectorAll(".event-row"), function (row) {
      return {
        week: Number(row.querySelector('[name="week"]').value),
        amount: Number(row.querySelector('[name="amount"]').value),
        label: row.querySelector('[name="label"]').value,
      };
    });
  }

  function readItems() {
    return Array.prototype.map.call(itemsBody.querySelectorAll("tr"), function (row) {
      var get = function (n) { return row.querySelector('[name="' + n + '"]').value; };
      return { name: get("name"), price: numOrBlank(get("price")), cost: numOrBlank(get("cost")), units: numOrBlank(get("units")) };
    });
  }

  function numOrBlank(v) {
    return v === "" ? "" : Number(v);
  }

  function targetMargin() {
    var t = Number(targetEl.value);
    return Number.isFinite(t) && t >= 0 && t < 100 ? t / 100 : 0.6;
  }

  function readState() {
    return {
      version: 2,
      profile: readProfile(),
      growth: Number(growthEl.value) || 0,
      events: readEvents(),
      items: readItems(),
      targetMargin: Number(targetEl.value) || 60,
      baseline: baseline,
      notes: notesEl.value,
    };
  }

  function applyState(s) {
    s = s || {};
    var p = s.profile || {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name) el.value = p[el.name] !== undefined ? p[el.name] : "";
    });
    growthEl.value = s.growth || 0;
    eventsEl.innerHTML = "";
    (s.events || []).forEach(addEventRow);
    itemsBody.innerHTML = "";
    (s.items || []).forEach(addItemRow);
    targetEl.value = s.targetMargin || 60;
    baseline = s.baseline || null;
    notesEl.value = s.notes || "";
    render();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(readState())); } catch (e) { /* storage unavailable */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---------- events list ----------

  function addEventRow(e) {
    e = e || { week: 1, amount: -1000, label: "" };
    var row = document.createElement("div");
    row.className = "event-row";
    row.innerHTML =
      '<input name="week" type="number" min="1" max="13" step="1" aria-label="Week">' +
      '<input name="amount" type="number" step="1" aria-label="Amount ($)">' +
      '<input name="label" type="text" placeholder="What is it?" aria-label="Description">' +
      '<button type="button" class="no-print" aria-label="Remove">✕</button>';
    row.querySelector('[name="week"]').value = e.week;
    row.querySelector('[name="amount"]').value = e.amount;
    row.querySelector('[name="label"]').value = e.label || "";
    row.querySelector("button").addEventListener("click", function () {
      row.remove();
      onChange();
    });
    eventsEl.appendChild(row);
  }

  // ---------- product lineup ----------

  function addItemRow(it) {
    it = it || { name: "", price: "", cost: "", units: "" };
    var row = document.createElement("tr");
    row.innerHTML =
      '<td><input name="name" type="text" placeholder="Item name" aria-label="Item name"></td>' +
      '<td><input name="price" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Price"></td>' +
      '<td><input name="cost" type="number" min="0" step="0.01" inputmode="decimal" aria-label="Cost to make"></td>' +
      '<td><input name="units" type="number" min="0" step="1" inputmode="numeric" aria-label="Sold per month"></td>' +
      '<td class="no-print"><button type="button" aria-label="Remove item">✕</button></td>';
    ["name", "price", "cost", "units"].forEach(function (k) {
      row.querySelector('[name="' + k + '"]').value = it[k] !== undefined ? it[k] : "";
    });
    row.querySelector("button").addEventListener("click", function () {
      row.remove();
      onChange();
    });
    itemsBody.appendChild(row);
    return row;
  }

  function renderItems() {
    var ia = L.itemAnalysis(readItems(), targetMargin());
    var summary = document.getElementById("items-summary");
    var body = document.querySelector("#items-result tbody");
    var legend = document.getElementById("items-legend");
    document.getElementById("items-result").hidden = !ia.rows.length;

    if (!ia.rows.length) {
      summary.innerHTML = "";
      body.innerHTML = "";
      legend.innerHTML = "";
      return ia;
    }

    var top = ia.rows[0];
    var lines = [
      "<strong>" + esc(top.name) + "</strong> brings in " + f.pct(top.contributionShare) + " of the money left after product costs.",
    ];
    if (ia.losers) {
      lines.push('<span class="neg">' + ia.losers + (ia.losers === 1 ? " item costs" : " items cost") + " more to make than it sells for.</span>");
    }
    if (ia.repricingGain > 0) {
      lines.push("Bringing every item up to a " + f.pct(ia.target) + " margin would add about <strong>" + f.money(ia.repricingGain) +
        "/month</strong> if sales held steady. Use the price-change table above to sanity-check that.");
    } else {
      lines.push("Every item already meets the " + f.pct(ia.target) + " target margin.");
    }
    summary.innerHTML = '<p class="summary">' + lines.join(" ") + "</p>";

    body.innerHTML = ia.rows.map(function (r) {
      var g = L.ITEM_GROUPS[r.group];
      return "<tr><td>" + esc(r.name) + '</td><td class="' + (r.margin <= 0 ? "neg" : "") + '">' + f.money2(r.margin) + " (" + f.pct(r.marginPct) + ")" +
        '</td><td><span class="share"><span style="width:' + Math.max(0, r.contributionShare * 100).toFixed(1) + '%"></span></span> ' + f.pct(Math.max(0, r.contributionShare)) +
        '</td><td><span class="tag ' + r.group + '">' + g.label + "</span></td><td>" + (r.targetPrice ? f.money2(r.targetPrice) : "—") + "</td></tr>";
    }).join("");

    var present = {};
    ia.rows.forEach(function (r) { present[r.group] = true; });
    legend.innerHTML = Object.keys(L.ITEM_GROUPS).filter(function (k) { return present[k]; }).map(function (k) {
      return '<li><span class="tag ' + k + '">' + L.ITEM_GROUPS[k].label + "</span> " + L.ITEM_GROUPS[k].advice + "</li>";
    }).join("");
    return ia;
  }

  // ---------- follow-up visits ----------

  function renderBaseline() {
    var status = document.getElementById("baseline-status");
    var clearBtn = document.getElementById("clear-baseline");
    var setBtn = document.getElementById("set-baseline");
    var section = document.getElementById("progress");
    var p = readProfile();

    clearBtn.hidden = !baseline;
    setBtn.textContent = baseline ? "Replace baseline with today" : "Save today as first-visit baseline";
    document.getElementById("notes-title").textContent = (baseline ? "8" : "7") + ". Notes and next steps";

    if (!baseline) {
      status.textContent = "At the end of the first visit, save a baseline. At the 30-day follow-up, update the numbers to see what changed.";
      section.hidden = true;
      return;
    }

    status.textContent = "Baseline saved from " + (baseline.date || "an earlier visit") + ". Update the numbers above at the follow-up to see progress.";
    if (!hasProfile(p) || !hasProfile(baseline.profile)) { section.hidden = true; return; }
    section.hidden = false;

    var rows = L.compareVisits(baseline.profile, p);
    document.getElementById("progress-hint").textContent = "Comparing the first visit (" + (baseline.date || "earlier") + ") with today's numbers.";
    document.querySelector("#progress-table tbody").innerHTML = rows.map(function (r) {
      var fmt = f[r.fmt];
      var change = r.delta === null || r.direction === "same" ? "—" :
        (r.delta > 0 ? "+" : "") + (r.fmt === "pct" ? (r.delta * 100).toFixed(1) + " pts" : fmt(r.delta));
      return "<tr><td>" + r.label + "</td><td>" + fmt(r.before) + "</td><td>" + fmt(r.after) + '</td><td class="delta ' + r.direction + '">' + change + "</td></tr>";
    }).join("");

    var profit = rows.find(function (r) { return r.key === "profit"; });
    var summary = document.getElementById("progress-summary");
    if (profit.delta > 0) summary.textContent = "Monthly profit is up " + f.money(profit.delta) + " since the first visit (" + f.money(profit.delta * 12) + " a year at this rate).";
    else if (profit.delta < 0) summary.textContent = "Monthly profit is down " + f.money(-profit.delta) + " since the first visit. Revisit the health check together.";
    else summary.textContent = "No change in monthly profit yet.";
  }

  // ---------- rendering ----------

  function hasProfile(p) {
    return Number(p.avgPrice) > 0 && Number(p.salesPerMonth) > 0;
  }

  function stat(label, value, sub, negative) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="value' + (negative ? " neg" : "") + '">' +
      value + "</div>" + (sub ? '<div class="sub">' + sub + "</div>" : "") + "</div>";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function renderSnapshot(a) {
    document.getElementById("stats").innerHTML = [
      stat("Revenue / month", f.money(a.revenue)),
      stat("Profit / month", f.money(a.profit), "before owner pay", a.profit < 0),
      stat("Margin per sale", f.money2(a.contributionMargin), f.pct(a.cmRatio) + " of price", a.contributionMargin <= 0),
      stat("Break-even", f.whole(a.breakEvenUnits) + " sales", "≈ " + f.whole(a.breakEvenPerDay) + " a day · " + f.money(a.breakEvenRevenue)),
      stat("Safety cushion", f.pct(a.marginOfSafety), "sales can drop this much before a loss", a.marginOfSafety < 0),
      stat("Sales to pay owner", f.whole(a.unitsForOwnerPay), "per month, incl. " + f.money(a.ownerPay) + " owner pay"),
    ].join("");

    var bar = document.getElementById("breakeven-bar");
    if (!Number.isFinite(a.breakEvenUnits)) { bar.innerHTML = ""; return; }
    var max = Math.max(a.sales, a.breakEvenUnits, a.unitsForOwnerPay) * 1.1;
    bar.innerHTML =
      '<div class="bar"><div class="fill" style="width:' + (a.sales / max * 100).toFixed(1) + '%"></div>' +
      '<div class="marker" style="left:' + (a.breakEvenUnits / max * 100).toFixed(1) + '%"></div></div>' +
      '<div class="bar-legend"><span>Current sales: ' + f.whole(a.sales) + "</span><span>│ marks break-even (" + f.whole(a.breakEvenUnits) + ")</span></div>";
  }

  function renderChecks(a) {
    var labels = { good: "Good", watch: "Watch", risk: "Act now" };
    document.getElementById("checks").innerHTML = L.healthChecks(a).map(function (c) {
      return '<li class="check ' + c.status + '"><div><span class="title">' + c.title + '</span><span class="badge">' +
        labels[c.status] + "</span></div><p>" + c.detail + '</p><p class="todo"><strong>Next step:</strong> ' + c.action + "</p></li>";
    }).join("");
  }

  function renderPriceTable(p) {
    var rows = L.priceChangeImpact(p, PRICE_STEPS).map(function (r) {
      var label = r.pct === 0 ? "Today" : (r.pct > 0 ? "+" : "") + (r.pct * 100).toFixed(0) + "%";
      var change;
      if (r.pct === 0) change = "—";
      else if (!Number.isFinite(r.salesChangePct)) change = "Loses money on every sale";
      else if (r.salesChangePct <= 0) change = "Can lose " + f.pct(-r.salesChangePct) + " of sales";
      else change = "Must gain " + f.pct(r.salesChangePct) + " more sales";
      return "<tr" + (r.pct === 0 ? ' class="current"' : "") + "><td>" + label + "</td><td>" + f.money2(r.newPrice) +
        "</td><td>" + f.whole(r.salesNeeded) + "</td><td>" + change + "</td></tr>";
    });
    document.querySelector("#price-table tbody").innerHTML = rows.join("");
  }

  function renderPriceForMargin() {
    var cost = Number(document.getElementById("pm-cost").value);
    var m = Number(document.getElementById("pm-margin").value) / 100;
    var price = L.priceForMargin(cost, m);
    var mm = price ? L.marginAndMarkup(price, cost) : null;
    document.getElementById("pm-result").innerHTML = price
      ? "Charge <strong>" + f.money2(price) + "</strong> (that's a " + f.pct(mm.markup) + " markup, not " + f.pct(m) + ")"
      : "Margin must be below 100%.";
  }

  function renderCash(p) {
    var fc = L.cashForecast(p, { weeks: 13, weeklyGrowth: (Number(growthEl.value) || 0) / 100, events: readEvents() });

    document.querySelector("#cash-table tbody").innerHTML = fc.rows.map(function (r) {
      return "<tr><td>" + r.week + (r.labels.length ? " · " + esc(r.labels.join(", ")) : "") + "</td><td>" + f.money(r.inflow) +
        "</td><td>" + f.money(r.outflow) + "</td><td>" + (r.oneTime ? f.money(r.oneTime) : "") + '</td><td class="' +
        (r.balance < 0 ? "neg" : "") + '">' + f.money(r.balance) + "</td></tr>";
    }).join("");

    var summary = document.getElementById("cash-summary");
    if (fc.firstNegativeWeek) {
      summary.innerHTML = '<span class="neg">Cash goes negative in week ' + fc.firstNegativeWeek + ".</span> Lowest point: " +
        f.money(fc.low.balance) + " in week " + fc.low.week + ". Plan for this now by moving a purchase, asking for supplier terms, or building savings first.";
    } else {
      summary.textContent = "Cash stays positive for 13 weeks. Lowest point: " + f.money(fc.low.balance) +
        (fc.low.week ? " in week " + fc.low.week : " (today)") + ". Ending balance: " + f.money(fc.ending) + ".";
    }

    drawChart(p.cashOnHand, fc.rows);
  }

  function drawChart(start, rows) {
    var svg = document.getElementById("cash-chart");
    var W = svg.clientWidth || 600, H = svg.clientHeight || 220;
    var pad = { l: 64, r: 12, t: 12, b: 24 };
    var pts = [{ week: 0, balance: Number(start) || 0 }].concat(rows);
    var vals = pts.map(function (d) { return d.balance; });
    var min = Math.min(0, Math.min.apply(null, vals));
    var max = Math.max(0, Math.max.apply(null, vals));
    if (max === min) max = min + 1;
    var x = function (w) { return pad.l + (w / 13) * (W - pad.l - pad.r); };
    var y = function (v) { return pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b); };

    var path = pts.map(function (d, i) { return (i ? "L" : "M") + x(d.week).toFixed(1) + "," + y(d.balance).toFixed(1); }).join("");
    var out = [];
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    [max, (max + min) / 2, min].forEach(function (v) {
      out.push('<text x="' + (pad.l - 8) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + f.money(v) + "</text>");
    });
    out.push('<line class="axis" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + (H - pad.b) + '" y2="' + (H - pad.b) + '"/>');
    out.push('<line class="zero" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + y(0) + '" y2="' + y(0) + '"/>');
    [0, 4, 8, 13].forEach(function (w) {
      out.push('<text x="' + x(w) + '" y="' + (H - 6) + '" text-anchor="' + (w === 13 ? "end" : w === 0 ? "start" : "middle") + '">' + (w === 0 ? "Now" : "Wk " + w) + "</text>");
    });
    out.push('<path class="line" d="' + path + '"/>');
    pts.forEach(function (d) {
      out.push('<circle class="dot' + (d.balance < 0 ? " neg" : "") + '" r="3" cx="' + x(d.week) + '" cy="' + y(d.balance) + '"><title>' +
        (d.week ? "Week " + d.week : "Now") + ": " + f.money(d.balance) + "</title></circle>");
    });
    svg.innerHTML = out.join("");
  }

  function render() {
    var p = readProfile();
    renderPriceForMargin();
    if (!hasProfile(p)) {
      document.getElementById("stats").innerHTML = '<p class="hint">Enter the average price and monthly sales to see results, or load the sample café.</p>';
      document.getElementById("breakeven-bar").innerHTML = "";
      document.getElementById("checks").innerHTML = "";
      document.querySelector("#price-table tbody").innerHTML = "";
      document.querySelector("#cash-table tbody").innerHTML = "";
      document.getElementById("cash-summary").textContent = "";
      document.getElementById("cash-chart").innerHTML = "";
      renderItems();
      renderBaseline();
      return;
    }
    var a = L.analyze(p);
    renderSnapshot(a);
    renderChecks(a);
    renderPriceTable(p);
    renderItems();
    renderCash(p);
    renderBaseline();
    document.title = (p.businessName ? p.businessName + " · " : "") + "Main Street Ledger";
  }

  function onChange() {
    render();
    save();
  }

  // ---------- wiring ----------

  form.addEventListener("input", onChange);
  growthEl.addEventListener("input", onChange);
  eventsEl.addEventListener("input", onChange);
  itemsBody.addEventListener("input", onChange);
  targetEl.addEventListener("input", onChange);
  document.getElementById("add-item").addEventListener("click", function () {
    addItemRow().querySelector("input").focus();
    onChange();
  });
  document.getElementById("items-to-profile").addEventListener("click", function () {
    var ia = L.itemAnalysis(readItems(), targetMargin());
    if (!ia.totalUnits) { alert("Add at least one item with a price and monthly sales first."); return; }
    if (!confirm("Replace average price, cost per sale, and sales per month with the lineup totals?\n\nThis treats each item sold as one sale.")) return;
    form.elements.avgPrice.value = ia.avgPrice.toFixed(2);
    form.elements.varCost.value = ia.avgCost.toFixed(2);
    form.elements.salesPerMonth.value = Math.round(ia.totalUnits);
    onChange();
  });
  document.getElementById("set-baseline").addEventListener("click", function () {
    var p = readProfile();
    if (!hasProfile(p)) { alert("Fill in the business profile first."); return; }
    if (baseline && !confirm("Replace the existing baseline with today's numbers?")) return;
    baseline = { date: p.visitDate || new Date().toISOString().slice(0, 10), profile: p, items: readItems() };
    onChange();
  });
  document.getElementById("clear-baseline").addEventListener("click", function () {
    if (!confirm("Remove the first-visit baseline?")) return;
    baseline = null;
    onChange();
  });
  notesEl.addEventListener("input", save);
  document.getElementById("pm-cost").addEventListener("input", renderPriceForMargin);
  document.getElementById("pm-margin").addEventListener("input", renderPriceForMargin);
  document.getElementById("add-event").addEventListener("click", function () { addEventRow(); onChange(); });
  document.getElementById("load-sample").addEventListener("click", function () { applyState(SAMPLE); save(); });
  document.getElementById("clear").addEventListener("click", function () {
    if (confirm("Clear all numbers on this device?")) { applyState({}); save(); }
  });
  document.getElementById("print").addEventListener("click", function () { window.print(); });

  document.getElementById("export").addEventListener("click", function () {
    var s = readState();
    var blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    var slug = (s.profile.businessName || "business").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "business";
    a.download = slug + "-" +
      (s.profile.visitDate || new Date().toISOString().slice(0, 10)) + ".json";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });

  document.getElementById("import").addEventListener("change", function (e) {
    var file = e.target.files[0];
    if (!file) return;
    file.text().then(function (text) {
      try { applyState(JSON.parse(text)); save(); } catch (err) { alert("That file could not be read."); }
    });
    e.target.value = "";
  });

  window.addEventListener("resize", render);

  applyState(load() || {});
})();
