/* Main Street Ledger: findings dashboard. Aggregates saved sessions; math lives in calc.js. */
(function () {
  "use strict";

  var L = window.Ledger;
  var f = L.fmt;
  var sessions = [];
  var demo = false;

  var drop = document.getElementById("drop");
  var input = document.getElementById("files");

  function readFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    Promise.all(files.map(function (file) {
      return file.text().then(function (t) {
        try { return JSON.parse(t); } catch (e) { return null; }
      });
    })).then(function (parsed) {
      if (demo) { sessions = []; demo = false; }
      sessions = sessions.concat(parsed.filter(Boolean));
      render();
    });
  }

  function demoSessions() {
    var types = ["Food & drink", "Food & drink", "Retail", "Salon / beauty", "Services & repair", "Food truck / market stall", "Food & drink", "Retail"];
    var seed = 7;
    var rand = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    return types.map(function (t) {
      var price = 6 + rand() * 30;
      var profile = {
        businessType: t,
        avgPrice: price,
        varCost: price * (0.25 + rand() * 0.5),
        salesPerMonth: Math.round(400 + rand() * 2000),
        fixedMonthly: Math.round(3000 + rand() * 9000),
        ownerPay: 3000,
        cashOnHand: Math.round(rand() * 15000),
      };
      var s = {
        profile: profile,
        items: [
          { name: "A", price: price, cost: price * 0.4, units: 300 },
          { name: "B", price: price * 0.6, cost: price * (0.3 + rand() * 0.4), units: 200 },
          { name: "C", price: price * 1.2, cost: price * 0.5, units: 50 },
        ],
      };
      if (rand() > 0.5) {
        s.baseline = { profile: Object.assign({}, profile, { avgPrice: price * 0.95, salesPerMonth: profile.salesPerMonth - 40 }) };
      }
      return s;
    });
  }

  function stat(label, value, sub) {
    return '<div class="stat"><div class="label">' + label + '</div><div class="value">' + value + "</div>" +
      (sub ? '<div class="sub">' + sub + "</div>" : "") + "</div>";
  }

  function bar(label, share, n) {
    var w = share === null ? 0 : Math.max(0, Math.min(1, share)) * 100;
    return '<div class="row"><span>' + label + '</span><span class="track"><span style="width:' + w.toFixed(1) + '%"></span></span><span class="n">' + n + "</span></div>";
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function brief(a) {
    var lines = [];
    lines.push("Main Street Ledger findings (" + a.count + " local businesses)");
    lines.push("");
    lines.push("- Typical margin per sale after product costs: " + f.pct(a.medianCmRatio) + " (median).");
    lines.push("- Typical break-even point: about " + f.whole(a.medianBreakEvenPerDay) + " sales a day (median).");
    lines.push("- " + f.pct(a.shareLosingMoney) + " were losing money each month" +
      (a.shareNearBreakEven ? "; another " + f.pct(a.shareNearBreakEven) + " were within 15% of break-even." : "."));
    lines.push("- " + f.pct(a.shareUnderpaidOwner) + " could not yet pay the owner their target salary.");
    lines.push("- " + f.pct(a.shareThinCash) + " had less than one month of fixed costs in cash.");
    if (a.itemsAnalyzed) {
      lines.push("- Of " + a.itemsAnalyzed + " products reviewed, " + a.losingItems + " cost more to make than they sold for.");
      lines.push("- Repricing below-target items could add about " + f.money(a.repricingGain) + "/month across these businesses if sales held steady.");
    }
    if (a.followUps) {
      lines.push("- " + a.improvedProfit + " of " + a.followUps + " businesses with a follow-up visit had higher monthly profit, a combined change of " +
        (a.totalProfitChange >= 0 ? "+" : "") + f.money(a.totalProfitChange) + "/month.");
    }
    lines.push("");
    lines.push("Figures are owner-reported estimates from free 30-minute checkups. Small sample; not statistically representative.");
    return lines.join("\n");
  }

  function render() {
    var results = document.getElementById("results");
    var a = L.aggregate(sessions);
    document.getElementById("drop-text").textContent = sessions.length
      ? (demo ? "Showing " + sessions.length + " demo checkups. Add your own files to replace them." :
        sessions.length + " checkup" + (sessions.length === 1 ? "" : "s") + " loaded") + (a.skipped ? " (" + a.skipped + " skipped: missing price or sales)" : "") + (demo ? "" : ". Add more?")
      : "Drop files here, or click to choose";

    if (!a.count) { results.hidden = true; return; }
    results.hidden = false;

    document.getElementById("f-stats").innerHTML = [
      stat("Businesses", a.count, a.followUps + " with a follow-up"),
      stat("Median margin per sale", f.pct(a.medianCmRatio)),
      stat("Median break-even", f.whole(a.medianBreakEvenPerDay) + " / day", "sales needed"),
      stat("Products reviewed", a.itemsAnalyzed, a.losingItems + " losing money"),
      stat("Repricing opportunity", f.money(a.repricingGain), "per month, combined"),
      stat("Profit change after follow-up", (a.totalProfitChange >= 0 ? "+" : "") + f.money(a.totalProfitChange),
        a.followUps ? a.improvedProfit + " of " + a.followUps + " improved" : "no follow-ups yet"),
    ].join("");

    var n = function (share) { return share === null ? "—" : Math.round(share * a.count) + "/" + a.count; };
    document.getElementById("f-issues").innerHTML = [
      bar("Losing money monthly", a.shareLosingMoney, n(a.shareLosingMoney)),
      bar("Within 15% of break-even", a.shareNearBreakEven, n(a.shareNearBreakEven)),
      bar("Thin margin (< 30%)", a.shareThinMargin, n(a.shareThinMargin)),
      bar("Owner underpaid", a.shareUnderpaidOwner, n(a.shareUnderpaidOwner)),
      bar("< 1 month cash cushion", a.shareThinCash, n(a.shareThinCash)),
    ].join("");

    var types = Object.keys(a.byType).sort(function (x, y) { return a.byType[y] - a.byType[x]; });
    document.getElementById("f-types").innerHTML = types.map(function (t) {
      return bar(esc(t), a.byType[t] / a.count, a.byType[t]);
    }).join("");

    document.getElementById("f-brief").textContent = brief(a);
  }

  input.addEventListener("change", function () { readFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("over"); });
  });
  ["dragleave", "drop"].forEach(function (ev) {
    drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("over"); });
  });
  drop.addEventListener("drop", function (e) { readFiles(e.dataTransfer.files); });
  document.getElementById("demo").addEventListener("click", function () { sessions = demoSessions(); demo = true; render(); });
  document.getElementById("reset").addEventListener("click", function () { sessions = []; demo = false; render(); });
  document.getElementById("print").addEventListener("click", function () { window.print(); });
  document.getElementById("copy").addEventListener("click", function (e) {
    var btn = e.target;
    var text = document.getElementById("f-brief").textContent;
    var done = function () { btn.textContent = "Copied"; setTimeout(function () { btn.textContent = "Copy brief"; }, 1500); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { alert(text); });
    else alert(text);
  });

  render();
})();
