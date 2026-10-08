/**
 * Announcements: a message from the admins to the whole guild, on Slack and
 * as a push. Limits shared by the composer, the Gemini draft and the route.
 *
 * Free of server-only imports so the admin form can use the same numbers.
 */
export const ANNOUNCE_LIMITS = {
  /** Push title. Lock screens cut around here. */
  title: 60,
  /** Push body. Most platforms show two lines. */
  body: 160,
  /** Slack message, mrkdwn. */
  slack: 1200,
  url: 500,
  brief: 500,
} as const

export interface AnnouncementDraft {
  title: string
  body: string
  slack_text: string
}

export type AnnouncementChannel = 'slack' | 'push'

export interface AnnouncementRecord extends AnnouncementDraft {
  id: string
  url: string | null
  channels: AnnouncementChannel[]
  slack_ok: boolean | null
  push_sent: number | null
  sent_at: string
}
