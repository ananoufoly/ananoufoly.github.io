# ananoufoly.github.io — rules for every agent run

Personal site of Foly Ananou (financial economist; PhD Université de Limoges 2021;
Société Générale; senior member of L'Afrique des Idées since 2012). Served by GitHub
Pages from **`/docs` on `main`**, built by Jekyll (no theme). Content lives in
`docs/_data/*.yml`; pages are Liquid templates over that data. **Update data, not HTML.**

## Hard rules

1. **Never invent anything.** Every entry needs a verifiable `source` (URL, DOI, or a local
   file path the owner pointed to). Unverifiable details (co-authors, date, venue, pages)
   stay blank (`""`) and are flagged in the PR description. Never fill from memory.
2. **Namesakes.** Search the exact name `"Foly Ananou"` (in quotes), never the surname alone
   — Ananou is a common Togolese surname (Crossref alone returns Alexandrine, Bouchra,
   Simeon, Ouasim Ananou… none of them him). Confirm identity with at least one of:
   economics/finance topic, WAEMU/UEMOA, L'Afrique des Idées, Université de Limoges,
   Société Générale, known co-authors (Tarazi, Wilson, Chronopoulos, Gloglo).
   Every candidate gets a confidence level (high/medium/low) plus the evidence.
3. **Nothing goes live without approval.** Never push to `main`. Every change = branch + PR.
   Merging the PR is the owner's approval.
4. **Confidentiality.** Never publish anything from local files that looks like Société
   Générale internal material (client data, internal notes, "confidentiel", "usage interne",
   "C2/C3", SG templates). When in doubt, leave it out and say so in the PR.
5. **Work in progress is opt-in.** Local drafts become entries only via a PR that the owner
   merges; even then only title + ≤3-line abstract + status. Never the draft, never target
   journals, data sources, or internal notes. *Dakar days* (book draft) stays off the site.
6. **There is no CV page.** The homepage is the CV (bio, Selected, Latest, About with
   positions, education, languages); `/cv.html` only redirects to `/`. CV facts live in
   `docs/_data/profile.yml` and come from the owner's CVs — never add positions, degrees or
   dates that are not in those sources; list doubts in `inbox/open_questions.md`.
7. **No personal or family details** beyond what `docs/_data/profile.yml` already shows.
   The agent never edits `profile.yml`.

## Data files (`docs/_data/`)

| File | Holds |
|---|---|
| `publications.yml` | peer-reviewed articles, book chapters, thesis |
| `working_papers.yml` | working papers, preprints, policy notes |
| `editos.yml` | op-eds, blog posts, think-tank pieces |
| `media.yml` | press coverage, interviews, quotes, podcasts, TV/radio |
| `talks.yml` | conferences, seminars, panels |
| `projects.yml` | data/tools/apps, and approved work in progress |
| `awards.yml` | prizes, fellowships, scholarships (`type: award`) |
| `profile.yml` | bio, affiliations, contact (owner-edited only) |
| `meta.yml` | `last_run` of the update agent |

### Entry schema (every list file)

```yaml
- id: ananou2026jfs              # unique, kebab/lowercase
  title: "…"
  type: article                  # article|chapter|thesis|working_paper|policy_note|oped|blog|think_tank|interview|quote|podcast|tv|radio|press|talk|seminar|panel|dataset|tool|app|wip
  date: "2026-06"                # YYYY, YYYY-MM or YYYY-MM-DD, always quoted
  language: en                   # fr|en
  authors: [Foly Ananou, …]      # in published order
  venue_or_outlet: "…"
  url: "https://…"               # "" if none
  doi: "10.…"                    # bare DOI, "" if none
  pdf: ""                        # /assets/papers/… only if the owner approved hosting
  abstract: ""                   # ≤3 lines, official abstract or owner's words; never invented
  tags: [WAEMU, sovereign debt]  # reuse existing tags where possible
  status: published              # published|forthcoming|under_review|working_paper|in_progress
  source: "…"                    # where it was found/verified — REQUIRED, never empty
  verified: true                 # false = kept in data but NOT rendered on the site
  # optional:
  featured: true                 # pinned in the homepage "Selected" block (keep to 2–3)
  earlier_title: "…"             # previous titles of the same work (e.g. SSRN versions)
  note: "…"                      # short factual note (e.g. institutions behind a working paper)
  related: ananou2026jfs         # id of a related entry (e.g. the paper an award was for)
```

Dates display as "Mon YYYY" when a month is known, "YYYY" otherwise; add the month whenever
the source gives one. Titles use typographic apostrophes (’) and quotes (“ ” in English, « » in French).

Only `verified: true` entries are rendered (pages, `/feed.xml`, `/items.json`).
Group versions of the same work (SSRN preprint → journal article): keep one entry, the
latest version.

## Primary sources

Google Scholar profile (primary for papers), Crossref (`query.author=Foly+Ananou`, filter
on exact author name), SSRN, ResearchGate, RePEc/IDEAS, ORCID, HAL/theses.fr,
L'Afrique des Idées, Financial Afrik, Jeune Afrique, Le Monde Afrique, RFI, Sika Finance,
Agence Ecofin, Togolese and Senegalese press, conference programmes.

## Do not touch

`docs/agenda/`, `docs/planner/` (encrypted), `docs/cika-*`, `docs/luka/`,
`docs/flowra-engine/`, `docs/predictions/`, `docs/tracker/`, `docs/robots.txt`,
`*.gs`, `encrypt_*.py`. These are separate tools that happen to share the domain.

## Automation

- `.github/workflows/update-portfolio.yml` runs quarterly and on demand; it follows
  `.github/agent/scan.md` or `.github/agent/intake.md`. The agent edits only `docs/_data/`
  and writes its PR summary to `inbox/.pr_body.md`; the workflow validates, then opens the PR.
- `scripts/validate_data.py` must pass before any PR. `scripts/check_links.py` reports dead links.
- Local intake: `/add-work <file>` (`.claude/commands/add-work.md`).
