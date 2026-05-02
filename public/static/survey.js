/* Survey client-side logic — vanilla JS, geen framework */
(function () {
  'use strict';

  var REQUIRED_IDS = ['q1_nps','q3_aantal','q4_sfeer','q6_akoestiek','q8_repertiore','q10_interactie','q12_communic','q14_bijdrage'];
  // typo guard — fix to actual id
  REQUIRED_IDS = ['q1_nps','q3_aantal','q4_sfeer','q6_akoestiek','q8_repertoire','q10_interactie','q12_communic','q14_bijdrage'];
  var TOTAL_QUESTIONS = 20;
  var STORAGE_KEY = 'survey_huiskamer_draft_v1';

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
      // mark scale or choice button selected
      var btns = document.querySelectorAll('[data-q="' + qid + '"]');
      btns.forEach(function (b) {
        if (b.getAttribute('data-v') === String(val)) b.classList.add('selected');
      });
      // Conditional email field
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
      var v = btn.getAttribute('data-v');
      // Deselect siblings
      document.querySelectorAll('[data-q="' + qid + '"]').forEach(function (s) {
        s.classList.remove('selected');
      });
      btn.classList.add('selected');

      // Choice: store lowercase for ja/nee, raw otherwise
      var stored = v;
      if (qid === 'q20_contact') stored = v.toLowerCase();
      setValue(qid, stored);

      // Conditional email field
      if (qid === 'q20_contact') {
        var box = document.getElementById('cond_q20_email');
        if (box) box.style.display = stored === 'ja' ? 'block' : 'none';
      }

      // Clear error
      var card = btn.closest('.q-card');
      if (card) card.classList.remove('error', 'shake');
    });
  });

  // ----- Free text inputs -----
  document.querySelectorAll('input[type="text"], input[type="email"], textarea').forEach(function (el) {
    if (el.classList.contains('honeypot')) return;
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
    if (label) label.textContent = filled + ' van ' + TOTAL_QUESTIONS + ' ingevuld';
  }
  updateProgress();

  // ----- Validation & submit -----
  var form = document.getElementById('surveyForm');
  var submitBtn = document.getElementById('submitBtn');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstError = null;
      // clear old errors
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

      // Conditional: if q20_contact = ja, email must be valid
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

      // Build payload
      var payload = {
        website: document.getElementById('website') ? document.getElementById('website').value : '',
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

      submitBtn.disabled = true;
      submitBtn.querySelector('span').textContent = 'Versturen…';

      fetch('/api/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; });
      }).then(function (res) {
        if (res.ok) {
          try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
          window.location.href = '/dank-je';
        } else {
          var msg = res.body && res.body.error ? res.body.error : 'onbekende fout';
          if (res.status === 429) msg = 'Te veel pogingen — probeer later opnieuw.';
          alert('Er ging iets mis: ' + msg);
          submitBtn.disabled = false;
          submitBtn.querySelector('span').textContent = 'Verstuur antwoorden';
        }
      }).catch(function (err) {
        alert('Netwerkfout: ' + (err && err.message ? err.message : 'onbekend'));
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Verstuur antwoorden';
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
