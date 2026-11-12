import { supabase } from './supabase'

/** Why push cannot be switched on here, or 'ok'. */
export type PushSupport = 'ok' | 'ios-install' | 'unsupported'

export function pushSupport(): PushSupport {
  if ('serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window) return 'ok'
  // iPhone and iPad only offer push to apps added to the home screen.
  return /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios-install' : 'unsupported'
}

function decodeKey(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

/** The push subscription of this browser, if there is one. */
export async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration()
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Asks for permission and registers this device for the member. Throws an Error with a German message. */
export async function enablePush(memberId: string): Promise<void> {
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration) throw new Error('Die App ist noch nicht fertig geladen. Bitte gleich noch einmal versuchen.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Benachrichtigungen sind für diese Seite blockiert. Bitte in den Browser-Einstellungen erlauben.')
  }

  const { data, error } = await supabase.functions.invoke('notify', { method: 'GET' })
  const publicKey = (data as { publicKey?: string } | null)?.publicKey
  if (error || !publicKey) throw new Error('Push ist auf dem Server noch nicht eingerichtet.')

  let subscription: PushSubscription
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeKey(publicKey),
    })
  } catch {
    throw new Error('Dieses Gerät konnte nicht für Benachrichtigungen angemeldet werden.')
  }

  const keys = subscription.toJSON().keys
  const { error: saveError } = await supabase.from('push_subscriptions').upsert(
    { member_id: memberId, endpoint: subscription.endpoint, p256dh: keys?.p256dh, auth: keys?.auth },
    { onConflict: 'endpoint', ignoreDuplicates: true },
  )
  if (saveError) {
    await subscription.unsubscribe()
    throw new Error('Die Anmeldung konnte nicht gespeichert werden.')
  }
}

export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}

/** Asks the server to push a chat message to the rest of the family. Failures are not fatal. */
export async function pushMessage(messageId: string): Promise<void> {
  const { error } = await supabase.functions.invoke('notify', { body: { message_id: messageId } })
  if (error) console.warn('Push could not be sent', error)
}
