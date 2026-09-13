/* Terminal I/O: append turns, type them out, keep the log scrolled. */
(function (root) {
  'use strict';

  var reduceMotion = root.matchMedia &&
    root.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function Terminal(logEl, opts) {
    this.log = logEl;
    this.opts = opts || {};
    this.queue = [];
    this.busy = false;
  }

  Terminal.prototype.atBottom = function () {
    return this.log.scrollHeight - this.log.scrollTop - this.log.clientHeight < 80;
  };

  Terminal.prototype.scroll = function (force) {
    if (force || this.atBottom()) this.log.scrollTop = this.log.scrollHeight;
  };

  Terminal.prototype.write = function (text, classes) {
    var p = document.createElement('p');
    p.className = 'turn ' + (classes || '');
    p.textContent = text;
    this.log.appendChild(p);
    this.scroll(true);
    return p;
  };

  /* Type text out character-group by character-group. Returns a promise so
   * callers can await the end of the line. Honours prefers-reduced-motion. */
  Terminal.prototype.type = function (text, classes, speed) {
    var self = this;
    var p = document.createElement('p');
    p.className = 'turn ' + (classes || '');
    this.log.appendChild(p);

    if (reduceMotion) {
      p.textContent = text;
      this.scroll(true);
      return Promise.resolve(p);
    }

    p.classList.add('caret');
    var i = 0;
    var step = Math.max(1, Math.round(text.length / 420)); // long entries still land fast
    var delay = speed || 12;

    return new Promise(function (resolve) {
      var stick = true;
      function frame() {
        i = Math.min(text.length, i + step);
        p.textContent = text.slice(0, i);
        if (stick && self.atBottom()) self.log.scrollTop = self.log.scrollHeight;
        if (i < text.length) {
          setTimeout(frame, delay);
        } else {
          p.classList.remove('caret');
          resolve(p);
        }
      }
      frame();
    });
  };

  /* Serialise writes so overlapping submissions cannot interleave. */
  Terminal.prototype.enqueue = function (task) {
    var self = this;
    this.queue.push(task);
    if (this.busy) return;
    this.busy = true;
    (function drain() {
      var next = self.queue.shift();
      if (!next) { self.busy = false; return; }
      Promise.resolve(next()).then(drain, drain);
    })();
  };

  root.OdiumTerminal = Terminal;
})(window);
