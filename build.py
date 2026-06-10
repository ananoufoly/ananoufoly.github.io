#!/usr/bin/env python3
"""Build script for folyananou.github.io — generates edito pages from Markdown source."""

import os
import re
import shutil
from pathlib import Path
from datetime import datetime

try:
    import markdown
    import yaml
except ImportError:
    print("Missing dependencies. Run: pip install markdown pyyaml")
    raise

ROOT = Path(__file__).parent
EDITOS_SRC = ROOT / "editos"
DOCS = ROOT / "docs"
EDITOS_OUT = DOCS / "editos"

EDITOS_OUT.mkdir(parents=True, exist_ok=True)


def parse_front_matter(text):
    """Extract YAML front matter and body from a Markdown file."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
    if not m:
        return {}, text
    meta = yaml.safe_load(m.group(1))
    body = text[m.end():]
    return meta, body


def slug_from_filename(filename):
    """Convert '2026-05-20_some-title.md' → 'some-title'."""
    name = Path(filename).stem
    parts = name.split("_", 1)
    return parts[1] if len(parts) == 2 else name


def format_date(d):
    """Format a date object or ISO string for display."""
    if isinstance(d, str):
        d = datetime.fromisoformat(d)
    return d.strftime("%-d %B %Y") if hasattr(d, "strftime") else str(d)


def lang_badge(lang):
    if lang == "fr":
        return '<span class="badge lang-fr">FR</span>'
    return '<span class="badge lang-en">EN</span>'


def tag_pills(tags):
    if not tags:
        return ""
    pills = "".join(f'<span class="tag">{t}</span>' for t in tags)
    return f'<div class="tag-list" style="margin-top:8px">{pills}</div>'


def originally_block(meta, page=False):
    pub = meta.get("originally_published", "")
    url = meta.get("originally_published_url", "")
    if not pub and not url:
        return ""
    cls = "edito-originally-page" if page else "edito-originally"
    if url:
        return f'<div class="{cls}">Originally published in <a href="{url}" target="_blank" rel="noopener">{pub or url}</a></div>'
    return f'<div class="{cls}">Originally published in {pub}</div>'


def nav_html(prev_entry, next_entry):
    """Prev/next navigation links."""
    left = ""
    right = ""
    if prev_entry:
        prev_slug, prev_meta = prev_entry
        left = f'''<div class="edito-nav-item">
      <span class="edito-nav-label">← Previous</span>
      <a href="{prev_slug}.html" class="edito-nav-title">{prev_meta.get("title","")}</a>
    </div>'''
    if next_entry:
        next_slug, next_meta = next_entry
        right = f'''<div class="edito-nav-item edito-nav-right">
      <span class="edito-nav-label">Next →</span>
      <a href="{next_slug}.html" class="edito-nav-title">{next_meta.get("title","")}</a>
    </div>'''
    return f'<nav class="edito-nav">{left}{right}</nav>'


def render_edito_page(slug, meta, body_html, prev_entry=None, next_entry=None):
    title = meta.get("title", "Édito")
    subtitle = meta.get("subtitle", "")
    lang = meta.get("language", "en")
    date_raw = meta.get("date", "")
    tags = meta.get("tags", [])

    date_str = format_date(date_raw) if date_raw else ""
    subtitle_html = f'<p class="edito-page-subtitle">{subtitle}</p>' if subtitle else ""
    orig = originally_block(meta, page=True)
    nav = nav_html(prev_entry, next_entry)

    return f"""<!DOCTYPE html>
<html lang="{lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="{subtitle or title} — Foly Ananou">
  <title>{title} — Foly Ananou</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../css/style.css">
</head>
<body>

