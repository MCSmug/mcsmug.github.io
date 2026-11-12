// Supabase Edge Function: reads appointments from a photo (notice board, letter,
// printed calendar) with Claude and returns them as suggestions. Nothing is
// stored here; the app inserts the events the user confirms.
//
// Required secret: ANTHROPIC_API_KEY
import Anthropic from 'npm:@anthropic-ai/sdk@1.7.0'
import { betaZodOutputFormat } from 'npm:@anthropic-ai/sdk@1.7.0/helpers/beta/zod'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
// ~4.5 MB of image data; the app downsizes photos far below this.
const MAX_BASE64_LENGTH = 6_000_000
// Cost limit: photos a family may analyse per calendar month.
const MONTHLY_PHOTO_LIMIT = 30

const Extraction = z.object({
  summary: z.string().describe('One short German sentence saying what the photo shows'),
  events: z.array(
    z.object({
      title: z.string().describe('Short title in the language of the document'),
      date: z.string().describe('Start date, YYYY-MM-DD'),
      end_date: z.string().nullable().describe('Last day for multi-day events, YYYY-MM-DD, else null'),
      start_time: z.string().nullable().describe('24h HH:MM, null if no time is given (all-day)'),
      end_time: z.string().nullable().describe('24h HH:MM, null if no end time is given'),
    }),
  ),
})

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function systemPrompt(today: string, weekday: string) {
  return `You read appointments from a photo for a family calendar app. The photo typically shows a kindergarten or school notice, a letter, an invitation, an appointment card or a printed calendar, usually in German.

Today is ${weekday}, ${today}.

Return every appointment that is actually visible in the photo. The family reviews your list before anything is saved, so completeness matters, but never invent appointments or details that are not in the photo. If the photo contains no appointments, return an empty list.

Also give a one-sentence German summary of what the photo shows (e.g. "Aushang des Kindergartens mit drei Terminen im Dezember" or "Unscharfes Foto eines Tisches, kein Text lesbar"). The family sees it when nothing was found, so say plainly if the photo is blurry, too dark, cut off or contains no dates.

For each appointment:
- title: short and specific, in the language of the document, including what a parent needs to recognise it (e.g. "Laternenfest Kindergarten", "Zahnarzt Kontrolle"). No dates or times in the title.
- date: the start date as YYYY-MM-DD. If the year is missing, use the next occurrence on or after today. Resolve weekday or relative wording ("nächsten Freitag") from today's date.
- end_date: only for events that span several days (holidays, closing days, trips), the last day; otherwise null.
- start_time / end_time: 24-hour HH:MM. If no time is given, set both to null (all-day). If only a start time is given, set end_time to null.
- A recurring entry ("jeden Dienstag") becomes one appointment on its next date.
- Skip dates that are not appointments, such as the date of the letter itself or a date of birth. A deadline ("Anmeldung bis 12.11.") is an all-day appointment on that day.`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Only signed-in family members may use this (each call costs API credits).
  const authorization = req.headers.get('Authorization')
  const apiKey = req.headers.get('apikey') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!authorization || !apiKey) return json({ error: 'unauthorized' }, 401)
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, apiKey, {
    global: { headers: { Authorization: authorization } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)
  const { data: membership } = await supabase
    .from('members')
    .select('id, family_id')
    .eq('user_id', userData.user.id)
    .limit(1)
  if (!membership?.length) return json({ error: 'forbidden' }, 403)
  const familyId = membership[0].family_id as string

  const monthStart = new Date()
  monthStart.setUTCDate(1)
  monthStart.setUTCHours(0, 0, 0, 0)
  const usage = await supabase
    .from('photo_imports')
    .select('*', { count: 'exact', head: true })
    .eq('family_id', familyId)
    .gte('created_at', monthStart.toISOString())
  if (usage.error) {
    console.error('Could not read photo usage:', usage.error.message)
    return json({ error: 'internal' }, 500)
  }
  if ((usage.count ?? 0) >= MONTHLY_PHOTO_LIMIT) return json({ error: 'limit' }, 429)

  let body: { image?: unknown; media_type?: unknown; today?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }
  const { image, media_type: mediaType, today } = body
  if (
    typeof image !== 'string' ||
    image.length === 0 ||
    image.length > MAX_BASE64_LENGTH ||
    typeof mediaType !== 'string' ||
    !(MEDIA_TYPES as readonly string[]).includes(mediaType) ||
    typeof today !== 'string' ||
    !DATE.test(today)
  ) {
    return json({ error: 'invalid_request' }, 400)
  }
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${today}T12:00:00Z`),
  )

  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'not_configured' }, 500)
  const anthropic = new Anthropic()

  try {
    const response = await anthropic.beta.messages.parse({
      model: 'claude-opus-5-5',
      max_tokens: 16000,
      output_config: { effort: 'medium', format: betaZodOutputFormat(Extraction) },
      // If the model declines a photo, let the API retry on its default fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: systemPrompt(today, weekday),
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType as (typeof MEDIA_TYPES)[number], data: image },
            },
            { type: 'text', text: 'Extract the appointments from this photo.' },
          ],
        },
      ],
    })

    // Count every analysed photo, whatever the outcome: the API call has been paid for.
    const recorded = await supabase.from('photo_imports').insert({ family_id: familyId })
    if (recorded.error) console.error('Could not record photo usage:', recorded.error.message)

    if (response.stop_reason === 'refusal') return json({ error: 'refused' }, 422)
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      return json({ error: 'unreadable' }, 422)
    }

    // The schema guarantees the shape, not the formats: keep only usable entries.
    const events = response.parsed_output.events
      .map((e) => ({
        title: e.title.trim().slice(0, 120),
        date: e.date,
        end_date: e.end_date && DATE.test(e.end_date) && e.end_date > e.date ? e.end_date : null,
        start_time: e.start_time && TIME.test(e.start_time) ? e.start_time : null,
        end_time: e.end_time && TIME.test(e.end_time) ? e.end_time : null,
      }))
      .filter((e) => e.title && DATE.test(e.date) && !Number.isNaN(Date.parse(e.date)))

    return json({ events, summary: response.parsed_output.summary.trim().slice(0, 200) })
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      console.error('Anthropic key rejected:', error.message)
      return json({ error: 'not_configured' }, 500)
    }
    if (error instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429)
    if (error instanceof Anthropic.BadRequestError) {
      console.error('Anthropic rejected the request:', error.message)
      return json({ error: 'unreadable' }, 422)
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Anthropic API error ${error.status}:`, error.message)
      return json({ error: 'upstream' }, 502)
    }
    console.error(error)
    return json({ error: 'internal' }, 500)
  }
})
