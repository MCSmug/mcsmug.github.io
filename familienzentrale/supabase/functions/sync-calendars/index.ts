// Supabase Edge Function: imports subscribed calendars (iCal URLs) into the events table.
//
//   POST with a signed-in user  -> syncs the calendars of that user's family now
//   POST without a user         -> syncs calendars that have not been synced recently
//                                  (called by pg_cron; harmless for anyone else to call)
import { createClient } from 'npm:@supabase/supabase-js@2'

import { parseCalendar } from './ical.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// All-day events and times without a zone are read in this time zone.
const TIME_ZONE = 'Europe/Berlin'
const PAST_DAYS = 31
const FUTURE_DAYS = 400
const MIN_MINUTES_BETWEEN_SYNCS = 25
const MAX_FEEDS_PER_RUN = 20
const MAX_BYTES = 5_000_000
const FETCH_TIMEOUT_MS = 15_000
const DAY_MS = 24 * 60 * 60 * 1000

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Downloads a calendar. Only public https addresses are fetched. */
async function download(url: string): Promise<string> {
  const target = new URL(url.replace(/^webcal:/i, 'https:'))
  const host = target.hostname
  if (target.protocol !== 'https:' || host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) {
    throw new Error('Adresse nicht erlaubt')
  }
  const response = await fetch(target, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { Accept: 'text/calendar, text/plain;q=0.8' },
  })
  if (!response.ok) throw new Error(`Kalender nicht erreichbar (${response.status})`)
  const text = await response.text()
  if (text.length > MAX_BYTES) throw new Error('Kalender ist zu groß')
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('Die Adresse liefert keinen Kalender')
  return text
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Which feeds: the caller's family, or everything that is due.
  let query = admin.from('calendar_feeds').select('id, ical_url').limit(MAX_FEEDS_PER_RUN)
  const authorization = req.headers.get('Authorization')
  const { data: userData } = authorization
    ? await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
    : { data: { user: null } }
  if (userData.user) {
    const { data: membership } = await admin.from('members').select('family_id').eq('user_id', userData.user.id)
    const familyIds = (membership ?? []).map((m) => m.family_id as string)
    if (familyIds.length === 0) return json({ error: 'forbidden' }, 403)
    query = query.in('family_id', familyIds)
  } else {
    const before = new Date(Date.now() - MIN_MINUTES_BETWEEN_SYNCS * 60_000).toISOString()
    query = query.or(`last_synced_at.is.null,last_synced_at.lt.${before}`).order('last_synced_at', { nullsFirst: true })
  }

  const { data: feeds, error } = await query
  if (error) {
    console.error('reading feeds failed:', error.message)
    return json({ error: 'internal' }, 500)
  }

  const from = new Date(Date.now() - PAST_DAYS * DAY_MS)
  const to = new Date(Date.now() + FUTURE_DAYS * DAY_MS)
  let ok = 0
  let failed = 0

  for (const feed of feeds ?? []) {
    try {
      const events = parseCalendar(await download(feed.ical_url as string), from, to, TIME_ZONE)
      const { error: replaceError } = await admin.rpc('replace_feed_events', { p_feed_id: feed.id, p_events: events })
      if (replaceError) throw new Error(replaceError.message)
      ok++
    } catch (err) {
      failed++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`feed ${feed.id} failed:`, message)
      // Keep the events of the last good sync; show the family what went wrong.
      await admin
        .from('calendar_feeds')
        .update({ last_synced_at: new Date().toISOString(), last_error: message.slice(0, 200) })
        .eq('id', feed.id)
    }
  }

  return json({ synced: ok, failed })
})
