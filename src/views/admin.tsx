import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Brand, Survey, LibraryQuestion } from '../lib/surveys'
import type { ListSurveysWithStatsRow } from '../lib/surveys'
import { v } from '../lib/version'

export const LoginPage: FC<{ error?: string }> = ({ error }) => (
  <Layout title="Admin login — Pensato.org" admin>
    <div class="login-shell">
      <div class="login-card">
        <span class="badge badge-teal italic-serif">Admin</span>
        <h1>Welkom terug</h1>
        <p class="sub">Pensato.org — survey-platform</p>
        {error ? <div class="err">{error}</div> : null}
        <form method="POST" action="/admin/login" autocomplete="on">
          <div class="field">
            <label for="email">E-mailadres</label>
            <input
              type="email"
              id="email"
              name="email"
              required
              autocomplete="username"
              autocapitalize="off"
              spellcheck={false}
              placeholder="naam@voorbeeld.be"
            />
          </div>
          <div class="field">
            <label for="password">Wachtwoord</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              autocomplete="current-password"
              placeholder="••••••••"
            />
          </div>
          <button type="submit" class="btn">Inloggen</button>
        </form>
        <a href="/" class="back-link">← terug naar de landingspagina</a>
      </div>
    </div>
  </Layout>
)

function fmtDateShort(iso: string | null): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso.includes('T') ? iso : iso + 'T00:00:00Z')
    return d.toLocaleDateString('nl-BE', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch { return iso }
}

function npsClass(nps: number | null): string {
  if (nps == null) return 'nps-empty'
  if (nps >= 7) return 'nps-good'
  if (nps >= 4) return 'nps-mid'
  return 'nps-low'
}

