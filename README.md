# Huiskamerconcerten Reeks I — Jouw stem telt

Survey-website voor **Andre Devaere VZW**: feedback van gasten van zes huiskamerconcerten met fortepianist **Jos van Immerseel** en klarinettiste **Ayako Ito**, om Reeks II te verbeteren.

---

## Project Overview

- **Naam**: Huiskamerconcerten Survey — Reeks I
- **Opdrachtgever**: Dominique Dejonghe · Andre Devaere VZW · `dominique.dejonghe@iutum.be`
- **Doel**: 20 vragen verzamelen van ~50-150 cultuurliefhebbers, anoniem tenzij contact wordt gewenst
- **Talen**: Nederlands (default) + English (via `/en`); taalknop in header (🌐 NL · EN)
- **Toon**: warm-persoonlijk, klassiek-elegant, niet corporate

## URLs

| Type | URL |
|------|-----|
| **Productie NL (publiek)** | https://huiskamerconcerten-survey.pages.dev/ |
| **Productie EN (public)** | https://huiskamerconcerten-survey.pages.dev/en |
| **Admin login** | https://huiskamerconcerten-survey.pages.dev/admin/login |
| **Bedankpagina (NL)** | https://huiskamerconcerten-survey.pages.dev/dank-je |
| **Thank-you page (EN)** | https://huiskamerconcerten-survey.pages.dev/thank-you |
| **Privacy (NL)** | https://huiskamerconcerten-survey.pages.dev/privacy |
| **Privacy (EN)** | https://huiskamerconcerten-survey.pages.dev/en/privacy |
| **Health check** | https://huiskamerconcerten-survey.pages.dev/health |

### Admin credentials (productie)

```
E-mail:     dominique@pensato.org
Wachtwoord: P@n@sonic1
```

> **Belangrijk:** wijzig dit wachtwoord vóór algemeen gebruik via `wrangler pages secret put ADMIN_PASSWORD --project-name huiskamerconcerten-survey`.

### Sneltoets

In de survey-pagina: **Ctrl+Shift+A** → springt direct naar `/admin`.

---

## Tech Stack

- **Hono 4** + **TypeScript** + **JSX** (server-side rendering, geen client framework)
- **Cloudflare Pages** (edge runtime, gratis tier)
- **Cloudflare D1** (SQLite, gratis tier — vervangt Supabase)
- **Resend** voor optionele e-mailnotificaties (uitgeschakeld via `EMAIL_ENABLED=false`)
- **Vite 5** voor builds
- **Zod** voor server-side validatie
- **Vanilla JS** + **CSS Custom Properties** voor frontend (geen Tailwind/React in client → bundle < 200 KB)
- **Web Crypto API** voor SHA-256 IP-hashing en HMAC session signing (geen `bcrypt`-dependency nodig)

### Waarom afgeweken van de Next.js + Supabase brief?

De brief gaf expliciet vrijheid voor onderbouwde stack-keuzes. Cloudflare Pages + D1 levert hetzelfde functioneel resultaat als Next.js + Supabase + Vercel — maar met:
- één platform i.p.v. drie (geen vendor lock-in tegelijk op Vercel + Supabase + Resend)
- snellere edge response (Workers runtime)
- kleinere bundle (< 130 KB vs ~500 KB voor minimale Next.js-app)
- geen koud-start probleem
- prima geschikt voor verwacht volume (~150 responses)

---

## Architectuur

```
src/
├── index.tsx                # Hono app + alle routes
├── lib/
│   ├── questions.ts         # Single source of truth — 20 vragen, secties, types
│   ├── validation.ts        # Zod-schema voor server-side validatie
│   ├── crypto.ts            # SHA-256, HMAC, UUID via Web Crypto API
│   ├── auth.ts              # Session cookie sign/verify, login guard
│   ├── db.ts                # D1 query helpers (insert, list, delete, rate-limit)
│   ├── stats.ts             # NPS-berekening, gemiddeldes, datumformat NL
│   ├── csv.ts               # CSV met UTF-8 BOM, JSON export
│   └── email.ts             # Resend integratie (uitgeschakeld via env flag)
└── views/
    ├── layout.tsx           # HTML shell + fonts + meta
    ├── survey.tsx           # SurveyPage, ThanksPage, PrivacyPage
    └── admin.tsx            # LoginPage, DashboardPage

public/static/
├── styles.css               # Volledig design systeem (kleuren, typografie, animaties)
├── survey.js                # Client survey logic (validatie, progress, localStorage draft)
├── admin.js                 # Dashboard rendering (charts, tabs, modal, polling)
└── favicon.svg

migrations/
└── 0001_initial_schema.sql  # responses, audit_log, rate_limit tabellen

seed.sql                     # Eén test-response om end-to-end werking te tonen
```

