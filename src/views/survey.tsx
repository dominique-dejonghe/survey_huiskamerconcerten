import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import { QUESTIONS, SECTIONS, type Question } from '../lib/questions'

const SiteHeader: FC = () => (
  <header class="site-header">
    <div class="site-header-inner">
      <a href="https://www.josvanimmerseel.com/huisconcerten" class="btn-home" aria-label="Home">
        <span aria-hidden="true">⌂</span> Home
      </a>
      <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
      </button>
      <nav class="site-nav" id="siteNav">
        <a href="https://www.josvanimmerseel.com/huisconcerten">Tickets</a>
        <a href="https://www.josvanimmerseel.com">Jos</a>
        <a href="https://www.josvanimmerseel.com">Ayako</a>
      </nav>
    </div>
  </header>
)

const Hero: FC = () => (
  <section class="hero">
    <span class="badge badge-red italic-serif">Reeks I — afgesloten</span>
    <h1>Jouw stem telt</h1>
    <p class="subtitle">
      Een korte vragenlijst over de huiskamerconcerten met Jos van Immerseel en Ayako Ito.
      Jouw eerlijke feedback helpt ons om Reeks II beter te maken.
    </p>
  </section>
)

const ProgressBar: FC = () => (
  <div class="progress-wrapper" role="region" aria-label="Voortgang">
    <div class="progress-inner">
      <div class="progress-track" aria-hidden="true">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <div class="progress-label" id="progressLabel">0 van 20 ingevuld</div>
    </div>
  </div>
)

const IntroCard: FC = () => (
  <div class="intro-card">
    <p>
      Welkom, en <strong>dank dat je tijd neemt</strong>. De vragenlijst telt 20 vragen
      en duurt ongeveer 5 minuten. <strong>8 vragen zijn verplicht</strong>, de rest is
      vrijblijvend — schrijf alleen wat je écht kwijt wil.
    </p>
    <p>
      We bewaren niets meer dan nodig. Je antwoorden zijn anoniem tenzij je expliciet
      contact wenst aan het einde.
    </p>
  </div>
)

const QuestionView: FC<{ q: Question }> = ({ q }) => {
  const required = q.required ? <span class="q-required" aria-label="verplicht">*</span> : null
  return (
    <div class={`q-card q-${q.id}`} data-qid={q.id} data-required={q.required ? '1' : '0'} data-type={q.type}>
      <span class="q-num italic-serif">Vraag {q.number}</span>
      <p class="q-text">{q.text}{required}</p>
      {q.helper ? <p class="q-helper">{q.helper}</p> : null}
      {q.type === 'scale' ? <ScaleInput q={q as any} /> : null}
      {q.type === 'choice' ? <ChoiceInput q={q as any} /> : null}
      {q.type === 'text' ? <TextInput q={q as any} /> : null}
      {q.type === 'paragraph' ? <ParagraphInput q={q as any} /> : null}
      <p class="q-error-msg">Deze vraag is verplicht.</p>
    </div>
  )
}

const ScaleInput: FC<{ q: { id: string; min: number; max: number; minLabel?: string; maxLabel?: string } }> = ({ q }) => {
  const values = []
  for (let i = q.min; i <= q.max; i++) values.push(i)
  const isFive = q.max === 5
  return (
    <>
      <input type="hidden" name={q.id} id={`input_${q.id}`} value="" />
      <div class={isFive ? 'scale5-row' : 'scale-row'} role="radiogroup" aria-labelledby={`label_${q.id}`}>
        {values.map(v => (
          <button
            type="button"
            class={isFive ? 'scale5-btn' : 'scale-btn'}
            data-q={q.id}
            data-v={v}
            aria-label={`Score ${v}`}
          >{v}</button>
        ))}
      </div>
      {q.minLabel || q.maxLabel ? (
        <div class="scale-labels">
          <span>{q.minLabel ?? ''}</span>
          <span>{q.maxLabel ?? ''}</span>
        </div>
      ) : null}
    </>
  )
}

const ChoiceInput: FC<{ q: { id: string; options: string[]; conditional?: { showField: string; whenValue: string } } }> = ({ q }) => (
  <>
    <input type="hidden" name={q.id} id={`input_${q.id}`} value="" />
    <div class="choice-row" role="radiogroup">
      {q.options.map(opt => (
        <button type="button" class="choice-btn" data-q={q.id} data-v={opt}>{opt}</button>
      ))}
    </div>
    {q.conditional ? (
      <div id={`cond_${q.conditional.showField}`} style="display:none; margin-top:14px;">
        <label for={q.conditional.showField} style="font-family:'Playfair Display',serif;font-style:italic;color:#555;font-size:14px;display:block;margin-bottom:6px;">
          Je e-mailadres
        </label>
        <input type="email" id={q.conditional.showField} name={q.conditional.showField} placeholder="naam@voorbeeld.be" autocomplete="email" />
      </div>
    ) : null}
  </>
)

