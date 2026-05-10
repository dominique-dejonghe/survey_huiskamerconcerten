// admin-new-survey.js — interactivity for /admin/surveys/new
// - Auto-slugify from title (only when slug is empty / untouched)
// - Brand prefix indicator on slug input
// - Live slug-availability check (debounced)
// - Question count + select all/none / copy-from-existing
// - Submit guard: require >= 1 question
(function () {
  'use strict';

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
  var slugTouched = false; // user typed in slug → stop auto-fill from title
  var lastSlugCheck = ''; // avoid duplicate checks

  // ----- 1. Brand prefix on slug + form preview -----
  function getSelectedBrand() {
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
    // brand changed → re-check current slug
    if (slugInput && slugInput.value) checkSlugAvailability();
  }

  brandRadios.forEach(function (r) {
    r.addEventListener('change', updateSlugPrefix);
  });
  updateSlugPrefix();

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
  var checkSlugAvailability = debounce(function () {
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
        if (data.free) {
          slugStatus.textContent = '✓ vrij';
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

  // ----- 5. Submit guard -----
  if (form && submitBtn) {
    form.addEventListener('submit', function (e) {
      var n = qChecks.filter(function (c) { return c.checked; }).length;
      if (n === 0) {
        e.preventDefault();
        alert('Selecteer minstens één vraag voor je de enquête aanmaakt.');
        return;
      }
      // disable to prevent double-submit
      submitBtn.disabled = true;
      submitBtn.textContent = 'Aanmaken…';
    });
  }
})();