### Routes

| Route | Methode | Doel |
|-------|---------|------|
| `/` | GET | Survey-pagina met alle 20 vragen |
| `/dank-je` | GET | Bedankscherm na succesvolle submission |
| `/privacy` | GET | Privacy-statement |
| `/health` | GET | Healthcheck JSON |
| `/api/responses` | POST | Nieuwe submission opslaan (Zod + honeypot + rate limit) |
| `/admin/login` | GET / POST | Login pagina + form handler |
| `/admin/logout` | GET | Sessie wissen |
| `/admin` | GET | Dashboard (auth required) |
| `/api/admin/responses` | GET | JSON dump + computed stats (auth) |
| `/api/admin/responses` | DELETE | Soft-delete alle responses (auth) |
| `/api/admin/responses/:id` | DELETE | Soft-delete één response (auth) |
| `/api/admin/export?format=csv\|json` | GET | Download (auth) |

---

## Data Architecture

### `responses` tabel (D1 / SQLite)

Volledige kolomnaam-mapping volgt de brief: `q1_nps`, `q2_blijft_bij`, `q3_aantal`, ... `q20_email`. Plus:
- `id` UUID, `submitted_at` UTC, `deleted_at` (soft delete)
- `ip_hash`: SHA-256(`IP_HASH_SALT::clientIp`) — IP-adressen worden **nooit** in plaintext opgeslagen
- `user_agent`: zoals doorgegeven door de browser

### `audit_log` tabel

Logt: `login_success`, `login_fail`, `response_submitted`, `rate_limited`, `export_csv`, `export_json`, `delete_response`, `delete_all`, `email_attempt`. Alleen IP-hashes, geen plaintext IP.

### `rate_limit` tabel

Per uur, per IP-hash, telt het aantal submissions. Reset automatisch (oude vensters worden opportunistisch gewist).

---

## Setup-instructies (vanaf nul)

### 1. Repository clonen + dependencies

```bash
git clone https://github.com/dominique-dejonghe/survey_huiskamerconcerten.git
cd survey_huiskamerconcerten
npm install
```

### 2. D1 database aanmaken

```bash
npx wrangler login                      # eenmalig, of zet CLOUDFLARE_API_TOKEN
npx wrangler d1 create huiskamerconcerten-prod
# Kopieer database_id in wrangler.jsonc
npx wrangler d1 migrations apply huiskamerconcerten-prod --remote
```

### 3. Secrets instellen op Cloudflare Pages

```bash
# Eerst Pages-project aanmaken
npx wrangler pages project create huiskamerconcerten-survey --production-branch main

# Daarna alle secrets — gebruik printf (geen echo) om trailing newlines te voorkomen
printf "dominique@pensato.org" | npx wrangler pages secret put ADMIN_EMAIL --project-name huiskamerconcerten-survey
printf "P@n@sonic1"             | npx wrangler pages secret put ADMIN_PASSWORD --project-name huiskamerconcerten-survey
openssl rand -hex 32             | tr -d '\n' | npx wrangler pages secret put SESSION_SECRET --project-name huiskamerconcerten-survey
openssl rand -hex 32             | tr -d '\n' | npx wrangler pages secret put IP_HASH_SALT --project-name huiskamerconcerten-survey
printf "false"                  | npx wrangler pages secret put EMAIL_ENABLED --project-name huiskamerconcerten-survey
printf "dominique.dejonghe@iutum.be" | npx wrangler pages secret put NOTIFY_TO --project-name huiskamerconcerten-survey
```

### 4. Build + deploy

```bash
npm run build
npx wrangler pages deploy dist --project-name huiskamerconcerten-survey --branch main
```

### 5. Lokale ontwikkeling

```bash
# Lokale D1 vullen
npm run db:migrate:local
npm run db:seed   # optioneel — laadt één test-response

# Server starten via PM2 (sandbox-safe)
fuser -k 3000/tcp 2>/dev/null
npm run build
pm2 start ecosystem.config.cjs

# Of plain wrangler:
npx wrangler pages dev dist --d1=webapp-production --local --ip 0.0.0.0 --port 3000
```

