import { supabase } from './supabase'
import { toDateInput } from './dates'

/** An appointment read from a photo, before the user confirmed it. */
export interface SuggestedEvent {
  title: string
  date: string
  end_date: string | null
  start_time: string | null
  end_time: string | null
}

const MAX_EDGE = 1568
const JPEG_QUALITY = 0.85

/** Downsizes a photo in the browser and returns it as base64 JPEG. */
async function toJpegBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY).split(',')[1]
}

const ERROR_TEXT: Record<string, string> = {
  not_configured: 'Die Foto-Erkennung ist noch nicht eingerichtet (API-Key fehlt oder ist ungültig).',
  busy: 'Die Foto-Erkennung ist gerade ausgelastet. Bitte gleich noch einmal versuchen.',
  unreadable: 'Das Foto konnte nicht ausgewertet werden. Bitte näher und schärfer fotografieren.',
  refused: 'Dieses Foto konnte nicht ausgewertet werden.',
  forbidden: 'Du gehörst zu keiner Familie.',
}
const DEFAULT_ERROR = 'Die Foto-Erkennung hat nicht geklappt. Bitte Verbindung prüfen und noch einmal versuchen.'

export interface PhotoResult {
  events: SuggestedEvent[]
  /** What the recognition saw in the photo, in one sentence. */
  summary: string | null
}

/** Sends a photo to the extract-events function. Throws an Error with a German message. */
export async function extractEventsFromPhoto(file: File): Promise<PhotoResult> {
  let image: string
  try {
    image = await toJpegBase64(file)
  } catch {
    throw new Error('Dieses Bildformat kann nicht gelesen werden.')
  }

  const { data, error } = await supabase.functions.invoke('extract-events', {
    body: { image, media_type: 'image/jpeg', today: toDateInput(new Date()) },
  })
  if (error) {
    // Function errors carry the JSON body on the response in `context`.
    let code: string | undefined
    const context = (error as { context?: unknown }).context
    if (context instanceof Response) {
      code = await context
        .json()
        .then((body: { error?: string }) => body.error)
        .catch(() => undefined)
    }
    throw new Error((code && ERROR_TEXT[code]) ?? DEFAULT_ERROR)
  }
  const result = data as { events: SuggestedEvent[]; summary?: string }
  return { events: result.events, summary: result.summary ?? null }
}
