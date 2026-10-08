import 'server-only'
import { geminiJson } from '@/lib/ai/gemini'
import { ANNOUNCE_LIMITS, type AnnouncementDraft } from '@/lib/announce'

const SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: `Push notification title, at most 50 characters, may start with one emoji.` },
    body: { type: 'string', description: `Push notification body, at most 140 characters: the one thing people need to know or do.` },
    slack_text: {
      type: 'string',
      description:
        'Slack message in Slack mrkdwn (*bold*, _italic_, line breaks as \\n, no markdown headings or [text](url) links; paste URLs bare). 2-5 short lines, at most 600 characters. First line bold and says what happened.',
    },
  },
  required: ['title', 'body', 'slack_text'],
}

const SYSTEM = `You write announcements from the admins of GuildBoard, the board for SkillRev's monthly engineering guild (about thirty software engineers), to every member. Each announcement goes out twice: as a Slack message in the guild channel and as a push notification.

Voice: fun and witty, dev-native, warm. Write like an engineer friend posting in the channel, not like a company. Every announcement gets exactly one real joke, ideally a nerdy aside the reader recognises (deploys, DNS, caches, flaky tests, "works on my machine"). One good joke beats three weak ones. Use 2 or 3 emojis across the Slack message and at most 1 in each push field. But it must stay to the point: what happened and what, if anything, people need to do, readable in five seconds. Put the joke after the facts, never instead of them.

The shape and tone to aim for (different topic, do not copy):
title: "🧹 Bytes got a spring clean"
body: "Fewer feeds, better picks. Same place: open Bytes and see what made the cut."
slack_text: "*🧹 Bytes got a spring clean*\\nFewer feeds, sharper picks, and summaries that actually summarise.\\nSame place as always: open Bytes on GuildBoard.\\nWe deleted more code than we wrote, which is the only kind of refactor anyone trusts. ✨"

Avoid corporate filler: "please note", "we are pleased", "officially", "update your bookmarks", "kindly".

Rules:
- Every fact, link, domain, date and name in the brief must appear exactly as given. Do not invent facts, dates or features.
- If the brief asks people to do something, say exactly what.
- No em dashes. No hashtags. No "Hey team" openers.`

/** A first draft from a one-line brief. Null when Gemini is unavailable. */
export async function draftAnnouncement(args: { brief: string }): Promise<AnnouncementDraft | null> {
  const result = await geminiJson<Partial<AnnouncementDraft>>({
    label: 'announcement',
    system: SYSTEM,
    prompt: `Brief from the admin:\n${args.brief.slice(0, ANNOUNCE_LIMITS.brief)}`,
    schema: SCHEMA,
  })
  const title = result?.title?.trim().slice(0, ANNOUNCE_LIMITS.title) ?? ''
  const body = result?.body?.trim().slice(0, ANNOUNCE_LIMITS.body) ?? ''
  const slack_text = result?.slack_text?.trim().slice(0, ANNOUNCE_LIMITS.slack) ?? ''
  return title && body && slack_text ? { title, body, slack_text } : null
}
