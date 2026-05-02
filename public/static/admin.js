/* Admin dashboard — vanilla JS, fetch /api/admin/responses elke 30s */
(function () {
  'use strict';

  var QUESTIONS_OPEN = [
    { id: 'q2_blijft_bij', label: 'Q2 — Wat blijft je bij' },
    { id: 'q5_sfeer_open', label: 'Q5 — Sfeer' },
    { id: 'q7_fortepiano', label: 'Q7 — Fortepiano' },
    { id: 'q9_favoriet',   label: 'Q9 — Favoriet concert' },
    { id: 'q11_gesprek',   label: 'Q11 — Ruimte gesprek' },
    { id: 'q13_catering',  label: 'Q13 — Catering' },
    { id: 'q15_wensen_2',  label: 'Q15 — Wensen Reeks II' },
    { id: 'q16_gasten',    label: 'Q16 — Gewenste gasten' },
    { id: 'q17_terugkomen',label: 'Q17 — Terugkomen' },
    { id: 'q18_overige',   label: 'Q18 — Overige' }
  ];
  var SCALE_QS = [
    { id: 'q4_sfeer',       label: 'Q4 · Sfeer huiskamer' },
    { id: 'q6_akoestiek',   label: 'Q6 · Akoestiek' },
    { id: 'q8_repertoire',  label: 'Q8 · Repertoire' },
    { id: 'q10_interactie', label: 'Q10 · Jos · interactie' },
    { id: 'q12_communic',   label: 'Q12 · Communicatie' },
    { id: 'q14_bijdrage',   label: 'Q14 · Bijdrage-model' }
  ];
  var ALL_QUESTIONS_LABELS = {
    submitted_at:'Verstuurd op', q1_nps:'Q1 · NPS (0-10)', q2_blijft_bij:'Q2 · Blijft bij',
    q3_aantal:'Q3 · # concerten',
    q4_sfeer:'Q4 · Sfeer (1-5)', q5_sfeer_open:'Q5 · Sfeer toelichting',
    q6_akoestiek:'Q6 · Akoestiek (1-5)', q7_fortepiano:'Q7 · Fortepiano',
    q8_repertoire:'Q8 · Repertoire (1-5)', q9_favoriet:'Q9 · Favoriet concert',
    q10_interactie:'Q10 · Interactie Jos (1-5)', q11_gesprek:'Q11 · Ruimte gesprek',
    q12_communic:'Q12 · Communicatie (1-5)', q13_catering:'Q13 · Catering',
    q14_bijdrage:'Q14 · Bijdrage (1-5)',
    q15_wensen_2:'Q15 · Wensen Reeks II', q16_gasten:'Q16 · Gewenste gasten',
    q17_terugkomen:'Q17 · Terugkomen', q18_overige:'Q18 · Overige',
    q19_naam:'Q19 · Naam', q20_contact:'Q20 · Contact?', q20_email:'Q20 · E-mail'
  };

  var state = { responses: [], stats: null, activeOpenTab: 'q15_wensen_2', search: '', sortKey: 'submitted_at', sortDir: 'desc' };

  function fmtNL(iso) {
    if (!iso) return '';
    var s = String(iso).replace(' ', 'T');
    if (!/Z|[+\-]\d\d:?\d\d$/.test(s)) s += 'Z';
    var d = new Date(s);
    if (isNaN(d.getTime())) return iso;
    var pad = function (n) { return String(n).padStart(2, '0'); };
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
    });
  }

  function renderKpis(stats) {
    var npsClass = stats.nps.score >= 50 ? 'promoter' : stats.nps.score < 0 ? 'detractor' : 'passive';
    var html = ''
      + kpi('Totaal responses', stats.total, '')
      + kpi('NPS-score', stats.nps.score, stats.nps.promoters + ' prom · ' + stats.nps.passives + ' pass · ' + stats.nps.detractors + ' detr', npsClass)
      + kpi('Sfeer (Q4)', stats.averages.q4_sfeer.toFixed(2), '/ 5')
      + kpi('Akoestiek (Q6)', stats.averages.q6_akoestiek.toFixed(2), '/ 5')
      + kpi('Repertoire (Q8)', stats.averages.q8_repertoire.toFixed(2), '/ 5')
      + kpi('Jos · interactie (Q10)', stats.averages.q10_interactie.toFixed(2), '/ 5');
    document.getElementById('kpiGrid').innerHTML = html;
  }

  function kpi(label, value, sub, cls) {
    return '<div class="kpi-card">'
      + '<div class="kpi-label">' + escapeHtml(label) + '</div>'
      + '<div class="kpi-value' + (cls ? ' ' + cls : '') + '">' + escapeHtml(String(value)) + '</div>'
      + (sub ? '<div class="kpi-sub">' + escapeHtml(sub) + '</div>' : '')
      + '</div>';
  }

  function renderScoresChart(avgs) {
    var html = SCALE_QS.map(function (q) {
      var v = avgs[q.id] || 0;
      var pct = (v / 5) * 100;
      return '<div class="bar-row">'
        + '<div class="bar-label">' + escapeHtml(q.label) + '</div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>'
        + '<div class="bar-value">' + v.toFixed(2) + '</div>'
        + '</div>';
    }).join('');
    document.getElementById('scoresChart').innerHTML = html || '<div class="empty">Nog geen data.</div>';
  }

  function renderNpsChart(nps) {
    var max = Math.max.apply(null, nps.distribution.concat([1]));
    var html = '<div class="nps-bar">' + nps.distribution.map(function (count, i) {
      var cls = i <= 6 ? 'detractor' : i <= 8 ? 'passive' : 'promoter';
      var pct = (count / max) * 100;
      return '<div class="nps-col">'
        + '<div class="nps-col-count">' + count + '</div>'
        + '<div class="nps-col-bar ' + cls + '" style="height:' + pct.toFixed(1) + '%"></div>'
        + '<div class="nps-col-num">' + i + '</div>'
        + '</div>';
    }).join('') + '</div>';
    document.getElementById('npsChart').innerHTML = html;
  }

  function renderAttendance(counts) {
    var labels = ['1','2','3','4','5','alle 6'];
    var max = Math.max.apply(null, labels.map(function (k) { return counts[k] || 0; }).concat([1]));
    var html = labels.map(function (k) {
      var c = counts[k] || 0;
      var pct = (c / max) * 100;
      return '<div class="bar-row">'
        + '<div class="bar-label">' + escapeHtml(k) + ' concert' + (k === '1' ? '' : 'en') + '</div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>'
        + '<div class="bar-value">' + c + '</div>'
        + '</div>';
    }).join('');
    document.getElementById('attendanceChart').innerHTML = html;
  }

  function renderOpenTabs() {
    var html = QUESTIONS_OPEN.map(function (q) {
      var n = state.responses.filter(function (r) { return r[q.id] && String(r[q.id]).trim() !== ''; }).length;
      var active = state.activeOpenTab === q.id ? ' active' : '';
      return '<button type="button" class="tab' + active + '" data-tab="' + q.id + '">' + escapeHtml(q.label) + '<span class="tab-badge">' + n + '</span></button>';
    }).join('');
    document.getElementById('openTabs').innerHTML = html;
    document.querySelectorAll('#openTabs .tab').forEach(function (t) {
      t.addEventListener('click', function () {
        state.activeOpenTab = t.getAttribute('data-tab');
        renderOpenTabs();
        renderOpenContent();
      });
    });
  }

  function renderOpenContent() {
    var qid = state.activeOpenTab;
    var search = state.search.trim().toLowerCase();
    var quotes = state.responses
      .filter(function (r) { return r[qid] && String(r[qid]).trim() !== ''; })
      .filter(function (r) {
        if (!search) return true;
        return String(r[qid]).toLowerCase().indexOf(search) !== -1
            || String(r.q19_naam || '').toLowerCase().indexOf(search) !== -1;
      })
      .map(function (r) {
        var name = (r.q19_naam && r.q19_naam.trim()) ? r.q19_naam : 'Anoniem';
        return '<div class="quote">'
          + escapeHtml(r[qid])
          + '<span class="quote-meta">— ' + escapeHtml(name) + ' · ' + escapeHtml(fmtNL(r.submitted_at)) + ' · NPS ' + r.q1_nps + '</span>'
          + '</div>';
      }).join('');
    document.getElementById('openContent').innerHTML = quotes || '<div class="empty">Geen antwoorden voor deze vraag.</div>';
  }

  function renderTable() {
    var rows = state.responses.slice();
    rows.sort(function (a, b) {
      var ka = a[state.sortKey], kb = b[state.sortKey];
      if (ka == null && kb == null) return 0;
      if (ka == null) return 1;
      if (kb == null) return -1;
      if (ka < kb) return state.sortDir === 'asc' ? -1 : 1;
      if (ka > kb) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    var html = rows.map(function (r) {
      return '<tr data-id="' + r.id + '">'
        + '<td>' + escapeHtml(fmtNL(r.submitted_at)) + '</td>'
        + '<td><strong>' + r.q1_nps + '</strong></td>'
        + '<td>' + escapeHtml(r.q3_aantal) + '</td>'
        + '<td>' + r.q4_sfeer + '</td>'
        + '<td>' + r.q6_akoestiek + '</td>'
        + '<td>' + r.q8_repertoire + '</td>'
        + '<td>' + r.q10_interactie + '</td>'
        + '<td>' + r.q12_communic + '</td>'
        + '<td>' + r.q14_bijdrage + '</td>'
        + '<td>' + escapeHtml(r.q19_naam || '—') + '</td>'
        + '</tr>';
    }).join('');
    document.getElementById('dataBody').innerHTML = html || '<tr><td colspan="10" class="empty">Nog geen responses.</td></tr>';
    document.querySelectorAll('#dataBody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openModal(tr.getAttribute('data-id')); });
    });
  }

  function openModal(id) {
    var r = state.responses.find(function (x) { return x.id === id; });
    if (!r) return;
    var rows = Object.keys(ALL_QUESTIONS_LABELS).map(function (k) {
      var v = k === 'submitted_at' ? fmtNL(r[k]) : r[k];
      return '<div class="modal-row"><div class="k">' + escapeHtml(ALL_QUESTIONS_LABELS[k]) + '</div><div class="v">' + escapeHtml(v == null || v === '' ? '—' : String(v)) + '</div></div>';
    }).join('');
    document.getElementById('modalContent').innerHTML = ''
      + '<button class="modal-close" type="button" id="modalClose">×</button>'
      + '<h2 style="font-style:italic;">Response detail</h2>'
      + '<p style="color:#888;font-size:13px;font-family:Playfair Display,serif;font-style:italic;">id: ' + escapeHtml(r.id) + '</p>'
      + rows;
    document.getElementById('modalBackdrop').classList.add('open');
    document.getElementById('modalClose').addEventListener('click', closeModal);
  }
  function closeModal() { document.getElementById('modalBackdrop').classList.remove('open'); }
  document.getElementById('modalBackdrop').addEventListener('click', function (e) {
    if (e.target.id === 'modalBackdrop') closeModal();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

  // Sorting
  document.querySelectorAll('#dataTable th[data-sort]').forEach(function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sortKey === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = k; state.sortDir = 'desc'; }
      renderTable();
    });
  });

  // Search
  document.getElementById('openSearch').addEventListener('input', function (e) {
    state.search = e.target.value;
    renderOpenContent();
  });

  // Refresh
  document.getElementById('refreshBtn').addEventListener('click', loadData);

  // Delete all
  document.getElementById('deleteAllBtn').addEventListener('click', function () {
    var first = prompt('Type "WIS" om alle responses te verwijderen. Dit kan niet ongedaan gemaakt worden.');
    if (first !== 'WIS') return;
    fetch('/api/admin/responses', { method: 'DELETE' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        alert('Verwijderd: ' + (j.deleted || 0) + ' responses');
        loadData();
      });
  });

  function loadData() {
    fetch('/api/admin/responses', { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.href = '/admin/login'; return null; }
        return r.json();
      })
      .then(function (j) {
        if (!j) return;
        state.responses = j.responses || [];
        state.stats = j.stats;
        renderKpis(j.stats);
        renderScoresChart(j.stats.averages);
        renderNpsChart(j.stats.nps);
        renderAttendance(j.stats.attendanceCounts);
        renderOpenTabs();
        renderOpenContent();
        renderTable();
      });
  }

  loadData();
  setInterval(loadData, 30000);
})();
