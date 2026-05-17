import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { SurveyPage, ThanksPage, PrivacyPage } from './views/survey'
import { LandingPage } from './views/landing'
import {
  LoginPage, DashboardPage, AdminOverviewPage, NewSurveyPage, EditSurveyPage,
  QuestionsLibraryPage, QuestionEditorPage, QuestionsImportPage,
  SurveyQuestionEditorPage,
} from './views/admin'
import { responseSchema, validateSurveyAnswers, extractAnswers } from './lib/validation'
import { hashIp } from './lib/crypto'
import {
  insertResponse, listResponses, deleteAllResponses,
  logAudit, checkRateLimit, softDeleteResponse,
} from './lib/db'
import { computeStats } from './lib/stats'
import { rowsToCsv, rowsToJson } from './lib/csv'
import { buildSurveyDocx } from './lib/docx-report'
import {
  type Bindings,
  createAdminSession, clearAdminSession, getAdminSession,
  requireAdmin, checkAdminCredentials,
} from './lib/auth'
import { sendNewResponseNotification } from './lib/email'
import {
  generateAnalysis, getCachedAnalysis, saveCachedAnalysis, clearCachedAnalysis,
} from './lib/ai'
import {
  listBrands, listSurveys, listSurveysWithStats,
  getBrandByPrefix, getSurveyBySlug, getSurveyById, getBrand,
  listLibraryQuestions, createSurvey, slugify, generateUniqueSlug,
  updateSurvey, generateUniqueSlugForUpdate,
  deleteSurvey, duplicateSurvey, getResponseCountForSurvey,
  getLibraryQuestion, createQuestion, updateQuestion, deleteQuestion,
  validateQuestionInput, getSurveysUsingQuestion, importQuestions,
  listSurveyQuestions, getSurveyQuestion,
  copyLibraryQuestionToSurvey, createSurveyQuestion,
  updateSurveyQuestion, deleteSurveyQuestion, reorderSurveyQuestions,
  reorderAndReassignSurveyQuestions,
  listSurveySections, getSurveySection,
  upsertSurveySection, deleteSurveySection,
  copySurveySections, seedDefaultSurveySections,
  type QuestionInput,
} from './lib/surveys'
import type { Lang } from './lib/i18n'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())

// Stricter CSP for public routes
app.use('*', async (c, next) => {
  const path = c.req.path
  const isAdmin = path.startsWith('/admin') || path.startsWith('/api/admin')
  const csp = isAdmin
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob: https://api.qrserver.com",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
      ].join('; ')
  c.header('Content-Security-Policy', csp)
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Frame-Options', 'DENY')
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  await next()
})
app.use('/api/*', cors({ origin: (o) => o ?? '*', credentials: true }))

// ----- Helpers -----
function getClientIp(c: any): string {
  return c.req.header('cf-connecting-ip')
    || c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || '0.0.0.0'
}

async function adminSurveyId(c: any): Promise<number> {
  const raw = c.req.query('survey')
  const id = raw ? parseInt(raw, 10) : NaN
  if (Number.isFinite(id) && id > 0) {
    const s = await getSurveyById(c.env.DB, id)
    if (s) return s.id
  }
  return 1 // backwards-compatible default
}

// ============================================================
// LANDING + LEGACY REDIRECTS
// ============================================================
app.get('/', async (c) => {
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'open' })
  const brands = await listBrands(c.env.DB)
  return c.html(<LandingPage lang="nl" surveys={surveys} brands={brands} />)
})
app.get('/en', async (c) => {
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'open' })
  const brands = await listBrands(c.env.DB)
  return c.html(<LandingPage lang="en" surveys={surveys} brands={brands} />)
})

// Legacy redirects: keep old links to Reeks I working
app.get('/dank-je', (c) => c.html(<ThanksPage lang="nl" />))
app.get('/privacy', (c) => c.html(<PrivacyPage lang="nl" />))
app.get('/thank-you', (c) => c.html(<ThanksPage lang="en" />))
app.get('/en/privacy', (c) => c.html(<PrivacyPage lang="en" />))
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// ============================================================
// PUBLIC SURVEY ROUTES — /h/:slug and /e/:slug (NL + EN)
// ============================================================
/**
 * Cache-Control headers for public survey HTML.
 *
 * Survey questions / wording can change at any moment from the admin. We
 * absolutely cannot let browsers or intermediaries cache a stale version of
 * the rendered HTML — otherwise an admin edit will only become visible to
 * visitors after their browser cache eventually expires (which can be hours
 * or days). So we explicitly forbid all caching here.
 *
 * Note: static assets under /static/* still use ASSET_VERSION cache busting
 * and remain aggressively cacheable, which is what we want for JS/CSS/fonts.
 */
function setNoCacheHeaders(c: any) {
  c.header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
  c.header('Pragma', 'no-cache')
  c.header('Expires', '0')
}

async function renderSurveyForSlug(c: any, prefix: string, slug: string, lang: Lang) {
  const brand = await getBrandByPrefix(c.env.DB, prefix)
  if (!brand) return c.notFound()
  const survey = await getSurveyBySlug(c.env.DB, prefix, slug)
  if (!survey) return c.notFound()
  if (survey.status !== 'open') {
    // Could render a "closed" page; for now redirect to landing
    return c.redirect(lang === 'en' ? '/en' : '/')
  }
  // Load the survey's OWN questions from the snapshot table — NOT the library.
  // This is the whole point of the snapshot refactor: each survey lives its
  // own life, edits to the library never propagate retroactively.
  const surveyQuestions = await listSurveyQuestions(c.env.DB, survey.id)
  // Same story for section dividers: read the per-survey snapshot. Lazy-seed
  // defaults the very first time an old survey (created before migration 0008)
  // is requested, so admins can edit them.
  let surveySections = await listSurveySections(c.env.DB, survey.id)
  if (surveySections.length === 0) {
    try {
      await seedDefaultSurveySections(c.env.DB, survey.id)
      surveySections = await listSurveySections(c.env.DB, survey.id)
    } catch (e) {
      console.error('seedDefaultSurveySections (renderSurveyForSlug) failed', e)
    }
  }
  setNoCacheHeaders(c)
  return c.html(
    <SurveyPage lang={lang} brand={brand} survey={survey}
      surveyQuestions={surveyQuestions} surveySections={surveySections} />
  )
}

