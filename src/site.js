/*
 * Site settings. Fill these in, commit, and the homepage updates.
 * Leave a value empty ("") to hide the parts of the page that use it.
 */
var SITE_CONFIG = {
  // Link to a request form, e.g. a Google Form (recommended, so your email stays private).
  request: "",
  // Optional public contact email. Consider a separate project address, not your personal one.
  email: "",
  // Link to the consultant playbook, e.g. https://github.com/<you>/<repo>/blob/main/docs/PLAYBOOK.md
  playbook: "",
};

(function () {
  "use strict";
  var c = SITE_CONFIG;
  var url = function (key) {
    var v = (c[key] || "").trim();
    if (!v) return "";
    if (key === "email") return "mailto:" + v + "?subject=" + encodeURIComponent("Free financial checkup");
    return /^https?:\/\//.test(v) ? v : "";
  };

  document.querySelectorAll("[data-when]").forEach(function (el) {
    var cond = el.getAttribute("data-when");
    var neg = cond.charAt(0) === "!";
    var has = !!url(neg ? cond.slice(1) : cond);
    el.hidden = neg ? has : !has;
  });

  document.querySelectorAll("[data-href]").forEach(function (el) {
    var key = el.getAttribute("data-href");
    var href = url(key);
    if (!href) {
      el.hidden = true;
      return;
    }
    el.href = href;
    if (/^https?:/.test(href)) {
      el.target = "_blank";
      el.rel = "noopener";
    }
  });

  document.querySelectorAll("[data-text]").forEach(function (el) {
    el.textContent = (c[el.getAttribute("data-text")] || "").trim();
  });
})();
