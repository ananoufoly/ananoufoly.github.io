---
description: Add one local file (paper, draft, slides, note) to the portfolio as a PR, after a confidentiality check and the owner's yes.
argument-hint: <path to file or folder>
---

Add the work at `$ARGUMENTS` to the portfolio. Follow `CLAUDE.md` (Hard rules + schema) throughout.

1. **Read, don't copy.** Read the file (or the latest version if the folder holds several:
   newest modification date / highest version suffix). Extract title, authors, date, and the
   author's own abstract. Never copy the file, or any of its text beyond the abstract, into the repo.
2. **Confidentiality check.** Stop and report, without adding anything, if the file shows any of:
   Société Générale branding or templates, "confidentiel", "usage interne", "internal use",
   C1/C2/C3 classification, client names or data, referee reports, or a co-author's unpublished
   work. When unsure, stop and ask.
3. **Classify.** Published (has a public URL/DOI) → normal entry in the right file.
   Not public → work-in-progress teaser in `docs/_data/projects.yml`: `type: wip`,
   `status: in_progress`, title, ≤3-line abstract in the author's words, no target journal, no data
   source, no URL to the file, `source: "Author's working draft (local manuscript, version of <Month YYYY>)"`.
4. **Show the owner** the exact YAML entry and the confidentiality verdict, and wait for an explicit
   yes. Without a yes, do nothing else.
5. On yes: create a branch `add-work/<id>` from `main`, add the entry, run
   `python3 scripts/validate_data.py`, commit, push the branch, and give the owner the link to open
   the PR (`https://github.com/ananoufoly/ananoufoly.github.io/compare/main...add-work/<id>`), or
   open it with `gh pr create` if `gh` is installed. Never push to `main`.
