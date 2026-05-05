import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'

import { SurveyPage, ThanksPage, PrivacyPage } from './views/survey'
import { LoginPage, DashboardPage } from './views/admin'
import { responseSchema } from './lib/validation'
import { hashIp } from './lib/crypto'
import {
  insertResponse, listResponses, deleteAllResponses,
  logAudit, checkRateLimit, softDeleteResponse,
} from './lib/db'
import { computeStats } from './lib/stats'
import { rowsToCsv, rowsToJson } from './lib/csv'
import {
  type Bindings,
  createAdminSession, clearAdminSession, getAdminSession,
  requireAdmin, checkAdminCredentials,
} from './lib/auth'
import { sendNewResponseNotification } from './lib/email'
import {
  generateAnalysis, getCachedAnalysis, saveCachedAnalysis, clearCachedAnalysis,
  type AnalysisResult,
} from './lib/ai'
import type { Lang } from './lib/i18n'

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', logger())

// Stricter CSP for public routes
app.use('*', async (c, next) => {
  const path = c.req.path
  const isAdmin = path.startsWith('/admin') || path.startsWith('/api/admin')
  const csp = isAdmin
    // Admin: allow html2pdf bundle from cdnjs + inline styles/scripts/data-URIs needed by html2canvas
    ? [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
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

// ============ PUBLIC ROUTES (NL = default) ============
app.get('/', (c) => c.html(<SurveyPage lang="nl" />))
app.get('/dank-je', (c) => c.html(<ThanksPage lang="nl" />))
app.get('/privacy', (c) => c.html(<PrivacyPage lang="nl" />))
// ============ PUBLIC ROUTES (EN) ============
app.get('/en', (c) => c.html(<SurveyPage lang="en" />))
app.get('/en/', (c) => c.redirect('/en'))
app.get('/thank-you', (c) => c.html(<ThanksPage lang="en" />))
app.get('/en/privacy', (c) => c.html(<PrivacyPage lang="en" />))
app.get('/health', (c) => c.json({ ok: true, ts: new Date().toISOString() }))

// ============ API: SUBMIT RESPONSE ============
app.post('/api/responses', async (c) => {
  let body: unknown
  try { body = await c.req.json() } catch { return c.json({ error: 'invalid_json' }, 400) }

  const parsed = responseSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({
      error: 'validation_failed',
      details: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    }, 400)
  }

  // Honeypot check
  const data = parsed.data
  if ((data.website ?? '').trim().length > 0) {
    return c.json({ error: 'spam_detected' }, 400)
  }

  const ip = getClientIp(c)
  const salt = c.env.IP_HASH_SALT || 'dev-salt-change-me'
  const ipHash = await hashIp(ip, salt)
  const userAgent = c.req.header('user-agent') ?? ''

  // Rate limit: 3 per uur per IP-hash
  const rl = await checkRateLimit(c.env.DB, ipHash, 3)
  if (!rl.ok) {
    await logAudit(c.env.DB, 'rate_limited', ipHash, { current: rl.current })
    return c.json({ error: 'rate_limited', message: 'Maximum 3 inzendingen per uur.' }, 429)
  }

  // Insert
  const id = await insertResponse(c.env.DB, data, { ipHash, userAgent })
  await logAudit(c.env.DB, 'response_submitted', ipHash, { id, nps: data.q1_nps })

  // E-mail (optioneel — gestuurd alleen als EMAIL_ENABLED=true)
  const url = new URL(c.req.url)
  const siteUrl = `${url.protocol}//${url.host}`
  c.executionCtx.waitUntil(
    sendNewResponseNotification(c.env, {
      id,
      nps: data.q1_nps,
      aantal: data.q3_aantal,
      wensen: data.q15_wensen_2 ?? '',
      siteUrl,
    }).then((res) => logAudit(c.env.DB, 'email_attempt', ipHash, { id, ...res }))
  )

  return c.json({ ok: true, id }, 201)
})

// ============ ADMIN: LOGIN ============
app.get('/admin/login', async (c) => {
  // Already logged in? → dashboard
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

// ============ ADMIN: DASHBOARD ============
app.get('/admin', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  return c.html(<DashboardPage />)
})

// ============ API: ADMIN ============
app.get('/api/admin/responses', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const rows = await listResponses(c.env.DB)
  const stats = computeStats(rows)
  c.header('Cache-Control', 'private, max-age=30')
  return c.json({ responses: rows, stats })
})

app.get('/api/admin/export', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const format = c.req.query('format') === 'json' ? 'json' : 'csv'
  const rows = await listResponses(c.env.DB)

  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, `export_${format}`, ipHash, { count: rows.length })

  const today = new Date().toISOString().slice(0, 10)
  if (format === 'csv') {
    const csv = rowsToCsv(rows)
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="huiskamerconcerten-survey-${today}.csv"`,
      },
    })
  } else {
    const json = rowsToJson(rows)
    return new Response(json, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="huiskamerconcerten-survey-${today}.json"`,
      },
    })
  }
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

// ============ API: AI ANALYSIS ============
// GET  → returns cached analysis (or 404 if none)
// POST → forces a fresh generation (and caches it)
app.get('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const cached = await getCachedAnalysis(c.env.DB, lang)
  if (!cached) return c.json({ cached: false, analysis: null }, 200)
  return c.json({ cached: true, analysis: cached })
})

app.post('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const lang: Lang = c.req.query('lang') === 'en' ? 'en' : 'nl'
  const force = c.req.query('force') === '1'

  if (!force) {
    const cached = await getCachedAnalysis(c.env.DB, lang)
    if (cached) return c.json({ cached: true, analysis: cached })
  }

  const rows = await listResponses(c.env.DB)
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
    await saveCachedAnalysis(c.env.DB, lang, result)
    await logAudit(c.env.DB, 'ai_analyze', ipHash, { lang, count: rows.length, provider: result.provider })
    return c.json({ cached: false, analysis: result })
  } catch (e: any) {
    console.error('AI analyze error:', e)
    await logAudit(c.env.DB, 'ai_analyze_fail', ipHash, { lang, error: String(e?.message ?? e).slice(0, 300) })
    return c.json({ error: 'ai_failed', message: e?.message ?? 'AI-analyse mislukt' }, 500)
  }
})

app.delete('/api/admin/analyze', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const lang = c.req.query('lang') as Lang | undefined
  await clearCachedAnalysis(c.env.DB, lang === 'nl' || lang === 'en' ? lang : undefined)
  return c.json({ ok: true })
})

app.delete('/api/admin/responses', async (c) => {
  const guard = await requireAdmin(c)
  if (guard) return guard
  const deleted = await deleteAllResponses(c.env.DB)
  const ip = getClientIp(c)
  const ipHash = await hashIp(ip, c.env.IP_HASH_SALT || 'dev')
  await logAudit(c.env.DB, 'delete_all', ipHash, { deleted })
  return c.json({ ok: true, deleted })
})

// ============ 404 ============
app.notFound((c) => c.json({ error: 'not_found' }, 404))

app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'server_error', message: err.message }, 500)
})

export default app
