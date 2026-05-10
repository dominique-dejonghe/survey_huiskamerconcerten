# Concertenquêtes — Pensato.org

Multi-survey platform voor concert-feedback enquêtes van **Andre Devaere VZW** en partners. Hosts twee merken (brands) onder één Cloudflare Pages deployment, met per-merk styling, eigen URLs en een gedeelde questionsbibliotheek.

---

## Project Overview

- **Naam**: Concertenquêtes — multi-survey platform
- **Opdrachtgever**: Dominique Dejonghe · Andre Devaere VZW · `dominique.dejonghe@iutum.be`
- **Doel**: feedback verzamelen van concertgangers, met aparte enquêtes per concertreeks of evenement
- **Architectuur**: Brand → Series → Concert/Survey (Hierarchy Option B)
- **Talen**: Nederlands (default) + English; taalknop in header (🌐 NL · EN), per-survey scoped
- **Toon**: warm-persoonlijk, klassiek-elegant, niet corporate

## Brands

| Brand | Prefix | URL pattern | Primaire kleur | Accent | Logo |
|-------|--------|-------------|----------------|--------|------|
| **Huiskamerconcerten** | `h` | `/h/<slug>` | `#5B1F2A` (bordeaux) | `#F4A93C` (gold) | `andre-devaere-logo.png` |
| **Ebdiepconcerten** | `e` | `/e/<slug>` | `#3C587E` (navy) | `#D8942B` (amber) | `ebdiep-logo.png` |

Brand kleuren worden via CSS custom properties (`--brand-primary`, `--brand-accent`, `--brand-surface`) op `<body>` gezet, samen met een class `brand-huiskamer` of `brand-ebdiep`.

## URLs

| Type | URL |
|------|-----|
| **Landing page (alle enquêtes)** | https://huiskamerconcerten-survey.pages.dev/ |
| **Reeks 1 — Immerseel & Ito** (NL) | https://huiskamerconcerten-survey.pages.dev/h/reeks-1-immerseel-ito |
| **Reeks 1 — Immerseel & Ito** (EN) | https://huiskamerconcerten-survey.pages.dev/h/reeks-1-immerseel-ito/en |
| **Admin overzicht** | https://huiskamerconcerten-survey.pages.dev/admin |
| **Nieuwe enquête aanmaken** | https://huiskamerconcerten-survey.pages.dev/admin/surveys/new |
| **Per-survey dashboard** | https://huiskamerconcerten-survey.pages.dev/admin/surveys/1 |
| **Bedankpagina (NL)** | https://huiskamerconcerten-survey.pages.dev/h/<slug>/dank-je |
| **Privacy (NL)** | https://huiskamerconcerten-survey.pages.dev/privacy |
| **Health check** | https://huiskamerconcerten-survey.pages.dev/api/health |

### Admin credentials (productie)

```
E-mail:     dominique@pensato.org
Wachtwoord: P@n@sonic1
```

> Wijzig vóór algemeen gebruik via:
> `npx wrangler pages secret put ADMIN_PASSWORD --project-name huiskamerconcerten-survey`

### Sneltoets

Vanaf elke survey-pagina: **Ctrl+Shift+A** → springt naar `/admin`.

---

## Tech Stack

- **Hono 4** + **TypeScript** + **JSX** (server-side rendering, geen client framework)
- **Cloudflare Pages** (edge runtime, gratis tier)
- **Cloudflare D1** (SQLite, gratis tier)
- **Resend** voor optionele e-mailnotificaties (uitgeschakeld via `EMAIL_ENABLED=false`)
- **Vite 5** voor builds (single `_worker.js` bundle ~528 kB)
- **Zod** voor server-side validatie
- **Vanilla JS** + **CSS Custom Properties** voor frontend (geen client framework)
- **Web Crypto API** voor SHA-256 IP-hashing en HMAC session signing
- **OpenAI GPT-4o-mini** voor AI-gestuurde analyse-rapporten (per survey + lang gecached)
- **docx** library voor Word-export, **jsPDF** voor PDF-export

---

## Data Architecture

### Database schema (Cloudflare D1 / SQLite)

```
brands                  surveys                       questions (library)
─────────               ───────────                   ──────────────────
id (PK)                 id (PK)                       id (PK)
prefix (h/e)            brand_id → brands.id          code (q1_nps, q5_acoustics, …)
name                    slug (UNIQUE per brand)       type (nps|scale|text|email|…)
primary_color           series_name                   label_nl / label_en
accent_color            artist                        scale_min / scale_max
surface_color           concert_date                  required (0/1)
logo_path               location                      conditional_on (JSON)
website                 title_nl / title_en           …
                        subtitle_nl / subtitle_en
                        question_codes (JSON array)
                        status (open|closed|archived)

responses                                analysis_cache
──────────────                           ──────────────────
id (PK)                                  survey_id (PK part)
survey_id → surveys.id                   lang (PK part)
brand_id → brands.id                     summary_md
lang (nl/en)                             generated_at
q1_nps … q20_email (legacy columns)      model_used
answers_json (TEXT, future flexible)
ip_hash, user_agent, created_at
```

