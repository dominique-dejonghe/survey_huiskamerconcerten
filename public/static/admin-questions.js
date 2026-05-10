// admin-questions.js — interactivity for the question library:
// - Library list: live filter (qFilter input), delete-confirm
// - Editor form: type-aware show/hide of scale & choice sections
// - Import page: load-sample button + JSON-pretty-print on blur
(function () {
  'use strict';

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // ============================================================
  // 1. LIBRARY LIST — live filter + delete confirmation
  // ============================================================
  var qFilter = $('#qFilter');
  if (qFilter) {
    var rows = $$('.question-row');
    var blocks = $$('.question-category-block');

    function applyFilter() {
      var q = qFilter.value.trim().toLowerCase();
      rows.forEach(function (r) {
        var s = r.getAttribute('data-search') || '';
        r.style.display = (!q || s.indexOf(q) !== -1) ? '' : 'none';
      });
      // Hide whole category block if all rows in it are hidden
      blocks.forEach(function (b) {
        var visible = Array.prototype.slice.call(b.querySelectorAll('.question-row'))
          .some(function (r) { return r.style.display !== 'none'; });
        b.style.display = visible ? '' : 'none';
      });
    }
    qFilter.addEventListener('input', applyFilter);
  }

  // Delete-form confirm dialog
  $$('.delete-form').forEach(function (f) {
    f.addEventListener('submit', function (e) {
      var code = f.getAttribute('data-code') || 'deze vraag';
      var usage = parseInt(f.getAttribute('data-usage') || '0', 10);
      if (usage > 0) {
        // Already disabled but belt-and-braces
        e.preventDefault();
        alert('Deze vraag wordt nog gebruikt en kan niet verwijderd worden.');
        return;
      }
      if (!confirm('Vraag "' + code + '" definitief verwijderen? Deze actie kan niet ongedaan gemaakt worden.')) {
        e.preventDefault();
      }
    });
  });

  // Auto-fade flash banner (same behaviour as on dashboards)
  var flash = $('#flashBanner');
  if (flash && !flash.hidden && flash.textContent.trim()) {
    setTimeout(function () {
      flash.style.transition = 'opacity 0.4s ease';
      flash.style.opacity = '0';
      setTimeout(function () { flash.hidden = true; }, 450);
    }, 4500);
  }

  // ============================================================
  // 2. EDITOR FORM — show/hide scale & choice sections per type
  // ============================================================
  var typeSelect = $('#type');
  var sectionScale = document.querySelector('.type-section-scale');
  var sectionChoice = document.querySelector('.type-section-choice');
  var codeInput = $('#code');
  var submitBtn = $('#submitBtn');
  var qForm = $('#questionForm');

  function syncTypeSections() {
    if (!typeSelect) return;
    var t = typeSelect.value;
    var showScale = (t === 'nps' || t === 'scale');
    var showChoice = (t === 'choice');
    if (sectionScale) sectionScale.style.display = showScale ? '' : 'none';
    if (sectionChoice) sectionChoice.style.display = showChoice ? '' : 'none';

    // Smart default values when switching to nps / scale
    if (showScale) {
      var sMin = $('#scale_min'); var sMax = $('#scale_max');
      if (sMin && !sMin.value) sMin.value = (t === 'nps') ? '0' : '1';
      if (sMax && !sMax.value) sMax.value = (t === 'nps') ? '10' : '5';
    }
  }
  if (typeSelect) {
    typeSelect.addEventListener('change', syncTypeSections);
    syncTypeSections();
  }

  // Auto-normalise the code input as user types (lowercase, _ instead of -, strip junk)
  if (codeInput && !codeInput.readOnly) {
    codeInput.addEventListener('input', function () {
      var pos = codeInput.selectionStart;
      var clean = codeInput.value
        .toLowerCase()
        .replace(/[^a-z0-9_]+/g, '_')
        .replace(/^_+/, '')
        .replace(/_{2,}/g, '_')
        .slice(0, 50);
      if (clean !== codeInput.value) {
        codeInput.value = clean;
        if (pos != null) codeInput.setSelectionRange(clean.length, clean.length);
      }
    });
  }

  // Submit guard — prevent double-submit
  if (qForm && submitBtn) {
    qForm.addEventListener('submit', function () {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Bezig…';
    });
  }

  // ============================================================
  // 3. IMPORT PAGE — load sample button + pretty-print
  // ============================================================
  var loadSampleBtn = $('#loadSampleBtn');
  var jsonTextarea = $('#json');
  if (loadSampleBtn && jsonTextarea) {
    loadSampleBtn.addEventListener('click', function () {
      jsonTextarea.value = jsonTextarea.placeholder || '';
      jsonTextarea.focus();
    });
  }
  if (jsonTextarea) {
    jsonTextarea.addEventListener('blur', function () {
      var v = jsonTextarea.value.trim();
      if (!v) return;
      try {
        var parsed = JSON.parse(v);
        jsonTextarea.value = JSON.stringify(parsed, null, 2);
      } catch (e) { /* leave as-is so user can fix */ }
    });
  }

  var importForm = $('#importForm');
  var importBtn = $('#importSubmitBtn');
  if (importForm && importBtn) {
    importForm.addEventListener('submit', function () {
      importBtn.disabled = true;
      importBtn.textContent = 'Importeren…';
    });
  }
})();