const TextInput: FC<{ q: { id: string } }> = ({ q }) => (
  <input type="text" id={q.id} name={q.id} maxlength="500" autocomplete="off" />
)

const ParagraphInput: FC<{ q: { id: string } }> = ({ q }) => (
  <textarea id={q.id} name={q.id} rows={4} maxlength="3000" autocomplete="off"></textarea>
)

const SectionDivider: FC<{ id: string }> = ({ id }) => {
  const s = SECTIONS.find(x => x.id === id)!
  return (
    <div class="section-divider" id={`section-${id}`}>
      <span class="badge badge-orange italic-serif">{s.title}</span>
      <h2>{s.subtitle}</h2>
    </div>
  )
}

export const SurveyPage: FC = () => {
  // Bouw de pagina sectie per sectie
  const grouped: Record<string, Question[]> = {}
  for (const q of QUESTIONS) {
    if (!grouped[q.section]) grouped[q.section] = []
    grouped[q.section].push(q)
  }
  return (
    <Layout title="Jouw stem telt — Huiskamerconcerten Reeks I">
      <SiteHeader />
      <Hero />
      <ProgressBar />
      <main class="container">
        <IntroCard />
        <form id="surveyForm" novalidate autocomplete="off">
          {/* Honeypot */}
          <input type="text" name="website" id="website" class="honeypot" tabindex={-1} autocomplete="off" aria-hidden="true" />

          {SECTIONS.map(section => (
            <>
              <SectionDivider id={section.id} />
              {(grouped[section.id] || []).map(q => <QuestionView q={q} />)}
            </>
          ))}

          <div class="submit-row">
            <button type="submit" class="btn-submit" id="submitBtn">
              <span>Verstuur antwoorden</span>
              <span class="arrow" aria-hidden="true">→</span>
            </button>
            <p class="submit-note">Anoniem tenzij je contact wenst · we bewaren niets meer dan nodig</p>
          </div>
        </form>
      </main>
      <footer class="site-footer">
        <p>
          <span class="italic-serif">Andre Devaere VZW</span> · Huiskamerconcerten Reeks I ·{' '}
          <a href="/privacy">Privacy</a>
        </p>
      </footer>
      <script src="/static/survey.js" defer></script>
    </Layout>
  )
}

export const ThanksPage: FC = () => (
  <Layout title="Dank je — Huiskamerconcerten">
    <SiteHeader />
    <main class="thanks">
      <div class="ornament" aria-hidden="true">❦</div>
      <h1>Dank je. Echt.</h1>
      <p>
        Jouw stem helpt ons om Reeks II niet zomaar een herhaling te maken,
        maar iets beter.
      </p>
      <p class="signature">— Dominique Dejonghe, Andre Devaere VZW</p>
    </main>
    <footer class="site-footer">
      <p><span class="italic-serif">Andre Devaere VZW</span></p>
    </footer>
  </Layout>
)

export const PrivacyPage: FC = () => (
  <Layout title="Privacy — Huiskamerconcerten">
    <SiteHeader />
    <main class="container" style="padding-top:40px;">
      <h1 style="font-style:italic;">Privacy</h1>
      <p>
        Andre Devaere VZW verzamelt enkel de antwoorden die je hier geeft. We slaan
        geen IP-adressen op in plaintext (enkel een eenrichtingshash voor anti-spam).
        Je naam en e-mailadres bewaren we alleen als je daar expliciet om vraagt
        bij vraag 20.
      </p>
      <p>
        We gebruiken geen tracking-cookies, geen Google Analytics. Data wordt na
        24 maanden automatisch geanonimiseerd. Verzoeken tot verwijdering kunnen via{' '}
        <a href="mailto:dominique.dejonghe@iutum.be">dominique.dejonghe@iutum.be</a>.
      </p>
      <p><a href="/">← Terug naar de vragenlijst</a></p>
    </main>
    <footer class="site-footer">
      <p><span class="italic-serif">Andre Devaere VZW</span></p>
    </footer>
  </Layout>
)
