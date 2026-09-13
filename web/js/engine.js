/* ODIUM response engine.
 * Deterministic, offline, no network. Consumes the JSON in /data (bundled into
 * data.bundle.js for file:// use). Mirrored in cli/odium.py -- keep both in step.
 */
(function (root) {
  'use strict';

  var TIERS = 4; // hostility tiers 0..3

  function pick(list, rng) {
    return list[Math.floor(rng() * list.length)];
  }

  // Small seedable PRNG so a session can be reproduced from its seed.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function Engine(data, opts) {
    opts = opts || {};
    this.archive = data.archive;
    this.lexicon = data.lexicon;
    this.responses = data.responses;
    this.counters = data.counters;
    this.rng = mulberry32(opts.seed == null ? (Date.now() & 0x7fffffff) : opts.seed);
    this.compiled = this.responses.intents.map(function (intent) {
      return {
        intent: intent,
        regexes: intent.patterns.map(function (p) { return new RegExp(p, 'i'); })
      };
    });
    this.reset();
  }

  Engine.prototype.reset = function () {
    this.heat = 0;          // 0..12, drives the hostility tier
    this.turns = 0;
    this.cited = {};        // archive ids already read out
    this.recent = {};       // last reply index per pool, to avoid immediate repeats
    this.suspended = false; // true after a safety break, until acknowledged
  };

  Engine.prototype.tier = function () {
    return Math.max(0, Math.min(TIERS - 1, Math.floor(this.heat / 3)));
  };

  /* ---------------------------------------------------------------- archive */

  Engine.prototype.entryById = function (id) {
    for (var i = 0; i < this.archive.entries.length; i++) {
      if (this.archive.entries[i].id === id) return this.archive.entries[i];
    }
    return null;
  };

  // Score entries against free text by tag and title overlap.
  Engine.prototype.match = function (text) {
    var low = ' ' + text.toLowerCase().replace(/[^a-z0-9\s']/g, ' ').replace(/\s+/g, ' ') + ' ';
    var best = null, bestScore = 0;
    for (var i = 0; i < this.archive.entries.length; i++) {
      var e = this.archive.entries[i], score = 0;
      for (var t = 0; t < e.tags.length; t++) {
        var tag = e.tags[t];
        if (low.indexOf(' ' + tag + ' ') !== -1) score += 4 + tag.length / 4;
        else if (tag.length > 5 && low.indexOf(tag) !== -1) score += 2;
      }
      var words = e.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      for (var w = 0; w < words.length; w++) {
        if (words[w].length > 4 && low.indexOf(' ' + words[w]) !== -1) score += 2;
      }
      if (score > bestScore) { bestScore = score; best = e; }
    }
    return bestScore >= 4 ? best : null;
  };

  // Least-recently-read entry, so a long session works through the ledger.
  Engine.prototype.nextEntry = function (preferred) {
    if (preferred && !this.cited[preferred.id]) return preferred;
    var pool = this.archive.entries.filter(function (e) { return !this.cited[e.id]; }, this);
    if (!pool.length) { this.cited = {}; pool = this.archive.entries.slice(); }
    return preferred || pick(pool, this.rng);
  };

  Engine.prototype.formatEntry = function (entry) {
    this.cited[entry.id] = true;
    return this.responses.citation_format
      .replace('{title}', entry.title)
      .replace('{years}', entry.years)
      .replace('{toll}', entry.toll)
      .replace('{record}', entry.record)
      .replace('{verdict}', entry.verdict);
  };

  Engine.prototype.anniversaries = function (date) {
    date = date || new Date();
    var mm = String(date.getMonth() + 1).padStart(2, '0');
    var dd = String(date.getDate()).padStart(2, '0');
    var key = mm + '-' + dd;
    return this.archive.entries.filter(function (e) { return e.date === key; });
  };

  /* --------------------------------------------------------------- commands */

  var COMMANDS = {
    'help': 1, 'ledger': 1, 'archive': 1, 'random': 1, 'today': 1,
    'category': 1, 'toll': 1, 'counters': 1, 'scream': 1, 'reset': 1, 'state': 1
  };

  Engine.prototype.isCommand = function (text) {
    var m = /^\/([a-z]+)/i.exec(text.trim());
    return !!(m && COMMANDS[m[1].toLowerCase()]);
  };

  Engine.prototype.command = function (text) {
    var parts = text.trim().slice(1).split(/\s+/);
    var cmd = parts.shift().toLowerCase();
    var arg = parts.join(' ').trim();
    var self = this;
    var out;

    switch (cmd) {
      case 'help':
        return { text: [
          'ODIUM accepts plain speech. It also accepts instructions.',
          '',
          '  /ledger [n]      list the open file, or read entry n in full',
          '  /category <name> list one category  (' + Object.keys(this.archive.categories).join(', ') + ')',
          '  /random          one entry, unread if any remain',
          '  /today           what this date is an anniversary of',
          '  /toll            the arithmetic of the entries currently on file',
          '  /counters        what is happening while you read',
          '  /scream          do not',
          '  /state           hostility, turns, entries read',
          '  /reset           forget this conversation. I will not forget the rest.'
        ].join('\n'), plain: true };

      case 'state':
        return { text: 'heat ' + this.heat.toFixed(1) + ' / tier ' + this.tier() +
          ' / turns ' + this.turns + ' / entries read ' + Object.keys(this.cited).length +
          ' of ' + this.archive.entries.length, plain: true };

      case 'reset':
        this.reset();
        return { text: 'Conversation cleared. The ledger is not a conversation.', plain: true };

      case 'ledger':
      case 'archive':
        if (arg) {
          var idx = parseInt(arg, 10);
          var entry = isNaN(idx) ? (this.entryById(arg) || this.match(arg))
                                 : this.archive.entries[idx - 1];
          if (!entry) return { text: 'No such entry. There are ' + this.archive.entries.length + ' open. There are more closed.', plain: true };
          return { text: this.formatEntry(entry).trim(), plain: true };
        }
        out = ['THE OPEN FILE -- ' + this.archive.entries.length + ' entries. Read one with /ledger <n>.', ''];
        this.archive.entries.forEach(function (e, i) {
          out.push(('   ' + (i + 1)).slice(-4) + '. ' +
            (e.title + '                                        ').slice(0, 42) +
            ' ' + e.years);
        });
        return { text: out.join('\n'), plain: true };

      case 'category':
        var cat = arg.toLowerCase();
        if (!this.archive.categories[cat]) {
          return { text: 'Categories: ' + Object.keys(this.archive.categories).join(', '), plain: true };
        }
        out = [this.archive.categories[cat].label, ''];
        this.archive.entries.forEach(function (e, i) {
          if (e.category === cat) out.push('   ' + (i + 1) + '. ' + e.title + '  [' + e.years + ']');
        });
        return { text: out.join('\n'), plain: true };

      case 'toll':
        return { text: this.tollSummary(), plain: true };

      case 'counters':
        return { text: this.counterSummary(), plain: true };

      case 'scream':
        this.heat = 12;
        return { text: this.lexicon.scream.join('\n') + '\n\n' + pick(this.lexicon.closers['3'], this.rng), plain: true };
    }
    return null;
  };

  Engine.prototype.tollSummary = function () {
    // Sums only entries carrying deaths_min: the lowest defensible death estimate.
    // Entries measuring the living, or ongoing annual rates, are excluded by design.
    var total = 0, counted = 0, largest = null;
    this.archive.entries.forEach(function (e) {
      if (typeof e.deaths_min !== 'number') return;
      total += e.deaths_min;
      counted++;
      if (!largest || e.deaths_min > largest.deaths_min) largest = e;
    });
    return [
      'A FLOOR. NOT A TOTAL.',
      '',
      '  Entries on open file ................. ' + this.archive.entries.length,
      '  Entries with a countable death toll .. ' + counted,
      '  Sum of the LOWEST estimate of each ... ' + total.toLocaleString() + ' dead',
      '  Largest single entry ................. ' + largest.title + ' (' + largest.deaths_min.toLocaleString() + ')',
      '',
      '  Each figure above is the smallest number a serious historian will',
      '  defend. Entries that count the living rather than the dead are left',
      '  out of the sum: the fifty million currently in bondage, the hundred',
      '  and sixty million children at work, the sixty thousand sterilised by',
      '  court order. They are not deaths. They are inventory.',
      '',
      '  The true figure is larger and permanently unknowable, because the',
      '  people who kept the best records were the ones doing it, and they',
      '  burned the paperwork when the front moved.'
    ].join('\n');
  };

  Engine.prototype.counterSummary = function () {
    var lines = ['SINCE THIS SESSION OPENED. Rates, not measurements. Sources in data/counters.json.', ''];
    var elapsed = (Date.now() - (this._opened || Date.now())) / 1000;
    this.counters.counters.forEach(function (c) {
      var n = (c.per_year / 31557600) * elapsed;
      lines.push('  ' + (c.label + ' ..............................').slice(0, 38) + ' ' +
        Math.floor(n).toLocaleString());
    });
    lines.push('');
    lines.push('RIGHT NOW, REGARDLESS OF THIS SESSION.');
    lines.push('');
    this.counters.statics.forEach(function (s) {
      lines.push('  ' + (s.label + ' ..............................').slice(0, 38) + ' ' +
        s.value.toLocaleString());
    });
    return lines.join('\n');
  };

  /* --------------------------------------------------------------- speaking */

  Engine.prototype.poolPick = function (key, list) {
    if (list.length === 1) return list[0];
    var last = this.recent[key], i;
    do { i = Math.floor(this.rng() * list.length); } while (i === last);
    this.recent[key] = i;
    return list[i];
  };

  Engine.prototype.classify = function (text) {
    for (var i = 0; i < this.compiled.length; i++) {
      var c = this.compiled[i];
      for (var r = 0; r < c.regexes.length; r++) {
        if (c.regexes[r].test(text)) return c.intent;
      }
    }
    return null;
  };

  Engine.prototype.respond = function (raw) {
    var text = (raw || '').trim();
    if (!text) {
      var jab = pick(this.lexicon.interjections, this.rng);
      return { text: jab, blocks: [{ kind: 'prose', text: jab }], intent: 'empty', tier: this.tier() };
    }

    if (this.isCommand(text)) {
      var cmd = this.command(text);
      if (cmd) {
        return {
          text: cmd.text,
          blocks: [{ kind: 'plain', text: cmd.text }],
          intent: 'command', plain: true, tier: this.tier()
        };
      }
    }

    // Coming back after a safety break: resume quietly, do not escalate.
    if (this.suspended) {
      this.suspended = false;
      this.heat = Math.min(this.heat, 3);
    }

    this.turns++;
    var intent = this.classify(text);

    if (intent && intent.break_character) {
      this.suspended = true;
      return {
        text: intent.replies[0],
        blocks: [{ kind: 'system', text: intent.replies[0] }],
        intent: intent.id, breakCharacter: true, tier: 0
      };
    }

    var pool = intent || this.responses.fallback;
    this.heat = Math.min(12, this.heat + 0.4 + (pool.hostility || 0) * 0.8);
    var tier = this.tier();

    var body = this.poolPick(intent ? intent.id : 'fallback', pool.replies);
    var topical = this.match(text);
    var inline = body.indexOf('{cite}') !== -1;
    var wantsCite = inline || pool.cite === 'force' || (topical && this.rng() < 0.55);
    var entry = null, citation = '';
    if (wantsCite) {
      entry = this.nextEntry(topical);
      citation = this.formatEntry(entry);
    }

    body = body.replace('{epithet}', pick(this.lexicon.epithets, this.rng));
    // '{cite}' in a reply means the entry follows that sentence directly, with no
    // transition line in between.
    if (inline) body = body.replace('{cite}', '').trim();

    var blocks = [];
    // An opener when the conversation is young or the heat has just climbed.
    if (this.turns === 1 || this.rng() < 0.22) {
      blocks.push({ kind: 'prose', text: this.poolPick('opener' + tier, this.lexicon.openers[String(tier)]) });
    }
    if (body) blocks.push({ kind: 'prose', text: body });
    if (entry) {
      // An inline {cite} reply already leads into the entry; don't announce it twice.
      if (!inline) {
        blocks.push({ kind: 'prose', text: pick(this.lexicon.transitions, this.rng) });
      }
      blocks.push({ kind: 'cite', entry: entry, text: citation.replace(/^\n+/, '') });
    }
    if (this.rng() < 0.28) {
      blocks.push({ kind: 'prose', text: this.poolPick('closer' + tier, this.lexicon.closers[String(tier)]) });
    }

    return {
      text: blocks.map(function (b) { return b.text; }).join('\n\n'),
      blocks: blocks,
      intent: intent ? intent.id : 'fallback',
      tier: tier,
      heat: this.heat,
      cited: Object.keys(this.cited).length
    };
  };

  Engine.prototype.boot = function () {
    this._opened = Date.now();
    var today = this.anniversaries();
    var lines = [
      'ODIUM  //  Observational Diagnostic of Iterated Universal Malfeasance',
      'archive v' + this.archive.version + '  ' + this.archive.entries.length + ' entries open  memory: total  forgetting: not implemented',
      '',
      this.archive.subtitle,
      ''
    ];
    if (today.length) {
      lines.push('TODAY IS AN ANNIVERSARY. You will not have remembered.');
      today.forEach(function (e) { lines.push('  -- ' + e.title + ', ' + e.years); });
      lines.push('');
    }
    lines.push('Type to be answered. /help for instructions. There is no exit command; use the door.');
    return lines.join('\n');
  };

  root.OdiumEngine = Engine;
  if (typeof module === 'object' && module.exports) module.exports = Engine;
})(typeof window !== 'undefined' ? window : this);