// ============================================================
// Admin overview: list of all surveys (multi-survey home)
// ============================================================
export const AdminOverviewPage: FC<{
  surveys: ListSurveysWithStatsRow[]
  brands: Brand[]
}> = ({ surveys, brands }) => {
  const open = surveys.filter(s => s.status === 'open')
  const closed = surveys.filter(s => s.status !== 'open')
  return (
    <Layout title="Admin — alle enquêtes" admin>
      <header class="admin-header">
        <h1>📊 Pensato.org · admin</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>
      <main class="admin-main">
        <section class="admin-section overview-hero">
          <h2 style="margin-top:0;">Overzicht enquêtes</h2>
          <p style="color:#555;">
            {surveys.length} enquêtes · {open.length} open · {surveys.reduce((acc, s) => acc + s.response_count, 0)} totale antwoorden
          </p>
        </section>

        <section class="admin-section">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
            <h2 style="margin:0;">Open enquêtes ({open.length})</h2>
            <a href="/admin/surveys/new" class="btn btn-teal">+ Nieuwe enquête</a>
          </div>
          {open.length === 0
            ? <p style="color:#777;font-style:italic;">Nog geen open enquêtes. Klik op <strong>+ Nieuwe enquête</strong> om er één aan te maken.</p>
            : (
              <div class="survey-grid">
                {open.map(s => <SurveyCard s={s} />)}
              </div>
            )
          }
        </section>

        {closed.length > 0 ? (
          <section class="admin-section">
            <h2>Gesloten / gearchiveerd ({closed.length})</h2>
            <div class="survey-grid">
              {closed.map(s => <SurveyCard s={s} />)}
            </div>
          </section>
        ) : null}

        <section class="admin-section">
          <h2>Merken</h2>
          <div class="brand-pill-row">
            {brands.map(b => (
              <span class="brand-pill" style={`--brand-primary:${b.primary_color};--brand-accent:${b.accent_color};`}>
                {b.logo_url ? <img src={b.logo_url} alt={b.name_nl} class="brand-pill-logo" /> : null}
                <span class="brand-pill-name">{b.name_nl}</span>
                <span class="brand-pill-prefix">/{b.url_prefix}/...</span>
              </span>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  )
}

const SurveyCard: FC<{ s: ListSurveysWithStatsRow }> = ({ s }) => {
  const url = `/admin/surveys/${s.id}`
  const publicUrl = `/${s.brand_id === 'huiskamer' ? 'h' : s.brand_id === 'ebdiep' ? 'e' : 'h'}/${s.slug}`
  return (
    <a class="survey-card" href={url} style={`--brand-primary:${s.brand_primary_color};--brand-accent:${s.brand_accent_color};`}>
      <div class="survey-card-header">
        {s.brand_logo_url ? <img src={s.brand_logo_url} alt={s.brand_name_nl} class="survey-card-logo" /> : null}
        <div>
          <span class="survey-card-brand italic-serif">{s.brand_name_nl}</span>
          {s.series_name ? <span class="survey-card-series"> · {s.series_name}</span> : null}
        </div>
        <span class={`status-pill status-${s.status}`}>{s.status}</span>
      </div>
      <h3>{s.title_nl}</h3>
      {s.subtitle_nl ? <p class="survey-card-sub">{s.subtitle_nl}</p> : null}
      <div class="survey-card-stats">
        <div class="stat">
          <span class="stat-num">{s.response_count}</span>
          <span class="stat-label">antwoorden</span>
        </div>
        <div class={`stat ${npsClass(s.avg_nps)}`}>
          <span class="stat-num">{s.avg_nps == null ? '—' : Math.round(s.avg_nps * 10) / 10}</span>
          <span class="stat-label">⌀ NPS</span>
        </div>
        <div class="stat">
          <span class="stat-num small">{fmtDateShort(s.last_response_at)}</span>
          <span class="stat-label">laatste</span>
        </div>
      </div>
      <div class="survey-card-actions">
        <span class="survey-card-cta">Open dashboard →</span>
        <a class="survey-card-link" href={publicUrl} onclick="event.stopPropagation();" target="_blank" rel="noopener">{publicUrl}</a>
      </div>
    </a>
  )
}

// ============================================================
// Per-survey dashboard (the existing one, now scoped by survey)
// ============================================================
export const DashboardPage: FC<{ survey: Survey; brand?: Brand | null }> = ({ survey, brand }) => {
  const titleString = `${survey.title_nl} — admin`
  // Build the public survey URL so the Share modal can copy / send it
  const prefix = brand?.url_prefix || (survey.brand_id === 'huiskamer' ? 'h' : 'e')
  const publicPath = `/${prefix}/${survey.slug}`
  return (
    <Layout title={titleString} admin>
      <header class="admin-header">
        <a href="/admin" class="btn btn-ghost" style="margin-right:auto;">← Alle enquêtes</a>
        <h1 style="margin:0 0 0 16px;">⌂ {survey.title_nl}</h1>
        <div class="spacer"></div>
        <button id="shareBtn" class="btn btn-teal" type="button"
          data-survey-path={publicPath}
          data-survey-title={survey.title_nl}
          title="Deel deze enquête via WhatsApp, e-mail of link kopiëren">🔗 Delen</button>
        <a href={`/admin/surveys/${survey.id}/edit`} class="btn btn-ghost"
           title="Pas titel, vragen of details aan">⚙ Bewerken</a>
        <button id="refreshBtn" class="btn btn-ghost" type="button">↻ Vernieuwen</button>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main" data-survey-id={String(survey.id)} data-survey-slug={survey.slug} data-brand-prefix={survey.brand_id === 'huiskamer' ? 'h' : survey.brand_id === 'ebdiep' ? 'e' : 'h'}>
        {/* Success banner shown after create/update redirects (admin.js fades it out) */}
        <div id="flashBanner" class="flash-banner no-print" hidden></div>

        <div class="export-bar no-print">
          <span class="label">Export &amp; beheer:</span>
          <a href={`/api/admin/export?format=csv&survey=${survey.id}`} class="btn">⬇ Export CSV</a>
          <a href={`/api/admin/export?format=json&survey=${survey.id}`} class="btn btn-orange">⬇ Export JSON</a>
          <button type="button" id="docxBtn" class="btn btn-teal" title="Volledig rapport als Word-document (.docx) — bevat KPI's, AI-analyse en ruwe data">📝 Word-rapport</button>
          <button type="button" id="pdfBtn" class="btn btn-teal" title="Visuele snapshot van het dashboard als PDF">📄 PDF rapport</button>
          <button type="button" id="deleteAllBtn" class="btn btn-red">🗑 Wis alle data</button>
        </div>

        <div class="kpi-grid" id="kpiGrid"></div>

        <section class="admin-section">
          <h2>Scores per dimensie</h2>
          <div id="scoresChart"></div>
        </section>

        <section class="admin-section">
          <h2>NPS-verdeling</h2>
          <div id="npsChart"></div>
          <div style="display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;font-size:13px;color:#555;">
            <span><span style="display:inline-block;width:12px;height:12px;background:#B73229;border-radius:3px;margin-right:6px;"></span>Detractors (0-6)</span>
            <span><span style="display:inline-block;width:12px;height:12px;background:#F4A93C;border-radius:3px;margin-right:6px;"></span>Passives (7-8)</span>
            <span><span style="display:inline-block;width:12px;height:12px;background:#2E7D32;border-radius:3px;margin-right:6px;"></span>Promoters (9-10)</span>
          </div>
        </section>

        <section class="admin-section">
          <h2>Concertdeelname</h2>
          <div id="attendanceChart"></div>
        </section>

        <section class="admin-section ai-section" id="aiSection">
          <div class="ai-section-header">
            <h2>AI-analyse &amp; suggesties</h2>
            <div class="ai-controls no-print">
              <div class="ai-lang-toggle" role="group" aria-label="Taal kiezen">
                <button type="button" class="ai-lang-btn active" data-lang="nl">NL</button>
                <button type="button" class="ai-lang-btn" data-lang="en">EN</button>
              </div>
              <button type="button" id="aiRefreshBtn" class="btn btn-ghost" title="Genereer een nieuwe analyse">↻ Vernieuwen</button>
            </div>
          </div>
          <p class="ai-meta" id="aiMeta">Klik op "Genereer analyse" om de eerste analyse te starten.</p>
          <div id="aiContent" class="ai-content">
            <div class="ai-empty">
              <button type="button" id="aiGenerateBtn" class="btn btn-teal">✨ Genereer AI-analyse</button>
              <p class="ai-hint">GPT-4o-mini (OpenAI) leest alle responses en formuleert sterktes, verbeterpunten en concrete suggesties. Resultaat wordt 24u gecached.</p>
            </div>
          </div>
        </section>

        <section class="admin-section">
          <h2>Open antwoorden</h2>
          <div class="tabs" id="openTabs"></div>
          <input type="search" class="search-input no-print" id="openSearch" placeholder="Zoek in antwoorden…" />
          <div id="openContent"></div>
        </section>

        <section class="admin-section">
          <h2>Ruwe data</h2>
          <div class="data-table-wrap">
            <table class="data-table" id="dataTable">
              <thead>
                <tr>
                  <th data-sort="submitted_at">Datum</th>
                  <th data-sort="q1_nps">NPS</th>
                  <th data-sort="q3_aantal"># concerten</th>
                  <th data-sort="q4_sfeer">Sfeer</th>
                  <th data-sort="q6_akoestiek">Akoestiek</th>
                  <th data-sort="q8_repertoire">Repertoire</th>
                  <th data-sort="q10_interactie">Interactie</th>
                  <th data-sort="q12_communic">Comm.</th>
                  <th data-sort="q14_bijdrage">Bijdrage</th>
                  <th data-sort="q19_naam">Naam</th>
                </tr>
              </thead>
              <tbody id="dataBody"></tbody>
            </table>
          </div>
        </section>

        <p class="no-print" style="text-align:center;color:#888;font-size:12px;margin-top:32px;">
          <span class="italic-serif">Pensato.org</span> — automatisch ververst om de 30 seconden
        </p>
      </main>

      <div class="modal-backdrop no-print" id="modalBackdrop">
        <div class="modal" id="modalContent"></div>
      </div>

      <div id="pdfOverlay" class="pdf-overlay no-print" hidden>
        <div class="pdf-overlay-card">
          <div class="pdf-spinner" aria-hidden="true"></div>
          <p id="pdfOverlayMsg">PDF wordt gegenereerd…</p>
        </div>
      </div>

      {/* Share modal — populated by admin.js when 🔗 Delen is clicked */}
      <div id="shareModal" class="share-modal no-print" hidden role="dialog" aria-labelledby="shareTitle" aria-modal="true">
        <div class="share-modal-card">
          <button type="button" class="share-modal-close" id="shareClose" aria-label="Sluiten">×</button>
          <h2 id="shareTitle">🔗 Deel deze enquête</h2>
          <p class="share-hint">Verstuur de directe link naar deelnemers via WhatsApp, e-mail of kopieer hem.</p>

          <div class="share-url-row">
            <input type="text" id="shareUrl" class="share-url-input" readOnly />
            <button type="button" id="shareCopy" class="btn btn-teal">📋 Kopieer</button>
          </div>
          <p class="share-copied" id="shareCopied" hidden>✓ Link gekopieerd naar klembord</p>

          <div class="share-buttons">
            <a id="shareWhatsapp" class="share-btn share-btn-whatsapp" target="_blank" rel="noopener noreferrer">
              <span class="share-icon">💬</span>
              <span>Verstuur via WhatsApp</span>
            </a>
            <a id="shareEmail" class="share-btn share-btn-email">
              <span class="share-icon">✉️</span>
              <span>Verstuur via e-mail</span>
            </a>
          </div>

          <div class="share-qr-block">
            <h3>📱 QR-code (voor flyer of scherm)</h3>
            <div id="shareQr" class="share-qr"></div>
            <a id="shareQrDownload" class="btn btn-ghost btn-small" download="qr-code.png" hidden>⬇ Download QR (PNG)</a>
          </div>
        </div>
      </div>

      <script src={v('/static/admin.js')} defer></script>
    </Layout>
  )
}

// ============================================================
// New survey form
// ============================================================

// Group questions by category for nicer UX
function groupQuestions(qs: LibraryQuestion[]): Array<{ category: string; items: LibraryQuestion[] }> {
  const map = new Map<string, LibraryQuestion[]>()
  for (const q of qs) {
    const cat = q.category || 'overig'
    if (!map.has(cat)) map.set(cat, [])
    map.get(cat)!.push(q)
  }
  // sensible order: known sections first
  const order = ['algemeen', 'locatie', 'muzikaal', 'jos', 'organisatie', 'reeks2', 'totslot']
  const sorted = Array.from(map.entries()).sort((a, b) => {
    const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0])
    if (ai === -1 && bi === -1) return a[0].localeCompare(b[0])
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return sorted.map(([category, items]) => ({ category, items }))
}

const CATEGORY_LABELS: Record<string, string> = {
  algemeen: 'Algemene beleving',
  locatie: 'Locatie & sfeer',
  muzikaal: 'Muzikaal & instrument',
  jos: 'Gastheer / artiest',
  organisatie: 'Praktische organisatie',
  reeks2: 'Volgende reeks',
  totslot: 'Tot slot (contact)',
  overig: 'Overig',
}

export const NewSurveyPage: FC<{
  brands: Brand[]
  questions: LibraryQuestion[]
  surveys: Survey[]
  error?: string
}> = ({ brands, questions, surveys, error }) => {
  const groups = groupQuestions(questions)
  const defaultBrand = brands[0]?.id || 'huiskamer'

  return (
    <Layout title="Nieuwe enquête — admin" admin>
      <header class="admin-header">
        <a href="/admin" class="btn btn-ghost" style="margin-right:auto;">← Alle enquêtes</a>
        <h1 style="margin:0 0 0 16px;">+ Nieuwe enquête</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main new-survey-form">
        {error ? (
          <div class="form-error" role="alert">
            <strong>Niet opgeslagen:</strong> {error}
          </div>
        ) : null}

        <form method="POST" action="/admin/surveys" id="newSurveyForm" autocomplete="off">
          {/* ───────── Brand ───────── */}
          <section class="admin-section">
            <h2>1. Voor welk merk?</h2>
            <p class="form-hint">Kies onder welk merk deze enquête komt. Dit bepaalt de URL, kleuren en het logo.</p>
            <div class="brand-radio-row">
              {brands.map((b, i) => (
                <label class="brand-radio" style={`--brand-primary:${b.primary_color};--brand-accent:${b.accent_color};`}>
                  <input
                    type="radio"
                    name="brand_id"
                    value={b.id}
                    required
                    {...(b.id === defaultBrand ? { checked: true } : {})}
                  />
                  {b.logo_url ? <img src={b.logo_url} alt={b.name_nl} class="brand-radio-logo" /> : null}
                  <div class="brand-radio-text">
                    <strong>{b.name_nl}</strong>
                    <span class="brand-radio-prefix">/{b.url_prefix}/&lt;slug&gt;</span>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* ───────── Titles & metadata ───────── */}
          <section class="admin-section">
            <h2>2. Titel &amp; details</h2>
            <div class="form-grid">
              <div class="form-field">
                <label for="title_nl">Titel (NL) <span class="req">*</span></label>
                <input type="text" id="title_nl" name="title_nl" required
                  placeholder="bv. Reeks II — Bach in de Huiskamer" maxLength={150} />
                <span class="form-helper">Verschijnt bovenaan de enquête en in het admin-overzicht.</span>
              </div>
              <div class="form-field">
                <label for="title_en">Titel (EN)</label>
                <input type="text" id="title_en" name="title_en"
                  placeholder="Series II — Bach in the Living Room" maxLength={150} />
                <span class="form-helper">Optioneel. Leeg laten = NL-versie wordt gebruikt.</span>
              </div>

              <div class="form-field full">
                <label for="subtitle_nl">Ondertitel (NL)</label>
                <input type="text" id="subtitle_nl" name="subtitle_nl"
                  placeholder="Jouw mening helpt ons Reeks III te verbeteren." maxLength={200} />
              </div>
              <div class="form-field full">
                <label for="subtitle_en">Ondertitel (EN)</label>
                <input type="text" id="subtitle_en" name="subtitle_en"
                  placeholder="Your opinion helps us improve Series III." maxLength={200} />
              </div>

              <div class="form-field">
                <label for="series_name">Reeks / serie</label>
                <input type="text" id="series_name" name="series_name"
                  placeholder="bv. Reeks II 2026" maxLength={80} />
              </div>
              <div class="form-field">
                <label for="artist">Artiest(en)</label>
                <input type="text" id="artist" name="artist"
                  placeholder="bv. Jos van Immerseel" maxLength={120} />
              </div>

              <div class="form-field">
                <label for="concert_date">Datum concert</label>
                <input type="date" id="concert_date" name="concert_date" />
                <span class="form-helper">Optioneel. Datum waarop het concert plaatsvond.</span>
              </div>
              <div class="form-field">
                <label for="location">Locatie</label>
                <input type="text" id="location" name="location"
                  placeholder="bv. Brugge" maxLength={120} />
              </div>

              <div class="form-field">
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="open" selected>Open (zichtbaar op landing)</option>
                  <option value="closed">Gesloten</option>
                  <option value="archived">Gearchiveerd</option>
                </select>
              </div>
              <div class="form-field">
                <label for="lang_default">Standaardtaal</label>
                <select id="lang_default" name="lang_default">
                  <option value="nl" selected>Nederlands</option>
                  <option value="en">Engels</option>
                </select>
              </div>
            </div>
          </section>

          {/* ───────── Slug / URL ───────── */}
          <section class="admin-section">
            <h2>3. URL</h2>
            <p class="form-hint">Wordt automatisch uit de titel gegenereerd, maar je kan hem aanpassen.</p>
            <div class="slug-row">
              <span class="slug-prefix" id="slugPrefix">/h/</span>
              <input type="text" id="slug" name="slug" maxLength={80}
                placeholder="auto uit titel" pattern="[a-z0-9\-]+" autocapitalize="off" autocorrect="off" spellcheck={false} />
              <span class="slug-status" id="slugStatus"></span>
            </div>
            <p class="form-helper">
              Alleen kleine letters, cijfers en koppelteken (-). Voorbeeld: <code>reeks-2-bach</code>
            </p>
          </section>

          {/* ───────── Question picker ───────── */}
          <section class="admin-section">
            <h2>4. Welke vragen?</h2>
            <div class="form-actions-inline">
              <span class="form-hint">Selecteer minstens één vraag uit de bibliotheek (geselecteerde: <strong id="qCount">0</strong>).</span>
              <span class="spacer"></span>
              <button type="button" class="btn btn-ghost btn-small" id="qSelectAll">Alles aan</button>
              <button type="button" class="btn btn-ghost btn-small" id="qSelectNone">Alles uit</button>
              {surveys.length > 0 ? (
                <select id="qCopyFrom" class="form-inline-select" title="Kopieer vragenset van bestaande enquête">
                  <option value="">— kopieer van bestaande enquête —</option>
                  {surveys.map(s => (
                    <option value={s.question_codes.join(',')}>{s.title_nl}</option>
                  ))}
                </select>
              ) : null}
            </div>

            {groups.map(({ category, items }) => (
              <div class="question-group">
                <h3 class="question-group-title">{CATEGORY_LABELS[category] ?? category}</h3>
                <div class="question-list">
                  {items.map(q => (
                    <label class="question-item">
                      <input type="checkbox" name="question_codes" value={q.code} class="q-check" />
                      <span class="q-code">{q.code}</span>
                      <span class="q-text">{q.label_nl}</span>
                      <span class="q-type">{q.type}{q.required ? ' · verplicht' : ''}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* ───────── Submit ───────── */}
          <section class="admin-section form-submit-row">
            <a href="/admin" class="btn btn-ghost">Annuleren</a>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-teal" id="submitBtn">Enquête aanmaken</button>
          </section>
        </form>
      </main>

      <script src={v('/static/admin-new-survey.js')} defer></script>
    </Layout>
  )
}

// ============================================================
// Edit existing survey — same shape as NewSurveyPage but pre-filled,
// brand is read-only, submit goes to POST /admin/surveys/:id
// ============================================================

export const EditSurveyPage: FC<{
  survey: Survey
  brands: Brand[]
  questions: LibraryQuestion[]
  error?: string
}> = ({ survey, brands, questions, error }) => {
  const groups = groupQuestions(questions)
  const brand = brands.find(b => b.id === survey.brand_id)
  const selectedSet = new Set(survey.question_codes)
  const prefix = brand?.url_prefix || (survey.brand_id === 'huiskamer' ? 'h' : 'e')

  return (
    <Layout title={`${survey.title_nl} — bewerken`} admin>
      <header class="admin-header">
        <a href={`/admin/surveys/${survey.id}`} class="btn btn-ghost" style="margin-right:auto;">← Terug naar dashboard</a>
        <h1 style="margin:0 0 0 16px;">⚙ Bewerken: {survey.title_nl}</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main new-survey-form" data-mode="edit" data-current-slug={survey.slug} data-survey-id={String(survey.id)} data-brand-prefix={prefix}>
        {error ? (
          <div class="form-error" role="alert">
            <strong>Niet opgeslagen:</strong> {error}
          </div>
        ) : null}

        <form method="POST" action={`/admin/surveys/${survey.id}`} id="newSurveyForm" autocomplete="off">
          {/* ───────── Brand (read-only) ───────── */}
          <section class="admin-section">
            <h2>1. Merk</h2>
            <p class="form-hint">
              Het merk staat vast: enquêtes verplaatsen tussen merken zou bestaande URL's en responses breken.
              Wil je toch wisselen? Maak een nieuwe enquête aan onder het andere merk.
            </p>
            <div class="brand-readonly" style={brand ? `--brand-primary:${brand.primary_color};--brand-accent:${brand.accent_color};` : ''}>
              {brand?.logo_url ? <img src={brand.logo_url} alt={brand.name_nl} class="brand-radio-logo" /> : null}
              <div class="brand-radio-text">
                <strong>{brand?.name_nl ?? survey.brand_id}</strong>
                <span class="brand-radio-prefix">/{prefix}/&lt;slug&gt;</span>
              </div>
              <input type="hidden" name="brand_id" value={survey.brand_id} />
            </div>
          </section>

          {/* ───────── Titles & metadata ───────── */}
          <section class="admin-section">
            <h2>2. Titel &amp; details</h2>
            <div class="form-grid">
              <div class="form-field">
                <label for="title_nl">Titel (NL) <span class="req">*</span></label>
                <input type="text" id="title_nl" name="title_nl" required
                  value={survey.title_nl} maxLength={150} />
              </div>
              <div class="form-field">
                <label for="title_en">Titel (EN)</label>
                <input type="text" id="title_en" name="title_en"
                  value={survey.title_en} maxLength={150} />
              </div>

              <div class="form-field full">
                <label for="subtitle_nl">Ondertitel (NL)</label>
                <input type="text" id="subtitle_nl" name="subtitle_nl"
                  value={survey.subtitle_nl ?? ''} maxLength={200} />
              </div>
              <div class="form-field full">
                <label for="subtitle_en">Ondertitel (EN)</label>
                <input type="text" id="subtitle_en" name="subtitle_en"
                  value={survey.subtitle_en ?? ''} maxLength={200} />
              </div>

              <div class="form-field">
                <label for="series_name">Reeks / serie</label>
                <input type="text" id="series_name" name="series_name"
                  value={survey.series_name ?? ''} maxLength={80} />
              </div>
              <div class="form-field">
                <label for="artist">Artiest(en)</label>
                <input type="text" id="artist" name="artist"
                  value={survey.artist ?? ''} maxLength={120} />
              </div>

              <div class="form-field">
                <label for="concert_date">Datum concert</label>
                <input type="date" id="concert_date" name="concert_date"
                  value={survey.concert_date ?? ''} />
              </div>
              <div class="form-field">
                <label for="location">Locatie</label>
                <input type="text" id="location" name="location"
                  value={survey.location ?? ''} maxLength={120} />
              </div>

              <div class="form-field">
                <label for="status">Status</label>
                <select id="status" name="status">
                  <option value="open" {...(survey.status === 'open' ? { selected: true } : {})}>Open (zichtbaar op landing)</option>
                  <option value="closed" {...(survey.status === 'closed' ? { selected: true } : {})}>Gesloten</option>
                  <option value="archived" {...(survey.status === 'archived' ? { selected: true } : {})}>Gearchiveerd</option>
                </select>
              </div>
              <div class="form-field">
                <label for="lang_default">Standaardtaal</label>
                <select id="lang_default" name="lang_default">
                  <option value="nl" {...(survey.lang_default === 'nl' ? { selected: true } : {})}>Nederlands</option>
                  <option value="en" {...(survey.lang_default === 'en' ? { selected: true } : {})}>Engels</option>
                </select>
              </div>
            </div>
          </section>

          {/* ───────── Slug / URL ───────── */}
          <section class="admin-section">
            <h2>3. URL</h2>
            <p class="form-hint">
              Pas alleen aan als je écht een nieuwe URL wil. <strong>Let op:</strong> oude links blijven niet werken
              als je de slug verandert.
            </p>
            <div class="slug-row">
              <span class="slug-prefix" id="slugPrefix">/{prefix}/</span>
              <input type="text" id="slug" name="slug" maxLength={80}
                value={survey.slug} pattern="[a-z0-9\-]+" autocapitalize="off" autocorrect="off" spellcheck={false} />
              <span class="slug-status" id="slugStatus"></span>
            </div>
            <p class="form-helper">
              Huidige URL: <code>/{prefix}/{survey.slug}</code>
            </p>
          </section>

          {/* ───────── Question picker ───────── */}
          <section class="admin-section">
            <h2>4. Vragen</h2>
            <div class="form-actions-inline">
              <span class="form-hint">Voeg vragen toe of haal ze weg (geselecteerde: <strong id="qCount">{survey.question_codes.length}</strong>).</span>
              <span class="spacer"></span>
              <button type="button" class="btn btn-ghost btn-small" id="qSelectAll">Alles aan</button>
              <button type="button" class="btn btn-ghost btn-small" id="qSelectNone">Alles uit</button>
            </div>

            {groups.map(({ category, items }) => (
              <div class="question-group">
                <h3 class="question-group-title">{CATEGORY_LABELS[category] ?? category}</h3>
                <div class="question-list">
                  {items.map(q => {
                    const checkedAttr = selectedSet.has(q.code) ? { checked: true } : {}
                    return (
                      <label class="question-item">
                        <input type="checkbox" name="question_codes" value={q.code} class="q-check" {...checkedAttr} />
                        <span class="q-code">{q.code}</span>
                        <span class="q-text">{q.label_nl}</span>
                        <span class="q-type">{q.type}{q.required ? ' · verplicht' : ''}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            ))}
          </section>

          {/* ───────── Submit ───────── */}
          <section class="admin-section form-submit-row">
            <a href={`/admin/surveys/${survey.id}`} class="btn btn-ghost">Annuleren</a>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-teal" id="submitBtn">Wijzigingen opslaan</button>
          </section>
        </form>
      </main>

      <script src={v('/static/admin-new-survey.js')} defer></script>
    </Layout>
  )
}
