import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Brand, Survey } from '../lib/surveys'
import type { ListSurveysWithStatsRow } from '../lib/surveys'

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
          </div>
          {open.length === 0
            ? <p style="color:#777;font-style:italic;">Geen open enquêtes.</p>
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
          <p style="color:#777;font-size:13px;margin-top:12px;">
            Een nieuwe enquête aanmaken? Dit gebeurt momenteel via de SQL-console (zie README).
            Een interactief formulier komt in de volgende iteratie.
          </p>
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
export const DashboardPage: FC<{ survey: Survey }> = ({ survey }) => {
  const titleString = `${survey.title_nl} — admin`
  return (
    <Layout title={titleString} admin>
      <header class="admin-header">
        <a href="/admin" class="btn btn-ghost" style="margin-right:auto;">← Alle enquêtes</a>
        <h1 style="margin:0 0 0 16px;">⌂ {survey.title_nl}</h1>
        <div class="spacer"></div>
        <button id="refreshBtn" class="btn btn-ghost" type="button">↻ Vernieuwen</button>
        <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
      </header>

      <main class="admin-main" data-survey-id={String(survey.id)} data-survey-slug={survey.slug} data-brand-prefix={survey.brand_id === 'huiskamer' ? 'h' : survey.brand_id === 'ebdiep' ? 'e' : 'h'}>
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

      <script src="/static/admin.js" defer></script>
    </Layout>
  )
}