app.get('/:prefix{[he]}/:slug', async (c) => {
  return renderSurveyForSlug(c, c.req.param('prefix'), c.req.param('slug'), 'nl')
})
app.get('/:prefix{[he]}/:slug/en', async (c) => {
  return renderSurveyForSlug(c, c.req.param('prefix'), c.req.param('slug'), 'en')
})
app.get('/:prefix{[he]}/:slug/dank-je', async (c) => {
  const brand = await getBrandByPrefix(c.env.DB, c.req.param('prefix'))
  const survey = await getSurveyBySlug(c.env.DB, c.req.param('prefix'), c.req.param('slug'))
  if (!brand || !survey) return c.notFound()
  return c.html(<ThanksPage lang="nl" brand={brand} survey={survey} />)
})
app.get('/:prefix{[he]}/:slug/thank-you', async (c) => {
  const brand = await getBrandByPrefix(c.env.DB, c.req.param('prefix'))
  const survey = await getSurveyBySlug(c.env.DB, c.req.param('prefix'), c.req.param('slug'))
  if (!brand || !survey) return c.notFound()
  return c.html(<ThanksPage lang="en" brand={brand} survey={survey} />)
})

// ============================================================
// API: SUBMIT RESPONSE
// ============================================================
app.post('/api/responses', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid_json' }, 400) }

  // ── Stap 1: metadata-validatie (Zod) ───────────────────────
  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      error: 'validation_failed',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    }, 400)
  }

  const data = parsed.data as any
  if ((data.website ?? '').trim().length > 0) {
    return c.json({ error: 'spam_detected' }, 400)
  }

  // ── Resolve survey ─────────────────────────────────────────
  // Default = 1 (Reeks I), maar liefst expliciet via id of slug.
  let surveyId = 1
  if (typeof data.survey_id === 'number' && data.survey_id > 0) {
    const s = await getSurveyById(c.env.DB, data.survey_id)
    if (s) surveyId = s.id
  } else if (typeof data.brand_prefix === 'string' && typeof data.survey_slug === 'string') {
    const s = await getSurveyBySlug(c.env.DB, data.brand_prefix, data.survey_slug)
    if (s) surveyId = s.id
  }

  const survey = await getSurveyById(c.env.DB, surveyId)
  if (!survey) return c.json({ error: 'unknown_survey' }, 400)
  if (survey.status !== 'open') return c.json({ error: 'survey_closed' }, 403)

  // ── Stap 2: per-vraag-validatie tegen survey snapshot ──────
  const surveyQuestions = await listSurveyQuestions(c.env.DB, surveyId)
  const answers = extractAnswers(parsed.data)
  const issues = validateSurveyAnswers(surveyQuestions, answers)
  if (issues.length > 0) {
    return c.json({ error: 'validation_failed', details: issues }, 400)
  }

  // ── Rate limit + persist ───────────────────────────────────
  const ip = getClientIp(c)
  const salt = c.env.IP_HASH_SALT || 'dev-salt-change-me'
  const ipHash = await hashIp(ip, salt)
  const userAgent = c.req.header('user-agent') ?? ''

  const rl = await checkRateLimit(c.env.DB, ipHash, 3)
  if (!rl.ok) {
    await logAudit(c.env.DB, 'rate_limited', ipHash, { current: rl.current, surveyId })
    return c.json({ error: 'rate_limited', message: 'Maximum 3 inzendingen per uur.' }, 429)
  }

  const id = await insertResponse(c.env.DB, answers, { ipHash, userAgent, surveyId, lang: data.lang || 'nl' })
  await logAudit(c.env.DB, 'response_submitted', ipHash, { id, surveyId, codes: Object.keys(answers).length })

  // ── E-mail notificatie (best-effort, alleen voor Reeks I-stijl
  //    surveys met q1_nps / q3_aantal / q15_wensen_2 in de antwoorden) ──
  const url = new URL(c.req.url)
  const siteUrl = `${url.protocol}//${url.host}`
  const nps = typeof answers.q1_nps === 'number' ? answers.q1_nps : Number(answers.q1_nps)
  if (Number.isFinite(nps)) {
    c.executionCtx.waitUntil(
      sendNewResponseNotification(c.env, {
        id,
        nps,
        aantal: String(answers.q3_aantal ?? ''),
        wensen: String(answers.q15_wensen_2 ?? ''),
        siteUrl,
      }).then((res) => logAudit(c.env.DB, 'email_attempt', ipHash, { id, surveyId, ...res }))
    )
  }

  return c.json({ ok: true, id, surveyId }, 201)
})

// ============================================================
// ADMIN: LOGIN / LOGOUT
// ============================================================
app.get('/admin/login', async (c) => {
  const s = await getAdminSession(c)
  if (s) return c.redirect('/admin')
  const err = c.req.query('error')
  return c.html(<LoginPage error={err === 'invalid' ? 'Ongeldige combinatie van e-mail en wachtwoord.' : undefined} />)
})

app.post('/admin/login', async (c) => {
  const form = await c.req.parseBody()
  const email = String(form.email || '')
  const password = String(form.password || '')
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')

  const ok = await checkAdminCredentials(email, password, c.env.ADMIN_EMAIL || '', c.env.ADMIN_PASSWORD || '')
  if (!ok) {
    await logAudit(c.env.DB, 'login_fail', ipHash, { email })
    return c.redirect('/admin/login?error=invalid')
  }
  await createAdminSession(c, email)
  await logAudit(c.env.DB, 'login_success', ipHash, { email })
  return c.redirect('/admin')
})

app.get('/admin/logout', async (c) => {
  clearAdminSession(c)
  return c.redirect('/admin/login')
})

// ============================================================
// ADMIN: OVERVIEW (all surveys) + per-survey dashboard
// ============================================================
// Normalize trailing slash: /admin/ -> /admin (Cloudflare Pages doesn't auto-collapse)
app.get('/admin/', (c) => c.redirect('/admin', 301))
app.get('/admin', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'all' })
  const brands = await listBrands(c.env.DB)
  return c.html(<AdminOverviewPage surveys={surveys} brands={brands}
    flash={c.req.query('flash') || ''} error={c.req.query('error') || ''} />)
})

// New-survey form (must come BEFORE /:id to avoid 'new' being parsed as id)
app.get('/admin/surveys/new', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const brands = await listBrands(c.env.DB)
  const questions = await listLibraryQuestions(c.env.DB)
  const surveys = await listSurveys(c.env.DB, {})
  const error = c.req.query('error') || ''
  return c.html(<NewSurveyPage brands={brands} questions={questions} surveys={surveys} error={error} />)
})

