import type { FC } from 'hono/jsx'
import { Layout } from './layout'

export const LoginPage: FC<{ error?: string }> = ({ error }) => (
  <Layout title="Admin login — Huiskamerconcerten" admin>
    <div class="login-shell">
      <div class="login-card">
        <span class="badge badge-teal italic-serif">Admin</span>
        <h1>Welkom terug</h1>
        <p class="sub">Pensato.org — Reeks I dashboard</p>
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
        <a href="/" class="back-link">← terug naar de vragenlijst</a>
      </div>
    </div>
  </Layout>
)

export const DashboardPage: FC = () => (
  <Layout title="Admin dashboard — Huiskamerconcerten" admin>
    <header class="admin-header">
      <h1>⌂ Huiskamerconcerten · admin</h1>
      <div class="spacer"></div>
      <button id="refreshBtn" class="btn btn-ghost" type="button">↻ Vernieuwen</button>
      <a href="/admin/logout" class="btn btn-ghost">Uitloggen</a>
    </header>

    <main class="admin-main">
      <div class="export-bar no-print">
        <span class="label">Export &amp; beheer:</span>
        <a href="/api/admin/export?format=csv" class="btn">⬇ Export CSV</a>
        <a href="/api/admin/export?format=json" class="btn btn-orange">⬇ Export JSON</a>
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
          <h2>AI-analyse &amp; suggesties voor Reeks II</h2>
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
            <p class="ai-hint">GPT-4o-mini (OpenAI) leest alle responses en formuleert sterktes, verbeterpunten en concrete suggesties voor Reeks II. Resultaat wordt 24u gecached.</p>
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
                <th data-sort="q10_interactie">Jos</th>
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

    {/* PDF generation overlay */}
    <div id="pdfOverlay" class="pdf-overlay no-print" hidden>
      <div class="pdf-overlay-card">
        <div class="pdf-spinner" aria-hidden="true"></div>
        <p id="pdfOverlayMsg">PDF wordt gegenereerd…</p>
      </div>
    </div>

    <script src="/static/admin.js" defer></script>
  </Layout>
)
