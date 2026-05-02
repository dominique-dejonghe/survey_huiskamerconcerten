// Resend e-mail integratie — uitgeschakeld tot EMAIL_ENABLED=true
// Werkt direct vanuit Cloudflare Workers (fetch naar Resend API)

import type { Bindings } from './auth'

export async function sendNewResponseNotification(
  env: Bindings,
  data: {
    id: string
    nps: number
    aantal: string
    wensen: string | null | undefined
    siteUrl: string
  },
): Promise<{ sent: boolean; reason?: string }> {
  if (env.EMAIL_ENABLED !== 'true') {
    return { sent: false, reason: 'email_disabled' }
  }
  if (!env.RESEND_API_KEY || !env.NOTIFY_FROM || !env.NOTIFY_TO) {
    return { sent: false, reason: 'missing_email_config' }
  }

  const wensenSnippet = (data.wensen ?? '').slice(0, 200)
  const html = `
    <div style="font-family: Georgia, serif; color:#2A2A2A; max-width:560px;">
      <h2 style="color:#1BA8B0; font-style:italic;">Nieuwe survey-response — Huiskamerconcerten</h2>
      <table style="border-collapse:collapse;">
        <tr><td style="padding:6px 12px 6px 0;"><strong>NPS-score:</strong></td><td>${data.nps} / 10</td></tr>
        <tr><td style="padding:6px 12px 6px 0;"><strong>Aantal concerten:</strong></td><td>${escapeHtml(data.aantal)}</td></tr>
        <tr><td style="padding:6px 12px 6px 0; vertical-align:top;"><strong>Wensen Reeks II:</strong></td><td>${escapeHtml(wensenSnippet) || '<em>(geen)</em>'}${wensenSnippet.length === 200 ? '…' : ''}</td></tr>
      </table>
      <p style="margin-top:24px;">
        <a href="${data.siteUrl}/admin" style="background:#1BA8B0;color:#fff;padding:10px 22px;border-radius:24px;text-decoration:none;display:inline-block;">Bekijk in admin</a>
      </p>
      <p style="font-size:12px;color:#888;margin-top:32px;">— Andre Devaere VZW · automatische notificatie</p>
    </div>
  `

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.NOTIFY_FROM,
        to: [env.NOTIFY_TO],
        subject: 'Nieuwe survey-response — Huiskamerconcerten',
        html,
      }),
    })
    if (!resp.ok) {
      const t = await resp.text()
      return { sent: false, reason: `resend_error_${resp.status}: ${t.slice(0, 100)}` }
    }
    return { sent: true }
  } catch (e) {
    return { sent: false, reason: `exception: ${(e as Error).message}` }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ))
}
