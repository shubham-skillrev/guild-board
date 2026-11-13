// ROUTE: POST /api/admin/meeting/meme  multipart { file }  -> { src }
// AUTH: admin only (404 for everyone else)
// PURPOSE: An image for a meme slide, from the slide editor (Preview slides):
//          stored in the public `meeting-memes` bucket (migration 049), so the
//          shared screen and every phone load it by URL. The slide stores the
//          URL as meme.src (lib/meeting.ts cleanMeme accepts only this bucket).
// STORAGE: meeting-memes (service role writes; public read)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { MEME_BUCKET, memeSrcOk } from '@/lib/meeting'

const MAX_BYTES = 4 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }

export async function POST(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return new NextResponse(null, { status: 404 })

  let file: FormDataEntryValue | null = null
  try {
    file = (await request.formData()).get('file')
  } catch {
    /* not multipart */
  }
  if (!(file instanceof Blob) || !file.size) return NextResponse.json({ error: 'Pick an image first.' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'PNG, JPEG, GIF or WebP only.' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Up to 4 MB.' }, { status: 400 })

  const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 12)}.${ext}`
  const storage = createAdminClient().storage.from(MEME_BUCKET)
  const { error } = await storage.upload(name, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
  if (error) {
    const missing = /bucket not found|not found/i.test(error.message)
    return NextResponse.json({ error: missing ? 'Apply migration 049 first (the meme bucket).' : error.message }, { status: missing ? 500 : 502 })
  }
  const src = storage.getPublicUrl(name).data.publicUrl
  // A custom storage domain wouldn't pass the slide's check: say so rather than lose the image on save.
  if (!memeSrcOk(src)) return NextResponse.json({ error: 'Uploaded, but its URL isn’t one the slides accept (a custom storage domain?).' }, { status: 500 })
  return NextResponse.json({ src })
}
