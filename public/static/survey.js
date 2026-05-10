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

  var REQUIRED_IDS = ['q1_nps','q3_aantal','q4_sfeer','q6_akoestiek','q8_repertoire','q10_interactie','q12_communic','q14_bijdrage'];
  var TOTAL_QUESTIONS = 20;
  var STORAGE_KEY = 'survey_huiskamer_draft_v1_' + I18N.lang;

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

      var payload = {
        website: document.getElementById('website') ? document.getElementById('website').value : '',
        lang: I18N.lang || 'nl',
        q1_nps: parseInt(state.q1_nps, 10),
        q2_blijft_bij: state.q2_blijft_bij || null,
        q3_aantal: state.q3_aantal,
        q4_sfeer: parseInt(state.q4_sfeer, 10),
        q5_sfeer_open: state.q5_sfeer_open || null,
        q6_akoestiek: parseInt(state.q6_akoestiek, 10),
        q7_fortepiano: state.q7_fortepiano || null,
        q8_repertoire: parseInt(state.q8_repertoire, 10),
        q9_favoriet: state.q9_favoriet || null,
        q10_interactie: parseInt(state.q10_interactie, 10),
        q11_gesprek: state.q11_gesprek || null,
        q12_communic: parseInt(state.q12_communic, 10),
        q13_catering: state.q13_catering || null,
        q14_bijdrage: parseInt(state.q14_bijdrage, 10),
        q15_wensen_2: state.q15_wensen_2 || null,
        q16_gasten: state.q16_gasten || null,
        q17_terugkomen: state.q17_terugkomen || null,
        q18_overige: state.q18_overige || null,
        q19_naam: state.q19_naam || null,
        q20_contact: state.q20_contact || null,
        q20_email: (state.q20_contact && state.q20_contact.toLowerCase() === 'ja')
          ? (document.getElementById('q20_email') ? document.getElementById('q20_email').value.trim() : null)
          : null
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
