/* Live counters. Arithmetic on published annual rates, from page-open time.
 * These are not measurements and the UI says so.
 */
(function (root) {
  'use strict';

  var SECONDS_PER_YEAR = 31557600; // Julian year, so the rates divide cleanly

  function fmt(n) {
    return Math.floor(n).toLocaleString('en-US');
  }

  function Counters(data, els) {
    this.data = data;
    this.list = els.list;
    this.statics = els.statics;
    this.opened = Date.now();
    this.rows = [];
    this.render();
  }

  Counters.prototype.render = function () {
    var self = this;
    this.data.counters.forEach(function (c) {
      var li = document.createElement('li');
      var n = document.createElement('span');
      n.className = 'n';
      n.textContent = '0';
      var k = document.createElement('span');
      k.className = 'k';
      k.textContent = c.label;
      li.title = c.label + ' -- ' + c.per_year.toLocaleString('en-US') + ' per year (' + c.source + ')';
      li.appendChild(k);
      li.appendChild(n);
      self.list.appendChild(li);
      self.rows.push({ el: n, perSecond: c.per_year / SECONDS_PER_YEAR });
    });

    this.data.statics.forEach(function (s) {
      var li = document.createElement('li');
      li.title = s.source;
      var k = document.createElement('span');
      k.className = 'k';
      k.textContent = s.label;
      var n = document.createElement('span');
      n.className = 'n';
      n.textContent = s.value.toLocaleString('en-US');
      li.appendChild(k);
      li.appendChild(n);
      self.statics.appendChild(li);
    });
  };

  Counters.prototype.tick = function () {
    var elapsed = (Date.now() - this.opened) / 1000;
    for (var i = 0; i < this.rows.length; i++) {
      this.rows[i].el.textContent = fmt(this.rows[i].perSecond * elapsed);
    }
  };

  Counters.prototype.start = function () {
    var self = this;
    this.tick();
    // 4 Hz: fast enough that the numbers visibly move, slow enough to be cheap.
    this.timer = setInterval(function () { self.tick(); }, 250);
  };

  root.OdiumCounters = Counters;
})(window);
