// Bilingual strings (NL default, EN secondary)
// Single source of truth for all UI labels and 20 questions in both languages

export type Lang = 'nl' | 'en'

export const UI = {
  nl: {
    htmlLang: 'nl',
    metaDesc: 'Feedback voor de huiskamerconcerten Reeks I — Pensato.org',
    surveyTitle: 'Jouw stem telt — Huiskamerconcerten Reeks I',
    thanksTitle: 'Dank je — Huiskamerconcerten',
    privacyTitle: 'Privacy — Huiskamerconcerten',
    // Header
    home: 'Home',
    navTickets: 'Tickets',
    navJos: 'Jos',
    navAyako: 'Ayako',
    menuLabel: 'Menu',
    // Hero
    heroTitle: 'Jouw stem telt',
    heroSub: 'Een korte vragenlijst over de huiskamerconcerten met Jos van Immerseel en Ayako Ito. Jouw eerlijke feedback helpt ons om Reeks II beter te maken.',
    // Progress
    progressLabel: (n: number, total: number) => `${n} van ${total} ingevuld`,
    progressRegion: 'Voortgang',
    // Intro
    introP1Welcome: 'Welkom, en ',
    introP1Strong1: 'dank dat je tijd neemt',
    introP1Mid: '. De vragenlijst telt 20 vragen en duurt ongeveer 5 minuten. ',
    introP1Strong2: '8 vragen zijn verplicht',
    introP1End: ', de rest is vrijblijvend — schrijf alleen wat je écht kwijt wil.',
    introP2: 'We bewaren niets meer dan nodig. Je antwoorden zijn anoniem tenzij je expliciet contact wenst aan het einde.',
    // Question card
    questionLabel: (n: number) => `Vraag ${n}`,
    requiredLabel: 'verplicht',
    requiredErrorMsg: 'Deze vraag is verplicht.',
    emailLabel: 'Je e-mailadres',
    emailPlaceholder: 'naam@voorbeeld.be',
    // Submit
    submitBtn: 'Verstuur antwoorden',
    submitSending: 'Versturen…',
    submitNote: 'Anoniem tenzij je contact wenst · we bewaren niets meer dan nodig',
    // Errors / messages
    errSomething: 'Er ging iets mis: ',
    errRateLimit: 'Te veel pogingen — probeer later opnieuw.',
    errNetwork: 'Netwerkfout: ',
    errUnknown: 'onbekend',
    // Footer
    footerCredit: 'Pensato.org',
    footerCenter: 'Huiskamerconcerten Reeks I',
    privacyLink: 'Privacy',
    // Thank-you page
    thanksHeadline: 'Dank je. Echt.',
    thanksBody: 'Jouw stem helpt ons om Reeks II niet zomaar een herhaling te maken, maar iets beter.',
    thanksSig: '— Dominique Dejonghe, Pensato.org',
    // Privacy page
    privacyHeading: 'Privacy',
    privacyP1: 'Pensato.org verzamelt enkel de antwoorden die je hier geeft. We slaan geen IP-adressen op in plaintext (enkel een eenrichtingshash voor anti-spam). Je naam en e-mailadres bewaren we alleen als je daar expliciet om vraagt bij vraag 20.',
    privacyP2Pre: 'We gebruiken geen tracking-cookies, geen Google Analytics. Data wordt na 24 maanden automatisch geanonimiseerd. Verzoeken tot verwijdering kunnen via ',
    privacyP2Post: '.',
    privacyBack: '← Terug naar de vragenlijst',
    // Lang switch
    langSwitchAria: 'Taal kiezen',
    langOther: 'EN',
    langOtherFull: 'English',
    langOtherHref: '/en',
    // Sections (for client-side use if needed)
  },
  en: {
    htmlLang: 'en',
    metaDesc: 'Feedback for the house concerts Series I — Pensato.org',
    surveyTitle: 'Your voice matters — House concerts Series I',
    thanksTitle: 'Thank you — House concerts',
    privacyTitle: 'Privacy — House concerts',
    // Header
    home: 'Home',
    navTickets: 'Tickets',
    navJos: 'Jos',
    navAyako: 'Ayako',
    menuLabel: 'Menu',
    // Hero
    heroTitle: 'Your voice matters',
    heroSub: 'A short questionnaire about the house concerts with Jos van Immerseel and Ayako Ito. Your honest feedback helps us make Series II even better.',
    // Progress
    progressLabel: (n: number, total: number) => `${n} of ${total} answered`,
    progressRegion: 'Progress',
    // Intro
    introP1Welcome: 'Welcome, and ',
    introP1Strong1: 'thank you for taking the time',
    introP1Mid: '. The questionnaire has 20 questions and takes about 5 minutes. ',
    introP1Strong2: '8 questions are required',
    introP1End: ', the rest are optional — only write what you really want to share.',
    introP2: 'We store no more than necessary. Your answers are anonymous unless you explicitly request contact at the end.',
    // Question card
    questionLabel: (n: number) => `Question ${n}`,
    requiredLabel: 'required',
    requiredErrorMsg: 'This question is required.',
    emailLabel: 'Your email address',
    emailPlaceholder: 'name@example.com',
    // Submit
    submitBtn: 'Submit answers',
    submitSending: 'Sending…',
    submitNote: 'Anonymous unless you request contact · we store no more than necessary',
    // Errors / messages
    errSomething: 'Something went wrong: ',
    errRateLimit: 'Too many attempts — please try again later.',
    errNetwork: 'Network error: ',
    errUnknown: 'unknown',
    // Footer
    footerCredit: 'Pensato.org',
    footerCenter: 'House concerts Series I',
    privacyLink: 'Privacy',
    // Thank-you page
    thanksHeadline: 'Thank you. Truly.',
    thanksBody: 'Your voice helps us make Series II not just a repeat, but something better.',
    thanksSig: '— Dominique Dejonghe, Pensato.org',
    // Privacy page
    privacyHeading: 'Privacy',
    privacyP1: 'Pensato.org collects only the answers you provide here. We do not store IP addresses in plaintext (only a one-way hash for anti-spam protection). We keep your name and email address only if you explicitly ask for it at question 20.',
    privacyP2Pre: 'We use no tracking cookies, no Google Analytics. Data is automatically anonymised after 24 months. Deletion requests can be sent to ',
    privacyP2Post: '.',
    privacyBack: '← Back to the questionnaire',
    // Lang switch
    langSwitchAria: 'Choose language',
    langOther: 'NL',
    langOtherFull: 'Nederlands',
    langOtherHref: '/',
  },
} as const

