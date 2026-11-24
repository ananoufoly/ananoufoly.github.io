# ananoufoly.github.io

Personal site of Foly Ananou, served by GitHub Pages from `/docs` on `main` and built by Jekyll.
All portfolio content lives in `docs/_data/*.yml`; the pages are templates over that data.
Rules and the entry schema: [`CLAUDE.md`](CLAUDE.md).

## Approving an update

The update agent never publishes anything. It opens a pull request titled
`Portfolio update – YYYY-MM-DD` listing each new item, its confidence level and the evidence.

1. Open the PR (GitHub app or Pull requests tab) and read the summary.
2. To drop an item, delete its block in **Files changed → ⋯ → Edit file**, or flip it to
   `verified: false` to keep it hidden.
3. **Merge** = approve. The site rebuilds within a couple of minutes. **Close** = reject.

## Adding an item by hand

- **From your phone or browser:** Actions → *Update portfolio* → *Run workflow*, paste a URL, DOI
  or a few lines in *item*. A PR follows.
- **From the repo:** paste the URL or text into `inbox/new_item.md` and commit to `main`.
- **From a local file (Claude Code on your Mac):** `/add-work ~/path/to/file`. It checks
  confidentiality and shows you the entry before anything leaves your machine.
- **Directly:** copy an existing block in the right `docs/_data/*.yml`, edit it, keep `source`
  filled, and check with `python3 scripts/validate_data.py`.

## Pausing the agent

Settings → Secrets and variables → Actions → **Variables** → New variable
`PORTFOLIO_AGENT_PAUSED` = `true`. Delete it (or set `false`) to resume. To stop it for good,
disable the workflow under Actions → *Update portfolio* → ⋯ → *Disable workflow*.

## Changing the agent's model

Settings → Secrets and variables → Actions → **Variables** → `PORTFOLIO_AGENT_MODEL`.
Default (no variable): `claude-sonnet-5-5`, about $3–5/month. `claude-opus-5-5` is stronger at
checking identity and namesakes, about $5–10/month. `claude-haiku-5-5` costs well under $1/month
but is weaker at judging uncertain matches.

## One-time setup

1. Settings → Secrets and variables → Actions → **New repository secret**
   `ANTHROPIC_API_KEY` = a key from console.anthropic.com (API keys).
2. Settings → Actions → General → Workflow permissions → tick
   **Allow GitHub Actions to create and approve pull requests**.
3. Actions → *Update portfolio* → *Run workflow* (leave *item* empty) to test.
