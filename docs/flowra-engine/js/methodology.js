/**
 * Flowra Methodology — section navigation.
 *
 * Sections are plain anchors that stay readable with JavaScript disabled:
 * the stylesheet only hides inactive sections once this script marks the
 * document as enhanced.
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    document.body.classList.add('js-enabled');

    const links = Array.from(document.querySelectorAll('.nav-link[data-section]'));
    const sections = Array.from(document.querySelectorAll('.methodology-section'));
    if (!links.length || !sections.length) return;

    function show(id, push) {
      const target = document.getElementById(id);
      if (!target) return;

      sections.forEach(s => s.classList.toggle('active', s === target));
      links.forEach(l => {
        const on = l.dataset.section === id;
        l.classList.toggle('active', on);
        if (on) {
          l.setAttribute('aria-current', 'true');
        } else {
          l.removeAttribute('aria-current');
        }
      });

      if (push && window.history && window.history.replaceState) {
        window.history.replaceState(null, '', '#' + id);
      }
      if (typeof window.scrollTo === 'function') {
        try {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) {
          /* Older engines reject the options form; scrolling is cosmetic. */
        }
      }
    }

    // Section links in the nav, and any inline cross-reference in the prose.
    document.querySelectorAll('[data-section]').forEach(el => {
      el.addEventListener('click', e => {
        e.preventDefault();
        show(el.dataset.section, true);
      });
    });

    // Deep link: /methodology.html#caveats opens that section directly.
    const initial = window.location.hash.replace('#', '');
    if (initial && document.getElementById(initial)) {
      show(initial, false);
    }

    window.addEventListener('hashchange', () => {
      const id = window.location.hash.replace('#', '');
      if (id && document.getElementById(id)) show(id, false);
    });
  });
})();
