/* Wiring. */
(function () {
  'use strict';

  var data = window.ODIUM_DATA;
  var engine = new OdiumEngine(data);
  var term = new OdiumTerminal(document.getElementById('log'));
  var input = document.getElementById('input');
  var form = document.getElementById('form');
  var heatEl = document.getElementById('heat-readout');
  var ledgerEl = document.getElementById('ledger');
  var readEl = document.getElementById('read-count');

  var counters = new OdiumCounters(data.counters, {
    list: document.getElementById('counters'),
    statics: document.getElementById('statics')
  });
  counters.start();

  /* ------------------------------------------------------------- side ledger */

  document.getElementById('entry-count').textContent = data.archive.entries.length;

  data.archive.entries.forEach(function (entry, i) {
    var li = document.createElement('li');
    li.dataset.id = entry.id;
    var b = document.createElement('button');
    b.type = 'button';
    var t = document.createElement('span');
    t.textContent = (i + 1) + '. ' + entry.title;
    var y = document.createElement('span');
    y.className = 'yr';
    y.textContent = entry.years;
    b.appendChild(t);
    b.appendChild(y);
    b.addEventListener('click', function () { send('/ledger ' + (i + 1)); });
    li.appendChild(b);
    ledgerEl.appendChild(li);
  });

  function refreshStatus(tier) {
    if (tier != null) {
      heatEl.textContent = 'TIER ' + tier;
      heatEl.dataset.tier = String(tier);
    }
    var read = Object.keys(engine.cited);
    readEl.textContent = read.length;
    read.forEach(function (id) {
      var li = ledgerEl.querySelector('li[data-id="' + id + '"]');
      if (li) li.classList.add('read');
    });
  }

  /* ------------------------------------------------------------------- turns */

  var FIELDS = [['toll', 'TOLL'], ['record', 'RECORD'], ['verdict', 'VERDICT']];

  // A cited entry is rendered as structure, not preformatted text, so long
  // lines wrap under their own label instead of falling back to column zero.
  function citation(entry) {
    var wrap = document.createElement('div');
    wrap.className = 'turn cite';

    var head = document.createElement('p');
    head.className = 'cite-head';
    head.textContent = entry.title;
    var yr = document.createElement('span');
    yr.textContent = entry.years;
    head.appendChild(yr);
    wrap.appendChild(head);

    FIELDS.forEach(function (f) {
      var row = document.createElement('p');
      row.className = 'cite-row';
      var label = document.createElement('span');
      label.className = 'cite-label';
      label.textContent = f[1];
      var value = document.createElement('span');
      value.textContent = entry[f[0]];
      row.appendChild(label);
      row.appendChild(value);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function renderBlock(block, result, first) {
    if (block.kind === 'cite' && block.entry) {
      term.log.appendChild(citation(block.entry));
      term.scroll(true);
      return Promise.resolve();
    }
    var cls = block.kind === 'system' ? 'system'
            : block.kind === 'plain' ? 'plain'
            : 'odium t' + (result.tier || 0);
    if (!first) cls += ' cont';
    // Bulk output types fast; a single cruel sentence is allowed to land slowly.
    var speed = block.kind === 'plain' ? 3 : (block.text.length > 220 ? 9 : 17);
    return term.type(block.text, cls, speed);
  }

  function send(raw) {
    var text = (raw == null ? input.value : raw).trim();
    if (!text) return;
    input.value = '';
    term.enqueue(function () {
      term.write(text, 'you');
      var result = engine.respond(text);
      refreshStatus(result.tier);
      var blocks = result.blocks || [{ kind: 'prose', text: result.text }];
      var chain = Promise.resolve();
      var labelled = false;
      blocks.forEach(function (b) {
        chain = chain.then(function () {
          var first = !labelled && b.kind !== 'cite';
          if (first) labelled = true;
          return renderBlock(b, result, first);
        });
      });
      return chain.then(function () { refreshStatus(result.tier); });
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    send();
  });

  // Clicking anywhere that is not a control returns focus to the prompt.
  document.addEventListener('click', function (e) {
    if (e.target.closest('button, a, input, .panel')) return;
    input.focus();
  });

  /* -------------------------------------------------------------------- boot */

  term.enqueue(function () {
    return term.type(engine.boot(), 'boot', 4);
  });
  refreshStatus(0);
  input.focus();
})();
