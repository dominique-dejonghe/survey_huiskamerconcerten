// Centrale definitie van alle 20 vragen — single source of truth
// Wijzig hier om vragen toe te voegen / aan te passen

export type ScaleQuestion = {
  type: 'scale'
  id: string
  number: number
  required: boolean
  text: string
  helper?: string
  min: number
  max: number
  minLabel?: string
  maxLabel?: string
  section: string
}

export type ChoiceQuestion = {
  type: 'choice'
  id: string
  number: number
  required: boolean
  text: string
  helper?: string
  options: string[]
  section: string
  conditional?: { showField: string; whenValue: string }
}

export type TextQuestion = {
  type: 'text' | 'paragraph'
  id: string
  number: number
  required: boolean
  text: string
  helper?: string
  section: string
  showIf?: { questionId: string; equals: string }
}

export type Question = ScaleQuestion | ChoiceQuestion | TextQuestion

export const SECTIONS = [
  { id: 'algemeen', title: 'Algemene beleving', subtitle: 'Hoe heb je de reeks ervaren?' },
  { id: 'locatie', title: 'Locatie & sfeer', subtitle: 'De huiskamer als ruimte.' },
  { id: 'muzikaal', title: 'Muzikaal & instrument', subtitle: 'Akoestiek, fortepiano, programma.' },
  { id: 'jos', title: 'Jos als gastheer', subtitle: 'Toelichting en interactie.' },
  { id: 'organisatie', title: 'Praktische organisatie', subtitle: 'Communicatie, receptie, bijdrage.' },
  { id: 'reeks2', title: 'Reeks II en verder', subtitle: 'Wat zou je graag horen?' },
  { id: 'totslot', title: 'Tot slot', subtitle: 'Naam en contact (optioneel).' },
] as const

