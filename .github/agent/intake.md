# Manual intake: one item

Read `CLAUDE.md` first; its Hard rules override anything below. The owner gave you one item
(a URL, a DOI, or a few lines), in the file named on the `ITEM_FILE` line of your task.

1. Identify the item. If it is a URL or DOI, open it (WebFetch or curl on the DOI's Crossref
   record) and take title, date, outlet, authors and language from the page itself.
   If it is free text with no link, use only what the owner wrote; search the web once with the
   exact title to find a URL, and accept it only if the page clearly matches.
2. Check it is not already in `docs/_data/*.yml` (Grep the URL, DOI and title).
3. Add one entry with the full schema to the right file. Items the owner submitted are approved
   by them: `verified: true`, unless the page contradicts what they wrote (then `false` and say
   why). Work in progress: title + ≤3-line abstract + `status: in_progress` only.
4. If `inbox/new_item.md` has content below its template comment, reset it to the template
   (keep the comment, remove what the owner pasted).
5. Run `python3 scripts/validate_data.py` and fix any error.
6. Write `inbox/.pr_body.md`: the entry you added, where each field came from, and any field
   you left empty.
