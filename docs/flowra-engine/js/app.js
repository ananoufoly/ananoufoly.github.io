/**
 * Flowra Scoring Engine — UI logic
 *
 * Populates the form, runs the engine, renders the scored result with its full
 * rule trace, and drives the what-if comparison panel.
 */

(function () {
  'use strict';

  const BUILD = '2026-09-18c';
  const engine = new ScoringEngine();

  /** Last scored transaction + result — the baseline for what-if scenarios. */
  let currentTransaction = null;
  let currentResult = null;

  /* ================================================================ *
   * BOOT
   * ================================================================ */

  document.addEventListener('DOMContentLoaded', async () => {
    populateSelects();
    wireForm();
    wireWhatIf();
    wireRangeOutput();

    // Transactions load before the picker is wired, so it never shows an
    // empty list or a stale set.
    await loadTransactions();
    populateSampleSelect();
    wireSamples();
    wireBorrowerSearch();
    announceDataSource();
  });

  /* ================================================================ *
   * FORM SETUP
   * ================================================================ */

  function populateSelects() {
    const corridorSelect = document.getElementById('f-corridor');
    const whatIfCorridor = document.getElementById('whatIfCorridor');

    CORRIDOR_OPTIONS.forEach(name => {
      const data = CORRIDOR_DATA[name];
      const label = `${name} (${(data.successRate * 100).toFixed(1)}% success)`;
      corridorSelect.appendChild(makeOption(name, label));
      whatIfCorridor.appendChild(makeOption(name, label));
    });

    const productSelect = document.getElementById('f-product');
    PRODUCT_OPTIONS.forEach(name => {
      productSelect.appendChild(makeOption(name, name));
    });

    const coherenceSelect = document.getElementById('f-coherence');
    const whatIfCoherence = document.getElementById('whatIfCoherence');
    COHERENCE_OPTIONS.forEach(opt => {
      coherenceSelect.appendChild(makeOption(opt.value, `${opt.label} — ${opt.points} pts`));
      whatIfCoherence.appendChild(makeOption(opt.value, opt.label));
    });

  }

  /** Filled once transactions have loaded. */
  function populateSampleSelect() {
    const sampleSelect = document.getElementById('sampleSelect');
    sampleSelect.innerHTML = '';
    SAMPLE_TRANSACTIONS.slice(0, 200).forEach((t, i) => {
      const label = t.borrower ? `${t.id} — ${t.borrower}` : t.id;
      sampleSelect.appendChild(makeOption(String(i), label));
    });
  }

  /** Tell the user which dataset is in play — real file or synthetic samples. */
  function announceDataSource() {
    const el = document.getElementById('dataSource');
    if (!el) return;
    const n = SAMPLE_TRANSACTIONS.length;
    console.log(`Flowra engine build ${BUILD} ready.`);
    const tag = document.getElementById('buildTag');
    if (tag) tag.textContent = `build ${BUILD}`;
    if (USING_REAL_DATA) {
      el.textContent = `${n} transaction${n > 1 ? 's' : ''} loaded from flowra-transactions.json.`;
      el.className = 'data-source data-source-real';
    } else {
      el.textContent = `${n} synthetic sample${n > 1 ? 's' : ''} — no transaction file present.`;
      el.className = 'data-source data-source-fallback';
    }
  }

  function makeOption(value, label) {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    return o;
  }

  function wireRangeOutput() {
    const range = document.getElementById('f-conc');
    const out = document.getElementById('concOut');
    const sync = () => { out.textContent = `${Math.round(range.value * 100)}%`; };
    range.addEventListener('input', sync);
    sync();
  }

  function wireForm() {
    document.getElementById('scoreForm').addEventListener('submit', e => {
      e.preventDefault();
      const transaction = getFormData();
      const validation = engine.validateTransaction(transaction);

      if (!validation.isValid) {
        renderValidationErrors(validation.errors);
        return;
      }

      currentTransaction = transaction;
      currentResult = engine.calculateScore(transaction);
      displayResults(currentResult);
      revealWhatIf();

      const results = document.getElementById('results');
      if (typeof results.scrollIntoView === 'function') {
        results.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });

    document.getElementById('resetForm').addEventListener('click', () => {
      document.getElementById('scoreForm').reset();
      wireRangeOutput();
      currentTransaction = null;
      currentResult = null;
      document.getElementById('whatIfSection').hidden = true;
      document.getElementById('results').innerHTML = placeholderHtml();
    });
  }

  function wireSamples() {
    document.getElementById('loadSample').addEventListener('click', () => {
      const idx = parseInt(document.getElementById('sampleSelect').value, 10) || 0;
      populateForm(SAMPLE_TRANSACTIONS[idx]);
    });
  }

  /* ================================================================ *
   * BORROWER SEARCH
   * ================================================================ */

  /** Index of the currently displayed suggestions, by list position. */
  let currentSuggestions = [];

  function wireBorrowerSearch() {
    const input = document.getElementById('borrowerSearch');
    if (!input) return;

    input.addEventListener('input', () => {
      const query = input.value.trim().toLowerCase();
      if (query.length < 2) {
        hideSuggestions();
        return;
      }

      currentSuggestions = SAMPLE_TRANSACTIONS.filter(t => {
        const name = String(t.borrower || '').toLowerCase();
        const id = String(t.id || '').toLowerCase();
        const corridor = String(t.corridor || '').toLowerCase();
        return name.includes(query) || id.includes(query) || corridor.includes(query);
      }).slice(0, 8);

      if (currentSuggestions.length) {
        showSuggestions(currentSuggestions);
      } else {
        showNoMatch(query);
      }
    });

    // Escape closes the list; a click elsewhere dismisses it.
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { hideSuggestions(); input.blur(); }
    });
    document.addEventListener('click', e => {
      if (e.target !== input && !e.target.closest('#borrowerSuggestions')) {
        hideSuggestions();
      }
    });
  }

  function suggestionBox() {
    let box = document.getElementById('borrowerSuggestions');
    if (!box) {
      box = document.createElement('div');
      box.id = 'borrowerSuggestions';
      box.className = 'suggestions';
      const input = document.getElementById('borrowerSearch');
      input.parentNode.insertBefore(box, input.nextSibling);
    }
    return box;
  }

  function showSuggestions(matches) {
    const box = suggestionBox();
    box.innerHTML = matches.map((m, i) => `
      <button type="button" class="suggestion" data-index="${i}">
        <span class="suggestion-name">${esc(m.borrower || m.id)}</span>
        <span class="suggestion-meta">${esc(m.corridor || '—')} · ${esc(m.product || m.typeProduct || '—')}</span>
      </button>
    `).join('');

    // Listeners rather than inline onclick: borrower names are data, and a
    // name containing a quote would break an inline handler.
    box.querySelectorAll('.suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        selectSuggestion(Number(btn.dataset.index));
      });
    });
  }

  function showNoMatch(query) {
    suggestionBox().innerHTML =
      `<p class="suggestion-empty">No borrower matching “${esc(query)}”.</p>`;
  }

  function hideSuggestions() {
    const box = document.getElementById('borrowerSuggestions');
    if (box) box.remove();
    currentSuggestions = [];
  }

  function selectSuggestion(index) {
    const chosen = currentSuggestions[index];
    if (!chosen) return;
    populateForm(chosen);
    hideSuggestions();
    document.getElementById('borrowerSearch').value = '';
  }

  /* ================================================================ *
   * FORM I/O
   * ================================================================ */

  function getFormData() {
    const form = document.getElementById('scoreForm');
    const fd = new FormData(form);
    return {
      id: (fd.get('id') || '').trim() || 'TXN001',
      borrower: (fd.get('borrower') || '').trim(),
      corridor: fd.get('corridor') || '',
      typeProduct: fd.get('typeProduct') || '',
      declaredValue: Number(fd.get('declaredValue')) || 0,
      coherencePrix: fd.get('coherencePrix') || '',
      spreadCommercial: Number(fd.get('spreadCommercial')) || 0,
      nbTripsTotal: parseInt(fd.get('nbTripsTotal'), 10) || 0,
      tripsPerMonth: Number(fd.get('tripsPerMonth')) || 0,
      concentrationCorridor: Number(fd.get('concentrationCorridor')) || 0,
      nbIncidents: parseInt(fd.get('nbIncidents'), 10) || 0
    };
  }

  function populateForm(sample) {
    setValue('f-id', sample.id);
    setValue('f-borrower', sample.borrower);

    // Real records may name a corridor or product the dropdown has never seen.
    // Add it rather than silently leaving the field blank — the engine scores
    // an unknown corridor as untested, which is the honest outcome.
    ensureOption('f-corridor', sample.corridor);
    ensureOption('f-product', sample.typeProduct);
    setValue('f-corridor', sample.corridor);
    setValue('f-product', sample.typeProduct);
    setValue('f-declaredValue', sample.declaredValue);
    setValue('f-coherence', sample.coherencePrix);
    setValue('f-spread', sample.spreadCommercial);
    setValue('f-trips', sample.nbTripsTotal);
    setValue('f-freq', sample.tripsPerMonth);
    setValue('f-conc', sample.concentrationCorridor);
    setValue('f-incidents', sample.nbIncidents);
    document.getElementById('concOut').textContent =
      `${Math.round(sample.concentrationCorridor * 100)}%`;
  }

  function setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  /** Add a value to a <select> if it is not already one of its options. */
  function ensureOption(selectId, value) {
    if (!value) return;
    const sel = document.getElementById(selectId);
    if (!sel) return;
    const exists = Array.from(sel.options).some(o => o.value === value);
    if (!exists) {
      sel.appendChild(makeOption(value, `${value} (not in reference data)`));
    }
  }

  /* ================================================================ *
   * RENDERING — RESULTS
   * ================================================================ */

  function displayResults(result) {
    const s = result.scoring;
    const pct = Math.max(0, Math.min(100, (s.totalScore / s.maxScore) * 100));

    const html = `
      <div class="score-card ${esc(s.tierSlug)}">

        <div class="score-header">
          <div class="score-header-main">
            <h2>${esc(s.tierEmoji)} ${esc(s.tier)}</h2>
            <p class="score-meta">${esc(result.transactionId)} · ${esc(result.borrower)}</p>
          </div>
          <div class="score-total">
            <span class="score-number">${s.totalScore}</span>
            <span class="score-denom">/ ${s.maxScore}</span>
          </div>
        </div>

        <div class="score-bar" role="img" aria-label="Score ${s.totalScore} of ${s.maxScore}">
          <div class="score-bar-fill" style="width:${pct}%"></div>
          <span class="score-bar-mark" style="left:50%" title="Approved threshold (50)"></span>
          <span class="score-bar-mark" style="left:66.7%" title="Standard threshold (40)"></span>
          <span class="score-bar-mark" style="left:83.3%" title="Conditional threshold (30)"></span>
        </div>

        ${s.overriddenByDecline ? `
          <div class="override-banner">
            <strong>✗ Mandatory decline applied.</strong>
            This file scored ${s.totalScore}/${s.maxScore}, but one or more hard stops were triggered.
            The score is shown for diagnosis only — the file is not fundable as submitted.
          </div>` : ''}

        <div class="advance-info">
          <div class="advance-item">
            <span class="advance-label">Advance Rate</span>
            <span class="advance-value">${(s.advancePct * 100).toFixed(0)}%</span>
          </div>
          <div class="advance-item">
            <span class="advance-label">Max Advance</span>
            <span class="advance-value">${fmtFcfa(s.advanceFcfa)} <small>FCFA</small></span>
          </div>
          <div class="advance-item">
            <span class="advance-label">Tenor</span>
            <span class="advance-value">${esc(s.tenor)}</span>
          </div>
          <div class="advance-item">
            <span class="advance-label">Declared Value</span>
            <span class="advance-value">${fmtFcfa(result.declaredValue)} <small>FCFA</small></span>
          </div>
        </div>

        ${renderDeclines(result.validation.mandatoryDeclines)}
        ${renderFlags(result.validation.manualReviewFlags)}

        <div class="score-details">
          ${renderLayer(s.layer1, 1)}
          ${renderLayer(s.layer2, 2)}
          ${renderLayer(s.layer3, 3)}
        </div>

        <details class="trace">
          <summary>📜 Full rule trace (${result.rulesTrace.length} entries)</summary>
          <table class="trace-table">
            <thead>
              <tr><th>Layer</th><th>Rule</th><th>Input</th><th>Pts</th></tr>
            </thead>
            <tbody>
              ${result.rulesTrace.map(t => `
                <tr class="${t.rule === 'SUBTOTAL' ? 'trace-subtotal' : ''}">
                  <td>${esc(t.layer)}</td>
                  <td>${esc(t.rule)}</td>
                  <td>${esc(t.input)}</td>
                  <td class="num">${t.points}/${t.max}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </details>

        <div class="caveat">
          <strong>⚠ ${esc(result.caveat.text)}</strong>
          <p>${esc(result.caveat.detail)}</p>
        </div>

        <div class="result-actions">
          <button type="button" id="printReport" class="btn-secondary">📄 Print Report</button>
          <button type="button" id="downloadJson" class="btn-secondary">⬇ Download JSON</button>
        </div>
      </div>
    `;

    document.getElementById('results').innerHTML = html;
    document.getElementById('printReport').addEventListener('click', () => window.print());
    document.getElementById('downloadJson').addEventListener('click', () => downloadJSON(result));
  }

  function renderLayer(layer, n) {
    const pct = (layer.total / layer.max) * 100;
    return `
      <div class="layer layer-${n}">
        <div class="layer-header">
          <h3><span class="dot dot-${n}"></span> Layer ${n}: ${esc(layer.name)}</h3>
          <span class="layer-total">${layer.total}<small>/${layer.max}</small></span>
        </div>
        <div class="layer-bar"><div class="layer-bar-fill" style="width:${pct}%"></div></div>
        ${layer.breakdown.map(b => `
          <div class="rule ${b.points === 0 ? 'rule-zero' : ''}">
            <div class="rule-head">
              <span class="rule-name">${esc(b.rule)}</span>
              <span class="points">${b.points > 0 ? '+' : ''}${b.points}<small>/${b.max}</small></span>
            </div>
            <p class="rule-value">${esc(b.value)}</p>
            <p class="explanation">${esc(b.explanation)}</p>
            ${b.caveat ? `<p class="rule-caveat">⚠ ${esc(b.caveat)}</p>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderDeclines(declines) {
    if (!declines || !declines.length) return '';
    return `
      <div class="decline-list">
        <h4>✗ Mandatory decline${declines.length > 1 ? 's' : ''} (${declines.length})</h4>
        ${declines.map(d => `
          <div class="decline-item">
            <strong>${esc(d.label)}</strong>
            <p>${esc(d.detail)}</p>
            <code>${esc(d.code)}</code>
          </div>`).join('')}
      </div>`;
  }

  function renderFlags(flags) {
    if (!flags || !flags.length) return '';
    return `
      <div class="flag-list">
        <h4>⚑ Manual review flag${flags.length > 1 ? 's' : ''} (${flags.length})</h4>
        ${flags.map(f => `
          <div class="flag-item">
            <strong>${esc(f.label)}</strong>
            <p>${esc(f.detail)}</p>
            <code>${esc(f.code)}</code>
          </div>`).join('')}
      </div>`;
  }

  function renderValidationErrors(errors) {
    document.getElementById('results').innerHTML = `
      <div class="score-card error-card">
        <h2>⚠ Incomplete transaction</h2>
        <p>The following must be supplied before the file can be scored:</p>
        <ul class="error-list">
          ${errors.map(e => `<li>${esc(e)}</li>`).join('')}
        </ul>
      </div>`;
  }

  function placeholderHtml() {
    return `
      <div class="placeholder">
        <p class="placeholder-icon">⚖️</p>
        <p>Enter transaction details and click <strong>Calculate Score</strong>.</p>
        <p class="placeholder-sub">Or load a sample from the left to see a scored file end to end.</p>
      </div>`;
  }

  /* ================================================================ *
   * WHAT-IF
   * ================================================================ */

  function wireWhatIf() {
    ['whatIfCorridor', 'whatIfSpread', 'whatIfCoherence', 'whatIfIncidents']
      .forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener('change', runWhatIf);
        el.addEventListener('input', runWhatIf);
      });

    document.getElementById('resetWhatIf').addEventListener('click', () => {
      document.getElementById('whatIfCorridor').value = '';
      document.getElementById('whatIfSpread').value = '';
      document.getElementById('whatIfCoherence').value = '';
      document.getElementById('whatIfIncidents').value = '';
      document.getElementById('scenarioComparison').innerHTML = '';
    });
  }

  function revealWhatIf() {
    const section = document.getElementById('whatIfSection');
    section.hidden = false;
    runWhatIf();
  }

  function runWhatIf() {
    if (!currentTransaction) return;

    const overrides = {};
    const corridor = document.getElementById('whatIfCorridor').value;
    const spread = document.getElementById('whatIfSpread').value;
    const coherence = document.getElementById('whatIfCoherence').value;
    const incidents = document.getElementById('whatIfIncidents').value;

    if (corridor) overrides.corridor = corridor;
    if (spread !== '') overrides.spreadCommercial = Number(spread);
    if (coherence) overrides.coherencePrix = coherence;
    if (incidents !== '') overrides.nbIncidents = parseInt(incidents, 10);

    const target = document.getElementById('scenarioComparison');
    if (!Object.keys(overrides).length) {
      target.innerHTML = '';
      return;
    }

    displayComparison(engine.compareScenario(currentTransaction, overrides));
  }

  function displayComparison(cmp) {
    const b = cmp.base.scoring;
    const v = cmp.variant.scoring;

    const changes = Object.keys(cmp.overrides)
      .map(k => `<li><span class="chg-field">${esc(labelFor(k))}</span>: ${esc(String(cmp.base[mapToResultKey(k)] ?? currentTransaction[k]))} → <strong>${esc(String(cmp.overrides[k]))}</strong></li>`)
      .join('');

    document.getElementById('scenarioComparison').innerHTML = `
      <div class="comparison">
        <ul class="change-list">${changes}</ul>

        <table class="comparison-table">
          <thead>
            <tr><th>Metric</th><th>Baseline</th><th>Scenario</th><th>Δ</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Layer 1 — Price Coherence</td>
              <td class="num">${b.layer1.total}/25</td>
              <td class="num">${v.layer1.total}/25</td>
              <td class="num ${deltaClass(cmp.delta.layer1)}">${fmtDelta(cmp.delta.layer1)}</td>
            </tr>
            <tr>
              <td>Layer 2 — Route Risk</td>
              <td class="num">${b.layer2.total}/20</td>
              <td class="num">${v.layer2.total}/20</td>
              <td class="num ${deltaClass(cmp.delta.layer2)}">${fmtDelta(cmp.delta.layer2)}</td>
            </tr>
            <tr>
              <td>Layer 3 — Borrower Activity</td>
              <td class="num">${b.layer3.total}/15</td>
              <td class="num">${v.layer3.total}/15</td>
              <td class="num ${deltaClass(cmp.delta.layer3)}">${fmtDelta(cmp.delta.layer3)}</td>
            </tr>
            <tr class="total-row">
              <td>Total score</td>
              <td class="num">${b.totalScore}/60</td>
              <td class="num">${v.totalScore}/60</td>
              <td class="num ${deltaClass(cmp.delta.totalScore)}">${fmtDelta(cmp.delta.totalScore)}</td>
            </tr>
            <tr>
              <td>Tier</td>
              <td>${esc(b.tier)}</td>
              <td>${esc(v.tier)}</td>
              <td>${cmp.delta.tierChanged ? '<span class="tier-changed">changed</span>' : '—'}</td>
            </tr>
            <tr>
              <td>Max advance (FCFA)</td>
              <td class="num">${fmtFcfa(b.advanceFcfa)}</td>
              <td class="num">${fmtFcfa(v.advanceFcfa)}</td>
              <td class="num ${deltaClass(cmp.delta.advanceFcfa)}">${fmtDeltaFcfa(cmp.delta.advanceFcfa)}</td>
            </tr>
          </tbody>
        </table>

        ${v.overriddenByDecline && !b.overriddenByDecline ? `
          <p class="comparison-note decline-note">
            ✗ This scenario triggers a mandatory decline: ${esc(cmp.variant.validation.mandatoryDeclines.map(d => d.label).join('; '))}.
          </p>` : ''}
        ${b.overriddenByDecline && !v.overriddenByDecline ? `
          <p class="comparison-note clear-note">
            ✓ This scenario clears the mandatory decline on the baseline file.
          </p>` : ''}
      </div>`;
  }

  function labelFor(key) {
    return {
      corridor: 'Corridor',
      spreadCommercial: 'Commercial spread',
      coherencePrix: 'Price coherence',
      nbIncidents: 'Incidents'
    }[key] || key;
  }

  function mapToResultKey(key) {
    return { corridor: 'corridor' }[key] || key;
  }

  /* ================================================================ *
   * EXPORT
   * ================================================================ */

  function downloadJSON(result) {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowra-score-${result.transactionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /* ================================================================ *
   * UTILITIES
   * ================================================================ */

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtFcfa(n) {
    return Math.round(Number(n) || 0).toLocaleString('fr-FR').replace(/ | /g, ' ');
  }

  function fmtDelta(d) {
    if (d === 0) return '—';
    return (d > 0 ? '+' : '') + d;
  }

  function fmtDeltaFcfa(d) {
    if (d === 0) return '—';
    return (d > 0 ? '+' : '−') + fmtFcfa(Math.abs(d));
  }

  function deltaClass(d) {
    if (d > 0) return 'delta-up';
    if (d < 0) return 'delta-down';
    return '';
  }

})();