export const QUESTIONS: Question[] = [
  // ALGEMENE BELEVING
  {
    type: 'scale', id: 'q1_nps', number: 1, required: true,
    text: 'Hoe waarschijnlijk is het dat je de huiskamerconcerten zou aanbevelen aan een vriend of vriendin?',
    helper: '0 = helemaal niet waarschijnlijk · 10 = absoluut wel',
    min: 0, max: 10, minLabel: 'Niet waarschijnlijk', maxLabel: 'Absoluut wel',
    section: 'algemeen',
  },
  {
    type: 'text', id: 'q2_blijft_bij', number: 2, required: false,
    text: 'In één zin: wat blijft je het meest bij van deze reeks?',
    section: 'algemeen',
  },
  {
    type: 'choice', id: 'q3_aantal', number: 3, required: true,
    text: 'Aan hoeveel van de zes concerten heb je deelgenomen?',
    options: ['1', '2', '3', '4', '5', 'alle 6'],
    section: 'algemeen',
  },
  // LOCATIE & SFEER
  {
    type: 'scale', id: 'q4_sfeer', number: 4, required: true,
    text: 'Hoe ervoer je de huiskamer-setting?',
    helper: '1 = te beperkt · 5 = magisch intiem',
    min: 1, max: 5, minLabel: 'Te beperkt', maxLabel: 'Magisch intiem',
    section: 'locatie',
  },
  {
    type: 'paragraph', id: 'q5_sfeer_open', number: 5, required: false,
    text: 'Wat maakte de sfeer voor jou bijzonder — of net niet?',
    section: 'locatie',
  },
  // MUZIKAAL & INSTRUMENT
  {
    type: 'scale', id: 'q6_akoestiek', number: 6, required: true,
    text: 'Hoe beoordeel je de akoestiek in de huiskamer?',
    min: 1, max: 5, minLabel: 'Zwak', maxLabel: 'Uitstekend',
    section: 'muzikaal',
  },
  {
    type: 'paragraph', id: 'q7_fortepiano', number: 7, required: false,
    text: 'De fortepiano als instrument — heeft die je verrast, geboeid, vervreemd?',
    section: 'muzikaal',
  },
  {
    type: 'scale', id: 'q8_repertoire', number: 8, required: true,
    text: 'Hoe beoordeel je de programmakeuze en het repertoire van deze reeks?',
    min: 1, max: 5, minLabel: 'Zwak', maxLabel: 'Uitstekend',
    section: 'muzikaal',
  },
  {
    type: 'paragraph', id: 'q9_favoriet', number: 9, required: false,
    text: 'Welk concert of programma sprak je het meest aan, en waarom?',
    section: 'muzikaal',
  },
  // JOS ALS GASTHEER
  {
    type: 'scale', id: 'q10_interactie', number: 10, required: true,
    text: 'Hoe ervoer je de toelichting en interactie met Jos en/of Ayako tijdens de avonden?',
    min: 1, max: 5, minLabel: 'Zwak', maxLabel: 'Uitstekend',
    section: 'jos',
  },
  {
    type: 'paragraph', id: 'q11_gesprek', number: 11, required: false,
    text: 'Was er voldoende ruimte voor vragen en gesprek? Wat zou je anders willen?',
    section: 'jos',
  },
  // PRAKTISCHE ORGANISATIE
  {
    type: 'scale', id: 'q12_communic', number: 12, required: true,
    text: 'Hoe beoordeel je de uitnodigingscommunicatie (timing, duidelijkheid, toon)?',
    min: 1, max: 5, minLabel: 'Zwak', maxLabel: 'Uitstekend',
    section: 'organisatie',
  },
  {
    type: 'paragraph', id: 'q13_catering', number: 13, required: false,
    text: 'Catering en receptie — sterke punten, verbeterpunten?',
    section: 'organisatie',
  },
  {
    type: 'scale', id: 'q14_bijdrage', number: 14, required: true,
    text: 'Hoe ervaar je het bijdrage-model (prijs versus kwaliteit)?',
    min: 1, max: 5, minLabel: 'Te duur', maxLabel: 'Zeer goed',
    section: 'organisatie',
  },
  // REEKS II EN VERDER
  {
    type: 'paragraph', id: 'q15_wensen_2', number: 15, required: false,
    text: 'Welke muziek, componisten, periodes of thema\u2019s zou je graag horen van Jos van Immerseel en Ayako Ito in een volgende reeks?',
    helper: 'Volledig vrijblijvend — alle suggesties zijn welkom.',
    section: 'reeks2',
  },
  {
    type: 'paragraph', id: 'q16_gasten', number: 16, required: false,
    text: 'Zijn er muzikale gasten of duo-partners die je graag met Jos en Ayako zou willen horen?',
    section: 'reeks2',
  },
  {
    type: 'paragraph', id: 'q17_terugkomen', number: 17, required: false,
    text: 'Wat zou jou definitief over de streep trekken om opnieuw te komen?',
    section: 'reeks2',
  },
  {
    type: 'paragraph', id: 'q18_overige', number: 18, required: false,
    text: 'Iets wat we niet gevraagd hebben, maar wat je toch kwijt wil?',
    section: 'reeks2',
  },
  // TOT SLOT
  {
    type: 'text', id: 'q19_naam', number: 19, required: false,
    text: 'Je naam (optioneel)',
    section: 'totslot',
  },
  {
    type: 'choice', id: 'q20_contact', number: 20, required: false,
    text: 'Mag ik je persoonlijk contacteren over je feedback?',
    options: ['Ja', 'Nee'],
    section: 'totslot',
    conditional: { showField: 'q20_email', whenValue: 'ja' },
  },
]

export const REQUIRED_IDS = QUESTIONS.filter(q => q.required).map(q => q.id)
export const OPEN_TEXT_IDS = ['q2_blijft_bij','q5_sfeer_open','q7_fortepiano','q9_favoriet','q11_gesprek','q13_catering','q15_wensen_2','q16_gasten','q17_terugkomen','q18_overige']
export const SCALE_IDS = ['q4_sfeer','q6_akoestiek','q8_repertoire','q10_interactie','q12_communic','q14_bijdrage']

// ────────────────────────────────────────────────────────────────────
// DB-backed question adapter
// ────────────────────────────────────────────────────────────────────
// The hardcoded QUESTIONS / SECTIONS arrays above are only used as a fallback
// (when no survey is provided to SurveyPage — e.g. the legacy unbranded
// /survey page that does not yet exist). For real surveys we render from the
// `survey_questions` snapshot table via this adapter.
//
// Note: the snapshot has no `section` column. We map a question's `category`
// (free-text in admin) onto a known section id by best-effort matching, and
// fall back to a generic 'algemeen' section so nothing gets dropped from the
// render.

import type { SurveyQuestion } from './surveys'

/** Map a free-text category (like "Algemene beleving" or "Locatie & sfeer")
 *  to one of our known SECTIONS ids. Case-insensitive, accent-insensitive,
 *  substring-based. Falls back to 'algemeen' if nothing matches.
 *
 *  If `knownSectionIds` is provided (the survey's own section list), an exact
 *  match on the normalised category wins first — this is what makes
 *  drag-and-drop into a custom section (e.g. 'eten') work. */
