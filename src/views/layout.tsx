import type { FC } from 'hono/jsx'

export const Layout: FC<{ title: string; children: any; admin?: boolean }> = ({ title, children, admin }) => {
  return (
    <html lang="nl">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
        <meta name="description" content="Feedback voor de huiskamerconcerten Reeks I — Pensato.org" />
        <meta name="theme-color" content="#1BA8B0" />
        <meta name="robots" content={admin ? 'noindex, nofollow' : 'index, follow'} />
        <title>{title}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Playfair+Display:ital,wght@0,500;0,600;0,700;1,400;1,600&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/static/styles.css" />
        <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
      </head>
      <body class={admin ? 'admin-body' : 'survey-body'}>
        {children}
      </body>
    </html>
  )
}
