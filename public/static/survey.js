/* Survey client-side logic — vanilla JS, geen framework, NL/EN aware */
(function () {
  'use strict';

  var I18N = window.SURVEY_I18N || {
    lang: 'nl',
    progressTpl: '__N__ van __T__ ingevuld',
    submitting: 'Versturen…',
    submit: 'Verstuur antwoorden',
    rateLimit: 'Te veel pogingen — probeer later opnieuw.',
    something: 'Er ging iets mis: ',
    network: 'Netwerkfout: ',
    unknown: 'onbekend',
    thanksUrl: '/dank-je'
  };

  // ─── Vraag-IDs en required-set dynamisch uit de DOM lezen ───
  // Elke vraag-kaart in de HTML draagt data-qid (de vraagcode) en
  // optioneel data-required="1". Dat maakt deze code survey-agnostisch:
  // werkt voor Reeks I én voor nieuwe enquêtes met andere vraagcodes.
  var ALL_QIDS = (function () {
    var ids = [];
    document.querySelectorAll('.q-card[data-qid]').forEach(function (c) {
      var qid = c.getAttribute('data-qid');
      if (qid) ids.push(qid);
    });
    return ids;
  })();
  var REQUIRED_IDS = (function () {
    var ids = [];
    document.querySelectorAll('.q-card[data-qid][data-required="1"]').forEach(function (c) {
      var qid = c.getAttribute('data-qid');
      if (qid) ids.push(qid);
    });
    return ids;
  })();
  var TOTAL_QUESTIONS = ALL_QIDS.length || 20;
  // Per-survey draft key zodat invullingen voor de ene enquête niet
  // doorlekken naar een andere. We pakken survey_id of slug uit
  // verborgen velden indien aanwezig, en vallen anders terug op een
  // generieke key (oude gedrag, voor Reeks I).
  var STORAGE_KEY = (function () {
    var sidEl = document.getElementById('survey_id');
    var ssEl = document.getElementById('survey_slug');
    var bpEl = document.getElementById('brand_prefix');
    var key = 'survey_draft_v2';
    if (sidEl && sidEl.value) key += '_id' + sidEl.value;
    else if (ssEl && ssEl.value) key += '_' + (bpEl ? bpEl.value + '-' : '') + ssEl.value;
    else key = 'survey_huiskamer_draft_v1';
    return key + '_' + I18N.lang;
  })();

  // ----- Hamburger menu -----
  var navToggle = document.getElementById('navToggle');
  var siteNav = document.getElementById('siteNav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      var open = siteNav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }

  // ----- State -----
  var state = {};
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) state = JSON.parse(saved) || {};
  } catch (e) { state = {}; }

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function setValue(qid, val) {
    state[qid] = val;
    var input = document.getElementById('input_' + qid) || document.getElementById(qid);
    if (input) input.value = val == null ? '' : String(val);
    persist();
    updateProgress();
  }

  // ----- Hydrate from saved state -----
  Object.keys(state).forEach(function (qid) {
    var val = state[qid];
    if (val == null || val === '') return;
    var hidden = document.getElementById('input_' + qid);
    if (hidden) {
      hidden.value = String(val);
      // Mark scale/choice button selected — match canonical via data-canon
      var btns = document.querySelectorAll('[data-q="' + qid + '"]');
      btns.forEach(function (b) {
        var canon = b.getAttribute('data-canon') || b.getAttribute('data-v');
        if (String(canon) === String(val)) b.classList.add('selected');
      });
      if (qid === 'q20_contact') {
        var box = document.getElementById('cond_q20_email');
        if (box) box.style.display = String(val).toLowerCase() === 'ja' ? 'block' : 'none';
      }
    } else {
      var freeInput = document.getElementById(qid);
      if (freeInput) freeInput.value = val;
    }
  });

  // ----- Scale & choice buttons -----
  document.querySelectorAll('.scale-btn, .scale5-btn, .choice-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var qid = btn.getAttribute('data-q');
      var displayV = btn.getAttribute('data-v');
      var canonical = btn.getAttribute('data-canon') || displayV;
      // Deselect siblings
      document.querySelectorAll('[data-q="' + qid + '"]').forEach(function (s) {
        s.classList.remove('selected');
      });
      btn.classList.add('selected');

      // For q20_contact: lowercase canonical (ja/nee)
      var stored = canonical;
      if (qid === 'q20_contact') stored = String(canonical).toLowerCase();
      setValue(qid, stored);

      if (qid === 'q20_contact') {
        var box = document.getElementById('cond_q20_email');
        if (box) box.style.display = stored === 'ja' ? 'block' : 'none';
      }

      var card = btn.closest('.q-card');
      if (card) card.classList.remove('error', 'shake');
    });
  });

  // ----- Free text inputs -----
  document.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(function (el) {
    if (el.classList.contains('honeypot')) return;
    if (el.id === 'lang') return;
    if (el.id === 'input_q20_email' || el.id === 'q20_email') {
      el.addEventListener('input', function () { state[el.name || el.id] = el.value; persist(); updateProgress(); });
      return;
    }
    el.addEventListener('input', function () {
      state[el.name || el.id] = el.value;
      persist();
      updateProgress();
      var card = el.closest('.q-card');
      if (card) card.classList.remove('error', 'shake');
    });
  });

  // ----- Progress -----
  function updateProgress() {
    var filled = 0;
    document.querySelectorAll('.q-card').forEach(function (card) {
      var qid = card.getAttribute('data-qid');
      if (!qid) return;
      var v = state[qid];
      if (v != null && String(v).trim() !== '') filled++;
    });
    var pct = Math.round((filled / TOTAL_QUESTIONS) * 100);
    var fill = document.getElementById('progressFill');
    var label = document.getElementById('progressLabel');
    if (fill) fill.style.width = pct + '%';
    if (label) {
      label.textContent = I18N.progressTpl
        .replace('__N__', String(filled))
        .replace('__T__', String(TOTAL_QUESTIONS));
    }
  }
  updateProgress();

  // ----- Validation & submit -----
  var form = document.getElementById('surveyForm');
  var submitBtn = document.getElementById('submitBtn');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstError = null;
      document.querySelectorAll('.q-card.error').forEach(function (c) { c.classList.remove('error', 'shake'); });

      REQUIRED_IDS.forEach(function (qid) {
        var v = state[qid];
        if (v == null || String(v).trim() === '') {
          var card = document.querySelector('.q-' + qid);
          if (card) {
            card.classList.add('error', 'shake');
            if (!firstError) firstError = card;
          }
        }
      });

      if ((state.q20_contact || '').toLowerCase() === 'ja') {
        var emailEl = document.getElementById('q20_email');
        var em = emailEl ? emailEl.value.trim() : '';
        if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
          var card = document.querySelector('.q-q20_contact');
          if (card) {
            card.classList.add('error', 'shake');
            if (!firstError) firstError = card;
          }
        }
      }

      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(function () { firstError.classList.remove('shake'); }, 500);
        return;
      }

      // ── Dynamische payload-opbouw ──────────────────────────
      // We bouwen een open `answers`-bag: voor elke .q-card op de
      // pagina nemen we de waarde uit state. Numerieke vragen
      // worden naar Number geparset; de rest blijft string of null.
      // De server (validateSurveyAnswers) doet de echte type-check.
      var answers = {};
      ALL_QIDS.forEach(function (qid) {
        var raw = state[qid];
        var card = document.querySelector('.q-card[data-qid="' + qid + '"]');
        var qtype = card ? (card.getAttribute('data-type') || card.getAttribute('data-qtype') || '') : '';
        if (raw == null || raw === '') {
          answers[qid] = null;
          return;
        }
        if (qtype === 'nps' || qtype === 'scale') {
          var n = parseInt(raw, 10);
          answers[qid] = Number.isFinite(n) ? n : null;
        } else {
          answers[qid] = String(raw);
        }
      });

      // q20_email zit niet in state (apart input-veld); voeg expliciet
      // toe wanneer q20_contact = ja. Generiek: elk *_email-veld dat
      // op de pagina staat én niet via state komt, even meenemen.
      document.querySelectorAll('input[type="email"]').forEach(function (el) {
        if (el.classList.contains('honeypot')) return;
        var code = el.getAttribute('data-qcode') || el.name || el.id;
        if (!code) return;
        var v = (el.value || '').trim();
        // Alleen overschrijven als er een waarde is, zodat we per
        // ongeluk geen lege string boven een ingevulde state zetten.
        if (v) answers[code] = v;
      });

      var payload = {
        website: document.getElementById('website') ? document.getElementById('website').value : '',
        lang: I18N.lang || 'nl',
        answers: answers,
      };

      // Multi-survey: include survey identification when present
      var sId = document.getElementById('survey_id');
      var bp = document.getElementById('brand_prefix');
      var ss = document.getElementById('survey_slug');
      if (sId && sId.value) payload.survey_id = parseInt(sId.value, 10);
      if (bp && bp.value) payload.brand_prefix = bp.value;
      if (ss && ss.value) payload.survey_slug = ss.value;

      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = I18N.submitting;

      fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
      }).then(function (res) {
        if (res.ok) {
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          window.location.href = I18N.thanksUrl;
        } else {
          var msg = res.body && res.body.error ? res.body.error : I18N.unknown;
          if (res.status === 429) msg = I18N.rateLimit;
          alert(I18N.something + msg);
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = I18N.submit;
        }
      }).catch(function (err) {
        alert(I18N.network + (err && err.message ? err.message : I18N.unknown));
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = I18N.submit;
      });
    });
  }

  // ----- Sneltoets Ctrl+Shift+A → /admin -----
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
      e.preventDefault();
      window.location.href = '/admin';
    }
  });
})();
