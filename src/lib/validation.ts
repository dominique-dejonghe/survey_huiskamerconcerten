import { z } from 'zod'

// Server-side validation schema voor POST /api/responses
export const responseSchema = z.object({
  // Honeypot — moet leeg zijn
  website: z.string().max(0).optional().or(z.literal('')),

  // Taalcode (nl default)
  lang: z.enum(['nl', 'en']).optional().default('nl'),

  q1_nps: z.number().int().min(0).max(10),
  q2_blijft_bij: z.string().max(2000).optional().nullable(),
  q3_aantal: z.enum(['1', '2', '3', '4', '5', 'alle 6']),

  q4_sfeer: z.number().int().min(1).max(5),
  q5_sfeer_open: z.string().max(5000).optional().nullable(),

  q6_akoestiek: z.number().int().min(1).max(5),
  q7_fortepiano: z.string().max(5000).optional().nullable(),
  q8_repertoire: z.number().int().min(1).max(5),
  q9_favoriet: z.string().max(5000).optional().nullable(),

  q10_interactie: z.number().int().min(1).max(5),
  q11_gesprek: z.string().max(5000).optional().nullable(),

  q12_communic: z.number().int().min(1).max(5),
  q13_catering: z.string().max(5000).optional().nullable(),
  q14_bijdrage: z.number().int().min(1).max(5),

  q15_wensen_2: z.string().max(5000).optional().nullable(),
  q16_gasten: z.string().max(5000).optional().nullable(),
  q17_terugkomen: z.string().max(5000).optional().nullable(),
  q18_overige: z.string().max(5000).optional().nullable(),

  q19_naam: z.string().max(200).optional().nullable(),
  q20_contact: z.enum(['ja', 'nee']).optional().nullable(),
  q20_email: z.string().email().max(254).optional().nullable().or(z.literal('')),
}).refine(
  (data) => {
    if (data.q20_contact === 'ja') {
      return !!data.q20_email && data.q20_email.length > 3
    }
    return true
  },
  { message: 'E-mail vereist wanneer je gecontacteerd wilt worden', path: ['q20_email'] }
)

export type ResponseInput = z.infer<typeof responseSchema>
