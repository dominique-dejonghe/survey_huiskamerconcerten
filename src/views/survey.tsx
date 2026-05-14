import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import { QUESTIONS, type Question, surveyQuestionsToUi } from '../lib/questions'
import type { SurveyQuestion, SurveySection } from '../lib/surveys'
import { UI, SECTIONS_I18N, QUESTIONS_I18N, type Lang } from '../lib/i18n'
import type { Brand, Survey } from '../lib/surveys'
import { v } from '../lib/version'

/** Section-render record used by the public survey page. Either built from
 *  the per-survey snapshot in the DB, or as a fallback from SECTIONS_I18N. */
type RenderSection = { id: string; title: string; subtitle: string }

const SiteHeader: FC<{ lang: Lang; brand?: Brand | null; survey?: Survey | null }> = ({ lang, brand, survey }) => {
  const t = UI[lang]
  // Build the language-switch URL that stays inside the same survey
  let langOtherHref = t.langOtherHref
  if (brand && survey) {
    langOtherHref = lang === 'en'
      ? `/${brand.url_prefix}/${survey.slug}`
      : `/${brand.url_prefix}/${survey.slug}/en`
  }
  const homeHref = brand?.website_url ?? 'https://www.josvanimmerseel.com/huisconcerten'
  const showJosLinks = !brand || brand.id === 'huiskamer'
  return (
    <header class="site-header">
      <div class="site-header-inner">
        {brand?.logo_url ? (
          <a href={homeHref} class="site-logo-link" aria-label={t.home}>
            <img src={brand.logo_url} alt={lang === 'en' ? brand.name_en : brand.name_nl} class="site-logo" />
          </a>
        ) : (
          <a href={homeHref} class="btn-home" aria-label={t.home}>
            <span aria-hidden="true">⌂</span> {t.home}
          </a>
        )}
        <button class="nav-toggle" id="navToggle" aria-label={t.menuLabel} aria-expanded="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
        <nav class="site-nav" id="siteNav">
          <a href={homeHref}>{t.navTickets}</a>
          {showJosLinks ? (
            <>
              <a href="https://www.josvanimmerseel.com/bio_jos">{t.navJos}</a>
              <a href="https://www.ayako-ito-fortepiano.com/">{t.navAyako}</a>
            </>
          ) : null}
          <a href={langOtherHref} class="lang-switch" aria-label={t.langSwitchAria} title={t.langOtherFull}>
            <span aria-hidden="true">🌐</span> {t.langOther}
          </a>
        </nav>
      </div>
    </header>
  )
}

const Hero: FC<{ lang: Lang; brand?: Brand | null; survey?: Survey | null }> = ({ lang, brand, survey }) => {
  const t = UI[lang]
  const title = survey ? (lang === 'en' ? survey.title_en : survey.title_nl) : t.heroTitle
  const subtitle = survey
    ? ((lang === 'en' ? survey.subtitle_en : survey.subtitle_nl) ?? t.heroSub)
    : t.heroSub
  return (
    <section class="hero">
      <h1>{title}</h1>
      <p class="subtitle">{subtitle}</p>
    </section>
  )
}

const ProgressBar: FC<{ lang: Lang; total?: number }> = ({ lang, total = 20 }) => {
  const t = UI[lang]
  return (
    <div class="progress-wrapper" role="region" aria-label={t.progressRegion}>
      <div class="progress-inner">
        <div class="progress-track" aria-hidden="true">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="progress-label" id="progressLabel" data-total={String(total)} data-i18n-progress={lang}>
          {t.progressLabel(0, total)}
        </div>
      </div>
    </div>
  )
}