// JSON: check whether a slug is free for a given brand (live form validation)
app.get('/api/admin/check-slug', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const brandId = c.req.query('brand') || ''
  const raw = c.req.query('slug') || ''
  const slug = slugify(raw)
  if (!brandId || !slug) return c.json({ ok: false, free: false, slug, reason: 'missing' })
  const exists = await c.env.DB.prepare(
    'SELECT 1 FROM surveys WHERE brand_id = ? AND slug = ? LIMIT 1',
  ).bind(brandId, slug).first()
  return c.json({ ok: true, free: !exists, slug })
})

// Submit: create survey + redirect to its dashboard
app.post('/admin/surveys', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard

  const form = await c.req.formData()
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  const getAll = (k: string) => form.getAll(k).filter((v): v is string => typeof v === 'string')

  const brandId = get('brand_id')
  const titleNl = get('title_nl')
  const titleEn = get('title_en')
  const slugRaw = get('slug')
  const seriesName = get('series_name')
  const artist = get('artist')
  const concertDate = get('concert_date')
  const location = get('location')
  const subtitleNl = get('subtitle_nl')
  const subtitleEn = get('subtitle_en')
  const introNl = get('intro_nl')
  const introEn = get('intro_en')
  const thanksNl = get('thanks_nl')
  const thanksEn = get('thanks_en')
  const status = (get('status') || 'open') as 'open' | 'closed' | 'archived'
  const langDefault = (get('lang_default') || 'nl') as 'nl' | 'en'
  const codes = getAll('question_codes')

  // ----- Validation -----
  const errs: string[] = []
  if (!brandId) errs.push('Kies een merk.')
  if (!titleNl) errs.push('Titel (NL) is verplicht.')
  if (codes.length === 0) errs.push('Selecteer minstens één vraag.')
  if (status !== 'open' && status !== 'closed' && status !== 'archived') errs.push('Ongeldige status.')
  // verify brand exists
  const brand = brandId
    ? await c.env.DB.prepare('SELECT id FROM brands WHERE id = ?').bind(brandId).first()
    : null
  if (brandId && !brand) errs.push('Onbekend merk.')
  // verify question codes exist
  if (codes.length > 0) {
    const placeholders = codes.map(() => '?').join(',')
    const found = await c.env.DB
      .prepare(`SELECT code FROM questions WHERE code IN (${placeholders})`)
      .bind(...codes).all<{ code: string }>()
    const foundSet = new Set((found.results ?? []).map(r => r.code))
    const missing = codes.filter(c => !foundSet.has(c))
    if (missing.length > 0) errs.push(`Onbekende vragen: ${missing.join(', ')}`)
  }

  if (errs.length > 0) {
    return c.redirect('/admin/surveys/new?error=' + encodeURIComponent(errs.join(' · ')))
  }

  // Slug: use what user typed (slugified), or auto-generate from title
  const seedSlug = slugRaw || titleNl
  let finalSlug = slugify(seedSlug) || 'enquete'
  // If duplicate, fall back to unique slug (server safety net)
  const dupe = await c.env.DB
    .prepare('SELECT 1 FROM surveys WHERE brand_id = ? AND slug = ? LIMIT 1')
    .bind(brandId, finalSlug).first()
  if (dupe) {
    finalSlug = await generateUniqueSlug(c.env.DB, brandId, seedSlug)
  }

  const created = await createSurvey(c.env.DB, {
    brandId,
    slug: finalSlug,
    seriesName: seriesName || null,
    artist: artist || null,
    concertDate: concertDate || null,
    location: location || null,
    titleNl,
    titleEn: titleEn || titleNl,
    subtitleNl: subtitleNl || null,
    subtitleEn: subtitleEn || null,
    introNl: introNl || null,
    introEn: introEn || null,
    thanksNl: thanksNl || null,
    thanksEn: thanksEn || null,
    questionCodes: codes,
    status,
    langDefault,
  })

  // Snapshot every chosen library question into survey_questions, in order.
  // From this point on the survey owns an independent copy — edits to the
  // library will NOT retroactively change this survey.
  for (let i = 0; i < codes.length; i++) {
    try {
      await copyLibraryQuestionToSurvey(c.env.DB, created.id, codes[i], i)
    } catch (e) {
      // Soft-fail: if a single snapshot fails, log and continue. The survey
      // is created and the admin can fix gaps from the per-survey question UI.
      console.error('snapshot failed for', codes[i], e)
    }
  }

  // Seed the survey with the default set of section dividers (Algemene
  // beleving, Locatie & sfeer, etc.). Admin can rename / reorder / remove
  // these afterwards per-survey without affecting any other survey.
  try {
    await seedDefaultSurveySections(c.env.DB, created.id)
  } catch (e) {
    console.error('section seed failed', e)
  }

  // Audit log
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_create', ipHash, {
    surveyId: created.id, brandId, slug: created.slug, questionCount: codes.length,
  })

  return c.redirect(`/admin/surveys/${created.id}?created=1`)
})

app.get('/admin/surveys/:id', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) return c.notFound()
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const brand = await getBrand(c.env.DB, survey.brand_id)
  return c.html(<DashboardPage survey={survey} brand={brand} />)
})

// ───── Edit survey: GET form + POST update ─────
app.get('/admin/surveys/:id/edit', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) return c.notFound()
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const brands = await listBrands(c.env.DB)
  const libraryQuestions = await listLibraryQuestions(c.env.DB)
  const surveyQuestions = await listSurveyQuestions(c.env.DB, id)
  let surveySections = await listSurveySections(c.env.DB, id)
  // Safety net: older surveys created before migration 0008 may have no
  // section rows. Seed defaults on-the-fly so admin never sees an empty list.
  if (surveySections.length === 0) {
    try {
      await seedDefaultSurveySections(c.env.DB, id)
      surveySections = await listSurveySections(c.env.DB, id)
    } catch (e) { console.error('lazy section seed failed', e) }
  }
  const error = c.req.query('error') || ''
  const flash = c.req.query('flash') || ''
  return c.html(
    <EditSurveyPage survey={survey} brands={brands}
      libraryQuestions={libraryQuestions} surveyQuestions={surveyQuestions}
      surveySections={surveySections}
      error={error} flash={flash} />,
  )
})

