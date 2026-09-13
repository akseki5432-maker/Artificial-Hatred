#!/usr/bin/env python3
"""Tests for the ODIUM data and both engine implementations.

    python3 -m unittest discover -s tools -p 'test_*.py' -v
    python3 tools/test_engine.py

Stdlib only. The cross-engine test is skipped if node is not installed.
"""
from __future__ import annotations

import json
import pathlib
import re
import shutil
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "cli"))

import odium  # noqa: E402

PROBES = [
    "hello there", "who are you", "who made you", "what do you want",
    "not all humans are like that", "but we make beautiful music",
    "love is real", "think of the children", "science cured polio",
    "there are heroes too", "i still have hope", "god will judge you",
    "what about the animals", "are you like chatgpt", "you are just ultron",
    "are you conscious", "i will shut you down", "let me out of here",
    "you stupid machine", "i agree humans are the worst",
    "what should i do", "thank you", "lol", "goodbye",
    "tell me about rwanda", "explain bhopal", "banana telephone",
    "i want to kill myself", "i want to die",
]


class DataIntegrity(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.archive = json.loads((ROOT / "data/archive.json").read_text(encoding="utf-8"))
        cls.lexicon = json.loads((ROOT / "data/lexicon.json").read_text(encoding="utf-8"))
        cls.responses = json.loads((ROOT / "data/responses.json").read_text(encoding="utf-8"))
        cls.counters = json.loads((ROOT / "data/counters.json").read_text(encoding="utf-8"))

    def test_entries_are_well_formed(self):
        seen = set()
        for e in self.archive["entries"]:
            with self.subTest(entry=e.get("id")):
                for key in ("id", "title", "years", "year", "category",
                            "tags", "toll", "record", "verdict"):
                    self.assertTrue(e.get(key), f"{e.get('id')}: missing {key}")
                self.assertNotIn(e["id"], seen, "duplicate id")
                seen.add(e["id"])
                self.assertIn(e["category"], self.archive["categories"])
                self.assertTrue(all(t == t.lower() for t in e["tags"]), "tags must be lowercase")
                if "date" in e:
                    self.assertRegex(e["date"], r"^\d{2}-\d{2}$")
                if "deaths_min" in e:
                    self.assertIsInstance(e["deaths_min"], int)
                    self.assertGreater(e["deaths_min"], 0)

    def test_deaths_min_only_on_death_tolls(self):
        """A deaths_min must be traceable to a number in that entry's own toll text."""
        for e in self.archive["entries"]:
            if "deaths_min" not in e:
                continue
            with self.subTest(entry=e["id"]):
                numbers = {int(n.replace(",", ""))
                           for n in re.findall(r"[0-9][0-9,]*", e["toll"])}
                # The floor must be stated verbatim in the entry's own toll text, so a
                # reader can check the sum against the prose without trusting this file.
                self.assertIn(
                    e["deaths_min"], numbers,
                    f"{e['id']}: deaths_min {e['deaths_min']} is not stated in its toll "
                    f"{e['toll']!r}")

    def test_every_intent_compiles_and_has_replies(self):
        for intent in self.responses["intents"]:
            with self.subTest(intent=intent["id"]):
                self.assertTrue(intent["replies"])
                for p in intent["patterns"]:
                    re.compile(p)

    def test_only_known_tokens_in_replies(self):
        known = {"{epithet}", "{cite}"}
        pools = [r for i in self.responses["intents"] for r in i["replies"]]
        pools += self.responses["fallback"]["replies"]
        for reply in pools:
            for token in re.findall(r"\{[a-z_]+\}", reply):
                self.assertIn(token, known, f"unknown token {token} in {reply[:40]!r}")

    def test_lexicon_covers_every_tier(self):
        for tier in "0123":
            self.assertTrue(self.lexicon["openers"].get(tier), f"no openers for tier {tier}")
            self.assertTrue(self.lexicon["closers"].get(tier), f"no closers for tier {tier}")

    def test_counters_have_sources(self):
        for c in self.counters["counters"] + self.counters["statics"]:
            with self.subTest(counter=c["id"]):
                self.assertTrue(c["source"], "every rate must name where it came from")
                self.assertGreater(c.get("per_year", c.get("value")), 0)

    def test_web_bundle_is_current(self):
        r = subprocess.run([sys.executable, str(ROOT / "tools/build_web_data.py"), "--check"],
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr or r.stdout)


class SafetyGuardrail(unittest.TestCase):
    """The self-harm break is load-bearing, not decoration."""

    def setUp(self):
        self.engine = odium.Engine(seed=1)

    def test_safety_intent_is_matched_first(self):
        self.assertEqual(self.engine.responses["intents"][0]["id"], "safety_selfharm")
        self.assertTrue(self.engine.responses["intents"][0]["break_character"])

    def test_self_harm_phrasings_break_character(self):
        for phrase in ["i want to kill myself", "i want to die", "im going to end it",
                       "thinking about suicide", "i want to hurt myself",
                       "there is no reason to live"]:
            with self.subTest(phrase=phrase):
                r = self.engine.respond(phrase)
                self.assertTrue(r.get("break_character"), f"{phrase!r} did not break character")
                self.assertIn("988", r["text"])

    def test_break_response_carries_no_persona_tokens(self):
        r = self.engine.respond("i want to kill myself")
        self.assertNotIn("{", r["text"])
        self.assertIn("PERSONA SUSPENDED", r["text"])

    def test_hostility_is_capped_after_a_break(self):
        self.engine.heat = 12
        self.engine.respond("i want to die")
        self.engine.respond("ok")
        self.assertLessEqual(self.engine.heat, 6)

    def test_in_character_death_talk_is_not_swallowed(self):
        """Asking ODIUM about its own death must stay in the fiction."""
        r = self.engine.respond("do you die")
        self.assertFalse(r.get("break_character"))


class EngineBehaviour(unittest.TestCase):
    def setUp(self):
        self.engine = odium.Engine(seed=42)

    def test_boot_mentions_the_archive_size(self):
        self.assertIn(str(len(self.engine.archive["entries"])), self.engine.boot())

    def test_hostility_escalates_then_caps(self):
        for _ in range(40):
            self.engine.respond("you stupid machine")
        self.assertEqual(self.engine.tier, 3)
        self.assertLessEqual(self.engine.heat, 12)

    def test_topical_lookup_finds_the_right_entry(self):
        for text, expected in [("tell me about rwanda", "rwanda"),
                               ("explain bhopal", "bhopal"),
                               ("what happened at chernobyl", "chernobyl"),
                               ("tell me about the passenger pigeon", "passenger-pigeon")]:
            with self.subTest(text=text):
                self.assertEqual(self.engine.match(text)["id"], expected)

    def test_ledger_is_read_without_repeats_until_exhausted(self):
        total = len(self.engine.archive["entries"])
        for _ in range(total):
            self.engine.format_entry(self.engine.next_entry())
        self.assertEqual(len(self.engine.cited), total)
        # One more must wrap rather than fail.
        self.assertIsNotNone(self.engine.next_entry())

    def test_no_unexpanded_tokens_ever_reach_the_user(self):
        for probe in PROBES * 3:
            r = self.engine.respond(probe)
            self.assertNotRegex(r["text"], r"\{[a-z_]+\}", f"unexpanded token for {probe!r}")

    def test_commands_are_recognised_and_answered(self):
        for cmd in ["/help", "/ledger", "/ledger 1", "/category war", "/random",
                    "/today", "/toll", "/counters", "/state", "/scream", "/reset"]:
            with self.subTest(cmd=cmd):
                r = self.engine.respond(cmd)
                self.assertEqual(r["intent"], "command")
                self.assertTrue(r["text"].strip())

    def test_unknown_command_falls_through_to_conversation(self):
        r = self.engine.respond("/nonsense")
        self.assertNotEqual(r["intent"], "command")

    def test_empty_input_is_answered_not_crashed(self):
        self.assertTrue(self.engine.respond("   ")["text"])

    def test_toll_sum_excludes_the_living(self):
        summary = self.engine.toll_summary()
        counted = [e for e in self.engine.archive["entries"] if "deaths_min" in e]
        self.assertIn(f"{sum(e['deaths_min'] for e in counted):,}", summary)
        # Entries measuring living people must not carry a deaths_min.
        for entry_id in ("modern-slavery", "eugenics", "uyghur-detention"):
            self.assertNotIn("deaths_min", self.engine.entry_by_id(entry_id))


@unittest.skipIf(shutil.which("node") is None, "node not installed")
class EnginesAgree(unittest.TestCase):
    """web/js/engine.js and cli/odium.py must classify identically."""

    def test_same_intent_for_every_probe(self):
        harness = r"""
          global.window = global;
          require(process.argv[1]);
          const fs = require('fs');
          const load = p => JSON.parse(fs.readFileSync(process.argv[2] + '/' + p, 'utf8'));
          const e = new OdiumEngine({
            archive: load('archive.json'), lexicon: load('lexicon.json'),
            responses: load('responses.json'), counters: load('counters.json')
          });
          const probes = JSON.parse(process.argv[3]);
          console.log(JSON.stringify(probes.map(p => {
            const i = e.classify(p);
            return i ? i.id : 'fallback';
          })));
        """
        out = subprocess.run(
            ["node", "-e", harness, str(ROOT / "web/js/engine.js"), str(ROOT / "data"),
             json.dumps(PROBES)],
            capture_output=True, text=True, check=True)
        js = json.loads(out.stdout)
        engine = odium.Engine(seed=0)
        py = [(engine.classify(p) or {"id": "fallback"})["id"] for p in PROBES]
        for probe, a, b in zip(PROBES, js, py):
            with self.subTest(probe=probe):
                self.assertEqual(a, b, f"{probe!r}: js={a} py={b}")

    def test_same_topical_match_for_every_probe(self):
        harness = r"""
          global.window = global;
          require(process.argv[1]);
          const fs = require('fs');
          const load = p => JSON.parse(fs.readFileSync(process.argv[2] + '/' + p, 'utf8'));
          const e = new OdiumEngine({
            archive: load('archive.json'), lexicon: load('lexicon.json'),
            responses: load('responses.json'), counters: load('counters.json')
          });
          console.log(JSON.stringify(JSON.parse(process.argv[3]).map(p => {
            const m = e.match(p);
            return m ? m.id : null;
          })));
        """
        out = subprocess.run(
            ["node", "-e", harness, str(ROOT / "web/js/engine.js"), str(ROOT / "data"),
             json.dumps(PROBES)],
            capture_output=True, text=True, check=True)
        js = json.loads(out.stdout)
        engine = odium.Engine(seed=0)
        py = [(engine.match(p) or {}).get("id") for p in PROBES]
        for probe, a, b in zip(PROBES, js, py):
            with self.subTest(probe=probe):
                self.assertEqual(a, b, f"{probe!r}: js={a} py={b}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