Open http://localhost:3000

---

## Environment Variables

Zie `.env.example` voor het volledige overzicht. Lokaal gebruik `.dev.vars` (zelfde format als `.env`), in productie `wrangler pages secret put`.

| Variabele | Doel | Verplicht |
|-----------|------|-----------|
| `ADMIN_EMAIL` | Login e-mailadres voor admin dashboard | ✅ |
| `ADMIN_PASSWORD` | Login wachtwoord (plaintext-vergelijking, constant-time) | ✅ |
| `SESSION_SECRET` | HMAC-key voor session cookie signing (≥ 32 char) | ✅ |
| `IP_HASH_SALT` | Salt voor SHA-256 IP-hash (GDPR) (≥ 32 char) | ✅ |
| `EMAIL_ENABLED` | `"true"` / `"false"` — schakelt Resend-notificatie | ✅ |
| `RESEND_API_KEY` | Resend API key | alleen als email enabled |
| `NOTIFY_FROM` | E-mail afzender (op een via Resend geverifieerd domein) | alleen als email enabled |
| `NOTIFY_TO` | Doel-e-mailadres voor notificaties | aanbevolen |

---

## Hoe nieuwe vragen toevoegen

1. Open `src/lib/questions.ts` en voeg een nieuw object toe aan de `QUESTIONS` array.
2. Werk het schema bij in `migrations/000X_add_question.sql` en run `wrangler d1 migrations apply ... --remote`.
3. Werk Zod-schema in `src/lib/validation.ts` bij.
4. Werk `src/lib/db.ts insertResponse()` bij om de nieuwe kolom mee te schrijven.
5. Werk `src/lib/csv.ts COLUMNS` en `HEADER_LABELS` bij voor CSV-export.
6. Indien open vraag: voeg id toe aan `QUESTIONS_OPEN` in `public/static/admin.js`.
7. Update `TOTAL_QUESTIONS` in `public/static/survey.js`.
8. Run `npm run build && wrangler pages deploy dist`.

## Hoe data exporteren

In het admin dashboard:
- **⬇ Export CSV** — UTF-8 met BOM, puntkomma-delimiter, NL-datumformaat (DD/MM/YYYY HH:mm) — opent direct in Excel
- **⬇ Export JSON** — volledige dump

Of via API (auth-cookie nodig):
```bash
curl -b cookies.txt https://huiskamerconcerten-survey.pages.dev/api/admin/export?format=csv > export.csv
```

## Hoe wachtwoord wijzigen

```bash
printf "nieuwWachtwoord!" | npx wrangler pages secret put ADMIN_PASSWORD --project-name huiskamerconcerten-survey
```
Geen redeploy nodig — Cloudflare past secrets onmiddellijk toe op alle nieuwe requests.

## E-mail notificaties activeren

```bash
printf "true" | npx wrangler pages secret put EMAIL_ENABLED --project-name huiskamerconcerten-survey
printf "re_xxxxxxxxxx" | npx wrangler pages secret put RESEND_API_KEY --project-name huiskamerconcerten-survey
printf "survey@andredevaere.org" | npx wrangler pages secret put NOTIFY_FROM --project-name huiskamerconcerten-survey
```

Bij elke nieuwe submission gaat dan een mail naar `NOTIFY_TO` met NPS, aantal concerten en eerste 200 tekens van Q15 (wensen Reeks II).

---

## Currently Completed Features