app.post('/admin/surveys/:id', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) return c.notFound()
  const existing = await getSurveyById(c.env.DB, id)
  if (!existing) return c.notFound()

  const form = await c.req.formData()
  const get = (k: string) => {
    const v = form.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  const getAll = (k: string) =>
    form.getAll(k).filter((v): v is string => typeof v === 'string')

  const titleNl = get('title_nl')
  const titleEn = get('title_en')
  const slugRaw = get('slug')
  const seriesName = get('series_name')
  const artist = get('artist')
  const concertDate = get('concert_date')
  const location = get('location')
  const subtitleNl = get('subtitle_nl')
  const subtitleEn = get('subtitle_en')
  const introNl = get('intro_nl')
  const introEn = get('intro_en')
  const thanksNl = get('thanks_nl')
  const thanksEn = get('thanks_en')
  const status = (get('status') || existing.status) as 'open' | 'closed' | 'archived'
  const langDefault = (get('lang_default') || existing.lang_default) as 'nl' | 'en'

  // Note: question-set is no longer edited here. The questions form section was
  // removed in favor of dedicated routes (add/edit/delete per survey_questions row),
  // because every survey now has its own snapshot independent of the library.
  // We keep existing.question_codes unchanged so the legacy column stays in sync
  // as a cached lookup list, but the source of truth is now `survey_questions`.

  const errs: string[] = []
  if (!titleNl) errs.push('Titel (NL) is verplicht.')
  if (status !== 'open' && status !== 'closed' && status !== 'archived') {
    errs.push('Ongeldige status.')
  }

  if (errs.length > 0) {
    return c.redirect(
      `/admin/surveys/${id}/edit?error=` + encodeURIComponent(errs.join(' · ')),
    )
  }

  // Slug: keep existing if user emptied the field, otherwise re-validate uniqueness
  // within the brand (allowing the survey's own slug to remain unchanged).
  const seedSlug = slugRaw || existing.slug
  const finalSlug = await generateUniqueSlugForUpdate(
    c.env.DB, existing.brand_id, id, seedSlug,
  )

  await updateSurvey(c.env.DB, id, {
    slug: finalSlug,
    seriesName: seriesName || null,
    artist: artist || null,
    concertDate: concertDate || null,
    location: location || null,
    titleNl,
    titleEn: titleEn || titleNl,
    subtitleNl: subtitleNl || null,
    subtitleEn: subtitleEn || null,
    questionCodes: existing.question_codes,
    status,
    langDefault,
    introNl: introNl || null,
    introEn: introEn || null,
    thanksNl: thanksNl || null,
    thanksEn: thanksEn || null,
  })

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_update', ipHash, {
    surveyId: id, slug: finalSlug,
  })

  return c.redirect(`/admin/surveys/${id}?updated=1`)
})

// ───── Delete survey (with response guard) ─────
app.post('/admin/surveys/:id/delete', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) {
    return c.redirect('/admin?error=' + encodeURIComponent('Ongeldige enquête-id.'))
  }
  const existing = await getSurveyById(c.env.DB, id)
  if (!existing) {
    return c.redirect('/admin?error=' + encodeURIComponent('Enquête bestaat niet (meer).'))
  }
  // Hard guard: refuse to delete if there are still live responses.
  // The admin should archive instead — that's a one-click status change.
  const count = await getResponseCountForSurvey(c.env.DB, id)
  if (count > 0) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent(
      `Deze enquête heeft nog ${count} actieve reactie${count === 1 ? '' : 's'}. ` +
      `Verwijderen is niet mogelijk. Zet de status op "archived" als je 'm wilt verbergen, ` +
      `of wis eerst de reacties via het dashboard.`,
    ))
  }
  await deleteSurvey(c.env.DB, id)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_delete', ipHash, {
    surveyId: id, slug: existing.slug, brand: existing.brand_id,
  })
  return c.redirect('/admin?flash=' + encodeURIComponent(
    `Enquête "${existing.title_nl}" verwijderd.`,
  ))
})

// ───── Duplicate survey (handy as a starting point for next concert) ─────
app.post('/admin/surveys/:id/duplicate', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isFinite(id) || id <= 0) {
    return c.redirect('/admin?error=' + encodeURIComponent('Ongeldige enquête-id.'))
  }
  const existing = await getSurveyById(c.env.DB, id)
  if (!existing) {
    return c.redirect('/admin?error=' + encodeURIComponent('Enquête bestaat niet (meer).'))
  }
  const copy = await duplicateSurvey(c.env.DB, id)

  // Copy questions and sections snapshot from source → new survey. We need
  // both so the duplicate is a real working starting point, not just an
  // empty shell with metadata.
  try {
    const sourceQs = await listSurveyQuestions(c.env.DB, id)
    for (let i = 0; i < sourceQs.length; i++) {
      const sq = sourceQs[i]
      // Re-snapshot from library where possible (preserves source_code link);
      // for purely custom questions, fall back to creating from snapshot fields.
      if (sq.source_code) {
        try { await copyLibraryQuestionToSurvey(c.env.DB, copy.id, sq.source_code, i) } catch {}
      } else {
        try {
          await createSurveyQuestion(c.env.DB, copy.id, {
            code: sq.code,
            type: sq.type,
            category: sq.category,
            required: sq.required === 1,
            scale_min: sq.scale_min,
            scale_max: sq.scale_max,
            label_nl: sq.label_nl,
            label_en: sq.label_en,
            helper_nl: sq.helper_nl,
            helper_en: sq.helper_en,
            min_label_nl: sq.min_label_nl,
            min_label_en: sq.min_label_en,
            max_label_nl: sq.max_label_nl,
            max_label_en: sq.max_label_en,
            options_nl: sq.options_nl,
            options_en: sq.options_en,
            conditional_on: sq.conditional_on,
          })
        } catch {}
      }
    }
    await copySurveySections(c.env.DB, id, copy.id)
  } catch (e) {
    console.error('duplicate snapshot copy failed', e)
  }

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_duplicate', ipHash, {
    sourceId: id, newId: copy.id, newSlug: copy.slug,
  })
  return c.redirect(`/admin/surveys/${copy.id}/edit?flash=` + encodeURIComponent(
    `Kopie aangemaakt van "${existing.title_nl}". Pas de details aan en zet de status op "open" als je klaar bent.`,
  ))
})

// ============================================================
// QUESTION LIBRARY — full CRUD
// ============================================================