const IntroCard: FC<{ lang: Lang; brand?: Brand | null; survey?: Survey | null }> = ({ lang, brand, survey }) => {
  const t = UI[lang]
  // Survey-specific intro takes priority
  const customIntro = survey ? (lang === 'en' ? survey.intro_en : survey.intro_nl) : null
  if (customIntro) {
    return (
      <div class="intro-card">
        {customIntro.split(/\n\n+/).map(p => <p>{p}</p>)}
      </div>
    )
  }
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

const QuestionView: FC<{ q: Question; lang: Lang; useI18nOverride?: boolean }> = ({ q, lang, useI18nOverride = false }) => {
  const t = UI[lang]
  // When rendering DB-backed snapshot questions, the question text/labels/options
  // already come in the requested language from the database — never override
  // with the hardcoded QUESTIONS_I18N table (which was the old single-survey
  // i18n source and is now intentionally bypassed for snapshot surveys).
  const i18n = useI18nOverride ? QUESTIONS_I18N[q.id]?.[lang] : undefined
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

const SectionDivider: FC<{ section: RenderSection }> = ({ section }) => {
  return (
    <div class="section-divider" id={`section-${section.id}`}>
      <span class="badge badge-orange italic-serif">{section.title}</span>
      {section.subtitle ? <h2>{section.subtitle}</h2> : null}
    </div>
  )
}

export const SurveyPage: FC<{
  lang?: Lang
  brand?: Brand | null
  survey?: Survey | null
  /** Per-survey snapshot questions, the new source of truth. When provided
   *  we render exclusively from these and bypass the hardcoded QUESTIONS array. */
  surveyQuestions?: SurveyQuestion[] | null
  /** Per-survey snapshot section dividers, the new source of truth. When provided
   *  we render exclusively from these and bypass the hardcoded SECTIONS_I18N. */
  surveySections?: SurveySection[] | null
}> = ({ lang = 'nl', brand, survey, surveyQuestions, surveySections }) => {
  const t = UI[lang]
  // Build the runtime question list.
  //  - If snapshot rows were supplied (the normal case from the route handler):
  //    convert them to UI Question shape in the requested language. The DB is
  //    the source of truth for wording, scale, options, required flag, etc.
  //  - Otherwise fall back to the hardcoded QUESTIONS (legacy code paths,
  //    e.g. server-side rendering without a survey context).
  const fromSnapshot = Array.isArray(surveyQuestions) && surveyQuestions.length > 0
  // Build the set of section_ids the survey actually knows about — used to
  // resolve a question's category to its proper section (incl. custom ones).
  const knownSectionIds = new Set(
    (surveySections || []).map(s => s.section_id.toLowerCase()),
  )
  const filtered: Question[] = fromSnapshot
    ? surveyQuestionsToUi(surveyQuestions!, lang, knownSectionIds.size > 0 ? knownSectionIds : undefined)
    : (() => {
        const wanted = survey?.question_codes ?? null
        return wanted ? QUESTIONS.filter(q => wanted.includes(q.id)) : QUESTIONS
      })()
  const grouped: Record<string, Question[]> = {}
  for (const q of filtered) {
    if (!grouped[q.section]) grouped[q.section] = []
    grouped[q.section].push(q)
  }
  // Build the section divider list:
  //  - If a per-survey snapshot of sections is supplied: use it as the source of
  //    truth (admin-edited title + subtitle, per-survey ordering).
  //  - Otherwise fall back to the hardcoded SECTIONS_I18N (legacy code paths).
  const sectionsFromSnapshot = Array.isArray(surveySections) && surveySections.length > 0
  const sections: RenderSection[] = sectionsFromSnapshot
    ? surveySections!.map(s => ({
        id: s.section_id,
        title: lang === 'en' ? (s.title_en || s.title_nl) : s.title_nl,
        subtitle: lang === 'en'
          ? (s.subtitle_en || s.subtitle_nl || '')
          : (s.subtitle_nl || ''),
      }))
    : SECTIONS_I18N[lang].map(s => ({ id: s.id, title: s.title, subtitle: s.subtitle }))
  // Catch-all for questions whose section_id isn't in the survey's section list
  // (e.g. orphan question after a section was deleted, or legacy data) — render
  // them under the first section so they aren't silently lost.
  const renderableSectionIds = new Set(sections.map(s => s.id))
  const orphanQuestions: Question[] = []
  for (const sid of Object.keys(grouped)) {
    if (!renderableSectionIds.has(sid)) {
      orphanQuestions.push(...grouped[sid])
      delete grouped[sid]
    }
  }
  if (orphanQuestions.length > 0 && sections.length > 0) {
    const firstId = sections[0].id
    grouped[firstId] = [...(grouped[firstId] || []), ...orphanQuestions]
  }
  const totalQuestions = filtered.length
  // Thanks URL stays within the survey context
  const thanksUrl = brand && survey
    ? `/${brand.url_prefix}/${survey.slug}/${lang === 'en' ? 'thank-you' : 'dank-je'}`
    : (lang === 'en' ? '/thank-you' : '/dank-je')
  const clientI18n = {
    lang,
    progressTpl: t.progressLabel(0, totalQuestions).replace('0', '__N__').replace(String(totalQuestions), '__T__'),
    submitting: t.submitSending,
    submit: t.submitBtn,
    rateLimit: t.errRateLimit,
    something: t.errSomething,
    network: t.errNetwork,
    unknown: t.errUnknown,
    thanksUrl,
    surveyId: survey?.id ?? 1,
    brandPrefix: brand?.url_prefix ?? 'h',
    surveySlug: survey?.slug ?? 'reeks-1-immerseel-ito',
  }
  const titleString = survey
    ? (lang === 'en' ? `${survey.title_en} — survey` : `${survey.title_nl} — enquête`)
    : t.surveyTitle
  return (
    <Layout title={titleString} lang={lang} brand={brand}>
      <SiteHeader lang={lang} brand={brand} survey={survey} />
      <Hero lang={lang} brand={brand} survey={survey} />
      <ProgressBar lang={lang} total={totalQuestions} />
      <main class="container">
        <IntroCard lang={lang} brand={brand} survey={survey} />
        <form id="surveyForm" novalidate autocomplete="off">
          {/* Honeypot */}
          <input type="text" name="website" id="website" class="honeypot" tabindex={-1} autocomplete="off" aria-hidden="true" />
          <input type="hidden" name="lang" id="lang" value={lang} />
          <input type="hidden" name="survey_id" id="survey_id" value={String(survey?.id ?? 1)} />
          <input type="hidden" name="brand_prefix" id="brand_prefix" value={brand?.url_prefix ?? 'h'} />
          <input type="hidden" name="survey_slug" id="survey_slug" value={survey?.slug ?? ''} />

          {sections.map(section => {
            const list = grouped[section.id] || []
            if (list.length === 0) return null
            return (
              <>
                <SectionDivider section={section} />
                {list.map(q => (
                  <QuestionView q={q} lang={lang} useI18nOverride={!fromSnapshot} />
                ))}
              </>
            )
          })}

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
        dangerouslySetInnerHTML={{ __html: `window.SURVEY_I18N=${JSON.stringify(clientI18n)};` }}
      />
      <script src={v('/static/survey.js')} defer></script>
    </Layout>
  )
}

export const ThanksPage: FC<{ lang?: Lang; brand?: Brand | null; survey?: Survey | null }> = ({ lang = 'nl', brand, survey }) => {
  const t = UI[lang]
  const customThanks = survey ? (lang === 'en' ? survey.thanks_en : survey.thanks_nl) : null
  return (
    <Layout title={t.thanksTitle} lang={lang} brand={brand}>
      <SiteHeader lang={lang} brand={brand} survey={survey} />
      <main class="thanks">
        <div class="ornament" aria-hidden="true">❦</div>
        <h1>{t.thanksHeadline}</h1>
        {customThanks
          ? customThanks.split(/\n\n+/).map(p => <p>{p}</p>)
          : <p>{t.thanksBody}</p>
        }
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
