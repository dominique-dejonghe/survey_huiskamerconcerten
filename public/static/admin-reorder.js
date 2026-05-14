/* admin-reorder.js — pijltjes (▲▼) + sectie-dropdown voor het reorderen
 * van secties en vragen op /admin/surveys/:id/edit.
 *
 * UX-keuzes:
 *  - Eén klik = één stap (omhoog of omlaag).
 *  - Voor vragen: ▲ naar boven binnen sectie; als al eerste van sectie,
 *    dan naar onderaan in vorige sectie. Spiegelbeeld voor ▼.
 *  - Sectie-dropdown verplaatst een vraag direct naar gekozen sectie
 *    (achteraan in die sectie).
 *  - Optimistic UI: we passen direct de DOM aan en sturen daarna PATCH.
 *    Mislukt de server → toast + reload zodat we synchroon blijven.
 */
(function () {
  'use strict';

  // ─── Toast helper ─────────────────────────────────────────────
  function toast(msg, isError) {
    var el = document.createElement('div');
    el.className = 'admin-toast' + (isError ? ' is-error' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.classList.add('is-visible'); }, 10);
    setTimeout(function () {
      el.classList.remove('is-visible');
      setTimeout(function () { el.remove(); }, 300);
    }, isError ? 3500 : 1800);
  }

  // ─── Sectie-reorder ───────────────────────────────────────────
  function initSectionReorder() {
    var list = document.getElementById('surveySectionList');
    if (!list) return;
    var url = list.getAttribute('data-reorder-url');
    if (!url) return;

    function renumberAndToggleArrows() {
      var rows = list.querySelectorAll(':scope > .survey-section-row');
      rows.forEach(function (row, idx) {
        var orderEl = row.querySelector('.ss-order');
        if (orderEl) orderEl.textContent = (idx + 1) + '.';
        var up = row.querySelector('.ss-up');
        var down = row.querySelector('.ss-down');
        if (up) up.disabled = idx === 0;
        if (down) down.disabled = idx === rows.length - 1;
      });
    }

    function postOrder() {
      var ids = Array.prototype.map.call(
        list.querySelectorAll(':scope > .survey-section-row'),
        function (r) { return r.getAttribute('data-section-id'); }
      );
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ ids: ids }),
        credentials: 'same-origin',
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }

    list.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('.ss-up, .ss-down');
      if (!btn || btn.disabled) return;
      ev.preventDefault();
      var row = btn.closest('.survey-section-row');
      if (!row) return;
      var sibling = btn.classList.contains('ss-up')
        ? row.previousElementSibling
        : row.nextElementSibling;
      if (!sibling || !sibling.classList.contains('survey-section-row')) return;

      if (btn.classList.contains('ss-up')) {
        list.insertBefore(row, sibling);
      } else {
        list.insertBefore(sibling, row);
      }
      renumberAndToggleArrows();

      postOrder()
        .then(function () { toast('Volgorde opgeslagen'); })
        .catch(function (err) {
          console.error('[reorder/sections]', err);
          toast('Opslaan mislukt — pagina wordt herladen', true);
          setTimeout(function () { window.location.reload(); }, 1200);
        });
    });

    renumberAndToggleArrows();
  }

  // ─── Vraag-reorder + sectie-switcher ──────────────────────────
  function initQuestionReorder() {
    var container = document.getElementById('surveyQuestionGroups');
    if (!container) return;
    var url = container.getAttribute('data-reorder-url');
    if (!url) return;

    // Collect ALL question-rows in display order, across all groups.
    function allRows() {
      return Array.prototype.slice.call(
        container.querySelectorAll('.sq-group-list .survey-question-row')
      );
    }

    function renumberAndToggleArrows() {
      var rows = allRows();
      rows.forEach(function (row, idx) {
        var orderEl = row.querySelector('.sq-order');
        if (orderEl) orderEl.textContent = (idx + 1) + '.';
        var up = row.querySelector('.sq-up');
        var down = row.querySelector('.sq-down');
        if (up) up.disabled = idx === 0;
        if (down) down.disabled = idx === rows.length - 1;
        // also keep the row's data-section-id in sync with its parent .sq-group-list
        var parentList = row.closest('.sq-group-list');
        if (parentList) {
          var sid = parentList.getAttribute('data-section-id') || '';
          row.setAttribute('data-section-id', sid);
          var sel = row.querySelector('.sq-section-select');
          if (sel) {
            sel.setAttribute('data-current-section', sid);
            sel.value = sid;
          }
        }
      });
    }

    function postOrder() {
      var rows = allRows();
      var items = rows.map(function (row) {
        var parentList = row.closest('.sq-group-list');
        var sid = parentList ? parentList.getAttribute('data-section-id') : '';
        return {
          code: row.getAttribute('data-code'),
          section: sid,
        };
      });
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ items: items }),
        credentials: 'same-origin',
      }).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }

    function failAndReload(err) {
      console.error('[reorder/questions]', err);
      toast('Opslaan mislukt — pagina wordt herladen', true);
      setTimeout(function () { window.location.reload(); }, 1200);
    }

    // ── Arrow clicks ──────────────────────────────────────────
    container.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('.sq-up, .sq-down');
      if (!btn || btn.disabled) return;
      ev.preventDefault();
      var row = btn.closest('.survey-question-row');
      if (!row) return;

      var isUp = btn.classList.contains('sq-up');
      var currentList = row.closest('.sq-group-list');
      if (!currentList) return;

      if (isUp) {
        var prev = row.previousElementSibling;
        if (prev && prev.classList.contains('survey-question-row')) {
          // within same section: swap with previous sibling
          currentList.insertBefore(row, prev);
        } else {
          // first of this section → jump to bottom of previous section
          var prevGroup = currentList.closest('.sq-group').previousElementSibling;
          if (!prevGroup) return; // safety: button should have been disabled
          var prevList = prevGroup.querySelector('.sq-group-list');
          if (!prevList) return;
          prevList.appendChild(row);
        }
      } else {
        var next = row.nextElementSibling;
        if (next && next.classList.contains('survey-question-row')) {
          // within same section: swap with next sibling
          currentList.insertBefore(next, row);
        } else {
          // last of this section → jump to top of next section
          var nextGroup = currentList.closest('.sq-group').nextElementSibling;
          if (!nextGroup) return;
          var nextList = nextGroup.querySelector('.sq-group-list');
          if (!nextList) return;
          nextList.insertBefore(row, nextList.firstChild);
        }
      }

      renumberAndToggleArrows();
      postOrder()
        .then(function () { toast('Volgorde opgeslagen'); })
        .catch(failAndReload);
    });

    // ── Section dropdown changes ──────────────────────────────
    container.addEventListener('change', function (ev) {
      var sel = ev.target.closest && ev.target.closest('.sq-section-select');
      if (!sel) return;
      var newSection = sel.value;
      var currentSection = sel.getAttribute('data-current-section');
      if (!newSection || newSection === currentSection) return;

      var row = sel.closest('.survey-question-row');
      if (!row) return;

      var targetGroup = container.querySelector('.sq-group[data-section-id="' + newSection + '"]');
      if (!targetGroup) return;
      var targetList = targetGroup.querySelector('.sq-group-list');
      if (!targetList) return;

      // Append at the bottom of the target section (most predictable)
      targetList.appendChild(row);
      renumberAndToggleArrows();

      postOrder()
        .then(function () { toast('Vraag verplaatst naar “' + targetGroup.querySelector('.sq-group-badge').textContent + '”'); })
        .catch(failAndReload);
    });

    renumberAndToggleArrows();
  }

  // ─── Bootstrap ────────────────────────────────────────────────
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
    } else {
      fn();
    }
  }

  ready(function () {
    try { initSectionReorder(); } catch (e) { console.error('[reorder/sections init]', e); }
    try { initQuestionReorder(); } catch (e) { console.error('[reorder/questions init]', e); }
  });
})();