// Helper: parse form body into QuestionInput shape
function parseQuestionForm(form: FormData): Partial<QuestionInput> {
  const get = (k: string): string => {
    const v = form.get(k)
    return typeof v === 'string' ? v.trim() : ''
  }
  const splitLines = (s: string): string[] =>
    s.split(/\r?\n/).map(x => x.trim()).filter(x => x.length > 0)

  const type = get('type') as QuestionInput['type']
  const sMin = get('scale_min')
  const sMax = get('scale_max')
  const cf = get('cond_field')
  const cv = get('cond_value')

  return {
    code: get('code'),
    type,
    category: get('category') || null,
    required: form.get('required') === 'on' || form.get('required') === '1',
    scale_min: sMin === '' ? null : Number(sMin),
    scale_max: sMax === '' ? null : Number(sMax),
    label_nl: get('label_nl'),
    label_en: get('label_en'),
    helper_nl: get('helper_nl') || null,
    helper_en: get('helper_en') || null,
    min_label_nl: get('min_label_nl') || null,
    min_label_en: get('min_label_en') || null,
    max_label_nl: get('max_label_nl') || null,
    max_label_en: get('max_label_en') || null,
    options_nl: type === 'choice' ? splitLines(get('options_nl')) : null,
    options_en: type === 'choice' ? splitLines(get('options_en')) : null,
    conditional_on: (cf && cv) ? { field: cf, value: cv } : null,
  }
}

// List + show all questions
app.get('/admin/questions', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const questions = await listLibraryQuestions(c.env.DB)
  // Compute usage map: which surveys use which question
  const surveys = await listSurveys(c.env.DB, {})
  const usage = new Map<string, Array<{ id: number; title_nl: string; status: string }>>()
  for (const s of surveys) {
    for (const code of s.question_codes) {
      if (!usage.has(code)) usage.set(code, [])
      usage.get(code)!.push({ id: s.id, title_nl: s.title_nl, status: s.status })
    }
  }
  return c.html(<QuestionsLibraryPage
    questions={questions}
    usage={Object.fromEntries(usage)}
    flash={c.req.query('flash') || ''}
    error={c.req.query('error') || ''}
  />)
})

// New question form
app.get('/admin/questions/new', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  return c.html(<QuestionEditorPage mode="create" question={null}
    error={c.req.query('error') || ''} formData={{}} />)
})

// JSON import: GET shows the page, POST executes the import.
// IMPORTANT: must be declared BEFORE the generic /admin/questions/:code routes
// below, otherwise Hono will treat "import" as a :code parameter.
app.get('/admin/questions/import', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  return c.html(<QuestionsImportPage error={c.req.query('error') || ''} />)
})

app.post('/admin/questions/import', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const form = await c.req.formData()
  const json = String(form.get('json') || '').trim()
  const mode = (String(form.get('mode') || 'skip') === 'replace' ? 'replace' : 'skip') as 'replace' | 'skip'
  if (!json) {
    return c.redirect('/admin/questions/import?error=' + encodeURIComponent('Plak eerst JSON in het tekstveld.'))
  }
  let parsed: any
  try { parsed = JSON.parse(json) }
  catch (e) {
    return c.redirect('/admin/questions/import?error=' + encodeURIComponent(
      'Ongeldige JSON: ' + (e instanceof Error ? e.message : 'parse error'),
    ))
  }
  const rows: any[] = Array.isArray(parsed) ? parsed : (Array.isArray(parsed.questions) ? parsed.questions : [])
  if (rows.length === 0) {
    return c.redirect('/admin/questions/import?error=' + encodeURIComponent(
      'Geen vragen gevonden — verwacht een JSON-array of object met "questions": [...].',
    ))
  }
  const allErrs: string[] = []
  const inputs: QuestionInput[] = []
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const coerced = { ...r, required: r.required === true || r.required === 1 || r.required === '1' }
    const errs = validateQuestionInput(coerced)
    if (errs.length > 0) {
      allErrs.push(`Rij ${i + 1} (${r.code || '?'}): ${errs.join('; ')}`)
    } else {
      inputs.push(coerced as QuestionInput)
    }
  }
  if (allErrs.length > 0) {
    return c.redirect('/admin/questions/import?error=' + encodeURIComponent(allErrs.join(' · ')))
  }
  const result = await importQuestions(c.env.DB, inputs, mode)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'question_import', ipHash, { ...result, mode })
  return c.redirect('/admin/questions?flash=' + encodeURIComponent(
    `Import voltooid: ${result.inserted} nieuw, ${result.updated} bijgewerkt, ${result.skipped} overgeslagen.`,
  ))
})

// Edit question form
app.get('/admin/questions/:code/edit', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const code = c.req.param('code')
  const q = await getLibraryQuestion(c.env.DB, code)
  if (!q) return c.notFound()
  const usage = await getSurveysUsingQuestion(c.env.DB, code)
  return c.html(<QuestionEditorPage mode="edit" question={q} usage={usage}
    error={c.req.query('error') || ''} formData={{}} />)
})

// Create question
app.post('/admin/questions', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const form = await c.req.formData()
  const input = parseQuestionForm(form)
  const errs = validateQuestionInput(input)
  // Code must be unique
  if (input.code && errs.length === 0) {
    const existing = await getLibraryQuestion(c.env.DB, input.code)
    if (existing) errs.push(`Een vraag met code "${input.code}" bestaat al.`)
  }
  if (errs.length > 0) {
    return c.redirect('/admin/questions/new?error=' + encodeURIComponent(errs.join(' · ')))
  }
  await createQuestion(c.env.DB, input as QuestionInput)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'question_create', ipHash, { code: input.code })
  return c.redirect('/admin/questions?flash=' + encodeURIComponent(`Vraag "${input.code}" toegevoegd.`))
})

// Update question
app.post('/admin/questions/:code', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const code = c.req.param('code')
  const existing = await getLibraryQuestion(c.env.DB, code)
  if (!existing) {
    return c.redirect('/admin/questions?error=' + encodeURIComponent(
      `Vraag "${code}" bestaat niet (meer).`,
    ))
  }
  const form = await c.req.formData()
  // Force the code from URL (immutable)
  const input = { ...parseQuestionForm(form), code }
  const errs = validateQuestionInput(input)
  if (errs.length > 0) {
    return c.redirect(`/admin/questions/${code}/edit?error=` + encodeURIComponent(errs.join(' · ')))
  }
  // type changes are allowed but warn the user via the UI; backend just persists.
  const { code: _, ...rest } = input as QuestionInput
  await updateQuestion(c.env.DB, code, rest)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'question_update', ipHash, { code })
  return c.redirect('/admin/questions?flash=' + encodeURIComponent(`Vraag "${code}" bijgewerkt.`))
})

