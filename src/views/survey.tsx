import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import { QUESTIONS, type Question } from '../lib/questions'
import { UI, SECTIONS_I18N, QUESTIONS_I18N, type Lang } from '../lib/i18n'

const SiteHeader: FC<{ lang: Lang }> = ({ lang }) => {
  const t = UI[lang]
  return (
    <header class="site-header">
      <div class="site-header-inner">
        <a href="https://www.josvanimmerseel.com/huisconcerten" class="btn-home" aria-label={t.home}>
          <span aria-hidden="true">⌂</span> {t.home}
        </a>
        <button class="nav-toggle" id="navToggle" aria-label={t.menuLabel} aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <nav class="site-nav" id="siteNav">
          <a href="https://www.josvanimmerseel.com/huisconcerten">{t.navTickets}</a>
          <a href="https://www.josvanimmerseel.com/bio_jos">{t.navJos}</a>
          <a href="https://www.ayako-ito-fortepiano.com/">{t.navAyako}</a>
          <a href={t.langOtherHref} class="lang-switch" aria-label={t.langSwitchAria} title={t.langOtherFull}>
            <span aria-hidden="true">🌐</span> {t.langOther}
          </a>
        </nav>
      </div>
    </header>
  )
}

const Hero: FC<{ lang: Lang }> = ({ lang }) => {
  const t = UI[lang]
  return (
    <section class="hero">
      <span class="badge badge-red italic-serif">{t.badge}</span>
      <h1>{t.heroTitle}</h1>
      <p class="subtitle">{t.heroSub}</p>
    </section>
  )
}

const ProgressBar: FC<{ lang: Lang }> = ({ lang }) => {
  const t = UI[lang]
  return (
    <div class="progress-wrapper" role="region" aria-label={t.progressRegion}>
      <div class="progress-inner">
        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="progress-label" id="progressLabel" data-total="20" data-i18n-progress={lang}>
          {t.progressLabel(0, 20)}
        </div>
      </div>
    </div>
  )
}

const IntroCard: FC<{ lang: Lang }> = ({ lang }) => {
  const t = UI[lang]
  return (
    <div class="intro-card">
      <p>
        {t.introP1Welcome}<strong>{t.introP1Strong1}</strong>{t.introP1Mid}
        <strong>{t.introP1Strong2}</strong>{t.introP1End}
      </p>
      <p>{t.introP2}</p>
    </div>
  )
}

const QuestionView: FC<{ q: Question; lang: Lang }> = ({ q, lang }) => {
  const t = UI[lang]
  const i18n = QUESTIONS_I18N[q.id]?.[lang]
  const text = i18n?.text ?? q.text
  const helper = i18n?.helper ?? q.helper
  const minLabel = (q.type === 'scale' ? (i18n?.minLabel ?? (q as any).minLabel) : undefined) as string | undefined
  const maxLabel = (q.type === 'scale' ? (i18n?.maxLabel ?? (q as any).maxLabel) : undefined) as string | undefined
  const options = (q.type === 'choice' ? (i18n?.options ?? (q as any).options) : undefined) as string[] | undefined
  const required = q.required ? <span class="q-required" aria-label={t.requiredLabel}>*</span> : null
  return (
    <div class={`q-card q-${q.id}`} data-qid={q.id} data-required={q.required ? '1' : '0'} data-type={q.type}>
      <span class="q-num italic-serif">{t.questionLabel(q.number)}</span>
      <p class="q-text">{text}{required}</p>
      {helper ? <p class="q-helper">{helper}</p> : null}
      {q.type === 'scale' ? <ScaleInput q={q as any} minLabel={minLabel} maxLabel={maxLabel} /> : null}
      {q.type === 'choice' ? <ChoiceInput q={q as any} options={options ?? (q as any).options} lang={lang} /> : null}
      {q.type === 'text' ? <TextInput q={q as any} /> : null}
      {q.type === 'paragraph' ? <ParagraphInput q={q as any} /> : null}
      <p class="q-error-msg">{t.requiredErrorMsg}</p>
    </div>
  )
}

const ScaleInput: FC<{ q: { id: string; min: number; max: number }; minLabel?: string; maxLabel?: string }> = ({ q, minLabel, maxLabel }) => {
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
      {minLabel || maxLabel ? (
        <div class="scale-labels">
          <span>{minLabel ?? ''}</span>
          <span>{maxLabel ?? ''}</span>
        </div>
      ) : null}
    </>
  )
}

const ChoiceInput: FC<{ q: { id: string; options: string[]; conditional?: { showField: string; whenValue: string } }; options: string[]; lang: Lang }> = ({ q, options, lang }) => {
  const t = UI[lang]
  // For q3_aantal we need to map display value → canonical NL value via data-canon
  // For q20_contact: store ja/nee canonical
  return (
    <>
      <input type="hidden" name={q.id} id={`input_${q.id}`} value="" />
      <div class="choice-row" role="radiogroup">
        {options.map((opt, idx) => {
          // canonical (NL) value
          let canonical = q.options[idx] ?? opt
          return (
            <button type="button" class="choice-btn" data-q={q.id} data-v={opt} data-canon={canonical}>{opt}</button>
          )
        })}
      </div>
      {q.conditional ? (
        <div id={`cond_${q.conditional.showField}`} style="display:none; margin-top:14px;">
          <label for={q.conditional.showField} style="font-family:'Playfair Display',serif;font-style:italic;color:#555;font-size:14px;display:block;margin-bottom:6px;">
            {t.emailLabel}
          </label>
          <input type="email" id={q.conditional.showField} name={q.conditional.showField} placeholder={t.emailPlaceholder} autocomplete="email" />
        </div>
      ) : null}
    </>
  )
}

