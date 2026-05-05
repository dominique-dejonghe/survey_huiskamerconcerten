import type { Context } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import { hmac, safeEqual } from './crypto'

const COOKIE_NAME = 'survey_admin_session'
const SESSION_DURATION = 60 * 60 * 8 // 8h

export type Bindings = {
  DB: D1Database
  AI: any // Cloudflare Workers AI binding (Ai type) — fallback provider
  ADMIN_EMAIL: string
  ADMIN_PASSWORD: string
  SESSION_SECRET: string
  IP_HASH_SALT: string
  EMAIL_ENABLED?: string
  RESEND_API_KEY?: string
  NOTIFY_FROM?: string
  NOTIFY_TO?: string
  OPENAI_API_KEY?: string // Primary AI provider (gpt-4o-mini)
  OPENAI_MODEL?: string   // Optional override (default: gpt-4o-mini)
}

// Session payload: base64(json) + "." + hmac(secret, base64(json))
async function signSession(secret: string, payload: object): Promise<string> {
  const json = JSON.stringify(payload)
  const b64 = btoa(json)
  const sig = await hmac(secret, b64)
  return `${b64}.${sig}`
}

async function verifySession(secret: string, token: string): Promise<{ email: string; exp: number } | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  const expected = await hmac(secret, b64)
  if (!safeEqual(sig, expected)) return null
  try {
    const data = JSON.parse(atob(b64)) as { email: string; exp: number }
    if (typeof data.exp !== 'number' || data.exp < Math.floor(Date.now() / 1000)) return null
    return data
  } catch {
    return null
  }
}

export async function createAdminSession(c: Context<{ Bindings: Bindings }>, email: string) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_DURATION
  const token = await signSession(c.env.SESSION_SECRET, { email, exp })
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    path: '/',
    maxAge: SESSION_DURATION,
  })
}

export function clearAdminSession(c: Context<{ Bindings: Bindings }>) {
  deleteCookie(c, COOKIE_NAME, { path: '/' })
}

export async function getAdminSession(c: Context<{ Bindings: Bindings }>): Promise<{ email: string } | null> {
  const token = getCookie(c, COOKIE_NAME)
  if (!token) return null
  const data = await verifySession(c.env.SESSION_SECRET, token)
  if (!data) return null
  return { email: data.email }
}

export async function requireAdmin(c: Context<{ Bindings: Bindings }>): Promise<Response | null> {
  const session = await getAdminSession(c)
  if (!session) {
    if (c.req.path.startsWith('/api/')) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    return c.redirect('/admin/login')
  }
  return null
}

export async function checkAdminCredentials(
  email: string,
  password: string,
  envEmail: string,
  envPassword: string,
): Promise<boolean> {
  const emailOk = safeEqual(email.trim().toLowerCase(), envEmail.trim().toLowerCase())
  const passOk = safeEqual(password, envPassword)
  return emailOk && passOk
}
