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
