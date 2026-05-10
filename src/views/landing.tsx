import type { FC } from 'hono/jsx'
import { Layout } from './layout'
import type { Lang } from '../lib/i18n'
import type { Brand } from '../lib/surveys'
import type { ListSurveysWithStatsRow } from '../lib/surveys'

const t = {
  nl: {
    title: 'Concertenquêtes — Pensato.org',
    heading: 'Welkom — kies de enquête',
    intro: 'Hieronder vind je de open enquêtes voor de concertreeksen waarvan je organisator een uitnodiging heeft gestuurd. Klik op de juiste kaart om je feedback te geven.',
    none: 'Er staan momenteel geen open enquêtes klaar. Bedankt voor je interesse — kom later terug.',
    open: 'Geef je feedback',
    closed: 'gesloten',
    archived: 'gearchiveerd',
    series: 'Reeks',
    artist: 'Uitvoerder',
    date: 'Datum',
    location: 'Locatie',
    responses: 'antwoorden',
    langSwitchLabel: 'English',
    langSwitchHref: '/en',
    footer: 'Pensato.org · Andre Devaere VZW',
    privacy: 'Privacy',
    privacyHref: '/privacy',
    adminLink: 'Admin login',
  },
  en: {
    title: 'Concert surveys — Pensato.org',
    heading: 'Welcome — choose your survey',
    intro: 'Below are the open surveys for the concert series whose organizer invited you. Click the matching card to share your feedback.',
    none: 'No open surveys at the moment. Thank you for your interest — please come back later.',
    open: 'Give feedback',
    closed: 'closed',
    archived: 'archived',
    series: 'Series',
    artist: 'Performer',
    date: 'Date',
    location: 'Venue',
    responses: 'responses',
    langSwitchLabel: 'Nederlands',
    langSwitchHref: '/',
    footer: 'Pensato.org · Andre Devaere VZW',
    privacy: 'Privacy',
    privacyHref: '/privacy',
    adminLink: 'Admin login',
  },
} as const

function fmtDate(iso: string | null, lang: Lang): string {
  if (!iso) return ''
  try {
    const d = new Date(iso + 'T00:00:00Z')
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'nl-BE', { day: '2-digit', month: 'long', year: 'numeric' })
  } catch { return iso }
}

export const LandingPage: FC<{
  lang: Lang
  surveys: ListSurveysWithStatsRow[]
  brands: Brand[]
}> = ({ lang, surveys, brands }) => {
  const tr = t[lang]
  const open = surveys.filter(s => s.status === 'open')
  // Group by brand for nicer presentation
  const byBrand: Record<string, ListSurveysWithStatsRow[]> = {}
  for (const s of open) {
    (byBrand[s.brand_id] ||= []).push(s)
  }

  return (
    <Layout title={tr.title} lang={lang}>
      <header class="landing-header">
        <div class="landing-header-inner">
          <a href={lang === 'en' ? '/en' : '/'} class="landing-brand-line">
            <span class="italic-serif">Pensato.org</span>
          </a>
          <nav class="landing-nav">
            <a href={tr.langSwitchHref} class="lang-switch">
              <span aria-hidden="true">🌐</span> {tr.langSwitchLabel}
            </a>
          </nav>
        </div>
      </header>

      <main class="landing-main">
        <section class="landing-hero">
          <h1>{tr.heading}</h1>
          <p class="landing-intro">{tr.intro}</p>
        </section>

        {open.length === 0 ? (
          <div class="landing-empty">
            <p>{tr.none}</p>
          </div>
        ) : (
          brands.map(brand => {
            const list = byBrand[brand.id]
            if (!list || list.length === 0) return null
            return (
              <section
                class="landing-brand-section"
                style={`--brand-primary:${brand.primary_color};--brand-accent:${brand.accent_color};--brand-surface:${brand.surface_color};`}
                data-brand={brand.id}
              >
                <header class="landing-brand-header">
                  {brand.logo_url ? (
                    <img src={brand.logo_url} alt={lang === 'en' ? brand.name_en : brand.name_nl} class="landing-brand-logo" />
                  ) : null}
                  <h2>{lang === 'en' ? brand.name_en : brand.name_nl}</h2>
                </header>
                <div class="landing-survey-grid">
                  {list.map(s => {
                    const url = `/${brand.url_prefix}/${s.slug}${lang === 'en' ? '/en' : ''}`
                    return (
                      <a class="landing-card" href={url}>
                        <span class="landing-card-series italic-serif">{s.series_name ?? tr.series}</span>
                        <h3>{lang === 'en' ? s.title_en : s.title_nl}</h3>
                        {(lang === 'en' ? s.subtitle_en : s.subtitle_nl) ? (
                          <p class="landing-card-sub">{lang === 'en' ? s.subtitle_en : s.subtitle_nl}</p>
                        ) : null}
                        <dl class="landing-card-meta">
                          {s.artist ? (
                            <div><dt>{tr.artist}</dt><dd>{s.artist}</dd></div>
                          ) : null}
                          {s.concert_date ? (
                            <div><dt>{tr.date}</dt><dd>{fmtDate(s.concert_date, lang)}</dd></div>
                          ) : null}
                          {s.location ? (
                            <div><dt>{tr.location}</dt><dd>{s.location}</dd></div>
                          ) : null}
                        </dl>
                        <span class="landing-card-cta">{tr.open} →</span>
                      </a>
                    )
                  })}
                </div>
              </section>
            )
          })
        )}
      </main>

      <footer class="landing-footer">
        <p>
          <span class="italic-serif">{tr.footer}</span> ·{' '}
          <a href={tr.privacyHref}>{tr.privacy}</a> ·{' '}
          <a href="/admin/login">{tr.adminLink}</a>
        </p>
      </footer>
    </Layout>
  )
}