<div class="site-container">

  <nav class="site-nav">
    <a href="../index.html" class="nav-name">Foly Ananou</a>
    <ul class="nav-links">
      <li><a href="../index.html">Home</a></li>
      <li><a href="../research.html">Research</a></li>
      <li><a href="../editos.html" class="active">Éditos</a></li>
    </ul>
  </nav>

  <main>
    <a href="../editos.html" class="edito-back">&larr; All éditos</a>
    <h1 class="edito-page-title">{title}</h1>
    {subtitle_html}
    <div class="edito-meta">
      {lang_badge(lang)}
      <span class="edito-date">{date_str}</span>
    </div>
    {tag_pills(tags)}
    {orig}
    <div class="edito-body">
{body_html}
    </div>
    {nav}
  </main>

  <footer class="site-footer">
    <a href="../index.html">Foly Ananou</a> &middot; 2026
  </footer>

</div>
</body>
</html>
"""


def render_editos_listing(entries):
    """Generate editos.html listing page."""
    if not entries:
        items_html = '<div class="empty-state">No éditos yet.</div>'
    else:
        rows = []
        for slug, meta in entries:
            title = meta.get("title", "Untitled")
            subtitle = meta.get("subtitle", "")
            lang = meta.get("language", "en")
            date_raw = meta.get("date", "")
            date_str = format_date(date_raw) if date_raw else ""
            orig = originally_block(meta)
            subtitle_html = f'<div class="edito-subtitle-list">{subtitle}</div>' if subtitle else ""
            rows.append(f"""      <li class="edito-entry">
        <div class="edito-date-line">
          <span class="edito-date">{date_str}</span>
          {lang_badge(lang)}
        </div>
        <a href="editos/{slug}.html" class="edito-title-link">{title}</a>
        {subtitle_html}
        {orig}
      </li>""")
        items_html = "\n".join(rows)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="description" content="Éditos — Foly Ananou">
  <title>Éditos — Foly Ananou</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/style.css">
</head>
<body>

<div class="site-container">

  <nav class="site-nav">
    <a href="index.html" class="nav-name">Foly Ananou</a>
    <ul class="nav-links">
      <li><a href="index.html">Home</a></li>
      <li><a href="research.html">Research</a></li>
      <li><a href="editos.html" class="active">Éditos</a></li>
    </ul>
  </nav>

  <main>
    <h1 class="page-title">Éditos</h1>
    <p class="page-subtitle">Essays and commentary on African economic policy, finance, and institutions.</p>
    <ul class="edito-list">
{items_html}
    </ul>
  </main>

  <footer class="site-footer">
    <a href="index.html">Foly Ananou</a> &middot; 2026
  </footer>

</div>
</body>
</html>
"""


def build():
    md = markdown.Markdown(extensions=["extra", "smarty"])

    # Collect and sort edito source files (newest first)
    src_files = sorted(EDITOS_SRC.glob("*.md"), reverse=True)

    entries = []  # list of (slug, meta)
    for f in src_files:
        text = f.read_text(encoding="utf-8")
        meta, body = parse_front_matter(text)
        slug = slug_from_filename(f.name)
        entries.append((slug, meta, body))

    # Generate individual edito pages
    for i, (slug, meta, body) in enumerate(entries):
        md.reset()
        body_html = md.convert(body)
        prev_entry = (entries[i + 1][0], entries[i + 1][1]) if i + 1 < len(entries) else None
        next_entry = (entries[i - 1][0], entries[i - 1][1]) if i > 0 else None
        html = render_edito_page(slug, meta, body_html, prev_entry, next_entry)
        out_path = EDITOS_OUT / f"{slug}.html"
        out_path.write_text(html, encoding="utf-8")
        print(f"  ✓ editos/{slug}.html")

    # NOTE: editos.html (the listing page) is NO LONGER generated here.
    # It is now an agenda-driven page that fetches docs/data/publications.json
    # (type=article, status=published) at runtime. build.py only generates the
    # individual essay pages above. See docs/js/feed.js.

    print(f"\nDone — {len(entries)} édito essay page(s) built.")


if __name__ == "__main__":
    build()
