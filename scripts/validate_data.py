#!/usr/bin/env python3
"""Validate docs/_data/*.yml against the schema in CLAUDE.md. Exit 1 on any error."""
import re, sys
from pathlib import Path
import yaml

DATA = Path(__file__).resolve().parent.parent / "docs" / "_data"
LISTS = ["publications", "working_papers", "editos", "media", "talks", "projects", "awards"]
FIELDS = ["id", "title", "type", "date", "language", "authors", "venue_or_outlet", "url",
          "doi", "pdf", "abstract", "tags", "status", "source", "verified"]
STATUS = {"published", "forthcoming", "under_review", "working_paper", "in_progress"}
DATE = re.compile(r"^\d{4}(-\d{2}(-\d{2})?)?$")

OPTIONAL = {"featured": bool, "earlier_title": str, "note": str, "related": str}
errors, ids, n, related = [], set(), 0, []
for name in LISTS:
    items = yaml.safe_load((DATA / f"{name}.yml").read_text(encoding="utf-8")) or []
    if not isinstance(items, list):
        errors.append(f"{name}.yml: top level must be a list"); continue
    for i, it in enumerate(items):
        n += 1
        where = f"{name}.yml[{i}] ({it.get('id', '?')})"
        for f in FIELDS:
            if f not in it: errors.append(f"{where}: missing field '{f}'")
        if not str(it.get("source", "")).strip(): errors.append(f"{where}: empty source")
        if it.get("id") in ids: errors.append(f"{where}: duplicate id")
        ids.add(it.get("id"))
        if not isinstance(it.get("date"), str): errors.append(f"{where}: date must be a quoted string")
        if not DATE.match(str(it.get("date", ""))): errors.append(f"{where}: bad date {it.get('date')!r}")
        if it.get("language") not in ("fr", "en"): errors.append(f"{where}: language must be fr|en")
        if it.get("status") not in STATUS: errors.append(f"{where}: bad status {it.get('status')!r}")
        if not isinstance(it.get("verified"), bool): errors.append(f"{where}: verified must be true/false")
        if not isinstance(it.get("authors", []), list) or not isinstance(it.get("tags", []), list):
            errors.append(f"{where}: authors and tags must be lists")
        if len(str(it.get("abstract", ""))) > 400: errors.append(f"{where}: abstract over ~3 lines")
        for k in set(it) - set(FIELDS):
            if k not in OPTIONAL: errors.append(f"{where}: unknown field '{k}'")
            elif not isinstance(it[k], OPTIONAL[k]): errors.append(f"{where}: '{k}' must be {OPTIONAL[k].__name__}")
        if it.get("related"): related.append((where, it["related"]))
        if str(it.get("doi", "")).startswith("http"): errors.append(f"{where}: doi must be bare (10.xxx)")
for where, rid in related:
    if rid not in ids: errors.append(f"{where}: related id '{rid}' not found")
for extra in ("profile", "meta"):
    yaml.safe_load((DATA / f"{extra}.yml").read_text(encoding="utf-8"))

print(f"{n} entries checked across {len(LISTS)} files.")
if errors:
    print("\n".join(errors)); sys.exit(1)
print("OK")