- ✅ Volledige survey-pagina met alle 20 vragen exact in de gevraagde formulering
- ✅ 8 verplichte vragen worden gevalideerd met visuele highlight, shake-animatie, scroll naar fout
- ✅ Sticky progress bar, real-time update bij elke input
- ✅ localStorage draft auto-save (geen "save & continue later" magic link, maar de pagina herstelt zichzelf na refresh)
- ✅ Bedankpagina met `❦` ornament en signature
- ✅ Mobile-first design, hamburger nav < 640 px, touch-targets ≥ 44 px, font-size ≥ 16 px
- ✅ Admin login met session cookie (HMAC-signed, httpOnly, secure, SameSite=Strict, 8u sessie)
- ✅ Admin dashboard: 6 KPI cards, scores per dimensie (gradient bars), NPS-verdeling (gekleurde bars), concertdeelname, 10 tabbladen open antwoorden met zoek, ruwe-data tabel met sort & detail-modal
- ✅ Auto-refresh om de 30 seconden + manuele refresh-knop
- ✅ CSV export (UTF-8 BOM, puntkomma, BE-datumformaat) + JSON export
- ✅ "Wis alle data" met "WIS"-bevestigingsprompt (soft delete via `deleted_at`)
- ✅ Honeypot field (`website` input, off-screen) blokkeert bots
- ✅ Rate limiting: 3 submissions per uur per IP-hash
- ✅ IP-adressen alleen als SHA-256 hash opgeslagen, geen plaintext, geen tracking-cookies
- ✅ Audit log voor login, export, delete, rate limit
- ✅ E-mail notificatie via Resend (geïntegreerd, uitgeschakeld via `EMAIL_ENABLED=false`)
- ✅ Strict CSP, secure headers, no-index op admin pagina's
- ✅ Print-stylesheet voor admin (verbergt knoppen)
- ✅ Sneltoets Ctrl+Shift+A → /admin

## Features niet geïmplementeerd

- ❌ "Save & continue later" via magic link (auto-save naar localStorage werkt wel)
- ❌ Sentiment-analyse op open antwoorden
- ❌ Word cloud van Q15
- ❌ Donkere modus voor admin
- ❌ Service worker voor offline gebruik
- ❌ Cron job voor 24-maanden anonimisering (handmatig via SQL of toevoegen via Cloudflare Cron Triggers)

## Recommended Next Steps

1. **Custom domain** koppelen (bv. `feedback.andredevaere.org`) via Cloudflare Pages dashboard.
2. **E-mail enabled zetten** zodra Resend-account + geverifieerd domein beschikbaar is.
3. **Cron Trigger** toevoegen voor automatische anonimisering na 24 maanden:
   ```sql
   UPDATE responses SET q19_naam=NULL, q20_email=NULL, ip_hash=NULL
   WHERE submitted_at < datetime('now', '-24 months');
   ```
4. **Lighthouse audit** uitvoeren via Chrome DevTools tegen de productie-URL voor de officiële score-screenshots.
5. **Monitoring** instellen via Cloudflare Analytics (gratis, geen tracking cookies nodig).
6. **Volgende wijziging admin-wachtwoord** door Dominique zelf (zie sectie boven).

---

## User Guide

### Voor respondenten

1. Open https://huiskamerconcerten-survey.pages.dev/
2. Vul de 20 vragen in — verplichte vragen zijn met `*` gemarkeerd, de rest is optioneel
3. Bij vraag 20 kun je aangeven of je gecontacteerd wilt worden — pas dan vraagt het formulier om je e-mailadres
4. Klik **Verstuur antwoorden** → bedankpagina

### Voor admin (Dominique)

1. Open https://huiskamerconcerten-survey.pages.dev/admin
2. Log in met `dominique@pensato.org` / `P@n@sonic1`
3. Bekijk:
   - **KPI-rij**: totaal, NPS-score, gemiddelden Q4/Q6/Q8/Q10
   - **Scores per dimensie**: horizontale bars met gradient turquoise→oranje
   - **NPS-verdeling**: 11 bars met kleurcodering (rood/oranje/groen)
   - **Concertdeelname**: bars per optie 1-6
   - **Open antwoorden**: tabbladen + zoekfunctie
   - **Ruwe data**: sorteerbare tabel, klik op rij → modal met alle 20 antwoorden
4. Export via knoppen bovenaan (CSV opent direct in Excel)
5. **🗑 Wis alle data** vraagt om bevestiging via prompt-tekst "WIS" voor extra veiligheid

---

## Deployment

- **Platform**: Cloudflare Pages
- **Status**: ✅ Active
- **Tech Stack**: Hono 4 + TypeScript + Vite + D1
- **Worker bundle**: 121 KB (gzipped, ruim onder 200 KB-target)
- **Last Updated**: 2026-05-02

---

## License & Credits

Gemaakt voor **Andre Devaere VZW** door Dominique Dejonghe. Alle vragen, kleuren en typografie volgen de visuele identiteit van [josvanimmerseel.com/huisconcerten](https://www.josvanimmerseel.com/huisconcerten).