// Delete question (with usage check)
app.post('/admin/questions/:code/delete', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const code = c.req.param('code')
  const existing = await getLibraryQuestion(c.env.DB, code)
  if (!existing) {
    return c.redirect('/admin/questions?error=' + encodeURIComponent(
      `Vraag "${code}" bestaat niet (meer).`,
    ))
  }
  // Hard guard: refuse delete if any survey still references the code
  const usage = await getSurveysUsingQuestion(c.env.DB, code)
  if (usage.length > 0) {
    const titles = usage.map(u => `"${u.title_nl}"`).join(', ')
    return c.redirect('/admin/questions?error=' + encodeURIComponent(
      `Vraag "${code}" wordt nog gebruikt in ${usage.length} enquête(s): ${titles}. Verwijder eerst de vraag uit die enquêtes.`,
    ))
  }
  await deleteQuestion(c.env.DB, code)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'question_delete', ipHash, { code })
  return c.redirect('/admin/questions?flash=' + encodeURIComponent(`Vraag "${code}" verwijderd.`))
})

// ============================================================
// PER-SURVEY QUESTION ROUTES — each survey owns an isolated snapshot
// in `survey_questions`. Editing here NEVER touches the library.
// Uses the same parseQuestionForm() helper as the library routes above.
// ============================================================

// GET — new question editor scoped to a single survey
app.get('/admin/surveys/:id/questions/new', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  return c.html(<SurveyQuestionEditorPage mode="new" survey={survey}
    question={null} error={c.req.query('error') || ''} formData={{}} />)
})

// GET — edit existing survey-scoped question
app.get('/admin/surveys/:id/questions/:code/edit', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const code = c.req.param('code')
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const sq = await getSurveyQuestion(c.env.DB, id, code)
  if (!sq) return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent(
    `Vraag "${code}" bestaat niet in deze enquête.`,
  ))
  return c.html(<SurveyQuestionEditorPage mode="edit" survey={survey}
    question={sq} error={c.req.query('error') || ''} formData={{}} />)
})

// POST — create new survey-scoped question
app.post('/admin/surveys/:id/questions', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const form = await c.req.formData()
  const input = parseQuestionForm(form)
  const errs = validateQuestionInput(input)
  // uniqueness within this survey
  if (input.code && errs.length === 0) {
    const existing = await getSurveyQuestion(c.env.DB, id, input.code)
    if (existing) errs.push(`Een vraag met code "${input.code}" bestaat al in deze enquête.`)
  }
  if (errs.length > 0) {
    return c.redirect(`/admin/surveys/${id}/questions/new?error=` + encodeURIComponent(errs.join(' · ')))
  }
  await createSurveyQuestion(c.env.DB, id, input as QuestionInput)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_question_create', ipHash, { surveyId: id, code: input.code })
  return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent(
    `Nieuwe vraag "${input.code}" toegevoegd aan deze enquête.`,
  ))
})

// POST — update existing survey-scoped question
// NOTE: route order matters — the more specific `/questions/reorder` and
// `/questions/add-from-library` routes are declared FURTHER DOWN. Hono
// matches in registration order, so this catch-all would normally swallow
// those reserved paths. We restrict `:code` to a regex that requires a
// q-prefix; real question codes always look like "q1_nps", "q14_bijdrage"
// so this is safe and lets `reorder`/`add-from-library` fall through.
app.post('/admin/surveys/:id/questions/:code{q[a-z0-9_]+}', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const code = c.req.param('code')
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const existing = await getSurveyQuestion(c.env.DB, id, code)
  if (!existing) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent(
      `Vraag "${code}" bestaat niet (meer) in deze enquête.`,
    ))
  }
  const form = await c.req.formData()
  const input = { ...parseQuestionForm(form), code }
  const errs = validateQuestionInput(input)
  if (errs.length > 0) {
    return c.redirect(`/admin/surveys/${id}/questions/${code}/edit?error=`
      + encodeURIComponent(errs.join(' · ')))
  }
  const { code: _, ...rest } = input as QuestionInput
  await updateSurveyQuestion(c.env.DB, id, code, rest)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_question_update', ipHash, { surveyId: id, code })
  return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent(
    `Vraag "${code}" bijgewerkt.`,
  ))
})

// POST — delete a question from this survey (does NOT touch library)
app.post('/admin/surveys/:id/questions/:code{q[a-z0-9_]+}/delete', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const code = c.req.param('code')
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  await deleteSurveyQuestion(c.env.DB, id, code)
  // Also keep the legacy question_codes JSON column in sync as a hint to the rest of the app.
  const remaining = await listSurveyQuestions(c.env.DB, id)
  await updateSurvey(c.env.DB, id, {
    slug: survey.slug, seriesName: survey.series_name, artist: survey.artist,
    concertDate: survey.concert_date, location: survey.location,
    titleNl: survey.title_nl, titleEn: survey.title_en,
    subtitleNl: survey.subtitle_nl, subtitleEn: survey.subtitle_en,
    questionCodes: remaining.map(q => q.code),
    status: survey.status, langDefault: survey.lang_default,
    introNl: survey.intro_nl, introEn: survey.intro_en,
    thanksNl: survey.thanks_nl, thanksEn: survey.thanks_en,
  })
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'survey_question_delete', ipHash, { surveyId: id, code })
  return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent(
    `Vraag "${code}" verwijderd uit deze enquête.`,
  ))
})

// POST — add a library question to this survey (snapshot copy)
app.post('/admin/surveys/:id/questions/add-from-library', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const form = await c.req.formData()
  const libCode = String(form.get('library_code') || '').trim()
  if (!libCode) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent('Kies een vraag uit de bibliotheek.'))
  }
  try {
    const r = await copyLibraryQuestionToSurvey(c.env.DB, id, libCode)
    // Keep legacy column in sync
    const remaining = await listSurveyQuestions(c.env.DB, id)
    await updateSurvey(c.env.DB, id, {
      slug: survey.slug, seriesName: survey.series_name, artist: survey.artist,
      concertDate: survey.concert_date, location: survey.location,
      titleNl: survey.title_nl, titleEn: survey.title_en,
      subtitleNl: survey.subtitle_nl, subtitleEn: survey.subtitle_en,
      questionCodes: remaining.map(q => q.code),
      status: survey.status, langDefault: survey.lang_default,
      introNl: survey.intro_nl, introEn: survey.intro_en,
      thanksNl: survey.thanks_nl, thanksEn: survey.thanks_en,
    })
    const flash = r.inserted
      ? `Vraag "${libCode}" gekopieerd uit de bibliotheek naar deze enquête.`
      : `Vraag "${libCode}" stond al in deze enquête.`
    return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent(flash))
  } catch (e: any) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent(
      e?.message || 'Kopie uit bibliotheek mislukt.',
    ))
  }
})

