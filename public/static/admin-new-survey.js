// admin-new-survey.js — interactivity for /admin/surveys/new AND /admin/surveys/:id/edit
// - Auto-slugify from title (only when slug is empty / untouched, and never in edit mode)
// - Brand prefix indicator on slug input (read from radio in new mode, dataset in edit mode)
// - Live slug-availability check (debounced) — current slug is treated as "free" in edit mode
// - Question count + select all/none / copy-from-existing
// - Submit guard: require >= 1 question
(function () {
  'use strict';

  // ----- mode detection -----
  var mainEl = document.querySelector('.admin-main.new-survey-form');
  var isEditMode = mainEl && mainEl.getAttribute('data-mode') === 'edit';
  var currentSlug = mainEl ? (mainEl.getAttribute('data-current-slug') || '') : '';
  var fixedBrandPrefix = mainEl ? mainEl.getAttribute('data-brand-prefix') : null; // edit mode

  // ----- helpers -----
  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function slugify(s) {
    return (s || '')
      .toLowerCase()
      .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/['"`]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-{2,}/g, '-')
      .slice(0, 80);
  }

  function debounce(fn, ms) {
    var t; return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // ----- elements -----
  var titleInput = $('#title_nl');
  var slugInput = $('#slug');
  var slugPrefix = $('#slugPrefix');
  var slugStatus = $('#slugStatus');
  var brandRadios = $$('input[name="brand_id"]');
  var qChecks = $$('.q-check');
  var qCount = $('#qCount');
  var qSelectAll = $('#qSelectAll');
  var qSelectNone = $('#qSelectNone');
  var qCopyFrom = $('#qCopyFrom');
  var submitBtn = $('#submitBtn');
  var form = $('#newSurveyForm');

  // ----- state -----
  // In edit mode: slug already has a value, treat it as "touched" so we never
  // overwrite from the title input (user must explicitly retype the slug).
  var slugTouched = isEditMode;
  var lastSlugCheck = ''; // avoid duplicate checks

  // ----- 1. Brand prefix on slug + form preview -----
  function getSelectedBrand() {
    // Edit mode: brand is fixed via hidden input; read prefix from data-attr.
    if (isEditMode) {
      var hidden = document.querySelector('input[name="brand_id"]');
      return {
        id: hidden ? hidden.value : '',
        prefix: fixedBrandPrefix || 'h',
      };
    }
    for (var i = 0; i < brandRadios.length; i++) {
      if (brandRadios[i].checked) {
        return {
          id: brandRadios[i].value,
          // get prefix from the visible label text "/x/<slug>"
          prefix: (function () {
            var lbl = brandRadios[i].closest('label');
            var pref = lbl ? lbl.querySelector('.brand-radio-prefix') : null;
            if (pref) {
              var m = pref.textContent.match(/^\/([a-z0-9]+)\//i);
              return m ? m[1] : 'h';
            }
            return 'h';
          })(),
        };
      }
    }
    return { id: 'huiskamer', prefix: 'h' };
  }

  function updateSlugPrefix() {
    var b = getSelectedBrand();
    if (slugPrefix) slugPrefix.textContent = '/' + b.prefix + '/';
    // brand changed → re-check current slug (only if checker already initialised)
    if (slugInput && slugInput.value && typeof checkSlugAvailability === 'function') {
      checkSlugAvailability();
    }
  }

  brandRadios.forEach(function (r) {
    r.addEventListener('change', updateSlugPrefix);
  });
  // Set the prefix synchronously, but defer the slug-check until after this
  // module finishes initialising (so checkSlugAvailability is defined below).
  (function initialPrefixOnly() {
    var b = getSelectedBrand();
    if (slugPrefix) slugPrefix.textContent = '/' + b.prefix + '/';
  })();

  // ----- 2. Auto-slugify title -----
  if (titleInput && slugInput) {
    titleInput.addEventListener('input', function () {
      if (slugTouched) return;
      slugInput.value = slugify(titleInput.value);
      checkSlugAvailability();
    });
    slugInput.addEventListener('input', function () {
      slugTouched = true;
      // normalise as user types
      var pos = slugInput.selectionStart;
      var clean = slugify(slugInput.value);
      if (clean !== slugInput.value) {
        slugInput.value = clean;
        slugInput.setSelectionRange(clean.length, clean.length);
      } else if (pos != null) {
        slugInput.setSelectionRange(pos, pos);
      }
      checkSlugAvailability();
    });
  }

  // ----- 3. Live slug check -----
  // Wrapped function declaration so it's hoisted — updateSlugPrefix() above
  // calls it during init before its body would otherwise be assigned.
  var _doSlugCheck = debounce(function () {
    if (!slugInput || !slugStatus) return;
    var slug = slugInput.value.trim();
    if (!slug) {
      slugStatus.textContent = '';
      slugStatus.className = 'slug-status';
      return;
    }
    var brandId = getSelectedBrand().id;
    var key = brandId + '|' + slug;
    if (key === lastSlugCheck) return;
    lastSlugCheck = key;
    slugStatus.textContent = 'controleren…';
    slugStatus.className = 'slug-status checking';

    fetch('/api/admin/check-slug?brand=' + encodeURIComponent(brandId) + '&slug=' + encodeURIComponent(slug),
      { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (key !== lastSlugCheck) return; // outdated response
        if (!data.ok) {
          slugStatus.textContent = '';
          slugStatus.className = 'slug-status';
          return;
        }
        // In edit mode, the survey's own current slug should display as OK.
        var ownSlug = isEditMode && slug === currentSlug;
        if (data.free || ownSlug) {
          slugStatus.textContent = ownSlug && !data.free ? '✓ huidige' : '✓ vrij';
          slugStatus.className = 'slug-status free';
        } else {
          slugStatus.textContent = '✗ al in gebruik';
          slugStatus.className = 'slug-status taken';
        }
      })
      .catch(function () {
        slugStatus.textContent = '';
        slugStatus.className = 'slug-status';
      });
  }, 350);
  function checkSlugAvailability() { _doSlugCheck(); }

  // ----- 4. Question count + helpers -----
  function updateCount() {
    var n = qChecks.filter(function (c) { return c.checked; }).length;
    if (qCount) qCount.textContent = String(n);
    if (submitBtn) submitBtn.disabled = false;
  }
  qChecks.forEach(function (c) { c.addEventListener('change', updateCount); });
  updateCount();

  if (qSelectAll) qSelectAll.addEventListener('click', function () {
    qChecks.forEach(function (c) { c.checked = true; });
    updateCount();
  });
  if (qSelectNone) qSelectNone.addEventListener('click', function () {
    qChecks.forEach(function (c) { c.checked = false; });
    updateCount();
  });

  if (qCopyFrom) qCopyFrom.addEventListener('change', function () {
    var v = qCopyFrom.value;
    if (!v) return;
    var codes = v.split(',').filter(Boolean);
    var set = {};
    codes.forEach(function (c) { set[c] = true; });
    qChecks.forEach(function (c) { c.checked = !!set[c.value]; });
    updateCount();
    // reset selector so user can re-trigger
    qCopyFrom.value = '';
  });

  // ----- 4b. Initial slug check (deferred until checkSlugAvailability is defined) -----
  if (slugInput && slugInput.value) {
    checkSlugAvailability();
  }

  // ----- 5. Submit guard -----
  // In create-mode: require at least one question checkbox so we never create an
  // empty survey. In edit-mode: questions are managed in a SEPARATE section below
  // the main form (each row has its own POST), so the main form no longer carries
  // any question checkboxes — checking qChecks here would always be 0 and would
  // wrongly block every save. So we skip the check entirely in edit-mode.
  if (form && submitBtn) {
    form.addEventListener('submit', function (e) {
      if (!isEditMode) {
        var n = qChecks.filter(function (c) { return c.checked; }).length;
        if (n === 0) {
          e.preventDefault();
          alert('Selecteer minstens één vraag voor je de enquête aanmaakt.');
          return;
        }
      }
      // disable to prevent double-submit
      submitBtn.disabled = true;
      submitBtn.textContent = isEditMode ? 'Opslaan…' : 'Aanmaken…';
    });
  }

  // ----- Live char-count for intro/thanks textareas -----
  document.querySelectorAll('.char-count[data-target]').forEach(function (el) {
    var targetId = el.getAttribute('data-target');
    var ta = document.getElementById(targetId);
    if (!ta) return;
    var max = parseInt(ta.getAttribute('maxLength') || ta.getAttribute('maxlength') || '1000', 10);
    function update() {
      var n = ta.value.length;
      el.textContent = n + ' / ' + max;
      el.classList.toggle('char-count-warn', n > max * 0.9);
    }
    ta.addEventListener('input', update);
    update();
  });
})();
