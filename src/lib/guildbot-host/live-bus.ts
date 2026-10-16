import type { LiveUpdate } from '@/lib/realtime/channels'

/**
 * How GuildBot's character hears the board without opening its own channel.
 *
 * A page subscribes to its live channel once (useLiveChannel), and that hook
 * re-announces what it hears here as window events. The character, which
 * lives in the layout on every page, listens. Two subscriptions to the same
 * channel on one client would tear each other down, so this is the only way
 * in. Payloads are the broadcast's own: counts and what changed, no people.
 *
 * The browser also announces its own posts ('gb:self'), so the poster can get
 * a personal line for a named post. A ghost post is announced as a ghost, and
 * the reaction rules (react.ts) treat that exactly like a stranger's post.
 */
const LIVE = 'gb:live'
const PRESENCE = 'gb:presence'
const SELF = 'gb:self'

export type SelfEvent = { kind: 'posted'; anonymous: boolean }

export function announceLive(channel: string, update: LiveUpdate) {
  window.dispatchEvent(new CustomEvent(LIVE, { detail: { channel, update } }))
}

export function announcePresence(channel: string, present: number) {
  window.dispatchEvent(new CustomEvent(PRESENCE, { detail: { channel, present } }))
}

export function announceSelf(event: SelfEvent) {
  window.dispatchEvent(new CustomEvent(SELF, { detail: event }))
}

export function listen(handlers: {
  live?: (channel: string, update: LiveUpdate) => void
  presence?: (channel: string, present: number) => void
  self?: (event: SelfEvent) => void
}): () => void {
  const live = (e: Event) => { const d = (e as CustomEvent).detail; handlers.live?.(d.channel, d.update) }
  const presence = (e: Event) => { const d = (e as CustomEvent).detail; handlers.presence?.(d.channel, d.present) }
  const self = (e: Event) => handlers.self?.((e as CustomEvent).detail)
  window.addEventListener(LIVE, live)
  window.addEventListener(PRESENCE, presence)
  window.addEventListener(SELF, self)
  return () => {
    window.removeEventListener(LIVE, live)
    window.removeEventListener(PRESENCE, presence)
    window.removeEventListener(SELF, self)
  }
}