// Sections in both languages
export const SECTIONS_I18N = {
  nl: [
    { id: 'algemeen',     title: 'Algemene beleving',   subtitle: 'Hoe heb je de reeks ervaren?' },
    { id: 'locatie',      title: 'Locatie & sfeer',     subtitle: 'De huiskamer als ruimte.' },
    { id: 'muzikaal',     title: 'Muzikaal & instrument', subtitle: 'Akoestiek, fortepiano, programma.' },
    { id: 'jos',          title: 'Jos & Ayako als gastheer', subtitle: 'Toelichting en interactie.' },
    { id: 'organisatie',  title: 'Praktische organisatie', subtitle: 'Communicatie, receptie, bijdrage.' },
    { id: 'reeks2',       title: 'Reeks II en verder',  subtitle: 'Wat zou je graag horen?' },
    { id: 'totslot',      title: 'Tot slot',            subtitle: 'Naam en contact (optioneel).' },
  ],
  en: [
    { id: 'algemeen',     title: 'Overall experience',  subtitle: 'How did you experience the series?' },
    { id: 'locatie',      title: 'Location & atmosphere', subtitle: 'The living room as a venue.' },
    { id: 'muzikaal',     title: 'Music & instrument',  subtitle: 'Acoustics, fortepiano, programme.' },
    { id: 'jos',          title: 'Jos & Ayako as hosts', subtitle: 'Commentary and interaction.' },
    { id: 'organisatie',  title: 'Practical organisation', subtitle: 'Communication, reception, contribution.' },
    { id: 'reeks2',       title: 'Series II and beyond', subtitle: 'What would you like to hear?' },
    { id: 'totslot',      title: 'Finally',             subtitle: 'Name and contact (optional).' },
  ],
} as const