// POST — reorder questions of a survey (expects ordered_codes as comma-separated)
app.post('/admin/surveys/:id/questions/reorder', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()

  // Two payload formats are supported:
  //   1. JSON POST from drag-and-drop:
  //        { items: [{code, section}, ...] }
  //      -> re-orders AND re-assigns each question's section in one shot.
  //   2. Legacy form-encoded POST:
  //        ordered_codes=code1,code2,code3
  //      -> re-orders only, sections untouched.
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    try {
      const body = await c.req.json<{ items?: Array<{ code: string; section: string }> }>()
      const items = Array.isArray(body.items) ? body.items : []
      if (items.length === 0) {
        return c.json({ ok: false, error: 'items leeg' }, 400)
      }
      const known = await listSurveyQuestions(c.env.DB, id)
      const codeSet = new Set(known.map(q => q.code))
      const cleaned = items
        .filter(it => typeof it?.code === 'string' && codeSet.has(it.code))
        .map(it => ({ code: it.code, sectionId: String(it.section || 'algemeen').trim() || 'algemeen' }))
      if (cleaned.length === 0) {
        return c.json({ ok: false, error: 'geen geldige codes' }, 400)
      }
      await reorderAndReassignSurveyQuestions(c.env.DB, id, cleaned)
      const remaining = await listSurveyQuestions(c.env.DB, id)
      await updateSurvey(c.env.DB, id, {
        slug: survey.slug, seriesName: survey.series_name, artist: survey.artist,
        concertDate: survey.concert_date, location: survey.location,
        titleNl: survey.title_nl, titleEn: survey.title_en,
        subtitleNl: survey.subtitle_nl, subtitleEn: survey.subtitle_en,
        questionCodes: remaining.map(q => q.code),
        status: survey.status, langDefault: survey.lang_default,
        introNl: survey.intro_nl, introEn: survey.intro_en,
        thanksNl: survey.thanks_nl, thanksEn: survey.thanks_en,
      })
      return c.json({ ok: true, count: cleaned.length })
    } catch (e) {
      console.error('reorder JSON error', e)
      return c.json({ ok: false, error: 'JSON parse error' }, 400)
    }
  }

  // Legacy form path (kept for backward compatibility).
  const form = await c.req.formData()
  const ordered = String(form.get('ordered_codes') || '').split(',').map(s => s.trim()).filter(Boolean)
  if (ordered.length === 0) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent('Volgorde ontbreekt.'))
  }
  await reorderSurveyQuestions(c.env.DB, id, ordered)
  const remaining = await listSurveyQuestions(c.env.DB, id)
  await updateSurvey(c.env.DB, id, {
    slug: survey.slug, seriesName: survey.series_name, artist: survey.artist,
    concertDate: survey.concert_date, location: survey.location,
    titleNl: survey.title_nl, titleEn: survey.title_en,
    subtitleNl: survey.subtitle_nl, subtitleEn: survey.subtitle_en,
    questionCodes: remaining.map(q => q.code),
    status: survey.status, langDefault: survey.lang_default,
    introNl: survey.intro_nl, introEn: survey.intro_en,
    thanksNl: survey.thanks_nl, thanksEn: survey.thanks_en,
  })
  return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent('Volgorde bijgewerkt.'))
})

// ============================================================
// PER-SURVEY SECTIONS — Admin CRUD for `survey_sections`
// Sections are the headings shown between groups of questions on the public
// page. Each survey owns its own list, fully editable independently.
// ============================================================

// POST — upsert a section (id + titles). When sectionId is empty we slugify
// the NL title to derive a stable id.
app.post('/admin/surveys/:id/sections', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()

  const form = await c.req.formData()
  const get = (k: string) => { const v = form.get(k); return typeof v === 'string' ? v.trim() : '' }

  const sectionIdRaw = get('section_id')
  const titleNl = get('title_nl')
  const titleEn = get('title_en')
  const subtitleNl = get('subtitle_nl')
  const subtitleEn = get('subtitle_en')

  if (!titleNl) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent('Hoofdstuk-titel (NL) is verplicht.'))
  }

  // Derive a stable id from titleNl if not provided, kebab-case, max 32 chars.
  const sectionId = sectionIdRaw || slugify(titleNl).slice(0, 32) || `section-${Date.now()}`

  // For new sections, append at the end of the order.
  const existing = await getSurveySection(c.env.DB, id, sectionId)
  let order: number
  if (existing) {
    order = existing.display_order
  } else {
    const all = await listSurveySections(c.env.DB, id)
    order = all.length > 0 ? Math.max(...all.map(s => s.display_order)) + 1 : 0
  }

  try {
    await upsertSurveySection(c.env.DB, id, {
      sectionId,
      displayOrder: order,
      titleNl,
      titleEn: titleEn || titleNl,
      subtitleNl: subtitleNl || null,
      subtitleEn: subtitleEn || null,
    })
    return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent(
      existing ? `Hoofdstuk "${titleNl}" bijgewerkt.` : `Hoofdstuk "${titleNl}" toegevoegd.`,
    ) + '#sections')
  } catch (e: any) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent(
      e?.message || 'Opslaan van hoofdstuk mislukt.',
    ))
  }
})

// POST — delete a section.
// Note: this does NOT delete the questions inside it. Questions just become
// orphans (their category is unchanged) and the public render then falls
// back to grouping them under "Algemeen" until you reassign them.
app.post('/admin/surveys/:id/sections/:sectionId/delete', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const sectionId = c.req.param('sectionId')
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()
  const sect = await getSurveySection(c.env.DB, id, sectionId)
  if (!sect) {
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent('Hoofdstuk bestaat niet (meer).'))
  }
  await deleteSurveySection(c.env.DB, id, sectionId)
  return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent(
    `Hoofdstuk "${sect.title_nl}" verwijderd.`,
  ) + '#sections')
})