const TextInput: FC<{ q: { id: string } }> = ({ q }) => (
  <input type="text" id={q.id} name={q.id} maxlength="500" autocomplete="off" />
)

const ParagraphInput: FC<{ q: { id: string } }> = ({ q }) => (
  <textarea id={q.id} name={q.id} rows={4} maxlength="3000" autocomplete="off"></textarea>
)

const SectionDivider: FC<{ id: string; lang: Lang }> = ({ id, lang }) => {
  const sections = SECTIONS_I18N[lang]
  const s = sections.find(x => x.id === id)!
  return (
    <div class="section-divider" id={`section-${id}`}>
      <span class="badge badge-orange italic-serif">{s.title}</span>
      <h2>{s.subtitle}</h2>
    </div>
  )
}

export const SurveyPage: FC<{ lang?: Lang }> = ({ lang = 'nl' }) => {
  const t = UI[lang]
  const grouped: Record<string, Question[]> = {}
  for (const q of QUESTIONS) {
    if (!grouped[q.section]) grouped[q.section] = []
    grouped[q.section].push(q)
  }
  const sections = SECTIONS_I18N[lang]
  // i18n payload for client-side script
  const clientI18n = {
    lang,
    progressTpl: t.progressLabel(0, 20).replace('0', '__N__').replace('20', '__T__'),
    submitting: t.submitSending,
    submit: t.submitBtn,
    rateLimit: t.errRateLimit,
    something: t.errSomething,
    network: t.errNetwork,
    unknown: t.errUnknown,
    thanksUrl: lang === 'en' ? '/thank-you' : '/dank-je',
  }
  return (
    <Layout title={t.surveyTitle} lang={lang}>
      <SiteHeader lang={lang} />
      <Hero lang={lang} />
      <ProgressBar lang={lang} />
      <main class="container">
        <IntroCard lang={lang} />
        <form id="surveyForm" novalidate autocomplete="off">
          {/* Honeypot */}
          <input type="text" name="website" id="website" class="honeypot" tabindex={-1} autocomplete="off" aria-hidden="true" />
          <input type="hidden" name="lang" id="lang" value={lang} />

          {sections.map(section => (
            <>
              <SectionDivider id={section.id} lang={lang} />
              {(grouped[section.id] || []).map(q => <QuestionView q={q} lang={lang} />)}
            </>
          ))}

          <div class="submit-row">
            <button type="submit" class="btn-submit" id="submitBtn">
              <span>{t.submitBtn}</span>
              <span class="arrow" aria-hidden="true">→</span>
            </button>
            <p class="submit-note">{t.submitNote}</p>
          </div>
        </form>
      </main>
      <footer class="site-footer">
        <p>
          <span class="italic-serif">{t.footerCredit}</span> · {t.footerCenter} ·{' '}
          <a href={lang === 'en' ? '/en/privacy' : '/privacy'}>{t.privacyLink}</a>
        </p>
      </footer>
      <script
        // i18n config for survey.js (read via window.SURVEY_I18N)
        dangerouslySetInnerHTML={{ __html: `window.SURVEY_I18N=${JSON.stringify(clientI18n)};` }}
      />
      <script src="/static/survey.js" defer></script>
    </Layout>
  )
}

export const ThanksPage: FC<{ lang?: Lang }> = ({ lang = 'nl' }) => {
  const t = UI[lang]
  return (
    <Layout title={t.thanksTitle} lang={lang}>
      <SiteHeader lang={lang} />
      <main class="thanks">
        <div class="ornament" aria-hidden="true">❦</div>
        <h1>{t.thanksHeadline}</h1>
        <p>{t.thanksBody}</p>
        <p class="signature">{t.thanksSig}</p>
      </main>
      <footer class="site-footer">
        <p><span class="italic-serif">{t.footerCredit}</span></p>
      </footer>
    </Layout>
  )
}

export const PrivacyPage: FC<{ lang?: Lang }> = ({ lang = 'nl' }) => {
  const t = UI[lang]
  return (
    <Layout title={t.privacyTitle} lang={lang}>
      <SiteHeader lang={lang} />
      <main class="container" style="padding-top:40px;">
        <h1 style="font-style:italic;">{t.privacyHeading}</h1>
        <p>{t.privacyP1}</p>
        <p>
          {t.privacyP2Pre}
          <a href="mailto:dominique.dejonghe@iutum.be">dominique.dejonghe@iutum.be</a>
          {t.privacyP2Post}
        </p>
        <p><a href={lang === 'en' ? '/en' : '/'}>{t.privacyBack}</a></p>
      </main>
      <footer class="site-footer">
        <p><span class="italic-serif">{t.footerCredit}</span></p>
      </footer>
    </Layout>
  )
}
