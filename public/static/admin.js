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

  // ============================================================
  // ===== AI ANALYSIS SECTION ===================================
  // ============================================================
  var aiState = { lang: 'nl', payload: null, generating: false };

  var aiContent  = document.getElementById('aiContent');
  var aiMeta     = document.getElementById('aiMeta');
  var aiRefresh  = document.getElementById('aiRefreshBtn');
  var aiLangBtns = document.querySelectorAll('.ai-lang-btn');

  var AI_TEXTS = {
    nl: {
      empty:    'Klik op "Genereer analyse" om de eerste analyse te starten.',
      generate: '✨ Genereer AI-analyse',
      hint:     'GPT-4o-mini (OpenAI) leest alle responses en formuleert sterktes, verbeterpunten en concrete suggesties voor Reeks II. Resultaat wordt 24u gecached.',
      loading:  'AI genereert de analyse… dit duurt ongeveer 8 seconden.',
      meta:     function (n, dt, cached, provider) { return 'Op basis van ' + n + ' responses · gegenereerd ' + dt + (cached ? ' · uit cache' : ' · vers') + (provider ? ' · ' + provider : ''); },
      summary:  'Samenvatting',
      strong:   'Sterke punten',
      improve:  'Verbeterpunten',
      suggest:  'Suggesties voor Reeks II',
      quotes:   'Onderbouwende citaten',
      noData:   'Nog geen responses om te analyseren.',
      error:    'Analyse mislukt: ',
      refreshTitle: 'Genereer een nieuwe analyse'
    },
    en: {
      empty:    'Click "Generate analysis" to run the first analysis.',
      generate: '✨ Generate AI analysis',
      hint:     'GPT-4o-mini (OpenAI) reads all responses and formulates strengths, areas for improvement and concrete suggestions for Series II. Cached for 24 hours.',
      loading:  'AI is generating the analysis… this takes about 8 seconds.',
      meta:     function (n, dt, cached, provider) { return 'Based on ' + n + ' responses · generated ' + dt + (cached ? ' · from cache' : ' · fresh') + (provider ? ' · ' + provider : ''); },
      summary:  'Summary',
      strong:   'Strengths',
      improve:  'Areas for improvement',
      suggest:  'Suggestions for Series II',
      quotes:   'Supporting quotes',
      noData:   'No responses to analyse yet.',
      error:    'Analysis failed: ',
      refreshTitle: 'Generate a new analysis'
    }
  };

  function aiT() { return AI_TEXTS[aiState.lang]; }

  function fmtDate(s) {
    if (!s) return '';
    var d = new Date(s.replace(' ', 'T') + (s.indexOf('Z') === -1 && s.indexOf('+') === -1 ? 'Z' : ''));
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString(aiState.lang === 'nl' ? 'nl-BE' : 'en-GB', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]; }); }

  function renderEmpty() {
    aiContent.innerHTML =
      '<div class="ai-empty">' +
        '<button type="button" id="aiGenerateBtn" class="btn btn-teal">' + aiT().generate + '</button>' +
        '<p class="ai-hint">' + aiT().hint + '</p>' +
      '</div>';
    aiMeta.textContent = aiT().empty;
    var btn = document.getElementById('aiGenerateBtn');
    if (btn) btn.addEventListener('click', function () { generate(false); });
  }

  function renderLoading() {
    aiContent.innerHTML =
      '<div class="ai-loading">' +
        '<div class="pdf-spinner" aria-hidden="true"></div>' +
        '<span>' + aiT().loading + '</span>' +
      '</div>';
    aiMeta.textContent = '';
  }

  function renderError(msg) {
    aiContent.innerHTML = '<div class="ai-error">' + escapeHtml(aiT().error + msg) + '</div>';
  }

  function renderAnalysis(payload, fromCache) {
    if (!payload) return renderEmpty();
    var html = '';

    if (payload.samenvatting) {
      html += '<div class="ai-summary"><h3 style="margin:0 0 10px;font-family:\'Playfair Display\',serif;font-style:italic;color:var(--teal-dark);font-size:18px;">' + escapeHtml(aiT().summary) + '</h3>' +
              '<p style="margin:0;">' + escapeHtml(payload.samenvatting) + '</p></div>';
    }

    function listBlock(cls, title, arr, titleKey, evidenceKey) {
      if (!arr || !arr.length) return '';
      var s = '<div class="ai-block ' + cls + '"><h3>' + escapeHtml(title) + '</h3><ul class="ai-list">';
      arr.forEach(function (it) {
        s += '<li>' +
               '<span class="ai-title">' + escapeHtml(it[titleKey] || '') + '</span>' +
               '<span class="ai-evidence">' + escapeHtml(it[evidenceKey] || '') + '</span>' +
             '</li>';
      });
      s += '</ul></div>';
      return s;
    }

    html += listBlock('ai-strong',  aiT().strong,  payload.sterke_punten,     'punt',  'bewijs');
    html += listBlock('ai-improve', aiT().improve, payload.verbeterpunten,    'punt',  'bewijs');
    html += listBlock('ai-suggest', aiT().suggest, payload.suggesties_reeks2, 'titel', 'beschrijving');

    if (payload.citaten && payload.citaten.length) {
      html += '<div class="ai-block ai-quotes"><h3>' + escapeHtml(aiT().quotes) + '</h3>';
      payload.citaten.forEach(function (q) {
        var cls = q.sentiment === 'positief' ? 'pos' : (q.sentiment === 'kritisch' ? 'neg' : 'neu');
        html += '<div class="ai-quote ' + cls + '">' +
                  '"' + escapeHtml(q.tekst) + '"' +
                  '<span class="ai-quote-meta">' + escapeHtml(q.vraag || '') + ' · ' + escapeHtml(q.sentiment || '') + '</span>' +
                '</div>';
      });
      html += '</div>';
    }

    aiContent.innerHTML = html || '<p>—</p>';
    aiMeta.textContent = aiT().meta(payload.response_count || 0, fmtDate(payload.generated_at), !!fromCache, payload.provider || '');
  }

  function generate(force) {
    if (aiState.generating) return;
    if (!state.responses || state.responses.length === 0) {
      aiMeta.textContent = aiT().noData;
      renderEmpty();
      return;
    }
    aiState.generating = true;
    renderLoading();
    var url = '/api/admin/analyze?lang=' + aiState.lang + (force ? '&force=1' : '');
    fetch(url, { method: 'POST', credentials: 'same-origin' })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); })
      .then(function (res) {
        aiState.generating = false;
        if (!res.ok || !res.body || !res.body.analysis) {
          renderError((res.body && (res.body.message || res.body.error)) || ('HTTP ' + res.status));
          return;
        }
        aiState.payload = res.body.analysis;
        renderAnalysis(res.body.analysis, !!res.body.cached);
      })
      .catch(function (err) {
        aiState.generating = false;
        renderError(err && err.message ? err.message : 'network error');
      });
  }

  function loadCached() {
    fetch('/api/admin/analyze?lang=' + aiState.lang, { credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j && j.analysis) {
          aiState.payload = j.analysis;
          renderAnalysis(j.analysis, true);
        } else {
          aiState.payload = null;
          renderEmpty();
        }
      })
      .catch(function () { renderEmpty(); });
  }

  aiLangBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var lang = btn.getAttribute('data-lang');
      if (lang === aiState.lang) return;
      aiLangBtns.forEach(function (b) { b.classList.toggle('active', b === btn); });
      aiState.lang = lang;
      loadCached();
    });
  });

  if (aiRefresh) {
    aiRefresh.title = aiT().refreshTitle;
    aiRefresh.addEventListener('click', function () { generate(true); });
  }

  // initial cached load (after a short delay to let main data load first)
  setTimeout(loadCached, 800);

  // ============================================================
  // ===== PDF GENERATION =======================================
  // ============================================================
  var pdfBtn     = document.getElementById('pdfBtn');
  var pdfOverlay = document.getElementById('pdfOverlay');
  var pdfMsg     = document.getElementById('pdfOverlayMsg');

  function showOverlay(msg) {
    if (!pdfOverlay) return;
    pdfMsg.textContent = msg || 'PDF wordt gegenereerd…';
    pdfOverlay.hidden = false;
  }
  function hideOverlay() { if (pdfOverlay) pdfOverlay.hidden = true; }

  function loadHtml2Pdf() {
    if (window.html2pdf) return Promise.resolve(window.html2pdf);
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.2/html2pdf.bundle.min.js';
      s.onload = function () { resolve(window.html2pdf); };
      s.onerror = function () { reject(new Error('Kon html2pdf.js niet laden')); };
      document.head.appendChild(s);
    });
  }

  function buildCoverNode() {
    var n = state.responses ? state.responses.length : 0;
    var nps = (state.stats && state.stats.nps) ? state.stats.nps.score : 0;
    var d = new Date();
    var dateStr = d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'long', year: 'numeric' });
    var lang = aiState.lang;
    var title = lang === 'en' ? 'Survey report — Series I' : 'Surveyrapport — Reeks I';
    var sub   = lang === 'en' ? 'House concerts · Jos van Immerseel & Ayako Ito' : 'Huiskamerconcerten · Jos van Immerseel & Ayako Ito';
    var lblResp = lang === 'en' ? 'Responses' : 'Responses';
    var lblNps  = 'NPS';
    var lblDate = lang === 'en' ? 'Date' : 'Datum';
    var div = document.createElement('section');
    div.className = 'pdf-cover';
    div.innerHTML =
      '<span class="pdf-cover-badge italic-serif">Pensato.org</span>' +
      '<h1>' + escapeHtml(title) + '</h1>' +
      '<p class="pdf-cover-sub">' + escapeHtml(sub) + '</p>' +
      '<div class="pdf-cover-meta">' +
        '<div><strong>' + n + '</strong>' + escapeHtml(lblResp) + '</div>' +
        '<div><strong>' + nps + '</strong>' + escapeHtml(lblNps) + '</div>' +
        '<div><strong>' + escapeHtml(dateStr) + '</strong>' + escapeHtml(lblDate) + '</div>' +
      '</div>' +
      '<p class="pdf-cover-credit">' + escapeHtml(lang === 'en' ? 'Generated by the Pensato.org survey dashboard' : 'Gegenereerd door het Pensato.org surveydashboard') + '</p>';
    return div;
  }

  function generatePdf() {
    if (!state.responses) { alert('Nog geen data geladen.'); return; }

    showOverlay('PDF wordt gegenereerd…');

    var ensureAnalysis = aiState.payload
      ? Promise.resolve()
      : new Promise(function (resolve) {
          showOverlay('AI-analyse wordt gegenereerd…');
          fetch('/api/admin/analyze?lang=' + aiState.lang, { method: 'POST', credentials: 'same-origin' })
            .then(function (r) { return r.json(); })
            .then(function (j) {
              if (j && j.analysis) {
                aiState.payload = j.analysis;
                renderAnalysis(j.analysis, !!j.cached);
              }
              resolve();
            })
            .catch(function () { resolve(); });
        });

    ensureAnalysis.then(function () {
      return loadHtml2Pdf();
    }).then(function (html2pdf) {
      showOverlay('PDF wordt gerenderd…');

      var main = document.querySelector('.admin-main');
      if (!main) throw new Error('admin-main niet gevonden');

      // Insert cover at top
      var cover = buildCoverNode();
      main.insertBefore(cover, main.firstChild);

      // Switch body to pdf mode for hiding non-print elements
      document.body.classList.add('pdf-rendering');

      // Filename
      var d = new Date();
      var iso = d.toISOString().slice(0, 10);
      var fname = 'huiskamerconcerten-rapport-' + iso + '.pdf';

      // A4 landscape = 297mm x 210mm. With 10mm side margins, content area = 277mm.
      // Render at 1400px wide so html2canvas captures the full dashboard layout
      // and html2pdf scales it down to fit the page width.
      var opt = {
        margin:       [10, 10, 12, 10], // mm: top, right, bottom, left
        filename:     fname,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FBF8F2',
          windowWidth: 1400,
          width: 1400,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
        pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
      };

      return html2pdf().set(opt).from(main).save()
        .then(function () {
          document.body.classList.remove('pdf-rendering');
          if (cover.parentNode) cover.parentNode.removeChild(cover);
          hideOverlay();
        })
        .catch(function (e) {
          document.body.classList.remove('pdf-rendering');
          if (cover.parentNode) cover.parentNode.removeChild(cover);
          hideOverlay();
          throw e;
        });
    }).catch(function (e) {
      hideOverlay();
      alert('PDF mislukt: ' + (e && e.message ? e.message : e));
    });
  }

  if (pdfBtn) pdfBtn.addEventListener('click', generatePdf);
})();
