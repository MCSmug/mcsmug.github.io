// Supabase Edge Function: sends Web Push notifications.
//
//   GET                        -> { publicKey }   (VAPID key the app needs to subscribe a device)
//   POST { message_id }        -> pushes a chat message to the rest of the family (signed-in author only)
//   POST { due: true }         -> sends reminders whose time has come (called every minute by pg_cron;
//                                 harmless for anyone else to call: it only sends what is due anyway)
//
// Required secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: contact)
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

interface Payload {
  title: string
  body: string
  url: string
  tag: string
}

interface Subscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/** Sends one payload to the devices of the given members. Returns how many pushes were accepted. */
async function pushToMembers(admin: SupabaseClient, memberIds: string[], payload: Payload): Promise<number> {
  if (memberIds.length === 0) return 0
  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('member_id', memberIds)
  if (error) throw new Error(`reading subscriptions failed: ${error.message}`)

  const results = await Promise.all(
    (data as Subscription[]).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 },
        )
        return true
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        // The device unsubscribed or the subscription expired: forget it.
        if (status === 404 || status === 410) {
          await admin.from('push_subscriptions').delete().eq('id', sub.id)
        } else {
          console.error(`push to ${new URL(sub.endpoint).host} failed:`, status ?? err)
        }
        return false
      }
    }),
  )
  return results.filter(Boolean).length
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!publicKey || !privateKey || !subject) return json({ error: 'not_configured' }, 500)

  if (req.method === 'GET') return json({ publicKey })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  webpush.setVapidDetails(subject, publicKey, privateKey)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  let body: { message_id?: unknown; due?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_request' }, 400)
  }

  try {
    // --- Due reminders -----------------------------------------------------
    if (body.due === true) {
      const now = new Date().toISOString()
      // Claiming with an UPDATE makes sure each reminder is sent only once.
      const { data: due, error } = await admin
        .from('reminders')
        .update({ sent_at: now })
        .is('sent_at', null)
        .lte('fire_at', now)
        .select('id, family_id, target_member_id, text')
      if (error) throw new Error(`claiming reminders failed: ${error.message}`)

      let sent = 0
      for (const reminder of due ?? []) {
        let memberIds: string[]
        if (reminder.target_member_id) {
          memberIds = [reminder.target_member_id]
        } else {
          const { data: members } = await admin.from('members').select('id').eq('family_id', reminder.family_id)
          memberIds = (members ?? []).map((m) => m.id as string)
        }
        sent += await pushToMembers(admin, memberIds, {
          title: 'Erinnerung',
          body: reminder.text,
          url: '/',
          tag: `reminder-${reminder.id}`,
        })
      }
      return json({ reminders: due?.length ?? 0, sent })
    }

    // --- Chat message ------------------------------------------------------
    if (typeof body.message_id === 'string') {
      const authorization = req.headers.get('Authorization')
      if (!authorization) return json({ error: 'unauthorized' }, 401)
      const { data: userData, error: userError } = await admin.auth.getUser(authorization.replace(/^Bearer\s+/i, ''))
      if (userError || !userData.user) return json({ error: 'unauthorized' }, 401)

      const { data: message } = await admin
        .from('messages')
        .select('id, family_id, author_id, text')
        .eq('id', body.message_id)
        .maybeSingle()
      if (!message?.author_id) return json({ error: 'not_found' }, 404)

      const { data: author } = await admin
        .from('members')
        .select('id, name, user_id')
        .eq('id', message.author_id)
        .maybeSingle()
      // Only the author may trigger the push for their own message.
      if (!author || author.user_id !== userData.user.id) return json({ error: 'forbidden' }, 403)

      const { data: members } = await admin.from('members').select('id').eq('family_id', message.family_id)
      const recipients = (members ?? []).map((m) => m.id as string).filter((id) => id !== author.id)
      const sent = await pushToMembers(admin, recipients, {
        title: author.name,
        body: message.text,
        url: '/familie',
        tag: `message-${message.id}`,
      })
      return json({ sent })
    }

    return json({ error: 'invalid_request' }, 400)
  } catch (error) {
    console.error(error)
    return json({ error: 'internal' }, 500)
  }
})