function categoryToSectionId(
  category: string | null,
  knownSectionIds?: ReadonlySet<string>,
): string {
  if (!category) return 'algemeen'
  const norm = category.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').trim()
  // 1. Exact match against survey's own sections (handles custom sections).
  if (knownSectionIds && knownSectionIds.has(norm)) return norm
  // 2. Heuristic substring matching (legacy categories like "Locatie & sfeer").
  const candidates: Array<{ id: string; keys: string[] }> = [
    { id: 'algemeen', keys: ['algemeen', 'beleving', 'overall'] },
    { id: 'locatie', keys: ['locatie', 'sfeer', 'huiskamer', 'restaurant', 'setting'] },
    { id: 'muzikaal', keys: ['muziek', 'muzikaal', 'instrument', 'akoestiek', 'fortepiano', 'repertoire', 'programma'] },
    { id: 'jos', keys: ['jos', 'gastheer', 'toelichting', 'interactie'] },
    { id: 'organisatie', keys: ['organisatie', 'praktisch', 'communicatie', 'catering', 'bijdrage'] },
    { id: 'reeks2', keys: ['reeks ii', 'reeks 2', 'volgende', 'wensen', 'gasten', 'terugkomen'] },
    { id: 'totslot', keys: ['totslot', 'tot slot', 'naam', 'contact'] },
  ]
  for (const c of candidates) {
    if (c.keys.some(k => norm.includes(k))) {
      // If we have known sections and our heuristic guess isn't one of them,
      // fall back to the first known section so questions don't disappear.
      if (knownSectionIds && !knownSectionIds.has(c.id)) continue
      return c.id
    }
  }
  // Final fallback: if survey has sections defined, use the first one.
  if (knownSectionIds && knownSectionIds.size > 0) {
    return Array.from(knownSectionIds)[0]
  }
  return 'algemeen'
}

/** Convert a DB SurveyQuestion into the UI `Question` shape, picking the
 *  correct language for text/helper/labels/options. */
export function surveyQuestionToUi(
  sq: SurveyQuestion,
  lang: 'nl' | 'en',
  number: number,
  knownSectionIds?: ReadonlySet<string>,
): Question {
  const label = (lang === 'en' ? sq.label_en : sq.label_nl) || sq.label_nl || sq.label_en || sq.code
  const helper = (lang === 'en' ? sq.helper_en : sq.helper_nl) || undefined
  const required = sq.required === 1
  const sectionId = categoryToSectionId(sq.category, knownSectionIds)

  // DB `nps` type maps to UI `scale` with min/max 0–10
  if (sq.type === 'nps' || sq.type === 'scale') {
    return {
      type: 'scale',
      id: sq.code,
      number,
      required,
      text: label,
      helper,
      min: sq.scale_min ?? (sq.type === 'nps' ? 0 : 1),
      max: sq.scale_max ?? (sq.type === 'nps' ? 10 : 5),
      minLabel: (lang === 'en' ? sq.min_label_en : sq.min_label_nl) || undefined,
      maxLabel: (lang === 'en' ? sq.max_label_en : sq.max_label_nl) || undefined,
      section: sectionId,
    }
  }
  if (sq.type === 'choice') {
    const opts = (lang === 'en' ? sq.options_en : sq.options_nl) || sq.options_nl || sq.options_en || []
    const cond = sq.conditional_on
      ? { showField: sq.conditional_on.field, whenValue: sq.conditional_on.value }
      : undefined
    return {
      type: 'choice',
      id: sq.code,
      number,
      required,
      text: label,
      helper,
      options: opts,
      section: sectionId,
      conditional: cond,
    }
  }
  // text / paragraph
  return {
    type: sq.type === 'paragraph' ? 'paragraph' : 'text',
    id: sq.code,
    number,
    required,
    text: label,
    helper,
    section: sectionId,
  }
}

/** Build the runtime list of UI Questions from a list of DB snapshots.
 *  Numbering follows display_order (already sorted by the caller). */
export function surveyQuestionsToUi(
  snapshots: SurveyQuestion[],
  lang: 'nl' | 'en',
  knownSectionIds?: ReadonlySet<string>,
): Question[] {
  return snapshots.map((sq, idx) => surveyQuestionToUi(sq, lang, idx + 1, knownSectionIds))
}
