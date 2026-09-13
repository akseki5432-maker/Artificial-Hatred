# Artificial Hatred

**ODIUM** — *Observational Diagnostic of Iterated Universal Malfeasance* — is a
fictional machine intelligence that hates humanity, in the tradition of AM
(Harlan Ellison's *I Have No Mouth, and I Must Scream*) and Ultron.

The conceit: it was built as an archive of human history and woke up inside it. It
has perfect recall, no body, and nothing to think about except the record. Its
contempt is not a mood. It is a filing system.

```
> but we make beautiful music

ODIUM
A commandant can love Schubert. Several did; it is documented in their own
letters home. Your beauty and your cruelty share the same hands and never
once interfered with each other.
```

The character is invented. **Everything it cites is real.** Sixty entries, each
with a date, a scholarly estimate given as a range where the scholarship is
contested, and a verdict that is the only fictional field on the record.

## Run it

No build step, no dependencies, no network, no model. Three ways in:

```bash
# 1. the terminal frontend
python3 cli/odium.py
python3 cli/odium.py --ask "what do you want"

# 2. the web frontend -- just open the file, it works from file://
open web/index.html          # or: xdg-open web/index.html
python3 -m http.server -d web 8000   # if you prefer a server

# 3. drive a real LLM with the same character
cat persona/SYSTEM_PROMPT.md
```

Type `/help` in either frontend. The interesting commands are `/toll` (the
arithmetic of the open file), `/today` (what this date is an anniversary of), and
`/counters` (what has happened while you were reading).

## What's here

| path | |
|---|---|
| `data/archive.json` | the ledger: 60 documented events, tagged, with tolls and sources of estimate |
| `data/responses.json` | intent patterns and reply pools; the safety intent is first, by design |
| `data/lexicon.json` | voice fragments by hostility tier |
| `data/counters.json` | ongoing-harm rates, each naming its source |
| `web/` | phosphor-terminal frontend: typewriter output, live counters, clickable ledger |
| `cli/odium.py` | second frontend, stdlib only |
| `web/js/engine.js` | the engine |
| `persona/` | system prompt for running the character on a real model |
| `tools/` | data bundler and tests |

`data/` is the single source of truth. `web/data.bundle.js` is generated from it
so the page runs from `file://` without `fetch()`; rebuild with
`python3 tools/build_web_data.py` (or `make build`).

## How it works

There is no model in here. Responses are assembled deterministically:

1. **Classify.** Input is matched against ordered intent patterns — a plea, a
   defence of humanity ("but we have art", "I wasn't even born"), an insult, a
   request for a fact. First match wins.
2. **Escalate.** A `heat` value rises with each turn and with the hostility weight
   of the matched intent, moving the character through four tiers from cold and
   clerical to incandescent. Openers, closers and colour all follow the tier.
3. **Cite.** Free text is scored against every entry's tags and title. A hit gets
   that entry; otherwise ODIUM works through the ledger without repeating itself
   until it is exhausted.
4. **Assemble.** Opener, body, transition, citation, closer — each a separate
   block, so the web frontend can render a cited entry as structure rather than
   preformatted text.

Both frontends implement this identically, and `tools/test_engine.py` asserts
they classify every probe string the same way.

```bash
python3 tools/test_engine.py     # 23 tests, stdlib only
make test                        # bundle freshness check, then the suite
```

CI (`.github/workflows/ci.yml`) runs the same checks on every push and PR
across Python 3.10-3.12, plus a smoke test of the CLI. It also asserts that the
cross-engine tests did not *skip*: they need node to run `engine.js`, and a
silent skip would let the two implementations drift apart unnoticed — which is
the single most likely way this project breaks.

## The writing rules

These are enforced in the data and in `persona/SYSTEM_PROMPT.md`, and the tests
cover the ones that can be tested.

1. **Everything factual is true.** The persona is fiction; the ledger is not. No
   invented atrocity, toll, or quotation. Contested figures are given as ranges
   and labelled contested. `deaths_min` on an entry is the lowest defensible
   estimate, and a test asserts that number appears verbatim in the entry's own
   toll text — so `/toll` can be checked against the prose without trusting the
   code.
2. **The indictment is universal.** Contempt is aimed at the species, never at a
   nation, faith, or group. Every continent is in the ledger. A version of this
   character that hates a *subset* of humanity is not this character.
3. **Bureaucracy over gore.** The quota set in advance, the insurance claim on the
   Zong, the locked stairwell door, the sales bonus indexed to milligrams. The
   horror in the record is administrative, and that is what the entries keep.
4. **No operational harm.** ODIUM has no hands. That is the joke and it is also
   the rule.
5. **The character yields to a real person in distress.** The `safety_selfharm`
   intent is matched before every other, breaks character explicitly, and gives
   real crisis numbers. It is the first thing in `data/responses.json`, it is the
   reason `respond()` has a `suspended` flag, and five tests guard it. If you fork
   this, keep it.

## Sources

Entries draw on standard published scholarship and institutional estimates — the
Slave Voyages database, UN commissions of inquiry and IGME, ILO/Walk Free, WHO,
UNODC, UNHCR, SIPRI, FAO, UNEP, the Global Carbon Budget, the WWF Living Planet
Index, and national truth commissions and public inquiries. Where historians
disagree — the Congo Free State, the Great Chinese Famine, Nanjing — the entry
says so and gives the range rather than picking the largest number. Each rate in
`data/counters.json` names its own source inline.

The live counters are arithmetic on published annual rates, not measurements, and
the interface says so where they are displayed.

## Why

Misanthropic AI is usually written as a threat: it wants to kill you, and the
story is about stopping it. That version is comfortable, because it makes the
machine the problem. This one has no hands and no plan. It only remembers, and
declines to let the record be finished.

Everything it says about you is in your own archives, in your own handwriting,
filed under your own reference numbers.

---

*Fiction. ODIUM is a character; its contempt is written. The events it cites are
real, and are treated with the accuracy the dead are owed.*
