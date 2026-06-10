// ───────────────────────────────────────────────────────────────────────────
// Public feed renderer. Reads docs/data/publications.json (exported from the
// private research agenda via "Export to website") and renders the Research,
// Éditos, and CV pages. No private data ever reaches this file — the agenda's
// export already strips notes/logs/priority/deadline.
// ───────────────────────────────────────────────────────────────────────────

const FEED_URL = "data/publications.json";

// Agenda status -> display label
const STATUS_LABELS = {
  drafting: "Working Paper",      // a working/in-progress paper, shown as such
  posted: "Working Paper",        // working_paper type that's been posted
  data_work: "In progress",
  internal_review: "In progress",
  revision: "In progress",
  submitted: "Submitted",
  under_review: "Under Review",
  revise_resubmit: "R&R",
  accepted: "Accepted",
  published: "Published",
};
// Agenda status -> CSS badge class (reuses existing site badges)
const STATUS_BADGE = {
  published: "badge-published",
  accepted: "badge-accepted",
  submitted: "badge-submitted",
  under_review: "badge-under_review",
  revise_resubmit: "badge-revise_resubmit",
  drafting: "badge-wp",
  posted: "badge-wp",
  data_work: "badge-drafting",
  internal_review: "badge-drafting",
  revision: "badge-drafting",
};
// "Finished / public" statuses go in the Publications group; the rest are WIP.
const PUBLISHED_GROUP = new Set(["published", "accepted", "submitted"]);

const esc = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

async function loadFeed() {
  const res = await fetch(FEED_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("feed " + res.status);
  return res.json();
}

// Build the meta line: coauthors · outlet
function metaLine(item) {
  const bits = [];
  if (item.coauthors) bits.push("w/ " + esc(item.coauthors));
  if (item.outlet) bits.push("<em>" + esc(item.outlet) + "</em>");
  return bits.join(" &middot; ");
}

function titleHtml(item) {
  const t = esc(item.title);
  return item.url
    ? `<a href="${esc(item.url)}" target="_blank" rel="noopener">${t}</a>`
    : t;
}

// ── RESEARCH PAGE ──────────────────────────────────────────────────────────
// Publications (published/accepted/submitted) + Work in Progress (the rest).
// Working papers are NOT a separate section — they appear as papers with a
// "Working Paper" badge.
function renderResearch(feed, pubEl, wipEl) {
  const items = (feed.research || []).slice();
  const pubs = items.filter((i) => PUBLISHED_GROUP.has(i.status));
  const wip = items.filter((i) => !PUBLISHED_GROUP.has(i.status));

  pubEl.innerHTML = pubs.length ? pubs.map((i) => {
    const badge = STATUS_BADGE[i.status] || "badge-wp";
    const label = STATUS_LABELS[i.status] || i.status;
    return `<li class="pub-entry">
      <div class="pub-header">
        <span class="badge ${badge}">${esc(label)}</span>
        <span class="pub-title">${titleHtml(i)}</span>
      </div>
      ${metaLine(i) ? `<div class="pub-meta">${metaLine(i)}</div>` : ""}
    </li>`;
  }).join("") : `<li class="feed-empty">No publications yet.</li>`;

  wipEl.innerHTML = wip.length ? wip.map((i) => {
    const label = STATUS_LABELS[i.status] || "";
    return `<li class="wip-entry">
      <div class="wip-title">${titleHtml(i)}</div>
      ${(label || i.outlet) ? `<div class="wip-desc">${[label, esc(i.outlet)].filter(Boolean).join(" &middot; ")}</div>` : ""}
    </li>`;
  }).join("") : "";

  // Hide the WIP heading entirely if there's nothing in progress.
  const wipHeading = document.querySelector("[data-wip-heading]");
  if (wipHeading) wipHeading.style.display = wip.length ? "" : "none";
}

// ── ÉDITOS PAGE ────────────────────────────────────────────────────────────
// Articles, published only. Each links to its URL (on-site or external).
function renderEditos(feed, listEl) {
  const items = feed.editos || [];
  if (!items.length) {
    listEl.innerHTML = `<li class="feed-empty">No éditos yet.</li>`;
    return;
  }
  listEl.innerHTML = items.map((i) => `<li class="edito-entry">
    ${i.outlet ? `<div class="edito-date-line"><span class="edito-date">${esc(i.outlet)}</span></div>` : ""}
    ${i.url
      ? `<a href="${esc(i.url)}" class="edito-title-link" target="_blank" rel="noopener">${esc(i.title)}</a>`
      : `<span class="edito-title-link">${esc(i.title)}</span>`}
    ${i.description ? `<div class="edito-subtitle-list">${esc(i.description)}</div>` : ""}
  </li>`).join("");
}

// ── CV PAGE ────────────────────────────────────────────────────────────────
// Publications + articles, grouped, newest-ish first. Bio is static in the page.
function renderCv(feed, listEl) {
  const research = (feed.research || []).filter((i) => PUBLISHED_GROUP.has(i.status));
  const editos = feed.editos || [];

  const pubItems = research.map((i) =>
    `<li class="pub-entry"><div class="pub-header">
      <span class="badge ${STATUS_BADGE[i.status] || "badge-wp"}">${esc(STATUS_LABELS[i.status] || i.status)}</span>
      <span class="pub-title">${titleHtml(i)}</span>
    </div>${metaLine(i) ? `<div class="pub-meta">${metaLine(i)}</div>` : ""}</li>`
  ).join("");

  const artItems = editos.map((i) =>
    `<li class="pub-entry"><div class="pub-header">
      <span class="pub-title">${titleHtml(i)}</span>
    </div>${i.outlet ? `<div class="pub-meta"><em>${esc(i.outlet)}</em></div>` : ""}</li>`
  ).join("");

  listEl.innerHTML =
    `<h2 class="section-heading">Publications &amp; Working Papers</h2>
     <ul class="pub-list">${pubItems || '<li class="feed-empty">—</li>'}</ul>` +
    (artItems
      ? `<h2 class="section-heading" style="margin-top:40px">Selected Writing</h2>
         <ul class="pub-list">${artItems}</ul>`
      : "");
}
