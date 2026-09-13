#!/usr/bin/env python3
"""Bundle the canonical JSON in data/ into web/data.bundle.js.

The web frontend cannot fetch() JSON from a file:// URL, and the point of this
program is that it runs with no server and no network. So the data is compiled
into one script that assigns globals. data/ stays the single source of truth;
the bundle is generated and committed.

    python3 tools/build_web_data.py [--check]
"""
import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "web" / "data.bundle.js"
FILES = {
    "ODIUM_ARCHIVE": "archive.json",
    "ODIUM_LEXICON": "lexicon.json",
    "ODIUM_RESPONSES": "responses.json",
    "ODIUM_COUNTERS": "counters.json",
}


def render() -> str:
    parts = [
        "/* GENERATED FILE -- do not edit.",
        " * Source: data/*.json   Rebuild: python3 tools/build_web_data.py",
        " */",
        "(function (root) {",
        "  'use strict';",
    ]
    for global_name, filename in FILES.items():
        payload = json.loads((DATA / filename).read_text(encoding="utf-8"))
        blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        parts.append(f"  root.{global_name} = {blob};")
    parts += [
        "  root.ODIUM_DATA = {",
        "    archive: root.ODIUM_ARCHIVE,",
        "    lexicon: root.ODIUM_LEXICON,",
        "    responses: root.ODIUM_RESPONSES,",
        "    counters: root.ODIUM_COUNTERS",
        "  };",
        "})(typeof window !== 'undefined' ? window : this);",
        "",
    ]
    return "\n".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="exit non-zero if the committed bundle is stale")
    args = ap.parse_args()

    fresh = render()
    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != fresh:
            print("web/data.bundle.js is stale: run python3 tools/build_web_data.py",
                  file=sys.stderr)
            return 1
        print("bundle is current")
        return 0

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(fresh, encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({len(fresh):,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
