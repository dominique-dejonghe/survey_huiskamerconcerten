/* Admin dashboard — vanilla JS, fetch /api/admin/responses elke 30s */
(function () {
  'use strict';

  // ============================================================
  // Survey-bewuste dashboard-state
  // ============================================================
  // Sinds 2026-05 zijn deze drie lijsten NIET meer hard-coded voor Reeks I.
  // Ze worden bij elke API-call opgebouwd uit data.questions (de per-survey
  // snapshot uit survey_questions). Zo gebruikt het Ebdiepconcert-1 dashboard
  // alleen zijn eigen vragen, met de juiste labels en zonder spook-Q14.
  var QUESTIONS_OPEN = [];      // [{ id, label }]  — text/paragraph vragen
  var SCALE_QS = [];            // [{ id, label, max }] — afgeleid uit stats.scaleAverages
  var CHOICE_QS = [];           // [{ id, label, options:[{value,count}] }]
  var ALL_QUESTIONS_LABELS = {  // gebruikt door de detail-modal (kolom-namen voor ruwe data)
    submitted_at: 'Verstuurd op',
  };
  /** Lijst met data-sort kolommen voor de ruwe-data tabel — wordt dynamisch ingevuld. */
  var TABLE_COLS = [{ id: 'submitted_at', label: 'Datum', kind: 'date' }];

  var state = { responses: [], stats: null, activeOpenTab: '', search: '', sortKey: 'submitted_at', sortDir: 'desc' };

  /**
   * Lees het antwoord op een vraagcode uit een response-row.
   * Voorrang: answers_json (nieuwe pipeline) → legacy q* kolom (Reeks I).
   * Geeft '' (lege string) als de vraag niet beantwoord is, zodat sort/filter
   * werken zonder null-checks overal.
   */
  function getAns(row, code) {
    if (!row) return '';
    // 1) answers_json — al geparsed in row.__answers door normalizeRows()
    if (row.__answers && Object.prototype.hasOwnProperty.call(row.__answers, code)) {
      var v = row.__answers[code];
      if (v == null) return '';
      return v;
    }
    // 2) legacy kolom (q1_nps..q20_email)
    if (code in row) {
      var v2 = row[code];
      return v2 == null ? '' : v2;
    }
    return '';
  }

  /** Parse answers_json éénmalig per row en cache het in row.__answers. */
  function normalizeRows(rows) {
    rows.forEach(function (r) {
      if (r.__answers) return; // al gedaan
      var a = {};
      if (r.answers_json) {
        try {
          var p = JSON.parse(r.answers_json);
          if (p && typeof p === 'object' && !Array.isArray(p)) a = p;
        } catch (e) { /* ignore — fall back to legacy cols */ }
      }
      r.__answers = a;
    });
  }

  /**
   * Bouw de dynamische lijsten op uit het API-antwoord (data.questions + data.stats).
   * Wordt aangeroepen bij elke loadData() — survey-bewust en zonder hard-coded codes.
   */
  function rebuildQuestionLists(questions, stats) {
    questions = questions || [];
    QUESTIONS_OPEN = [];
    SCALE_QS = [];
    CHOICE_QS = [];
    ALL_QUESTIONS_LABELS = { submitted_at: 'Verstuurd op' };
    TABLE_COLS = [{ id: 'submitted_at', label: 'Datum', kind: 'date' }];

    // Map scale-averages by code voor snelle lookup
    var avgByCode = {};
    (stats && stats.scaleAverages ? stats.scaleAverages : []).forEach(function (s) { avgByCode[s.code] = s; });

    questions.forEach(function (q) {
      ALL_QUESTIONS_LABELS[q.code] = q.code.toUpperCase() + ' · ' + q.label_nl;
      if (q.type === 'nps') {
        // NPS krijgt zijn eigen sectie boven; geen kolom in scoresChart.
        TABLE_COLS.push({ id: q.code, label: 'NPS', kind: 'num' });
      } else if (q.type === 'scale') {
        SCALE_QS.push({
          id: q.code,
          label: q.code.toUpperCase() + ' · ' + q.label_nl,
          max: (q.scale_max != null ? q.scale_max : 5),
        });
        TABLE_COLS.push({ id: q.code, label: shortLabel(q.label_nl), kind: 'num' });
      } else if (q.type === 'choice') {
        TABLE_COLS.push({ id: q.code, label: shortLabel(q.label_nl), kind: 'text' });
      } else if (q.type === 'text' || q.type === 'paragraph') {
        QUESTIONS_OPEN.push({ id: q.code, label: q.code.toUpperCase() + ' — ' + q.label_nl });
        // Tekstvragen niet in tabel (te lang); user kan via modal alles zien.
        // Uitzondering: korte tekst-vragen die typisch een naam zijn (heuristiek: code
        // bevat 'naam' / 'name') tonen we wél als laatste kolom, want dat is handig.
        if (/naam|name/i.test(q.code)) {
          TABLE_COLS.push({ id: q.code, label: 'Naam', kind: 'text' });
        }
      }
    });

    // Choice-breakdowns uit stats — bewaren voor renderChoiceCharts()
    CHOICE_QS = (stats && stats.choiceBreakdowns ? stats.choiceBreakdowns : []).map(function (c) {
      return { id: c.code, label: c.label_nl, options: c.options };
    });

    // Zorg dat activeOpenTab geldig is (na survey-switch of bij eerste load)
    if (QUESTIONS_OPEN.length > 0) {
      var hasActive = QUESTIONS_OPEN.some(function (q) { return q.id === state.activeOpenTab; });
      if (!hasActive) state.activeOpenTab = QUESTIONS_OPEN[0].id;
    } else {
      state.activeOpenTab = '';
    }

    // Zorg dat sortKey nog steeds bestaat in TABLE_COLS, anders terugvallen op datum
    var sortKeyExists = TABLE_COLS.some(function (c) { return c.id === state.sortKey; });
    if (!sortKeyExists) { state.sortKey = 'submitted_at'; state.sortDir = 'desc'; }
  }

  /** Kort label voor tabel-headers — max ~12 tekens, anders ellipsis. */
  function shortLabel(s) {
    s = String(s || '');
    // Knip op eerste komma/aanhalingsteken/punt, of harde lengte 14.
    var idx = s.search(/[,?.\(\)\u2014\u2013]/);
    if (idx > 0 && idx <= 18) s = s.slice(0, idx);
    s = s.trim();
    if (s.length > 14) s = s.slice(0, 13) + '…';
    return s;
  }

  // ====== Multi-survey scope ======
  // The surveyId is read from <main class="admin-main" data-survey-id="..."> set by the server.
  // All admin API calls add ?survey=<id> so the backend filters per survey.
  var SURVEY_ID = (function () {
    var el = document.querySelector('.admin-main');
    if (el && el.getAttribute('data-survey-id')) {
      var n = parseInt(el.getAttribute('data-survey-id'), 10);
      if (!isNaN(n) && n > 0) return n;
    }
    return 1;
  })();
  function api(path, params) {
    // append ?survey=X (or &survey=X) to any /api/admin/* path
    params = params || {};
    params.survey = SURVEY_ID;
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    var sep = path.indexOf('?') >= 0 ? '&' : '?';
    return path + sep + qs;
  }

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
    var html = kpi('Totaal responses', stats.total, '');
    if (stats.nps) {
      var npsClass = stats.nps.score >= 50 ? 'promoter' : stats.nps.score < 0 ? 'detractor' : 'passive';
      html += kpi('NPS-score', stats.nps.score,
        stats.nps.promoters + ' prom · ' + stats.nps.passives + ' pass · ' + stats.nps.detractors + ' detr',
        npsClass);
    }
    // Toon de eerste 4 scale-averages als KPI-kaartjes (de rest komt in scoresChart).
    // Hierdoor is de KPI-rij altijd compact + leesbaar, ongeacht aantal scale-vragen.
    var scales = (stats.scaleAverages || []).filter(function (s) { return s.type === 'scale'; });
    scales.slice(0, 4).forEach(function (s) {
      html += kpi(
        shortLabel(s.label_nl) + ' (' + s.code.toUpperCase() + ')',
        (s.avg || 0).toFixed(2),
        '/ ' + s.scale_max
      );
    });
    document.getElementById('kpiGrid').innerHTML = html;
  }

  function kpi(label, value, sub, cls) {
    return '<div class="kpi-card">'
      + '<div class="kpi-label">' + escapeHtml(label) + '</div>'
      + '<div class="kpi-value' + (cls ? ' ' + cls : '') + '">' + escapeHtml(String(value)) + '</div>'
      + (sub ? '<div class="kpi-sub">' + escapeHtml(sub) + '</div>' : '')
      + '</div>';
  }

  function renderScoresChart(stats) {
    var scales = (stats.scaleAverages || []).filter(function (s) { return s.type === 'scale'; });
    if (scales.length === 0) {
      document.getElementById('scoresChart').innerHTML =
        '<div class="empty">Geen schaal-vragen in deze enquête.</div>';
      return;
    }
    var html = scales.map(function (s) {
      var v = s.avg || 0;
      var max = s.scale_max || 5;
      var pct = (v / max) * 100;
      return '<div class="bar-row">'
        + '<div class="bar-label">' + escapeHtml(s.code.toUpperCase() + ' · ' + s.label_nl) + '</div>'
        + '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>'
        + '<div class="bar-value">' + v.toFixed(2) + ' / ' + max + '</div>'
        + '</div>';
    }).join('');
    document.getElementById('scoresChart').innerHTML = html;
  }

  function renderNpsChart(nps) {
    var section = document.getElementById('npsChart');
    if (!section) return;
    var wrapper = section.closest('.admin-section');
    if (!nps) {
      // Verberg de hele sectie als er geen NPS-vraag in deze survey zit
      if (wrapper) wrapper.style.display = 'none';
      section.innerHTML = '';
      return;
    }
    if (wrapper) wrapper.style.display = '';
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
    section.innerHTML = html;
  }

  function renderAttendance() {
    // Verbergen als er geen choice-vragen zijn (b.v. Ebdiepconcert-1 zonder q3_aantal).
    var section = document.getElementById('attendanceChart');
    if (!section) return;
    var wrapper = section.closest('.admin-section');
    if (CHOICE_QS.length === 0) {
      if (wrapper) wrapper.style.display = 'none';
      section.innerHTML = '';
      return;
    }
    if (wrapper) wrapper.style.display = '';
    // Toon één balkenchart per choice-vraag, met als titel het label van de vraag.
    var html = CHOICE_QS.map(function (q) {
      var max = Math.max.apply(null, q.options.map(function (o) { return o.count; }).concat([1]));
      var bars = q.options.map(function (o) {
        var pct = (o.count / max) * 100;
        return '<div class="bar-row">'
          + '<div class="bar-label">' + escapeHtml(o.value) + '</div>'
          + '<div class="bar-track"><div class="bar-fill" style="width:' + pct.toFixed(1) + '%"></div></div>'
          + '<div class="bar-value">' + o.count + '</div>'
          + '</div>';
      }).join('');
      // Eerste choice-vraag krijgt geen extra sub-titel (de section-header is genoeg);
      // bij meerdere choice-vragen tonen we wel een sub-titel per vraag.
      var subtitle = CHOICE_QS.length > 1
        ? '<h3 class="chart-subheading">' + escapeHtml(q.label) + '</h3>'
        : '';
      return subtitle + bars;
    }).join('');
    // Update ook de h2 van deze sectie naar het label van de eerste choice-vraag
    // (i.p.v. "Concertdeelname" hardcoded — werkt nog voor Reeks I, maar correct
    // voor andere surveys).
    if (wrapper && CHOICE_QS.length === 1) {
      var h2 = wrapper.querySelector('h2');
      if (h2) h2.textContent = CHOICE_QS[0].label;
    }
    section.innerHTML = html;
  }

  function renderOpenTabs() {
    var section = document.getElementById('openTabs');
    if (!section) return;
    var wrapper = section.closest('.admin-section');
    if (QUESTIONS_OPEN.length === 0) {
      if (wrapper) wrapper.style.display = 'none';
      section.innerHTML = '';
      return;
    }
    if (wrapper) wrapper.style.display = '';
    var html = QUESTIONS_OPEN.map(function (q) {
      var n = state.responses.filter(function (r) {
        var v = getAns(r, q.id);
        return v && String(v).trim() !== '';
      }).length;
      var active = state.activeOpenTab === q.id ? ' active' : '';
      return '<button type="button" class="tab' + active + '" data-tab="' + q.id + '">' + escapeHtml(q.label) + '<span class="tab-badge">' + n + '</span></button>';
    }).join('');
    section.innerHTML = html;
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
    var target = document.getElementById('openContent');
    if (!target) return;
    if (!qid) {
      target.innerHTML = '';
      return;
    }
    var search = state.search.trim().toLowerCase();
    // Zoek dynamisch een "naam"-vraag en een NPS-vraag voor de citaat-metadata;
    // deze waren vroeger hard-coded op q19_naam / q1_nps.
    var nameQ = QUESTIONS_OPEN.find(function (q) { return /naam|name/i.test(q.id); });
    var nameCode = nameQ ? nameQ.id : null;
    var npsCode = state.stats && state.stats.nps ? state.stats.nps.code : null;
    var quotes = state.responses
      .filter(function (r) { var v = getAns(r, qid); return v && String(v).trim() !== ''; })
      .filter(function (r) {
        if (!search) return true;
        var ans = String(getAns(r, qid) || '').toLowerCase();
        var name = String(nameCode ? getAns(r, nameCode) || '' : '').toLowerCase();
        return ans.indexOf(search) !== -1 || name.indexOf(search) !== -1;
      })
      .map(function (r) {
        var rawName = nameCode ? String(getAns(r, nameCode) || '').trim() : '';
        var name = rawName || 'Anoniem';
        var npsVal = npsCode ? getAns(r, npsCode) : '';
        var npsBit = (npsVal !== '' && npsVal != null) ? ' · NPS ' + npsVal : '';
        return '<div class="quote">'
          + escapeHtml(getAns(r, qid))
          + '<span class="quote-meta">— ' + escapeHtml(name) + ' · ' + escapeHtml(fmtNL(r.submitted_at)) + npsBit + '</span>'
          + '</div>';
      }).join('');
    target.innerHTML = quotes || '<div class="empty">Geen antwoorden voor deze vraag.</div>';
  }

  function renderTableHead() {
    // Bouw <thead><tr>…</tr></thead> dynamisch op vanuit TABLE_COLS, want
    // de server-rendered HTML kent alleen Reeks-I kolommen.
    var thead = document.querySelector('#dataTable thead tr');
    if (!thead) return;
    var html = TABLE_COLS.map(function (col) {
      var arrow = '';
      if (state.sortKey === col.id) arrow = state.sortDir === 'asc' ? ' ▲' : ' ▼';
      return '<th data-sort="' + escapeHtml(col.id) + '">' + escapeHtml(col.label) + arrow + '</th>';
    }).join('');
    thead.innerHTML = html;
    // Hang sort-handlers (her)op de nieuwe headers
    thead.querySelectorAll('th[data-sort]').forEach(function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-sort');
        if (state.sortKey === k) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortKey = k; state.sortDir = 'desc'; }
        renderTableHead();
        renderTable();
      });
    });
  }

  function renderTable() {
    var rows = state.responses.slice();
    var sortKey = state.sortKey;
    rows.sort(function (a, b) {
      var ka = sortKey === 'submitted_at' ? a[sortKey] : getAns(a, sortKey);
      var kb = sortKey === 'submitted_at' ? b[sortKey] : getAns(b, sortKey);
      // Numerieke vergelijking als beide nummers/numeriek zijn
      var na = typeof ka === 'number' ? ka : (ka !== '' && !isNaN(parseFloat(ka)) ? parseFloat(ka) : null);
      var nb = typeof kb === 'number' ? kb : (kb !== '' && !isNaN(parseFloat(kb)) ? parseFloat(kb) : null);
      if (na != null && nb != null) {
        return state.sortDir === 'asc' ? na - nb : nb - na;
      }
      // Leeg helemaal onderaan
      if ((ka === '' || ka == null) && (kb === '' || kb == null)) return 0;
      if (ka === '' || ka == null) return 1;
      if (kb === '' || kb == null) return -1;
      var sa = String(ka), sb = String(kb);
      if (sa < sb) return state.sortDir === 'asc' ? -1 : 1;
      if (sa > sb) return state.sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    var html = rows.map(function (r) {
      var cells = TABLE_COLS.map(function (col) {
        if (col.id === 'submitted_at') {
          return '<td>' + escapeHtml(fmtNL(r.submitted_at)) + '</td>';
        }
        var v = getAns(r, col.id);
        if (v === '' || v == null) return '<td>—</td>';
        if (col.kind === 'num') {
          // NPS in bold zoals voorheen (eerste num-kolom met label 'NPS')
          if (col.label === 'NPS') return '<td><strong>' + escapeHtml(String(v)) + '</strong></td>';
          return '<td>' + escapeHtml(String(v)) + '</td>';
        }
        return '<td>' + escapeHtml(String(v)) + '</td>';
      }).join('');
      return '<tr data-id="' + r.id + '">' + cells + '</tr>';
    }).join('');
    var colspan = TABLE_COLS.length;
    document.getElementById('dataBody').innerHTML = html || '<tr><td colspan="' + colspan + '" class="empty">Nog geen responses.</td></tr>';
    document.querySelectorAll('#dataBody tr[data-id]').forEach(function (tr) {
      tr.addEventListener('click', function () { openModal(tr.getAttribute('data-id')); });
    });
  }

  function openModal(id) {
    var r = state.responses.find(function (x) { return x.id === id; });
    if (!r) return;
    var rows = Object.keys(ALL_QUESTIONS_LABELS).map(function (k) {
      var v = k === 'submitted_at' ? fmtNL(r[k]) : getAns(r, k);
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

  // Sorting handlers worden in renderTableHead() opnieuw aangehangen (dynamische kolommen).

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
    fetch(api('/api/admin/responses'), { method: 'DELETE', credentials: 'same-origin' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        alert('Verwijderd: ' + (j.deleted || 0) + ' responses');
        loadData();
      });
  });

  function loadData() {
    fetch(api('/api/admin/responses'), { credentials: 'same-origin' })
      .then(function (r) {
        if (r.status === 401) { window.location.href = '/admin/login'; return null; }
        return r.json();
      })
      .then(function (j) {
        if (!j) return;
        var rows = j.responses || [];
        normalizeRows(rows);
        state.responses = rows;
        state.stats = j.stats;
        // Bouw QUESTIONS_OPEN / SCALE_QS / CHOICE_QS / TABLE_COLS opnieuw op vanuit
        // de actuele survey-snapshot. Zo blijft het dashboard automatisch in sync
        // met vragen-wijzigingen in de bewerk-pagina.
        rebuildQuestionLists(j.questions || [], j.stats);
        renderKpis(j.stats);
        renderScoresChart(j.stats);
        renderNpsChart(j.stats.nps);
        renderAttendance();
        renderOpenTabs();
        renderOpenContent();
        renderTableHead();
        renderTable();
      });
  }

  // Flash banner — show success message after create/update redirect.
  // The server redirects to ?created=1 or ?updated=1 — we read & remove it
  // from the URL so a refresh doesn't re-show it.
  (function showFlashFromQuery() {
    var banner = document.getElementById('flashBanner');
    if (!banner) return;
    var qs = new URLSearchParams(window.location.search);
    var msg = '';
    if (qs.get('created') === '1') msg = '✓ Enquête aangemaakt — je kunt hem nu bewerken of delen.';
    else if (qs.get('updated') === '1') msg = '✓ Wijzigingen opgeslagen.';
    if (!msg) return;
    banner.textContent = msg;
    banner.hidden = false;
    setTimeout(function () {
      banner.style.opacity = '0';
      setTimeout(function () { banner.hidden = true; banner.style.opacity = ''; }, 400);
    }, 4500);
    // Clean URL so a refresh doesn't re-show it
    qs.delete('created'); qs.delete('updated');
    var newSearch = qs.toString();
    var newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '');
    try { history.replaceState(null, '', newUrl); } catch (e) { /* ignore */ }
  })();

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
    var url = api('/api/admin/analyze', force ? { lang: aiState.lang, force: '1' } : { lang: aiState.lang });
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
    fetch(api('/api/admin/analyze', { lang: aiState.lang }), { credentials: 'same-origin' })
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
          fetch(api('/api/admin/analyze', { lang: aiState.lang }), { method: 'POST', credentials: 'same-origin' })
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

      // Tag specific sections with page-break-before so the report has a clean
      // logical structure: Cover | KPI+Scores | NPS+Attendance | AI analysis | Open answers | Raw data.
      // The cover already has page-break-after via the `after` selector above.
      var sections = main.querySelectorAll('.admin-section');
      var pageBreakTargets = []; // remember to clean up later
      // Section indices: 0=Scores, 1=NPS, 2=Attendance, 3=AI, 4=Open answers, 5=Raw data
      [1, 3, 4, 5].forEach(function (idx) {
        var s = sections[idx];
        if (s) { s.classList.add('pdf-page-break-before'); pageBreakTargets.push(s); }
      });
      // Group KPI grid + first chart together (they belong on same page)
      var kpiGrid = main.querySelector('.kpi-grid');
      if (kpiGrid) { kpiGrid.classList.add('pdf-keep-together'); pageBreakTargets.push(kpiGrid); }

      // Filename
      var d = new Date();
      var iso = d.toISOString().slice(0, 10);
      var fname = 'huiskamerconcerten-rapport-' + iso + '.pdf';

      // A4 landscape = 297mm x 210mm. With 10mm side margins, content area = 277mm.
      // Render at 1100px wide (matches admin-main natural width) so the canvas
      // doesn't include big empty side strips and scales 1:1 onto the page.
      var opt = {
        margin:       [10, 10, 12, 10], // mm: top, right, bottom, left
        filename:     fname,
        image:        { type: 'jpeg', quality: 0.95 },
        html2canvas:  {
          scale: 2,
          useCORS: true,
          backgroundColor: '#FBF8F2',
          windowWidth: 1100,
          width: 1100,
          scrollX: 0,
          scrollY: 0
        },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape', compress: true },
        // Use CSS page-break rules + per-element selectors instead of avoid-all
        // (avoid-all forces every element onto its own line which leaves big gaps).
        pagebreak:    {
          mode:   ['css', 'legacy'],
          before: ['.pdf-page-break-before'],
          after:  ['.pdf-cover'],
          avoid:  ['.pdf-keep-together', '.kpi-card', '.ai-summary', '.ai-block', '.ai-list li', '.ai-quote', 'tr', 'thead']
        }
      };

      function cleanup() {
        document.body.classList.remove('pdf-rendering');
        if (cover.parentNode) cover.parentNode.removeChild(cover);
        pageBreakTargets.forEach(function (el) {
          el.classList.remove('pdf-page-break-before');
          el.classList.remove('pdf-keep-together');
        });
      }

      return html2pdf().set(opt).from(main).save()
        .then(function () { cleanup(); hideOverlay(); })
        .catch(function (e) { cleanup(); hideOverlay(); throw e; });
    }).catch(function (e) {
      hideOverlay();
      alert('PDF mislukt: ' + (e && e.message ? e.message : e));
    });
  }

  if (pdfBtn) pdfBtn.addEventListener('click', generatePdf);

  // ====== Word (.docx) report download ======
  // Server-rendered Word document. Uses the currently cached AI analysis for
  // the active language (aiState.lang). If none exists yet, the document is
  // generated without the AI section — user can then run the analysis and
  // download again to include it.
  var docxBtn = document.getElementById('docxBtn');
  if (docxBtn) {
    docxBtn.addEventListener('click', function () {
      var lang = (aiState && aiState.lang) || 'nl';
      var url = api('/api/admin/export', { format: 'docx', lang: lang });

      // Visual feedback: temporarily disable the button so the user knows the
      // server is working (docx build can take 1-3 seconds for large datasets).
      var original = docxBtn.textContent;
      docxBtn.disabled = true;
      docxBtn.textContent = lang === 'en' ? '⏳ Building Word…' : '⏳ Word wordt gemaakt…';

      // Triggering the download via window.location keeps the existing admin
      // session cookie (no fetch+blob plumbing needed). Restore the button
      // shortly after — the browser handles the rest.
      try { window.location.href = url; } catch (e) { /* ignore */ }
      setTimeout(function () {
        docxBtn.disabled = false;
        docxBtn.textContent = original;
      }, 4000);
    });
  }

  // ============================================================
  // Share modal — WhatsApp / Email / Copy-to-clipboard / QR-code
  // ============================================================
  var shareBtn = document.getElementById('shareBtn');
  var shareModal = document.getElementById('shareModal');
  if (shareBtn && shareModal) {
    var shareUrlInput = document.getElementById('shareUrl');
    var shareCopyBtn = document.getElementById('shareCopy');
    var shareCopiedMsg = document.getElementById('shareCopied');
    var shareWhatsapp = document.getElementById('shareWhatsapp');
    var shareEmail = document.getElementById('shareEmail');
    var shareClose = document.getElementById('shareClose');
    var shareQr = document.getElementById('shareQr');
    var shareQrDownload = document.getElementById('shareQrDownload');

    function buildShareData() {
      var path = shareBtn.getAttribute('data-survey-path') || '/';
      var title = shareBtn.getAttribute('data-survey-title') || 'enquête';
      var url = window.location.origin + path;
      // Friendly NL message — encoded for both WhatsApp and email body
      var greeting = 'Hallo!';
      var body = greeting + '\n\nWe horen graag wat je vond van het concert. ' +
                 'Het invullen van deze korte enquête neemt slechts een paar minuten:\n\n' +
                 url + '\n\nAlvast bedankt!\n— Pensato.org';
      var subject = 'Jouw mening over ' + title;
      return { url: url, title: title, body: body, subject: subject };
    }

    function openShareModal() {
      var data = buildShareData();
      shareUrlInput.value = data.url;
      shareWhatsapp.href = 'https://wa.me/?text=' + encodeURIComponent(data.body);
      shareEmail.href = 'mailto:?subject=' + encodeURIComponent(data.subject) +
                       '&body=' + encodeURIComponent(data.body);
      // QR-code via goqr.me public API (no auth, no rate limits for normal use)
      var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=' +
                  encodeURIComponent(data.url);
      shareQr.innerHTML = '<img src="' + qrUrl + '" alt="QR-code voor ' +
                          data.url + '" width="240" height="240" />';
      if (shareQrDownload) {
        shareQrDownload.href = qrUrl + '&format=png&download=1';
        shareQrDownload.hidden = false;
      }
      shareCopiedMsg.hidden = true;
      shareModal.hidden = false;
      // Move focus for accessibility
      setTimeout(function () { shareUrlInput.focus(); shareUrlInput.select(); }, 50);
    }

    function closeShareModal() {
      shareModal.hidden = true;
      shareCopiedMsg.hidden = true;
    }

    shareBtn.addEventListener('click', openShareModal);
    shareClose.addEventListener('click', closeShareModal);
    shareModal.addEventListener('click', function (e) {
      // Close on backdrop click (but not on the card itself)
      if (e.target === shareModal) closeShareModal();
    });
    document.addEventListener('keydown', function (e) {
      if (!shareModal.hidden && e.key === 'Escape') closeShareModal();
    });

    shareCopyBtn.addEventListener('click', function () {
      var url = shareUrlInput.value;
      function showCopied() {
        shareCopiedMsg.hidden = false;
        setTimeout(function () { shareCopiedMsg.hidden = true; }, 2500);
      }
      // Modern clipboard API with fallback for non-HTTPS contexts
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(showCopied, function () {
          // fallback below
          fallbackCopy();
        });
      } else {
        fallbackCopy();
      }
      function fallbackCopy() {
        try {
          shareUrlInput.removeAttribute('readonly');
          shareUrlInput.select();
          shareUrlInput.setSelectionRange(0, 99999);
          document.execCommand('copy');
          shareUrlInput.setAttribute('readonly', 'readonly');
          showCopied();
        } catch (err) {
          alert('Kon niet automatisch kopiëren. Selecteer de URL en gebruik Ctrl+C.');
        }
      }
    });
  }
})();
