import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Brand, Survey, LibraryQuestion, SurveyQuestion, SurveySection } from '../lib/surveys'
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
  flash?: string
  error?: string
}> = ({ surveys, brands, flash, error }) => {
  const open = surveys.filter(s => s.status === 'open')
  const closed = surveys.filter(s => s.status !== 'open')
  return (
    <Layout title="Admin — alle enquêtes" admin>
      <header class="admin-header">
        <h1>📊 Pensato.org · admin</h1>
        <div class="spacer"></div>
        <a href="/admin/questions" class="btn btn-ghost" title="Beheer de sjabloon-bibliotheek (raakt bestaande enquêtes niet)">📚 Sjabloon-bibliotheek</a>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>
      <main class="admin-main">
        {flash ? (
          <div class="form-flash" role="status" id="flashBanner">
            <strong>✓</strong> {flash}
          </div>
        ) : null}
        {error ? (
          <div class="form-error" role="alert">
            <strong>Fout:</strong> {error}
          </div>
        ) : null}
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
      <script src={v('/static/admin-survey-edit.js')} defer></script>
    </Layout>
  )
}

const SurveyCard: FC<{ s: ListSurveysWithStatsRow }> = ({ s }) => {
  const url = `/admin/surveys/${s.id}`
  const editUrl = `/admin/surveys/${s.id}/edit`
  const publicUrl = `/${s.brand_id === 'huiskamer' ? 'h' : s.brand_id === 'ebdiep' ? 'e' : 'h'}/${s.slug}`
  // Card is a <div> instead of <a> so we can nest forms (duplicate / delete) inside.
  // The whole card stays clickable via a wrapper link around the upper info block.
  return (
    <div class="survey-card" style={`--brand-primary:${s.brand_primary_color};--brand-accent:${s.brand_accent_color};`}>
      <a class="survey-card-clickable" href={url}>
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
      </a>
      <div class="survey-card-actions">
        <a class="survey-card-link" href={publicUrl} target="_blank" rel="noopener">{publicUrl}</a>
        <span class="spacer"></span>
        <a href={editUrl} class="btn btn-ghost btn-small" title="Bewerken">⚙ Bewerken</a>
        <form method="post" action={`/admin/surveys/${s.id}/duplicate`} class="inline-form">
          <button type="submit" class="btn btn-ghost btn-small" title="Duplicaat maken">📋</button>
        </form>
        <form method="post" action={`/admin/surveys/${s.id}/delete`} class="inline-form survey-delete-form"
          data-title={s.title_nl} data-responses={String(s.response_count)}>
          <button type="submit" class={`btn btn-ghost btn-small ${s.response_count > 0 ? 'btn-disabled' : 'btn-danger-hover'}`}
            title={s.response_count > 0
              ? `Niet verwijderbaar — ${s.response_count} reactie(s). Archiveer in plaats daarvan.`
              : 'Verwijderen'}>
            🗑
          </button>
        </form>
      </div>
    </div>
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

              <div class="form-field full">
                <label for="intro_nl">Inleiding (NL)</label>
                <textarea id="intro_nl" name="intro_nl" rows={4} maxLength={1000}
                  placeholder="bv. Dank je dat je een paar minuten neemt voor deze korte vragenlijst…"></textarea>
                <small class="form-helper char-count" data-target="intro_nl">0 / 1000</small>
              </div>
              <div class="form-field full">
                <label for="intro_en">Inleiding (EN)</label>
                <textarea id="intro_en" name="intro_en" rows={4} maxLength={1000}
                  placeholder="e.g. Thanks for taking a few minutes to share your thoughts…"></textarea>
                <small class="form-helper char-count" data-target="intro_en">0 / 1000</small>
              </div>
              <div class="form-field full">
                <label for="thanks_nl">Bedankboodschap (NL)</label>
                <textarea id="thanks_nl" name="thanks_nl" rows={4} maxLength={1000}
                  placeholder="bv. Dank voor je tijd. We zien je graag terug op het volgende concert…"></textarea>
                <small class="form-helper char-count" data-target="thanks_nl">0 / 1000</small>
              </div>
              <div class="form-field full">
                <label for="thanks_en">Bedankboodschap (EN)</label>
                <textarea id="thanks_en" name="thanks_en" rows={4} maxLength={1000}
                  placeholder="e.g. Thanks for your time. We hope to see you at the next concert…"></textarea>
                <small class="form-helper char-count" data-target="thanks_en">0 / 1000</small>
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
              <a href="/admin/questions/new" target="_blank" rel="noopener" class="btn btn-ghost btn-small" title="Nieuwe vraag toevoegen aan de bibliotheek (opent nieuw tabblad)">+ Nieuwe vraag</a>
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
            <p class="form-helper" style="margin-top:-4px;">
              Vragen bewerken of toevoegen aan de bibliotheek opent een nieuw tabblad. Sla daarna eerst je vraag op,
              kom hier terug en <strong>herlaad de pagina</strong> om de bijgewerkte bibliotheek te zien.
            </p>

            {groups.map(({ category, items }) => (
              <div class="question-group">
                <h3 class="question-group-title">{CATEGORY_LABELS[category] ?? category}</h3>
                <div class="question-list">
                  {items.map(q => (
                    <div class="question-item-row">
                      <label class="question-item">
                        <input type="checkbox" name="question_codes" value={q.code} class="q-check" />
                        <span class="q-code">{q.code}</span>
                        <span class="q-text">{q.label_nl}</span>
                        <span class="q-type">{q.type}{q.required ? ' · verplicht' : ''}</span>
                      </label>
                      <a href={`/admin/questions/${q.code}/edit`} target="_blank" rel="noopener"
                         class="btn btn-ghost btn-tiny q-edit-link" title={`Bewerk "${q.code}" in nieuw tabblad`}
                         aria-label={`Bewerk vraag ${q.code}`}>✏️ Bewerk</a>
                    </div>
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
  /** Full library of available template questions (for the "add from library" picker). */
  libraryQuestions: LibraryQuestion[]
  /** This survey's own snapshot — independent from the library. */
  surveyQuestions: SurveyQuestion[]
  /** This survey's own section dividers — independent per-survey. */
  surveySections: SurveySection[]
  error?: string
  flash?: string
}> = ({ survey, brands, libraryQuestions, surveyQuestions, surveySections, error, flash }) => {
  const brand = brands.find(b => b.id === survey.brand_id)
  const prefix = brand?.url_prefix || (survey.brand_id === 'huiskamer' ? 'h' : 'e')
  // Library questions NOT yet in this survey — eligible for "add from library"
  const surveyCodeSet = new Set(surveyQuestions.map(q => q.code))
  const libraryAvailable = libraryQuestions.filter(q => !surveyCodeSet.has(q.code))

  return (
    <Layout title={`${survey.title_nl} — bewerken`} admin>
      <header class="admin-header">
        <a href={`/admin/surveys/${survey.id}`} class="btn btn-ghost" style="margin-right:auto;">← Terug naar dashboard</a>
        <h1 style="margin:0 0 0 16px;">⚙ Bewerken: {survey.title_nl}</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main new-survey-form" data-mode="edit" data-current-slug={survey.slug} data-survey-id={String(survey.id)} data-brand-prefix={prefix}>
        {flash ? (
          <div class="form-flash" role="status" id="flashBanner">
            <strong>✓</strong> {flash}
          </div>
        ) : null}
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

          {/* ───────── Question section pointer (real management is below, outside main form) ───────── */}
          <section class="admin-section">
            <h2>4. Vragen</h2>
            <p class="form-hint">
              Deze enquête bevat <strong>{surveyQuestions.length} vragen</strong>. Wijzigingen aan de vragen worden
              direct opgeslagen — je hoeft dit hoofdformulier daarvoor niet te bevestigen. Scroll naar
              <strong> "Vragen in deze enquête"</strong> onderaan om vragen te bewerken, te verwijderen of
              toe te voegen.
            </p>
            <p class="form-helper">
              <em>De bibliotheek is een sjabloon</em>: nieuwe enquêtes starten met een kopie van bibliotheek-vragen,
              maar daarna leeft elke enquête zijn eigen leven. Wijzigingen aan de bibliotheek hebben géén
              terugwerkende kracht op bestaande enquêtes.
            </p>
          </section>

          {/* ───────── Intro & thanks copy ───────── */}
          <section class="admin-section">
            <h2>5. Inleiding & bedankboodschap</h2>
            <p class="form-hint">
              Optioneel. De inleiding verschijnt boven de eerste vraag, de bedankboodschap op de "dank je"-pagina ná
              het indienen. Laat leeg om de standaardteksten te gebruiken. <strong>Tip:</strong> hou het persoonlijk
              en kort — twee à drie zinnen is genoeg.
            </p>
            <div class="form-grid">
              <div class="form-field">
                <label for="intro_nl">Inleiding (NL)</label>
                <textarea id="intro_nl" name="intro_nl" rows={4} maxLength={1000}
                  placeholder="bv. Dank je dat je een paar minuten neemt voor deze korte vragenlijst…">{survey.intro_nl || ''}</textarea>
                <small class="form-helper char-count" data-target="intro_nl">0 / 1000</small>
              </div>
              <div class="form-field">
                <label for="intro_en">Inleiding (EN)</label>
                <textarea id="intro_en" name="intro_en" rows={4} maxLength={1000}
                  placeholder="e.g. Thanks for taking a few minutes to share your thoughts…">{survey.intro_en || ''}</textarea>
                <small class="form-helper char-count" data-target="intro_en">0 / 1000</small>
              </div>
              <div class="form-field">
                <label for="thanks_nl">Bedankboodschap (NL)</label>
                <textarea id="thanks_nl" name="thanks_nl" rows={4} maxLength={1000}
                  placeholder="bv. Dank voor je tijd. We zien je graag terug op het volgende concert…">{survey.thanks_nl || ''}</textarea>
                <small class="form-helper char-count" data-target="thanks_nl">0 / 1000</small>
              </div>
              <div class="form-field">
                <label for="thanks_en">Bedankboodschap (EN)</label>
                <textarea id="thanks_en" name="thanks_en" rows={4} maxLength={1000}
                  placeholder="e.g. Thanks for your time. We hope to see you at the next concert…">{survey.thanks_en || ''}</textarea>
                <small class="form-helper char-count" data-target="thanks_en">0 / 1000</small>
              </div>
            </div>
          </section>

          {/* ───────── Submit ───────── */}
          <section class="admin-section form-submit-row">
            <a href={`/admin/surveys/${survey.id}`} class="btn btn-ghost">Annuleren</a>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-teal" id="submitBtn">Wijzigingen opslaan</button>
          </section>
        </form>

        {/* ───────── Hoofdstukken (sectie-titels die boven groepen vragen verschijnen) ───────── */}
        <section class="admin-section survey-sections-section" id="sections">
          <h2>Hoofdstukken in deze enquête</h2>
          <p class="form-hint">
            Hoofdstukken zijn de tussentitels die op de publieke enquête-pagina verschijnen boven
            groepen vragen. Je kan ze hier <strong>per enquête</strong> aanpassen — wijzigen in deze
            enquête heeft <strong>geen</strong> invloed op andere enquêtes.
          </p>
          <div class="section-preview-hint" aria-hidden="true">
            <div class="section-preview-label">Zo wordt elk hoofdstuk getoond op de publieke pagina:</div>
            <div class="section-preview-mock">
              <span class="section-preview-badge">Badge (oranje)</span>
              <div class="section-preview-heading">Hoofding (groene tekst)</div>
            </div>
          </div>

          <details class="survey-section-form-wrap" style="margin-bottom:14px;">
            <summary class="btn btn-teal btn-small" style="display:inline-block;">+ Nieuw hoofdstuk toevoegen</summary>
            <form method="POST" action={`/admin/surveys/${survey.id}/sections`}
              class="survey-section-form" style="margin-top:12px;">
              <input type="hidden" name="section_id" value="" />
              <div class="form-grid">
                <div class="form-field">
                  <label><span class="swatch swatch-orange"></span> Badge (oranje pill, NL) *</label>
                  <input type="text" name="title_nl" required maxlength="60" placeholder="bv. Locatie & sfeer" />
                </div>
                <div class="form-field">
                  <label><span class="swatch swatch-orange"></span> Badge (oranje pill, EN)</label>
                  <input type="text" name="title_en" maxlength="60" placeholder="e.g. Location & atmosphere" />
                </div>
                <div class="form-field full">
                  <label><span class="swatch swatch-teal"></span> Hoofding (grote groene tekst, NL)</label>
                  <input type="text" name="subtitle_nl" maxlength="160" placeholder="bv. De huiskamer als ruimte." />
                  <p class="field-hint-tiny">Laat leeg om enkel de badge te tonen.</p>
                </div>
                <div class="form-field full">
                  <label><span class="swatch swatch-teal"></span> Hoofding (grote groene tekst, EN)</label>
                  <input type="text" name="subtitle_en" maxlength="160" placeholder="e.g. The living room as a venue." />
                </div>
              </div>
              <div class="form-actions-inline">
                <button type="submit" class="btn btn-teal btn-small">Toevoegen</button>
              </div>
            </form>
          </details>

          {surveySections.length === 0 ? (
            <p class="form-empty">Nog geen hoofdstukken. Voeg er één toe hierboven.</p>
          ) : (
            <div class="survey-section-list">
              {surveySections.map((s, idx) => (
                <details class="survey-section-row" data-section-id={s.section_id}>
                  <summary>
                    <span class="ss-order">{idx + 1}.</span>
                    <span class="ss-id">{s.section_id}</span>
                    <span class="ss-main">
                      <span class="ss-title-nl">{s.title_nl}</span>
                      {s.subtitle_nl ? <span class="ss-subtitle">{s.subtitle_nl}</span> : null}
                    </span>
                    <span class="ss-edit-hint">✏️ Bewerk</span>
                  </summary>
                  <div class="survey-section-edit">
                    <form method="POST" action={`/admin/surveys/${survey.id}/sections`} class="survey-section-form">
                      <input type="hidden" name="section_id" value={s.section_id} />
                      <div class="form-grid">
                        <div class="form-field">
                          <label><span class="swatch swatch-orange"></span> Badge (oranje pill, NL) *</label>
                          <input type="text" name="title_nl" required maxlength="60" value={s.title_nl} />
                        </div>
                        <div class="form-field">
                          <label><span class="swatch swatch-orange"></span> Badge (oranje pill, EN)</label>
                          <input type="text" name="title_en" maxlength="60" value={s.title_en} />
                        </div>
                        <div class="form-field full">
                          <label><span class="swatch swatch-teal"></span> Hoofding (grote groene tekst, NL)</label>
                          <input type="text" name="subtitle_nl" maxlength="160" value={s.subtitle_nl || ''} />
                          <p class="field-hint-tiny">Laat leeg om enkel de badge te tonen.</p>
                        </div>
                        <div class="form-field full">
                          <label><span class="swatch swatch-teal"></span> Hoofding (grote groene tekst, EN)</label>
                          <input type="text" name="subtitle_en" maxlength="160" value={s.subtitle_en || ''} />
                        </div>
                      </div>
                      <div class="form-actions-inline">
                        <button type="submit" class="btn btn-teal btn-small">Opslaan</button>
                      </div>
                    </form>
                    <form method="POST" action={`/admin/surveys/${survey.id}/sections/${s.section_id}/delete`}
                      class="inline-form delete-ss-form" style="margin-top:10px;">
                      <button type="submit" class="btn btn-ghost btn-tiny btn-red-text"
                        title="Verwijder dit hoofdstuk (vragen blijven bestaan, vallen onder 'Algemeen')">
                        🗑 Verwijder hoofdstuk
                      </button>
                    </form>
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        {/* ───────── Vragen in deze enquête (eigen snapshot — los van bibliotheek) ───────── */}
        <section class="admin-section survey-questions-section">
          <h2>Vragen in deze enquête</h2>
          <p class="form-hint">
            Dit is de <strong>eigen kopie</strong> van vragen voor deze enquête. Bewerken hier wijzigt
            <strong> alleen deze enquête</strong>, niet de bibliotheek of andere enquêtes.
          </p>

          {/* Add-from-library + add new actions */}
          <div class="form-actions-inline" style="margin-bottom:14px;">
            <form method="POST" action={`/admin/surveys/${survey.id}/questions/add-from-library`}
              class="inline-form add-from-lib-form">
              <select name="library_code" required>
                <option value="">— kies een vraag uit de bibliotheek —</option>
                {libraryAvailable.length === 0 ? (
                  <option value="" disabled>(alle bibliotheek-vragen zitten al in deze enquête)</option>
                ) : libraryAvailable.map(q => (
                  <option value={q.code}>{q.code} — {q.label_nl}</option>
                ))}
              </select>
              <button type="submit" class="btn btn-ghost btn-small" disabled={libraryAvailable.length === 0}>
                ➕ Voeg toe (kopie)
              </button>
            </form>
            <span class="spacer"></span>
            <a href={`/admin/surveys/${survey.id}/questions/new`} class="btn btn-teal btn-small">
              + Geheel nieuwe vraag
            </a>
          </div>

          {surveyQuestions.length === 0 ? (
            <p class="form-empty">Deze enquête heeft nog geen vragen. Voeg er een toe met één van de knoppen hierboven.</p>
          ) : (
            <div class="survey-question-list">
              {surveyQuestions.map((q, idx) => (
                <div class="survey-question-row" data-code={q.code} data-order={String(q.display_order)}>
                  <span class="sq-order">{idx + 1}.</span>
                  <span class="sq-code">{q.code}</span>
                  <div class="sq-main">
                    <span class="sq-label">{q.label_nl}</span>
                    <span class="sq-meta">
                      {q.type}{q.required ? ' · verplicht' : ''}
                      {q.source_code ? ` · uit bibliotheek (${q.source_code})` : ' · enquête-eigen'}
                    </span>
                  </div>
                  <div class="sq-actions">
                    <a href={`/admin/surveys/${survey.id}/questions/${q.code}/edit`}
                       class="btn btn-ghost btn-tiny" title="Bewerk deze vraag (alleen voor deze enquête)">
                      ✏️ Bewerk
                    </a>
                    <form method="POST" action={`/admin/surveys/${survey.id}/questions/${q.code}/delete`}
                      class="inline-form delete-sq-form">
                      <button type="submit" class="btn btn-ghost btn-tiny btn-red-text"
                        title="Verwijder deze vraag uit deze enquête">
                        🗑
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ───────── Danger zone — duplicate / delete (separate mini-forms, OUTSIDE main form) ───────── */}
        <section class="admin-section danger-zone">
          <h2>Beheer</h2>
          <p class="form-hint">
            Duplicaat: handig als startpunt voor een volgend concert — alles wordt gekopieerd behalve responses, en
            de kopie staat op <em>closed</em> tot je 'm bewust opent. Verwijderen: alleen mogelijk als er nog géén
            responses zijn. Heb je wel responses maar wil je 'm verbergen? Zet de status hierboven op <em>archived</em>.
          </p>
          <div class="danger-zone-actions">
            <form method="post" action={`/admin/surveys/${survey.id}/duplicate`} class="inline-form">
              <button type="submit" class="btn btn-ghost" id="duplicateBtn">
                📋 Duplicaat maken
              </button>
            </form>
            <form method="post" action={`/admin/surveys/${survey.id}/delete`} class="inline-form"
              id="deleteSurveyForm">
              <button type="submit" class="btn btn-red" id="deleteBtn">
                🗑 Enquête verwijderen
              </button>
            </form>
          </div>
        </section>
      </main>

      <script src={v('/static/admin-new-survey.js')} defer></script>
      <script src={v('/static/admin-survey-edit.js')} defer></script>
    </Layout>
  )
}

// ============================================================
// QUESTION LIBRARY — list page
// ============================================================

const TYPE_LABELS: Record<string, string> = {
  nps: 'NPS (0-10)',
  scale: 'Schaal (1-5)',
  choice: 'Keuze',
  text: 'Tekst (kort)',
  paragraph: 'Tekst (lang)',
}

export const QuestionsLibraryPage: FC<{
  questions: LibraryQuestion[]
  usage: Record<string, Array<{ id: number; title_nl: string; status: string }>>
  flash?: string
  error?: string
}> = ({ questions, usage, flash, error }) => {
  // Group by category
  const groups = (() => {
    const map = new Map<string, LibraryQuestion[]>()
    for (const q of questions) {
      const cat = q.category || 'overig'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(q)
    }
    const order = ['algemeen', 'locatie', 'muzikaal', 'jos', 'organisatie', 'reeks2', 'totslot']
    return Array.from(map.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]); const bi = order.indexOf(b[0])
      if (ai === -1 && bi === -1) return a[0].localeCompare(b[0])
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })
  })()

  return (
    <Layout title="Sjabloon-bibliotheek — admin" admin>
      <header class="admin-header">
        <a href="/admin" class="btn btn-ghost" style="margin-right:auto;">← Alle enquêtes</a>
        <h1 style="margin:0 0 0 16px;">📚 Sjabloon-bibliotheek</h1>
        <div class="spacer"></div>
        <a href="/admin/questions/import" class="btn btn-ghost" title="Bulk-import via JSON">⬆ Importeer</a>
        <a href="/api/admin/questions/export" class="btn btn-ghost" title="Download alle vragen als JSON">⬇ Exporteer</a>
        <a href="/admin/questions/new" class="btn btn-teal">+ Nieuwe vraag</a>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main questions-library">
        {flash ? <div id="flashBanner" class="flash-banner no-print">{flash}</div> : null}
        {error ? <div class="form-error" role="alert"><strong>Fout:</strong> {error}</div> : null}

        <section class="admin-section overview-hero">
          <h2 style="margin-top:0;">Sjablonen voor enquêtevragen</h2>
          <p style="color:#555;">
            {questions.length} sjablonen · gegroepeerd per categorie · gebruik deze als startpunt bij het aanmaken van een nieuwe enquête.
          </p>
          <p class="form-hint" style="margin-bottom:0;background:#fff8e1;border-left:3px solid #f5a623;padding:10px 12px;">
            <strong>⚠️ Let op — dit is een sjabloon-bibliotheek.</strong> Wijzigingen hier hebben <strong>geen</strong> effect
            op bestaande enquêtes. Elke enquête heeft sinds versie 2026-05-11 haar eigen, onafhankelijke kopie van de vragen
            (een snapshot op het moment dat de vraag aan de enquête werd toegevoegd). Wil je een vraag in een lopende enquête
            aanpassen? Doe dat dan vanuit het bewerk-scherm van die enquête zelf.
          </p>
          <p class="form-hint" style="margin-bottom:0;margin-top:8px;">
            <strong>Belangrijk:</strong> de <code>code</code> van een sjabloon is de identifier — die kan je niet wijzigen na aanmaken.
          </p>
        </section>

        <input type="search" id="qFilter" class="search-input" placeholder="Filter op code, label of categorie…"
               style="margin-bottom:16px;" />

        {groups.length === 0
          ? <p style="color:#777;font-style:italic;">Nog geen vragen. Klik op <strong>+ Nieuwe vraag</strong> of <strong>⬆ Importeer</strong>.</p>
          : groups.map(([cat, items]) => (
            <section class="admin-section question-category-block" data-category={cat}>
              <h2>{CATEGORY_LABELS[cat] ?? cat} <span class="cat-count">({items.length})</span></h2>
              <table class="data-table questions-table">
                <thead>
                  <tr>
                    <th style="width:11%;">Code</th>
                    <th style="width:9%;">Type</th>
                    <th>Label NL</th>
                    <th style="width:7%;text-align:center;">Verplicht</th>
                    <th style="width:14%;">Gebruikt in</th>
                    <th style="width:14%;text-align:right;">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(q => {
                    const surveys = usage[q.code] ?? []
                    return (
                      <tr class="question-row"
                          data-search={(q.code + ' ' + q.label_nl + ' ' + (q.category || '')).toLowerCase()}>
                        <td><code class="q-code-cell">{q.code}</code></td>
                        <td><span class={`type-pill type-${q.type}`}>{TYPE_LABELS[q.type] ?? q.type}</span></td>
                        <td class="q-label-cell">
                          <strong>{q.label_nl}</strong>
                          {q.helper_nl ? <span class="q-helper">{q.helper_nl}</span> : null}
                        </td>
                        <td style="text-align:center;">{q.required ? '✓' : '—'}</td>
                        <td>
                          {surveys.length === 0
                            ? <span style="color:#999;font-style:italic;">ongebruikt</span>
                            : <span class="usage-count" title={surveys.map(s => s.title_nl).join(', ')}>{surveys.length} enquête{surveys.length === 1 ? '' : 's'}</span>
                          }
                        </td>
                        <td style="text-align:right;white-space:nowrap;">
                          <a href={`/admin/questions/${q.code}/edit`} class="btn btn-ghost btn-small">⚙ Bewerk</a>
                          <form method="POST" action={`/admin/questions/${q.code}/delete`} style="display:inline;"
                                class="delete-form" data-code={q.code} data-usage={String(surveys.length)}>
                            <button type="submit" class="btn btn-red btn-small" {...(surveys.length > 0 ? { disabled: true, title: 'In gebruik — verwijder eerst uit alle enquêtes' } : { title: 'Verwijder definitief' })}>🗑</button>
                          </form>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
          ))
        }
      </main>

      <script src={v('/static/admin-questions.js')} defer></script>
    </Layout>
  )
}

// ============================================================
// QUESTION EDITOR — create or edit a question
// ============================================================

export const QuestionEditorPage: FC<{
  mode: 'create' | 'edit'
  question: LibraryQuestion | null
  usage?: Array<{ id: number; title_nl: string; status: string }>
  error?: string
  formData?: Record<string, string>
}> = ({ mode, question, usage, error }) => {
  const isEdit = mode === 'edit'
  const q = question
  const action = isEdit ? `/admin/questions/${q!.code}` : '/admin/questions'
  const heading = isEdit ? `⚙ Bewerk: ${q!.code}` : '+ Nieuwe vraag'
  const submitLabel = isEdit ? 'Wijzigingen opslaan' : 'Vraag aanmaken'
  const initialType = q?.type || 'text'

  return (
    <Layout title={`${isEdit ? q!.code : 'Nieuwe vraag'} — admin`} admin>
      <header class="admin-header">
        <a href="/admin/questions" class="btn btn-ghost" style="margin-right:auto;">← Vragenbibliotheek</a>
        <h1 style="margin:0 0 0 16px;">{heading}</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main new-survey-form" data-question-mode={mode} data-initial-type={initialType}>
        {error ? (
          <div class="form-error" role="alert">
            <strong>Niet opgeslagen:</strong> {error}
          </div>
        ) : null}

        {isEdit && usage && usage.length > 0 ? (
          <div class="usage-notice" role="note">
            <strong>Let op:</strong> deze vraag wordt gebruikt in {usage.length} enquête{usage.length === 1 ? '' : 's'}:{' '}
            {usage.map((u, i) => (
              <span>
                {i > 0 ? ', ' : ''}
                <a href={`/admin/surveys/${u.id}`}>{u.title_nl}</a>
              </span>
            ))}.{' '}
            Wijzigingen aan label/helper zijn meteen zichtbaar voor respondenten.
            Wijzig <strong>het type</strong> alleen als er nog geen antwoorden binnen zijn.
          </div>
        ) : null}

        <form method="POST" action={action} id="questionForm" autocomplete="off">
          {/* ───────── Identifier ───────── */}
          <section class="admin-section">
            <h2>1. Identifier</h2>
            <div class="form-grid">
              <div class="form-field">
                <label for="code">Code <span class="req">*</span></label>
                <input type="text" id="code" name="code"
                  value={q?.code ?? ''}
                  required
                  pattern="[a-z][a-z0-9_]*"
                  maxLength={50}
                  readOnly={isEdit}
                  placeholder="bv. q21_inschrijven"
                />
                <span class="form-helper">
                  {isEdit
                    ? 'Code is de primary key — niet wijzigbaar na aanmaken.'
                    : 'Begin met een kleine letter; alleen kleine letters, cijfers en underscores. Tip: behoud de q-prefix-conventie.'}
                </span>
              </div>
              <div class="form-field">
                <label for="category">Categorie</label>
                <input type="text" id="category" name="category"
                  value={q?.category ?? ''}
                  list="catSuggestions"
                  placeholder="bv. algemeen, locatie, muzikaal…" />
                <datalist id="catSuggestions">
                  <option value="algemeen" />
                  <option value="locatie" />
                  <option value="muzikaal" />
                  <option value="jos" />
                  <option value="organisatie" />
                  <option value="reeks2" />
                  <option value="totslot" />
                </datalist>
              </div>
              <div class="form-field">
                <label for="type">Type <span class="req">*</span></label>
                <select id="type" name="type" required>
                  {(['nps', 'scale', 'choice', 'text', 'paragraph'] as const).map(t => (
                    <option value={t} {...(initialType === t ? { selected: true } : {})}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div class="form-field">
                <label class="checkbox-label">
                  <input type="checkbox" name="required" value="1"
                    {...(q?.required ? { checked: true } : {})} />
                  <span>Verplicht (respondent moet antwoorden)</span>
                </label>
              </div>
            </div>
          </section>

          {/* ───────── Labels ───────── */}
          <section class="admin-section">
            <h2>2. Vraagtekst</h2>
            <div class="form-grid">
              <div class="form-field full">
                <label for="label_nl">Label NL <span class="req">*</span></label>
                <input type="text" id="label_nl" name="label_nl" required
                  value={q?.label_nl ?? ''}
                  maxLength={300}
                  placeholder="bv. Hoe ervoer je de huiskamer-setting?" />
              </div>
              <div class="form-field full">
                <label for="label_en">Label EN <span class="req">*</span></label>
                <input type="text" id="label_en" name="label_en" required
                  value={q?.label_en ?? ''}
                  maxLength={300}
                  placeholder="e.g. How did you experience the intimate setting?" />
              </div>
              <div class="form-field full">
                <label for="helper_nl">Helper NL</label>
                <input type="text" id="helper_nl" name="helper_nl"
                  value={q?.helper_nl ?? ''}
                  maxLength={300}
                  placeholder="Optionele toelichting onder de vraag" />
              </div>
              <div class="form-field full">
                <label for="helper_en">Helper EN</label>
                <input type="text" id="helper_en" name="helper_en"
                  value={q?.helper_en ?? ''}
                  maxLength={300} />
              </div>
            </div>
          </section>

          {/* ───────── Scale fields (nps/scale only) ───────── */}
          <section class="admin-section type-section type-section-scale">
            <h2>3. Schaal-instellingen <span class="form-hint">(voor NPS &amp; schaal)</span></h2>
            <div class="form-grid">
              <div class="form-field">
                <label for="scale_min">Min waarde</label>
                <input type="number" id="scale_min" name="scale_min" min={0} max={20}
                  value={q?.scale_min != null ? String(q.scale_min) : ''} />
              </div>
              <div class="form-field">
                <label for="scale_max">Max waarde</label>
                <input type="number" id="scale_max" name="scale_max" min={1} max={20}
                  value={q?.scale_max != null ? String(q.scale_max) : ''} />
              </div>
              <div class="form-field">
                <label for="min_label_nl">Label minimum (NL)</label>
                <input type="text" id="min_label_nl" name="min_label_nl"
                  value={q?.min_label_nl ?? ''} placeholder="bv. Niet waarschijnlijk" />
              </div>
              <div class="form-field">
                <label for="max_label_nl">Label maximum (NL)</label>
                <input type="text" id="max_label_nl" name="max_label_nl"
                  value={q?.max_label_nl ?? ''} placeholder="bv. Absoluut wel" />
              </div>
              <div class="form-field">
                <label for="min_label_en">Label minimum (EN)</label>
                <input type="text" id="min_label_en" name="min_label_en"
                  value={q?.min_label_en ?? ''} placeholder="e.g. Not likely" />
              </div>
              <div class="form-field">
                <label for="max_label_en">Label maximum (EN)</label>
                <input type="text" id="max_label_en" name="max_label_en"
                  value={q?.max_label_en ?? ''} placeholder="e.g. Extremely likely" />
              </div>
            </div>
          </section>

          {/* ───────── Choice options ───────── */}
          <section class="admin-section type-section type-section-choice">
            <h2>4. Keuze-opties <span class="form-hint">(voor type "Keuze")</span></h2>
            <p class="form-helper">Eén optie per regel. Aantal regels NL en EN moet gelijk zijn.</p>
            <div class="form-grid">
              <div class="form-field full">
                <label for="options_nl">Opties NL</label>
                <textarea id="options_nl" name="options_nl" rows={6}
                  placeholder="1&#10;2&#10;3&#10;4&#10;5&#10;alle 6">{(q?.options_nl ?? []).join('\n')}</textarea>
              </div>
              <div class="form-field full">
                <label for="options_en">Opties EN</label>
                <textarea id="options_en" name="options_en" rows={6}
                  placeholder="1&#10;2&#10;3&#10;4&#10;5&#10;all 6">{(q?.options_en ?? []).join('\n')}</textarea>
              </div>
            </div>
          </section>

          {/* ───────── Conditional display ───────── */}
          <section class="admin-section">
            <h2>5. Voorwaardelijke weergave <span class="form-hint">(optioneel)</span></h2>
            <p class="form-helper">
              Toon deze vraag enkel als een andere vraag een specifiek antwoord kreeg. Laat beide leeg om altijd te tonen.
            </p>
            <div class="form-grid">
              <div class="form-field">
                <label for="cond_field">Veld (code van andere vraag)</label>
                <input type="text" id="cond_field" name="cond_field"
                  value={q?.conditional_on?.field ?? ''}
                  placeholder="bv. q20_contact" />
              </div>
              <div class="form-field">
                <label for="cond_value">Verwachte waarde</label>
                <input type="text" id="cond_value" name="cond_value"
                  value={q?.conditional_on?.value ?? ''}
                  placeholder='bv. ja' />
              </div>
            </div>
          </section>

          {/* ───────── Submit ───────── */}
          <section class="admin-section form-submit-row">
            <a href="/admin/questions" class="btn btn-ghost">Annuleren</a>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-teal" id="submitBtn">{submitLabel}</button>
          </section>
        </form>
      </main>

      <script src={v('/static/admin-questions.js')} defer></script>
    </Layout>
  )
}

// ============================================================
// SURVEY-SCOPED QUESTION EDITOR — edits a row in `survey_questions`,
// completely independent from the library. Reuses the same form layout
// as QuestionEditorPage but posts to /admin/surveys/:id/questions[/:code].
// ============================================================

export const SurveyQuestionEditorPage: FC<{
  mode: 'new' | 'edit'
  survey: Survey
  question: SurveyQuestion | null
  error?: string
  formData?: Record<string, string>
}> = ({ mode, survey, question, error }) => {
  const isEdit = mode === 'edit'
  const q = question
  const action = isEdit
    ? `/admin/surveys/${survey.id}/questions/${q!.code}`
    : `/admin/surveys/${survey.id}/questions`
  const heading = isEdit ? `⚙ Bewerk vraag: ${q!.code}` : '+ Geheel nieuwe vraag in deze enquête'
  const submitLabel = isEdit ? 'Wijzigingen opslaan' : 'Vraag aanmaken'
  const initialType = q?.type || 'text'

  return (
    <Layout title={`${isEdit ? q!.code : 'Nieuwe vraag'} — ${survey.title_nl}`} admin>
      <header class="admin-header">
        <a href={`/admin/surveys/${survey.id}/edit`} class="btn btn-ghost" style="margin-right:auto;">
          ← {survey.title_nl}
        </a>
        <h1 style="margin:0 0 0 16px;">{heading}</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main new-survey-form" data-question-mode={mode} data-initial-type={initialType}>
        {error ? (
          <div class="form-error" role="alert">
            <strong>Niet opgeslagen:</strong> {error}
          </div>
        ) : null}

        <div class="usage-notice" role="note">
          <strong>Belangrijk:</strong> deze vraag bestaat <strong>alleen voor de enquête "{survey.title_nl}"</strong>.
          Wijzigingen hier raken géén andere enquête, en evenmin de bibliotheek.
          {q?.source_code ? (
            <> Deze vraag is oorspronkelijk gekopieerd uit bibliotheek-vraag <code>{q.source_code}</code>;
              de link met de bibliotheek is daarna doorgeknipt.</>
          ) : null}
        </div>

        <form method="POST" action={action} id="questionForm" autocomplete="off">
          {/* ───────── Identifier ───────── */}
          <section class="admin-section">
            <h2>1. Identifier</h2>
            <div class="form-grid">
              <div class="form-field">
                <label for="code">Code <span class="req">*</span></label>
                <input type="text" id="code" name="code"
                  value={q?.code ?? ''}
                  required
                  pattern="[a-z][a-z0-9_]*"
                  maxLength={50}
                  readOnly={isEdit}
                  placeholder="bv. q21_specifiek" />
                <span class="form-helper">
                  {isEdit
                    ? 'Code is uniek binnen deze enquête en niet meer wijzigbaar.'
                    : 'Begin met een kleine letter; alleen kleine letters, cijfers en underscores.'}
                </span>
              </div>
              <div class="form-field">
                <label for="category">Categorie</label>
                <input type="text" id="category" name="category"
                  value={q?.category ?? ''}
                  list="catSuggestions"
                  placeholder="bv. algemeen, locatie, muzikaal…" />
                <datalist id="catSuggestions">
                  <option value="algemeen" />
                  <option value="locatie" />
                  <option value="muzikaal" />
                  <option value="jos" />
                  <option value="organisatie" />
                  <option value="reeks2" />
                  <option value="totslot" />
                </datalist>
              </div>
              <div class="form-field">
                <label for="type">Type <span class="req">*</span></label>
                <select id="type" name="type" required>
                  {(['nps', 'scale', 'choice', 'text', 'paragraph'] as const).map(t => (
                    <option value={t} {...(initialType === t ? { selected: true } : {})}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div class="form-field">
                <label class="checkbox-label">
                  <input type="checkbox" name="required" value="1"
                    {...(q?.required ? { checked: true } : {})} />
                  <span>Verplicht (respondent moet antwoorden)</span>
                </label>
              </div>
            </div>
          </section>

          {/* ───────── Labels ───────── */}
          <section class="admin-section">
            <h2>2. Vraagtekst</h2>
            <div class="form-grid">
              <div class="form-field full">
                <label for="label_nl">Label NL <span class="req">*</span></label>
                <input type="text" id="label_nl" name="label_nl" required
                  value={q?.label_nl ?? ''} maxLength={300}
                  placeholder="bv. Hoe ervoer je de huiskamer-setting?" />
              </div>
              <div class="form-field full">
                <label for="label_en">Label EN <span class="req">*</span></label>
                <input type="text" id="label_en" name="label_en" required
                  value={q?.label_en ?? ''} maxLength={300}
                  placeholder="e.g. How did you experience the intimate setting?" />
              </div>
              <div class="form-field full">
                <label for="helper_nl">Helper NL</label>
                <input type="text" id="helper_nl" name="helper_nl"
                  value={q?.helper_nl ?? ''} maxLength={300}
                  placeholder="Optionele toelichting onder de vraag" />
              </div>
              <div class="form-field full">
                <label for="helper_en">Helper EN</label>
                <input type="text" id="helper_en" name="helper_en"
                  value={q?.helper_en ?? ''} maxLength={300} />
              </div>
            </div>
          </section>

          {/* ───────── Scale fields ───────── */}
          <section class="admin-section type-section type-section-scale">
            <h2>3. Schaal-instellingen <span class="form-hint">(voor NPS &amp; schaal)</span></h2>
            <div class="form-grid">
              <div class="form-field">
                <label for="scale_min">Min waarde</label>
                <input type="number" id="scale_min" name="scale_min" min={0} max={20}
                  value={q?.scale_min != null ? String(q.scale_min) : ''} />
              </div>
              <div class="form-field">
                <label for="scale_max">Max waarde</label>
                <input type="number" id="scale_max" name="scale_max" min={1} max={20}
                  value={q?.scale_max != null ? String(q.scale_max) : ''} />
              </div>
              <div class="form-field">
                <label for="min_label_nl">Label minimum (NL)</label>
                <input type="text" id="min_label_nl" name="min_label_nl"
                  value={q?.min_label_nl ?? ''} placeholder="bv. Niet waarschijnlijk" />
              </div>
              <div class="form-field">
                <label for="max_label_nl">Label maximum (NL)</label>
                <input type="text" id="max_label_nl" name="max_label_nl"
                  value={q?.max_label_nl ?? ''} placeholder="bv. Absoluut wel" />
              </div>
              <div class="form-field">
                <label for="min_label_en">Label minimum (EN)</label>
                <input type="text" id="min_label_en" name="min_label_en"
                  value={q?.min_label_en ?? ''} placeholder="e.g. Not likely" />
              </div>
              <div class="form-field">
                <label for="max_label_en">Label maximum (EN)</label>
                <input type="text" id="max_label_en" name="max_label_en"
                  value={q?.max_label_en ?? ''} placeholder="e.g. Extremely likely" />
              </div>
            </div>
          </section>

          {/* ───────── Choice options ───────── */}
          <section class="admin-section type-section type-section-choice">
            <h2>4. Keuze-opties <span class="form-hint">(voor type "Keuze")</span></h2>
            <p class="form-helper">Eén optie per regel. Aantal regels NL en EN moet gelijk zijn.</p>
            <div class="form-grid">
              <div class="form-field full">
                <label for="options_nl">Opties NL</label>
                <textarea id="options_nl" name="options_nl" rows={6}>{(q?.options_nl ?? []).join('\n')}</textarea>
              </div>
              <div class="form-field full">
                <label for="options_en">Opties EN</label>
                <textarea id="options_en" name="options_en" rows={6}>{(q?.options_en ?? []).join('\n')}</textarea>
              </div>
            </div>
          </section>

          {/* ───────── Submit ───────── */}
          <section class="admin-section form-submit-row">
            <a href={`/admin/surveys/${survey.id}/edit`} class="btn btn-ghost">Annuleren</a>
            <span class="spacer"></span>
            <button type="submit" class="btn btn-teal" id="submitBtn">{submitLabel}</button>
          </section>
        </form>
      </main>

      <script src={v('/static/admin-questions.js')} defer></script>
    </Layout>
  )
}

// ============================================================
// QUESTION IMPORT — paste a JSON blob, validate + insert/update
// ============================================================

export const QuestionsImportPage: FC<{ error?: string }> = ({ error }) => {
  const sample = JSON.stringify({
    questions: [
      {
        code: 'q21_voorbeeld',
        type: 'scale',
        category: 'organisatie',
        required: false,
        scale_min: 1,
        scale_max: 5,
        label_nl: 'Hoe tevreden ben je over de inschrijfprocedure?',
        label_en: 'How satisfied are you with the registration process?',
        helper_nl: null,
        helper_en: null,
        min_label_nl: 'Erg ontevreden',
        min_label_en: 'Very dissatisfied',
        max_label_nl: 'Heel tevreden',
        max_label_en: 'Very satisfied',
        options_nl: null,
        options_en: null,
        conditional_on: null,
      },
    ],
  }, null, 2)

  return (
    <Layout title="Vragen importeren — admin" admin>
      <header class="admin-header">
        <a href="/admin/questions" class="btn btn-ghost" style="margin-right:auto;">← Vragenbibliotheek</a>
        <h1 style="margin:0 0 0 16px;">⬆ Vragen importeren</h1>
        <div class="spacer"></div>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main new-survey-form">
        {error ? (
          <div class="form-error" role="alert">
            <strong>Niet geïmporteerd:</strong> {error}
          </div>
        ) : null}

        <section class="admin-section">
          <h2>Plak JSON</h2>
          <p class="form-hint">
            Verwacht: ofwel een JSON-array <code>[{`{...}, {...}`}]</code>, ofwel een object met <code>questions</code>:
            <code>{`{ "questions": [...] }`}</code>. Elk item moet de vereiste velden bevatten (zie voorbeeld onderaan).
          </p>
          <p class="form-hint">
            <strong>Tip:</strong> exporteer eerst de huidige bibliotheek via <a href="/api/admin/questions/export">⬇ Exporteer</a>,
            pas aan, en importeer terug.
          </p>

          <form method="POST" action="/admin/questions/import" id="importForm">
            <div class="form-field full">
              <label for="json">JSON-payload <span class="req">*</span></label>
              <textarea id="json" name="json" rows={20} required spellcheck={false}
                style="font-family:ui-monospace,SFMono-Regular,monospace;font-size:0.85rem;"
                placeholder={sample}></textarea>
            </div>

            <div class="form-field" style="margin-top:14px;">
              <label>Bij bestaande code:</label>
              <label class="radio-inline">
                <input type="radio" name="mode" value="skip" checked />
                <span><strong>Overslaan</strong> — bestaande vragen blijven ongewijzigd (veiligste optie)</span>
              </label>
              <label class="radio-inline">
                <input type="radio" name="mode" value="replace" />
                <span><strong>Vervangen</strong> — overschrijf bestaande velden volledig</span>
              </label>
            </div>

            <div class="form-submit-row" style="margin-top:24px;">
              <a href="/admin/questions" class="btn btn-ghost">Annuleren</a>
              <span class="spacer"></span>
              <button type="button" id="loadSampleBtn" class="btn btn-ghost">📋 Plak voorbeeld</button>
              <button type="submit" class="btn btn-teal" id="importSubmitBtn">⬆ Importeer</button>
            </div>
          </form>
        </section>

        <section class="admin-section">
          <h2>Voorbeeld-payload</h2>
          <pre style="background:#f5f7f9;padding:14px 18px;border-radius:8px;overflow-x:auto;font-size:0.82rem;line-height:1.5;">{sample}</pre>
        </section>
      </main>

      <script src={v('/static/admin-questions.js')} defer></script>
    </Layout>
  )
}