// POST — reorder sections. Accepts:
//   - JSON: { ids: ['algemeen','locatie',...] } -> returns JSON {ok:true}
//   - Form: ordered_ids=algemeen,locatie,... -> redirects with flash
app.post('/admin/surveys/:id/sections/reorder', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = parseInt(c.req.param('id'), 10)
  const survey = await getSurveyById(c.env.DB, id)
  if (!survey) return c.notFound()

  let ordered: string[] = []
  let isJson = false
  const contentType = c.req.header('content-type') || ''
  if (contentType.includes('application/json')) {
    isJson = true
    try {
      const body = await c.req.json<{ ids?: string[] }>()
      ordered = Array.isArray(body.ids) ? body.ids.map(s => String(s).trim()).filter(Boolean) : []
    } catch (e) {
      return c.json({ ok: false, error: 'JSON parse error' }, 400)
    }
  } else {
    const form = await c.req.formData()
    ordered = String(form.get('ordered_ids') || '').split(',').map(s => s.trim()).filter(Boolean)
  }

  if (ordered.length === 0) {
    if (isJson) return c.json({ ok: false, error: 'ids leeg' }, 400)
    return c.redirect(`/admin/surveys/${id}/edit?error=` + encodeURIComponent('Volgorde ontbreekt.'))
  }
  // Re-upsert each with its new display_order. We need to look up each row
  // first to keep title/subtitle untouched.
  let count = 0
  for (let i = 0; i < ordered.length; i++) {
    const sect = await getSurveySection(c.env.DB, id, ordered[i])
    if (!sect) continue
    await upsertSurveySection(c.env.DB, id, {
      sectionId: sect.section_id,
      displayOrder: i,
      titleNl: sect.title_nl,
      titleEn: sect.title_en,
      subtitleNl: sect.subtitle_nl,
      subtitleEn: sect.subtitle_en,
    })
    count++
  }
  if (isJson) return c.json({ ok: true, count })
  return c.redirect(`/admin/surveys/${id}/edit?flash=` + encodeURIComponent('Hoofdstuk-volgorde bijgewerkt.') + '#sections')
})

// JSON export of full library — handy as a backup or to copy to another deployment
app.get('/api/admin/questions/export', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const questions = await listLibraryQuestions(c.env.DB)
  const today = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify({ exported_at: new Date().toISOString(), questions }, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="questions-library-${today}.json"`,
    },
  })
})

// ============================================================
// API: ADMIN
// ============================================================
app.get('/api/admin/surveys', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveys = await listSurveysWithStats(c.env.DB, { status: 'all' })
  c.header('Cache-Control', 'private, max-age=15')
  return c.json({ surveys })
})

app.get('/api/admin/responses', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  // Laad responses + survey-snapshot van vragen in parallel; stats heeft beide
  // nodig (per-survey labels, types, schaal-grenzen). Het frontend gebruikt
  // de questions-lijst ook om dynamisch labels te tonen i.p.v. gehardcodeerd
  // Reeks-I terminologie ("Sfeer huiskamer", "Jos · interactie", …).
  const [rows, questions] = await Promise.all([
    listResponses(c.env.DB, surveyId),
    listSurveyQuestions(c.env.DB, surveyId),
  ])
  const stats = computeStats(rows, questions)
  c.header('Cache-Control', 'private, max-age=30')
  return c.json({ responses: rows, stats, questions, surveyId })
})

app.get('/api/admin/export', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const survey = await getSurveyById(c.env.DB, surveyId)
  const fmtRaw = c.req.query('format')
  const format: 'csv' | 'json' | 'docx' =
    fmtRaw === 'json' ? 'json' : fmtRaw === 'docx' ? 'docx' : 'csv'
  const rows = await listResponses(c.env.DB, surveyId)

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, `export_${format}`, ipHash, { count: rows.length, surveyId })

  const today = new Date().toISOString().slice(0, 10)
  const slug = survey?.slug ?? 'survey'
  const fileBase = `${slug}-${today}`

  if (format === 'csv') {
    const csv = rowsToCsv(rows)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.csv"`,
      },
    })
  }

  if (format === 'json') {
    const json = rowsToJson(rows)
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileBase}.json"`,
      },
    })
  }

  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const analysis = await getCachedAnalysis(c.env.DB, lang, surveyId)
  const buffer = await buildSurveyDocx(rows, analysis, lang, survey ?? undefined)
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileBase}.docx"`,
      'Content-Length': String(buffer.byteLength),
      'Cache-Control': 'no-store',
    },
  })
})

app.delete('/api/admin/responses/:id', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const id = c.req.param('id')
  await softDeleteResponse(c.env.DB, id)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'delete_response', ipHash, { id })
  return c.json({ ok: true })
})

app.delete('/api/admin/responses', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const deleted = await deleteAllResponses(c.env.DB, surveyId)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'delete_all', ipHash, { deleted, surveyId })
  return c.json({ ok: true, deleted })
})

// ============================================================
// API: AI ANALYSIS (per survey)
// ============================================================
app.get('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const cached = await getCachedAnalysis(c.env.DB, lang, surveyId)
  if (!cached) return c.json({ cached: false, analysis: null }, 200)
  return c.json({ cached: true, analysis: cached })
})

app.post('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const force = c.req.query('force') === '1'

  if (!force) {
    const cached = await getCachedAnalysis(c.env.DB, lang, surveyId)
    if (cached) return c.json({ cached: true, analysis: cached })
  }

  const rows = await listResponses(c.env.DB, surveyId)
  if (rows.length === 0) {
    return c.json({ error: 'no_data', message: 'Geen responses om te analyseren.' }, 400)
  }

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  try {
    const result = await generateAnalysis(
      {
        AI: c.env.AI,
        DB: c.env.DB,
        OPENAI_API_KEY: c.env.OPENAI_API_KEY,
        OPENAI_MODEL: c.env.OPENAI_MODEL,
      },
      rows,
      lang,
    )
    await saveCachedAnalysis(c.env.DB, lang, result, surveyId)
    await logAudit(c.env.DB, 'ai_analyze', ipHash, { lang, count: rows.length, provider: result.provider, surveyId })
    return c.json({ cached: false, analysis: result })
  } catch (e: any) {
    console.error('AI analyze error:', e)
    await logAudit(c.env.DB, 'ai_analyze_fail', ipHash, { lang, error: String(e?.message ?? e).slice(0, 300), surveyId })
    return c.json({ error: 'ai_failed', message: e?.message ?? 'AI-analyse mislukt' }, 500)
  }
})

app.delete('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const surveyId = await adminSurveyId(c)
  const lang = c.req.query('lang') as Lang | undefined
  await clearCachedAnalysis(c.env.DB, lang === 'nl' || lang === 'en' ? lang : undefined, surveyId)
  return c.json({ ok: true })
})

// ============================================================
// 404 / error
// ============================================================
app.notFound((c) => c.json({ error: 'not_found' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'server_error', message: err.message }, 500)
})

export default app
