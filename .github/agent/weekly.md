# Weekly portfolio scan

You are updating Foly Ananou's portfolio site. Read `CLAUDE.md` first: its Hard rules
override anything below. Keep the run lean: no site builds, no rewrites, at most
8 web searches. You only edit files under `docs/_data/` and write `inbox/.pr_body.md`.

## 1. What is already there
`docs/_data/meta.yml` holds `last_run`. Collect every `url` and `doi` already present in
`docs/_data/*.yml` (Grep) so you can skip known items.

## 2. Look for new items since `last_run` (search the exact name "Foly Ananou")
1. OpenAlex (papers, preprints, SSRN): fetch
   `https://api.openalex.org/works?filter=author.id:A5107398670&sort=publication_date:desc&per_page=25`
2. Crossref: `https://api.crossref.org/works?query.author=%22Foly+Ananou%22&sort=published&order=desc&rows=20`
   — keep only records whose author list contains given name Foly (or "Foly Sodjine") + family Ananou.
3. Google Scholar profile (best effort, often blocked):
   `https://scholar.google.com/citations?user=ux2mKAYAAAAJ&hl=en&sortby=pubdate`
4. L'Afrique des Idées author page: `https://lafriquedesidees.org/communaute/foly-ananou/`
   (only items whose own page names the author "Foly ANANOU").
5. Jeune Afrique author page: `https://www.jeuneafrique.com/auteurs/f-ananou/` (bylines only; the
   page also lists other people's latest articles).
6. Web searches, exact name in quotes, recent results: news/interviews/podcasts/conferences in
   French and English (Financial Afrik, Jeune Afrique, Le Monde Afrique, RFI, Agence Ecofin, Sika
   Finance, Togolese and Senegalese press, SSRN, ResearchGate, conference programmes).

For every candidate open its page and confirm identity (CLAUDE.md rule 2). Group versions of the
same work (an SSRN preprint of a paper already listed is not new).

## 3. Write the changes
- Append each new item to the right file with the full schema, `source` = the evidence
  (which page, which byline/bio, date field).
- Confidence **high** → `verified: true`. **Medium/low** → add it with `verified: false`
  (kept out of the site until the owner flips it).
- Never invent abstracts, co-authors or dates; leave `""` and say so in the PR body.
- Set `last_run` in `docs/_data/meta.yml` to today's date.
- Run `python3 scripts/validate_data.py` and fix any error.

## 4. PR body → `inbox/.pr_body.md`
A short Markdown note: a table of new candidates (title, outlet, date, URL, file, confidence,
evidence), then anything you could not verify, then the link report found at the path in
the `LINK_REPORT` line of your task. If nothing is new, write exactly `NOTHING_NEW` as the
first line, followed by the link report.
