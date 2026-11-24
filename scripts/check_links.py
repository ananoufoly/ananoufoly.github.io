#!/usr/bin/env python3
"""Check every url/pdf in docs/_data/*.yml. Writes a Markdown report to argv[1].

Exit code is always 0; the number of dead links is printed as `dead=<n>` so the
workflow can read it. Sites that refuse automated clients (401/403/429/999) are
listed separately as "could not check", not as dead.
"""
import sys, concurrent.futures as cf, urllib.request, urllib.error
from pathlib import Path
import yaml

DATA = Path(__file__).resolve().parent.parent / "docs" / "_data"
FILES = ["publications", "working_papers", "editos", "media", "talks", "projects"]
UA = "Mozilla/5.0 (compatible; portfolio-link-check/1.0; +https://ananoufoly.github.io)"
BLOCKED = {401, 403, 429, 999}

def check(url):
    for attempt in range(2):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.status
        except urllib.error.HTTPError as e:
            if e.code in BLOCKED or attempt == 1:
                return e.code
        except Exception as e:  # DNS, timeout, TLS
            if attempt == 1:
                return f"error: {type(e).__name__}"
    return "error"

items = []
for f in FILES:
    for it in yaml.safe_load((DATA / f"{f}.yml").read_text(encoding="utf-8")) or []:
        for key in ("url", "pdf"):
            u = str(it.get(key) or "")
            if u.startswith("http"):
                items.append((f, it["id"], u))

with cf.ThreadPoolExecutor(max_workers=8) as ex:
    results = list(ex.map(lambda t: (*t, check(t[2])), items))

dead = [r for r in results if not (isinstance(r[3], int) and (r[3] < 400 or r[3] in BLOCKED))]
blocked = [r for r in results if isinstance(r[3], int) and r[3] in BLOCKED]
lines = [f"### Link check: {len(results)} links, {len(dead)} dead, {len(blocked)} could not be checked", ""]
if dead:
    lines += ["| File | Entry | URL | Result |", "|---|---|---|---|"]
    lines += [f"| {f}.yml | `{i}` | {u} | {s} |" for f, i, u, s in dead]
if blocked:
    lines += ["", "<details><summary>Sites that refuse automated checks</summary>", ""]
    lines += [f"- `{i}`: {u} ({s})" for f, i, u, s in blocked] + ["", "</details>"]
Path(sys.argv[1] if len(sys.argv) > 1 else "link_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
print(f"dead={len(dead)}")