// Question text translations (keyed by question id)
// Structure: { id: { nl: { text, helper?, minLabel?, maxLabel?, options? }, en: { ... } } }
export const QUESTIONS_I18N: Record<string, {
  nl: { text: string; helper?: string; minLabel?: string; maxLabel?: string; options?: string[] }
  en: { text: string; helper?: string; minLabel?: string; maxLabel?: string; options?: string[] }
}> = {
  q1_nps: {
    nl: {
      text: 'Hoe waarschijnlijk is het dat je de huiskamerconcerten zou aanbevelen aan een vriend of vriendin?',
      helper: '0 = helemaal niet waarschijnlijk · 10 = absoluut wel',
      minLabel: 'Niet waarschijnlijk', maxLabel: 'Absoluut wel',
    },
    en: {
      text: 'How likely are you to recommend the house concerts to a friend?',
      helper: '0 = not at all likely · 10 = absolutely',
      minLabel: 'Not likely', maxLabel: 'Absolutely',
    },
  },
  q2_blijft_bij: {
    nl: { text: 'In één zin: wat blijft je het meest bij van deze reeks?' },
    en: { text: 'In one sentence: what stays with you most from this series?' },
  },
  q3_aantal: {
    nl: { text: 'Aan hoeveel van de zes concerten heb je deelgenomen?', options: ['1', '2', '3', '4', '5', 'alle 6'] },
    en: { text: 'How many of the six concerts did you attend?',         options: ['1', '2', '3', '4', '5', 'all 6'] },
  },
  q4_sfeer: {
    nl: { text: 'Hoe ervoer je de huiskamer-setting?', helper: '1 = te beperkt · 5 = magisch intiem', minLabel: 'Te beperkt', maxLabel: 'Magisch intiem' },
    en: { text: 'How did you experience the living-room setting?', helper: '1 = too limited · 5 = magically intimate', minLabel: 'Too limited', maxLabel: 'Magically intimate' },
  },
  q5_sfeer_open: {
    nl: { text: 'Wat maakte de sfeer voor jou bijzonder — of net niet?' },
    en: { text: 'What made the atmosphere special for you — or not?' },
  },
  q6_akoestiek: {
    nl: { text: 'Hoe beoordeel je de akoestiek in de huiskamer?', minLabel: 'Zwak', maxLabel: 'Uitstekend' },
    en: { text: 'How do you rate the acoustics in the living room?', minLabel: 'Poor', maxLabel: 'Excellent' },
  },
  q7_fortepiano: {
    nl: { text: 'De fortepiano als instrument — heeft die je verrast, geboeid, vervreemd?' },
    en: { text: 'The fortepiano as an instrument — did it surprise, captivate or alienate you?' },
  },
  q8_repertoire: {
    nl: { text: 'Hoe beoordeel je de programmakeuze en het repertoire van deze reeks?', minLabel: 'Zwak', maxLabel: 'Uitstekend' },
    en: { text: 'How do you rate the programme and repertoire of this series?', minLabel: 'Poor', maxLabel: 'Excellent' },
  },
  q9_favoriet: {
    nl: { text: 'Welk concert of programma sprak je het meest aan, en waarom?' },
    en: { text: 'Which concert or programme appealed to you most, and why?' },
  },
  q10_interactie: {
    nl: { text: 'Hoe ervoer je de toelichting en interactie met Jos en/of Ayako tijdens de avonden?', minLabel: 'Zwak', maxLabel: 'Uitstekend' },
    en: { text: 'How did you experience the commentary and interaction with Jos and/or Ayako during the evenings?', minLabel: 'Poor', maxLabel: 'Excellent' },
  },
  q11_gesprek: {
    nl: { text: 'Was er voldoende ruimte voor vragen en gesprek? Wat zou je anders willen?' },
    en: { text: 'Was there enough room for questions and conversation? What would you change?' },
  },
  q12_communic: {
    nl: { text: 'Hoe beoordeel je de uitnodigingscommunicatie (timing, duidelijkheid, toon)?', minLabel: 'Zwak', maxLabel: 'Uitstekend' },
    en: { text: 'How do you rate the invitation communication (timing, clarity, tone)?', minLabel: 'Poor', maxLabel: 'Excellent' },
  },
  q13_catering: {
    nl: { text: 'Catering en receptie — sterke punten, verbeterpunten?' },
    en: { text: 'Catering and reception — strengths and points for improvement?' },
  },
  q14_bijdrage: {
    nl: { text: 'Hoe ervaar je het bijdrage-model (prijs versus kwaliteit)?', minLabel: 'Te duur', maxLabel: 'Zeer goed' },
    en: { text: 'How do you experience the contribution model (price versus quality)?', minLabel: 'Too expensive', maxLabel: 'Very good' },
  },
  q15_wensen_2: {
    nl: { text: 'Welke muziek, componisten, periodes of thema\u2019s zou je graag horen van Jos van Immerseel en Ayako Ito in een volgende reeks?', helper: 'Volledig vrijblijvend — alle suggesties zijn welkom.' },
    en: { text: 'Which music, composers, periods or themes would you like to hear from Jos van Immerseel and Ayako Ito in a next series?', helper: 'Entirely optional — all suggestions are welcome.' },
  },
  q16_gasten: {
    nl: { text: 'Zijn er muzikale gasten of duo-partners die je graag met Jos en Ayako zou willen horen?' },
    en: { text: 'Are there musical guests or duo partners you would like to hear with Jos and Ayako?' },
  },
  q17_terugkomen: {
    nl: { text: 'Wat zou jou definitief over de streep trekken om opnieuw te komen?' },
    en: { text: 'What would definitively convince you to come again?' },
  },
  q18_overige: {
    nl: { text: 'Iets wat we niet gevraagd hebben, maar wat je toch kwijt wil?' },
    en: { text: 'Anything we did not ask, but you still want to share?' },
  },
  q19_naam: {
    nl: { text: 'Je naam (optioneel)' },
    en: { text: 'Your name (optional)' },
  },
  q20_contact: {
    nl: { text: 'Mag ik je persoonlijk contacteren over je feedback?', options: ['Ja', 'Nee'] },
    en: { text: 'May I contact you personally about your feedback?',   options: ['Yes', 'No'] },
  },
}

// Map an EN choice value back to the canonical NL value the DB expects
export function normaliseChoice(qid: string, value: string): string {
  if (qid === 'q3_aantal') {
    if (value === 'all 6') return 'alle 6'
    return value
  }
  if (qid === 'q20_contact') {
    const v = value.toLowerCase()
    if (v === 'yes') return 'ja'
    if (v === 'no') return 'nee'
    return v
  }
  return value
}
