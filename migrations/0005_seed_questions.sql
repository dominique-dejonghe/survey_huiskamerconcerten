-- Seed the question library with Q1-Q20 used by survey 1 (Huiskamerconcerten Reeks I).
-- These become the starting bibliotheek; new surveys can pick from them or add new ones.

INSERT OR IGNORE INTO questions
  (code, type, category, required, scale_min, scale_max,
   label_nl, label_en,
   helper_nl, helper_en,
   min_label_nl, min_label_en, max_label_nl, max_label_en,
   options_nl, options_en, conditional_on, times_used, last_used_at)
VALUES
  -- Q1 NPS
  ('q1_nps', 'nps', 'algemeen', 1, 0, 10,
   'Hoe waarschijnlijk is het dat je deze concertreeks zou aanbevelen aan een vriend of vriendin?',
   'How likely is it that you would recommend this concert series to a friend?',
   '0 = helemaal niet waarschijnlijk · 10 = absoluut wel',
   '0 = not at all likely · 10 = extremely likely',
   'Niet waarschijnlijk', 'Not likely', 'Absoluut wel', 'Extremely likely',
   NULL, NULL, NULL, 1, datetime('now')),

  ('q2_blijft_bij', 'text', 'algemeen', 0, NULL, NULL,
   'In één zin: wat blijft je het meest bij van deze reeks?',
   'In one sentence: what stays with you most from this series?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q3_aantal', 'choice', 'algemeen', 1, NULL, NULL,
   'Aan hoeveel van de zes concerten heb je deelgenomen?',
   'How many of the six concerts did you attend?',
   NULL, NULL, NULL, NULL, NULL, NULL,
   '["1","2","3","4","5","alle 6"]',
   '["1","2","3","4","5","all 6"]',
   NULL, 1, datetime('now')),

  -- LOCATIE
  ('q4_sfeer', 'scale', 'locatie', 1, 1, 5,
   'Hoe ervoer je de huiskamer-setting?',
   'How did you experience the intimate setting?',
   '1 = te beperkt · 5 = magisch intiem',
   '1 = too cramped · 5 = magically intimate',
   'Te beperkt', 'Too cramped', 'Magisch intiem', 'Magically intimate',
   NULL, NULL, NULL, 1, datetime('now')),

  ('q5_sfeer_open', 'paragraph', 'locatie', 0, NULL, NULL,
   'Wat maakte de sfeer voor jou bijzonder — of net niet?',
   'What made the atmosphere special for you — or not?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  -- MUZIKAAL
  ('q6_akoestiek', 'scale', 'muzikaal', 1, 1, 5,
   'Hoe beoordeel je de akoestiek?',
   'How do you rate the acoustics?',
   NULL, NULL,
   'Zwak', 'Poor', 'Uitstekend', 'Excellent',
   NULL, NULL, NULL, 1, datetime('now')),

  ('q7_fortepiano', 'paragraph', 'muzikaal', 0, NULL, NULL,
   'De fortepiano als instrument — heeft die je verrast, geboeid, vervreemd?',
   'The fortepiano as an instrument — did it surprise, captivate or alienate you?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q8_repertoire', 'scale', 'muzikaal', 1, 1, 5,
   'Hoe beoordeel je de programmakeuze en het repertoire?',
   'How do you rate the program and repertoire?',
   NULL, NULL,
   'Zwak', 'Poor', 'Uitstekend', 'Excellent',
   NULL, NULL, NULL, 1, datetime('now')),

  ('q9_favoriet', 'paragraph', 'muzikaal', 0, NULL, NULL,
   'Welk concert of programma sprak je het meest aan, en waarom?',
   'Which concert or program appealed to you most, and why?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  -- INTERACTIE
  ('q10_interactie', 'scale', 'interactie', 1, 1, 5,
   'Hoe ervoer je de toelichting en interactie met de uitvoerder(s)?',
   'How did you experience the commentary and interaction with the performer(s)?',
   NULL, NULL,
   'Zwak', 'Poor', 'Uitstekend', 'Excellent',
   NULL, NULL, NULL, 1, datetime('now')),

  ('q11_gesprek', 'paragraph', 'interactie', 0, NULL, NULL,
   'Was er voldoende ruimte voor vragen en gesprek? Wat zou je anders willen?',
   'Was there enough room for questions and discussion? What would you change?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  -- ORGANISATIE
  ('q12_communic', 'scale', 'organisatie', 1, 1, 5,
   'Hoe beoordeel je de uitnodigingscommunicatie (timing, duidelijkheid, toon)?',
   'How do you rate the invitation communication (timing, clarity, tone)?',
   NULL, NULL,
   'Zwak', 'Poor', 'Uitstekend', 'Excellent',
   NULL, NULL, NULL, 1, datetime('now')),

  ('q13_catering', 'paragraph', 'organisatie', 0, NULL, NULL,
   'Catering en receptie — sterke punten, verbeterpunten?',
   'Catering and reception — strengths, areas to improve?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q14_bijdrage', 'scale', 'organisatie', 1, 1, 5,
   'Hoe ervaar je het bijdrage-model (prijs versus kwaliteit)?',
   'How do you experience the contribution model (price vs. quality)?',
   NULL, NULL,
   'Te duur', 'Too expensive', 'Zeer goed', 'Very good',
   NULL, NULL, NULL, 1, datetime('now')),

  -- WENSEN
  ('q15_wensen_2', 'paragraph', 'wensen', 0, NULL, NULL,
   'Welke muziek, componisten, periodes of thema''s zou je graag horen in een volgende reeks?',
   'Which music, composers, periods or themes would you like to hear in a future series?',
   'Volledig vrijblijvend — alle suggesties zijn welkom.',
   'Completely non-binding — all suggestions are welcome.',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q16_gasten', 'paragraph', 'wensen', 0, NULL, NULL,
   'Zijn er muzikale gasten of duo-partners die je graag zou willen horen?',
   'Are there musical guests or duo partners you would like to hear?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q17_terugkomen', 'paragraph', 'wensen', 0, NULL, NULL,
   'Wat zou jou definitief over de streep trekken om opnieuw te komen?',
   'What would definitively convince you to come again?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q18_overige', 'paragraph', 'wensen', 0, NULL, NULL,
   'Iets wat we niet gevraagd hebben, maar wat je toch kwijt wil?',
   'Anything we didn''t ask but you''d still like to share?',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  -- TOT SLOT
  ('q19_naam', 'text', 'totslot', 0, NULL, NULL,
   'Je naam (optioneel)',
   'Your name (optional)',
   NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 1, datetime('now')),

  ('q20_contact', 'choice', 'totslot', 0, NULL, NULL,
   'Mag ik je persoonlijk contacteren over je feedback?',
   'May I contact you personally about your feedback?',
   NULL, NULL, NULL, NULL, NULL, NULL,
   '["Ja","Nee"]',
   '["Yes","No"]',
   '{"showField":"q20_email","whenValue":"ja"}',
   1, datetime('now'));
