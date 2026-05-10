import type { FC } from 'hono/jsx'
import { UI, type Lang } from '../lib/i18n'
import type { Brand } from '../lib/surveys'
import { v } from '../lib/version'

export const Layout: FC<{
  title: string
  children: any
  admin?: boolean
  lang?: Lang
  brand?: Brand | null
}> = ({ title, children, admin, lang = 'nl', brand }) => {
  const t = UI[lang]
  // Brand variables (CSS custom properties scoped to <body>)
  const brandStyle = brand
    ? `--brand-primary:${brand.primary_color};--brand-accent:${brand.accent_color};--brand-surface:${brand.surface_color};`
    : ''
  const bodyClass = [
    admin ? 'admin-body' : 'survey-body',
    brand ? `brand-${brand.id}` : '',
  ].filter(Boolean).join(' ')
  return (
    <html lang={t.htmlLang}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="description" content={t.metaDesc} />
        <meta name="theme-color" content={brand?.primary_color ?? '#1BA8B0'} />
        <meta name="robots" content={admin ? 'noindex, nofollow' : 'index, follow'} />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href={v('/static/styles.css')} />
        <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
      </head>
      <body class={bodyClass} style={brandStyle || undefined}>
        {children}
      </body>
    </html>
  )
}