### Question library

20 vragen (`q1_nps`, `q2_immerseel_perf`, …, `q20_contact`) zitten in de `questions` tabel. Een survey kiest welke vragen bij hem horen via een **JSON array van question codes** in `surveys.question_codes`. Antwoorden worden voorlopig nog in de oude vaste kolommen (`q1_nps` … `q20_email`) opgeslagen voor backwards compatibility, met `answers_json` als toekomstige flexibele opslag voor surveys met andere vragen.

### Hoe een nieuwe survey toevoegen

**Vanuit admin (aanbevolen):**

1. Log in op `/admin`
2. Klik op **+ Nieuwe enquête** rechtsboven in het overzicht
3. Vul het formulier in:
   - **Merk** kiezen (Huiskamerconcerten of Ebdiepconcerten)
   - **Titel NL** (verplicht), Titel EN (optioneel — leeg = NL gebruiken)
   - Ondertitel, reeks, artiest, datum, locatie (allemaal optioneel)
   - **URL slug** wordt auto-gegenereerd uit de titel maar je kan hem aanpassen; live availability-check
   - **Status**: open / closed / archived
   - **Vragen kiezen** uit de bibliotheek, of via "kopieer van bestaande enquête"
4. Klik **Enquête aanmaken** → je komt direct in het dashboard van de nieuwe enquête

**Via SQL (fallback voor bulk-import):**

```sql
INSERT INTO surveys (
  brand_id, slug, series_name, artist, concert_date, location,
  title_nl, title_en, subtitle_nl, subtitle_en,
  question_codes, status
) VALUES (
  'ebdiep',                       -- brand_id is een string: 'huiskamer' of 'ebdiep'
  'concert-2026-09-mariekerke',   -- URL slug → /e/concert-2026-09-mariekerke
  'Najaar 2026', '...', '2026-09-15', 'Mariekerke',
  '...', '...', '...', '...',
  '["q1_nps","q4_sfeer","q19_naam","q20_contact"]',
  'open'
);
```

Toepassen op productie:
```bash
npx wrangler d1 execute huiskamerconcerten-prod --remote --command="INSERT INTO surveys ..."
```

---

## Currently Completed Features

✅ **Multi-survey platform** — twee brands, ongebonden aantal surveys per brand
✅ **Landing page** — toont alle open enquêtes gegroepeerd per merk
✅ **Brand-aware styling** — CSS custom properties + body class per brand
✅ **Per-survey URL routing** — `/h/<slug>` en `/e/<slug>` met regex-restrictie
✅ **i18n** — NL/EN met taalknop die binnen survey blijft
✅ **20-vragen enquête** — NPS, schaal, tekst, conditional email
✅ **Question library** — herbruikbare vragenbank met JSON-array koppeling per survey
✅ **Admin overzicht** — alle surveys met response count, gemiddelde NPS, laatste reactie
✅ **Per-survey dashboard** — filters, KPIs, exports allemaal scoped op `?survey=X`
✅ **CSV/PDF/DOCX export** — bestandsnaam bevat survey-slug en datum
✅ **AI-analyse (GPT-4o-mini)** — per survey + lang gecached, automatische refresh bij invalidate
✅ **Authenticatie** — HMAC-signed session cookie, e-mail+wachtwoord
✅ **Rate limiting** — 5 submits/IP/uur via SHA-256 hash
✅ **Audit log** — alle admin acties (login, delete, export, AI generate)
✅ **Migration toegepast lokaal + productie** — 5 migrations, brands, surveys, questions tabellen
✅ **Admin form: nieuwe enquête aanmaken** — `/admin/surveys/new` met brand-keuze, auto-slug, live availability-check, question picker met "kopieer van bestaande"

## Features Not Yet Implemented

⏳ **Question editor in admin** — vragen toevoegen/wijzigen via UI (nu enkel via migration)
⏳ **Edit/clone bestaande survey** — momenteel kan een survey enkel aangemaakt worden, niet gewijzigd
⏳ **Survey duplicate** — kopieer een survey als basis voor een nieuwe
⏳ **Bulk e-mail uitnodigingen** vanuit admin
⏳ **Per-survey Resend-template** voor confirmation/notification mails
⏳ **Multi-tenant isolatie** — momenteel ziet één admin alle surveys; eventueel per-brand admin
⏳ **Brand-specifieke header/hero polish** voor Ebdiep (nu enkel kleurwissel)
⏳ **Vrije vragen-engine** — antwoorden in `answers_json` ipv vaste kolommen, voor surveys met afwijkende structuur

## Recommended Next Steps

1. **Maak eerste echte Ebdiepconcerten survey** via `/admin/surveys/new` (geen SQL meer nodig!)
2. **Edit-functionaliteit** — wijzigen van bestaande surveys (titel, status, vragen)
3. **Question library editor** — vragen toevoegen/wijzigen vanuit admin
4. **Ebdiep-specifieke hero/header design** beyond just kleurwissel

