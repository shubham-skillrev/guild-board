'use client'

import { useEffect, useRef } from 'react'
import { botSays } from '@/lib/guildbot-host/voice'
import { focus, formatClock, useFocusState, type Phase } from '@/lib/focus/store'

const MUTE = 'guildbot:focus:mute'
const TITLE_MARK = /^(?:⏱ [\d:]+ · |☕ [\d:]+ · |☕ Break! · |✅ Done · )/

/**
 * Keeps the focus timer honest on every page: moves a finished phase on (the
 * only place that does, so it's counted once), and tells you, even from a
 * background tab:
 *
 *  - the tab title counts down ("⏱ 18:02 · ") and flips at the end
 *  - a soft two-note chime, unless muted on the focus page
 *  - a local browser notification, only if you've already allowed
 *    notifications for GuildBoard; it never asks
 *  - GuildBot says so in a bubble (via the 'gb:say' event)
 */
export function FocusAlerts() {
  const state = useFocusState()
  const flash = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const strip = () => document.title.replace(TITLE_MARK, '')
    if (state.phase === 'idle' || (!state.endsAt && state.pausedLeft === null)) {
      if (!flash.current) document.title = strip()
      return
    }
    const tick = () => {
      if (state.endsAt && Date.now() >= state.endsAt) {
        const ended = focus.finish(state.endsAt)
        if (ended) announce(ended, strip, flash)
        return
      }
      const left = state.endsAt ? state.endsAt - Date.now() : state.pausedLeft ?? 0
      document.title = `${state.phase === 'focus' ? '⏱' : '☕'} ${formatClock(left)} · ${strip()}`
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [state])

  useEffect(() => () => { if (flash.current) clearTimeout(flash.current) }, [])

  return null
}

function announce(ended: Phase, strip: () => string, flash: { current: ReturnType<typeof setTimeout> | null }) {
  const key = ended === 'focus' ? 'focus.done' : 'break.done'
  const line = botSays(key, String(Date.now()), 'ui') ?? (ended === 'focus' ? 'Block done. Take a break.' : 'Break over. Back to it.')

  document.title = `${ended === 'focus' ? '☕ Break!' : '✅ Done'} · ${strip()}`
  if (flash.current) clearTimeout(flash.current)
  flash.current = setTimeout(() => { flash.current = null }, 8000)

  if (localStorage.getItem(MUTE) !== '1') chime()
  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try { new Notification(ended === 'focus' ? 'Break time' : 'Back to it', { body: line, icon: '/icon-192.png', tag: 'guildbot-focus' }) } catch { /* some browsers only allow notifications from a service worker */ }
  }
  window.dispatchEvent(new CustomEvent('gb:say', { detail: { key } }))
}

/** Two soft notes, made on the spot: no audio file to load. */
function chime() {
  try {
    const ctx = new AudioContext()
    const notes = [660, 880]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const at = ctx.currentTime + i * 0.22
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.12, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.55)
    })
    setTimeout(() => ctx.close(), 1200)
  } catch { /* no audio: the title and GuildBot still say it */ }
}

export function isChimeMuted(): boolean {
  return typeof window !== 'undefined' && localStorage.getItem(MUTE) === '1'
}
export function setChimeMuted(on: boolean) {
  if (on) localStorage.setItem(MUTE, '1'); else localStorage.removeItem(MUTE)
}
