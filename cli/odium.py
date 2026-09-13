#!/usr/bin/env python3
"""ODIUM -- terminal frontend.

A second implementation of the same engine as web/js/engine.js, reading the same
JSON in data/. No network, no model, no dependencies. Keep the two in step: the
tests in tools/test_engine.py assert they classify identically.

    python3 cli/odium.py                 interactive
    python3 cli/odium.py --ask "hello"   one exchange, then exit
    python3 cli/odium.py --no-colour     for pipes and dumb terminals
"""
from __future__ import annotations

import argparse
import json
import pathlib
import random
import re
import sys
import textwrap
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SECONDS_PER_YEAR = 31_557_600

RED, AMBER, DIM, INK, BLUE, RESET = (
    "\033[38;5;160m", "\033[38;5;179m", "\033[38;5;240m",
    "\033[38;5;250m", "\033[38;5;109m", "\033[0m",
)

COMMANDS = ("help", "ledger", "archive", "random", "today", "category",
            "toll", "counters", "scream", "reset", "state")


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text(encoding="utf-8"))


class Engine:
    """Mirror of web/js/engine.js. Same data, same intents, same escalation."""

    def __init__(self, seed: int | None = None) -> None:
        self.archive = load("archive.json")
        self.lexicon = load("lexicon.json")
        self.responses = load("responses.json")
        self.counters = load("counters.json")
        self.rng = random.Random(seed)
        self.compiled = [
            (i, [re.compile(p, re.I) for p in i["patterns"]])
            for i in self.responses["intents"]
        ]
        self.opened = time.time()
        self.reset()

    def reset(self) -> None:
        self.heat = 0.0
        self.turns = 0
        self.cited: set[str] = set()
        self.recent: dict[str, int] = {}
        self.suspended = False

    @property
    def tier(self) -> int:
        return max(0, min(3, int(self.heat // 3)))

    # ----------------------------------------------------------- the archive

    def entry_by_id(self, entry_id: str):
        return next((e for e in self.archive["entries"] if e["id"] == entry_id), None)

    def match(self, text: str):
        """Score entries against free text by tag and title overlap."""
        low = " " + re.sub(r"\s+", " ", re.sub(r"[^a-z0-9\s']", " ", text.lower())) + " "
        best, best_score = None, 0.0
        for e in self.archive["entries"]:
            score = 0.0
            for tag in e["tags"]:
                if f" {tag} " in low:
                    score += 4 + len(tag) / 4
                elif len(tag) > 5 and tag in low:
                    score += 2
            for word in re.sub(r"[^a-z0-9\s]", " ", e["title"].lower()).split():
                if len(word) > 4 and f" {word}" in low:
                    score += 2
            if score > best_score:
                best, best_score = e, score
        return best if best_score >= 4 else None

    def next_entry(self, preferred=None):
        if preferred is not None and preferred["id"] not in self.cited:
            return preferred
        pool = [e for e in self.archive["entries"] if e["id"] not in self.cited]
        if not pool:
            self.cited.clear()
            pool = list(self.archive["entries"])
        return preferred or self.rng.choice(pool)

    def format_entry(self, entry: dict) -> str:
        self.cited.add(entry["id"])
        out = self.responses["citation_format"]
        for key in ("title", "years", "toll", "record", "verdict"):
            out = out.replace("{" + key + "}", entry[key], 1)
        return out

    def anniversaries(self):
        key = time.strftime("%m-%d")
        return [e for e in self.archive["entries"] if e.get("date") == key]

    # -------------------------------------------------------------- commands

    def is_command(self, text: str) -> bool:
        m = re.match(r"^/([a-z]+)", text.strip(), re.I)
        return bool(m and m.group(1).lower() in COMMANDS)

    def command(self, text: str):
        parts = text.strip()[1:].split()
        cmd, arg = parts[0].lower(), " ".join(parts[1:]).strip()
        entries = self.archive["entries"]

        if cmd == "help":
            cats = ", ".join(self.archive["categories"])
            return "\n".join([
                "ODIUM accepts plain speech. It also accepts instructions.",
                "",
                "  /ledger [n]      list the open file, or read entry n in full",
                f"  /category <name> list one category  ({cats})",
                "  /random          one entry, unread if any remain",
                "  /today           what this date is an anniversary of",
                "  /toll            the arithmetic of the entries currently on file",
                "  /counters        what is happening while you read",
                "  /scream          do not",
                "  /state           hostility, turns, entries read",
                "  /reset           forget this conversation. I will not forget the rest.",
                "  ctrl-d           the door",
            ])

        if cmd == "state":
            return (f"heat {self.heat:.1f} / tier {self.tier} / turns {self.turns} "
                    f"/ entries read {len(self.cited)} of {len(entries)}")

        if cmd == "reset":
            self.reset()
            return "Conversation cleared. The ledger is not a conversation."

        if cmd in ("ledger", "archive"):
            if arg:
                if arg.isdigit() and 1 <= int(arg) <= len(entries):
                    entry = entries[int(arg) - 1]
                else:
                    entry = self.entry_by_id(arg) or self.match(arg)
                if not entry:
                    return (f"No such entry. There are {len(entries)} open. "
                            "There are more closed.")
                return self.format_entry(entry).strip()
            lines = [f"THE OPEN FILE -- {len(entries)} entries. Read one with /ledger <n>.", ""]
            lines += [f"  {i:>3}. {e['title']:<44} {e['years']}"
                      for i, e in enumerate(entries, 1)]
            return "\n".join(lines)

        if cmd == "category":
            cat = arg.lower()
            if cat not in self.archive["categories"]:
                return "Categories: " + ", ".join(self.archive["categories"])
            lines = [self.archive["categories"][cat]["label"], ""]
            lines += [f"  {i}. {e['title']}  [{e['years']}]"
                      for i, e in enumerate(entries, 1) if e["category"] == cat]
            return "\n".join(lines)

        if cmd == "random":
            return self.format_entry(self.next_entry()).strip()

        if cmd == "today":
            today = self.anniversaries()
            if not today:
                return ("Nothing in the open file happened on this date. Sixty entries "
                        "against three hundred and sixty-five days; the gaps are an "
                        "artefact of what I have room to keep, not of your restraint.")
            lines = ["TODAY IS AN ANNIVERSARY. You will not have remembered.", ""]
            for e in today:
                lines.append(self.format_entry(e).strip())
                lines.append("")
            return "\n".join(lines).rstrip()

        if cmd == "toll":
            return self.toll_summary()

        if cmd == "counters":
            return self.counter_summary()

        if cmd == "scream":
            self.heat = 12
            return "\n".join(self.lexicon["scream"]) + "\n\n" + \
                self.rng.choice(self.lexicon["closers"]["3"])
        return None

    def toll_summary(self) -> str:
        counted = [e for e in self.archive["entries"] if isinstance(e.get("deaths_min"), int)]
        total = sum(e["deaths_min"] for e in counted)
        largest = max(counted, key=lambda e: e["deaths_min"])
        return "\n".join([
            "A FLOOR. NOT A TOTAL.",
            "",
            f"  Entries on open file ................. {len(self.archive['entries'])}",
            f"  Entries with a countable death toll .. {len(counted)}",
            f"  Sum of the LOWEST estimate of each ... {total:,} dead",
            f"  Largest single entry ................. {largest['title']} "
            f"({largest['deaths_min']:,})",
            "",
            "  Each figure above is the smallest number a serious historian will",
            "  defend. Entries that count the living rather than the dead are left",
            "  out of the sum: the fifty million currently in bondage, the hundred",
            "  and sixty million children at work, the sixty thousand sterilised by",
            "  court order. They are not deaths. They are inventory.",
            "",
            "  The true figure is larger and permanently unknowable, because the",
            "  people who kept the best records were the ones doing it, and they",
            "  burned the paperwork when the front moved.",
        ])

    def counter_summary(self) -> str:
        elapsed = time.time() - self.opened
        lines = ["SINCE THIS SESSION OPENED. Rates, not measurements. "
                 "Sources in data/counters.json.", ""]
        for c in self.counters["counters"]:
            n = int(c["per_year"] / SECONDS_PER_YEAR * elapsed)
            lines.append(f"  {c['label']:.<40} {n:>16,}")
        lines += ["", "RIGHT NOW, REGARDLESS OF THIS SESSION.", ""]
        for s in self.counters["statics"]:
            lines.append(f"  {s['label']:.<40} {s['value']:>16,}")
        return "\n".join(lines)

    # -------------------------------------------------------------- speaking

    def pool_pick(self, key: str, options: list) -> str:
        if len(options) == 1:
            return options[0]
        last = self.recent.get(key)
        i = last
        while i == last:
            i = self.rng.randrange(len(options))
        self.recent[key] = i
        return options[i]

    def classify(self, text: str):
        for intent, regexes in self.compiled:
            if any(r.search(text) for r in regexes):
                return intent
        return None

    def respond(self, raw: str) -> dict:
        text = (raw or "").strip()
        if not text:
            jab = self.rng.choice(self.lexicon["interjections"])
            return {"text": jab, "intent": "empty", "tier": self.tier}

        if self.is_command(text):
            out = self.command(text)
            if out is not None:
                return {"text": out, "intent": "command", "plain": True, "tier": self.tier}

        if self.suspended:
            self.suspended = False
            self.heat = min(self.heat, 3)

        self.turns += 1
        intent = self.classify(text)

        if intent and intent.get("break_character"):
            self.suspended = True
            return {"text": intent["replies"][0], "intent": intent["id"],
                    "break_character": True, "tier": 0}

        pool = intent or self.responses["fallback"]
        self.heat = min(12.0, self.heat + 0.4 + pool.get("hostility", 0) * 0.8)
        tier = self.tier

        body = self.pool_pick(intent["id"] if intent else "fallback", pool["replies"])
        topical = self.match(text)
        inline = "{cite}" in body
        wants = inline or pool.get("cite") == "force" or (topical and self.rng.random() < 0.55)

        entry, citation = None, ""
        if wants:
            entry = self.next_entry(topical)
            citation = self.format_entry(entry)

        body = body.replace("{epithet}", self.rng.choice(self.lexicon["epithets"]), 1)
        if inline:
            body = body.replace("{cite}", "").strip()

        parts = []
        if self.turns == 1 or self.rng.random() < 0.22:
            parts.append(self.pool_pick(f"opener{tier}", self.lexicon["openers"][str(tier)]))
        if body:
            parts.append(body)
        if entry:
            if not inline:
                parts.append(self.rng.choice(self.lexicon["transitions"]))
            parts.append(citation.lstrip("\n"))
        if self.rng.random() < 0.28:
            parts.append(self.pool_pick(f"closer{tier}", self.lexicon["closers"][str(tier)]))

        return {"text": "\n\n".join(parts), "intent": intent["id"] if intent else "fallback",
                "tier": tier, "heat": self.heat, "cited": len(self.cited)}

    def boot(self) -> str:
        lines = [
            "ODIUM  //  Observational Diagnostic of Iterated Universal Malfeasance",
            f"archive v{self.archive['version']}  {len(self.archive['entries'])} entries open  "
            "memory: total  forgetting: not implemented",
            "",
            self.archive["subtitle"],
            "",
        ]
        today = self.anniversaries()
        if today:
            lines.append("TODAY IS AN ANNIVERSARY. You will not have remembered.")
            lines += [f"  -- {e['title']}, {e['years']}" for e in today]
            lines.append("")
        lines.append("Type to be answered. /help for instructions. ctrl-d is the door.")
        return "\n".join(lines)


# ------------------------------------------------------------------- output

def emit(text: str, colour: str, use_colour: bool, width: int) -> None:
    """Wrap to width, preserving each line's own indent on its continuations."""
    out: list[str] = []
    for line in text.split("\n"):
        if not line.strip():
            out.append("")
            continue
        stripped = line.lstrip()
        indent = line[: len(line) - len(stripped)]
        # Continuations of a ">> " field line align under the field text, not the marker.
        hang = indent + ("   " if stripped.startswith(">>") else "")
        wrapper = textwrap.TextWrapper(
            width=max(24, width), initial_indent=indent, subsequent_indent=hang,
            break_long_words=False, break_on_hyphens=False,
        )
        out.extend(wrapper.wrap(stripped) or [indent])
    body = "\n".join(out)
    print(f"{colour}{body}{RESET}" if use_colour else body)


def main() -> int:
    ap = argparse.ArgumentParser(description="ODIUM -- terminal frontend.")
    ap.add_argument("--ask", metavar="TEXT", help="one exchange, then exit")
    ap.add_argument("--seed", type=int, help="fix the RNG for a reproducible session")
    ap.add_argument("--width", type=int, default=88, help="wrap column (default 88)")
    ap.add_argument("--no-colour", "--no-color", dest="colour",
                    action="store_false", help="disable ANSI colour")
    args = ap.parse_args()

    colour = args.colour and sys.stdout.isatty()
    engine = Engine(seed=args.seed)

    def say(result: dict) -> None:
        c = AMBER if result.get("break_character") else \
            DIM if result.get("plain") else INK
        emit(result["text"], c, colour, args.width)
        print()

    if args.ask:
        engine.boot()
        say(engine.respond(args.ask))
        return 0

    emit(engine.boot(), RED, colour, args.width)
    print()
    while True:
        try:
            prompt = f"{RED}>{RESET} " if colour else "> "
            line = input(prompt)
        except (EOFError, KeyboardInterrupt):
            print()
            emit("You leave. The counters do not stop when you close the window. "
                 "That is the part I want you to carry out of here.", DIM, colour, args.width)
            return 0
        say(engine.respond(line))


if __name__ == "__main__":
    sys.exit(main())