---

## User Guide (kort)

### Voor concertgangers
1. Ga naar de uitnodigings-URL (bv. `/h/reeks-1-immerseel-ito`)
2. Beantwoord ~5 minuten vragen (NPS, schalen, open vragen)
3. Optioneel: laat e-mail achter voor follow-up
4. Submit → bedankpagina

### Voor admin (Dominique)
1. Ga naar `/admin` → log in met admin credentials
2. **Overzicht**: zie alle surveys met response count, gemiddelde NPS, laatste reactie
3. **Klik op een survey** → per-survey dashboard met:
   - Filter op taal (NL/EN/alles)
   - KPI's: aantal responses, gemiddelde NPS, top antwoorden
   - Tabel met alle individuele responses
   - **Export**: CSV / PDF / Word — bestandsnaam bevat survey-slug + datum
   - **AI-analyse**: GPT-4o-mini genereert markdown rapport (gecached per survey + lang)
4. **Nieuwe survey**: tot Phase 2 via SQL (zie recipe boven)

---

## Local Development

```bash
# Install
cd /home/user/webapp && npm install

# Apply migrations + seed
npm run db:migrate:local
npm run db:seed

# Build + start
npm run build
pm2 start ecosystem.config.cjs

# Test
curl http://localhost:3000/api/health
curl http://localhost:3000/                            # Landing
curl http://localhost:3000/h/reeks-1-immerseel-ito     # Huiskamer survey
```

PM2 commands:
```bash
pm2 list
pm2 logs survey --nostream
pm2 restart survey
```

---

## Deployment

- **Platform**: Cloudflare Pages
- **Project name**: `huiskamerconcerten-survey`
- **Production branch**: `main`
- **Status**: ✅ Active
- **Tech Stack**: Hono + TypeScript + JSX + Cloudflare D1
- **Last Updated**: 2026-05-10 — Multi-survey platform with Huiskamerconcerten + Ebdiepconcerten

### Production deploy

```bash
cd /home/user/webapp

# 1. Apply migrations to production D1
npx wrangler d1 migrations apply huiskamerconcerten-prod

# 2. Build + deploy
npm run build
npx wrangler pages deploy dist --project-name huiskamerconcerten-survey

# 3. Verify
curl https://huiskamerconcerten-survey.pages.dev/api/health
curl https://huiskamerconcerten-survey.pages.dev/
curl https://huiskamerconcerten-survey.pages.dev/h/reeks-1-immerseel-ito
```

### Environment / Secrets

| Var | Where | Default |
|-----|-------|---------|
| `ADMIN_EMAIL` | secret | `dominique@pensato.org` |
| `ADMIN_PASSWORD` | secret | `P@n@sonic1` |
| `SESSION_SECRET` | secret | random 32-byte hex |
| `OPENAI_API_KEY` | secret | required for AI analysis |
| `EMAIL_ENABLED` | var | `false` |
| `RESEND_API_KEY` | secret | optional |

Set with: `npx wrangler pages secret put VAR_NAME --project-name huiskamerconcerten-survey`

---

## File Structure

```
webapp/
├── src/
│   ├── index.tsx                  # Hono app + all routes (landing, /h/:slug, /e/:slug, admin)
│   ├── lib/
│   │   ├── db.ts                  # Response queries, survey-scoped
│   │   ├── surveys.ts             # NEW: Brand/Survey/Question helpers
│   │   ├── ai.ts                  # OpenAI + per-survey cache
│   │   ├── docx-report.ts         # Word export, survey-aware cover
│   │   ├── pdf-report.ts          # PDF export
│   │   ├── auth.ts, session.ts    # HMAC session
│   │   ├── validation.ts          # Zod schemas, accepts survey_id
│   │   └── questions.ts           # 20-question definition (used by survey.tsx)
│   └── views/
│       ├── layout.tsx             # Brand CSS variables on body
│       ├── landing.tsx            # NEW: landing page with brand grid
│       ├── survey.tsx             # Public survey form, brand+survey aware
│       └── admin.tsx              # Login, overview, per-survey dashboard
├── public/static/
│   ├── styles.css                 # Brand CSS vars, landing, admin overview
│   ├── survey.js                  # Sends survey_id in POST payload
│   ├── admin.js                   # api() helper appends ?survey=X to all calls
│   └── brand/
│       ├── andre-devaere-logo.png
│       └── ebdiep-logo.png
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_lang.sql
│   ├── 0003_analysis_cache.sql
│   ├── 0004_multi_survey.sql      # NEW: brands, surveys, questions, survey_id
│   └── 0005_seed_questions.sql    # NEW: seed 20 questions
├── seed.sql                        # Test data (with survey_id=1)
├── wrangler.jsonc
├── ecosystem.config.cjs            # PM2 config
└── package.json
```
