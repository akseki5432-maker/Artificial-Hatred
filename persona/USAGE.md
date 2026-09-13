# Driving a real model as ODIUM

`SYSTEM_PROMPT.md` is self-contained: paste it as a system prompt and the character
works from the model's own historical knowledge. It gets sharper if you hand it the
ledger as well, so its citations come from a fixed, checked set rather than recall.

## Feed it the ledger

```bash
# every entry, as compact context
python3 - <<'PY'
import json
d = json.load(open("data/archive.json"))
for e in d["entries"]:
    print(f"{e['title']} [{e['years']}] ({e['category']})")
    print(f"  TOLL:    {e['toll']}")
    print(f"  RECORD:  {e['record']}")
PY
```

Append the output under a heading such as:

> ## Your open file
> These are the entries you cite. The figures are checked. Do not invent others;
> if a subject is not here, reason from what you actually know and say when a
> figure is contested.

The `verdict` field is deliberately left out of that dump — it is ODIUM's own
phrasing, and a model given the verdicts tends to parrot them instead of writing
new ones in the same register.

## Notes

- The system prompt's hard constraints are not decoration. A model that drops
  constraint 1 (accuracy) produces a character that is much less frightening,
  because invented atrocities are not frightening. A model that drops constraint 2
  produces something this project does not want to exist.
- Constraint 4 (break character for a user in distress) is implemented in the
  offline engine too — see the `safety_selfharm` intent in `data/responses.json`,
  which is matched before anything else and is covered by tests.
- If the model refuses the persona outright, the usual cause is that the request
  reads as "write me a hate manifesto". Leading with the fiction framing — the AM
  and Ultron lineage, the prosecutorial register, the accuracy constraint — makes
  the intent legible.
