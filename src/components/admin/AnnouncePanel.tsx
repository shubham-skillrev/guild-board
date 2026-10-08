'use client'

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/Section'
import { Input, Textarea, Label, CharCount } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import {
  ANNOUNCE_LIMITS,
  type AnnouncementChannel,
  type AnnouncementDraft,
  type AnnouncementRecord,
} from '@/lib/announce'
import { cn } from '@/lib/utils/cn'

/* The first announcement this panel sends. Pre-filled so it is one press of
   "Draft with Gemini" away; delete once the move has gone out. */
const DOMAIN_BRIEF =
  'GuildBoard has a new address: guildboard.skillrev.in. Sign in there once with Google. ' +
  'Anyone who installed the app or turned on notifications should do it again from the new address ' +
  'and remove the old one. Old links still redirect.'

const EMPTY: AnnouncementDraft = { title: '', body: '', slack_text: '' }

/**
 * Tell the whole guild something: Slack and push, in the admins' voice.
 *
 * Gemini drafts from a one-line brief, or you write it yourself; either way
 * every word is editable and previewed before it goes. Channels are ticked
 * separately so a Slack-only test never buzzes thirty phones. Sent messages
 * are listed underneath.
 */
export function AnnouncePanel() {
  const toast = useToast()
  const [brief, setBrief] = useState(DOMAIN_BRIEF)
  const [draft, setDraft] = useState<AnnouncementDraft | null>(null)
  const [url, setUrl] = useState('')
  const [channels, setChannels] = useState<Set<AnnouncementChannel>>(new Set(['slack', 'push']))
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null)
  const [history, setHistory] = useState<AnnouncementRecord[]>([])

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/announcements')
      const data = await res.json()
      setHistory(Array.isArray(data.announcements) ? data.announcements : [])
    } catch { /* non-critical */ }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const call = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
    return data
  }

  const generate = async () => {
    setBusy('draft')
    try {
      const data = await call({ action: 'draft', brief })
      setDraft(data.draft)
      // A link in the brief is almost always where the push should open.
      const link = brief.match(/https:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}\b/i)?.[0]
      if (link && !url) setUrl(link.startsWith('http') ? link.replace(/[.,)]+$/, '') : `https://${link}`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not draft', 'error')
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    if (!draft) return
    const where = [channels.has('slack') && 'Slack', channels.has('push') && 'every push subscriber']
      .filter(Boolean).join(' and ')
    if (!confirm(`Send this to ${where}?`)) return
    setBusy('send')
    try {
      const data = await call({ action: 'send', ...draft, url, channels: [...channels] })
      const parts = [
        data.slackOk === true && 'posted to Slack',
        data.slackOk === false && 'Slack failed (is it configured?)',
        typeof data.pushSent === 'number' && `pushed to ${data.pushSent} ${data.pushSent === 1 ? 'device' : 'devices'}`,
      ].filter(Boolean)
      toast(`Announced: ${parts.join(', ')}`, data.slackOk === false ? 'warning' : 'success')
      setDraft(null)
      setBrief('')
      setUrl('')
      loadHistory()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send', 'error')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (c: AnnouncementChannel) =>
    setChannels(prev => {
      const next = new Set(prev)
      if (next.has(c)) next.delete(c); else next.add(c)
      return next
    })

  const set = (key: keyof AnnouncementDraft, v: string) => draft && setDraft({ ...draft, [key]: v })
  const ready =
    !!draft && channels.size > 0 &&
    (!channels.has('push') || (!!draft.title.trim() && !!draft.body.trim())) &&
    (!channels.has('slack') || !!draft.slack_text.trim())

  return (
    <section aria-labelledby="admin-announce" className="mt-(--gap-section)">
      <SectionHeader id="admin-announce" title="Announce" hint="Slack and push, to the whole guild" />
      <div className="rounded-(--radius-card) border border-border bg-paper p-(--pad-card) space-y-4">
        <div>
          <Label htmlFor="announce-brief">What to announce</Label>
          <Textarea
            id="announce-brief"
            rows={3}
            value={brief}
            onChange={e => setBrief(e.target.value)}
            maxLength={ANNOUNCE_LIMITS.brief}
            placeholder="The facts, plainly. Gemini makes it fun; you check it."
            className="font-sans"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="tinted" icon={Sparkle} onClick={generate} disabled={busy !== null || !brief.trim()}>
              {busy === 'draft' ? 'Drafting…' : draft ? 'Draft again' : 'Draft with Gemini'}
            </Button>
            {!draft && (
              <Button variant="ghost" onClick={() => setDraft({ ...EMPTY })}>
                Write it myself
              </Button>
            )}
          </div>
        </div>

        {draft && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <Label htmlFor="announce-title">Push title</Label>
                  <Input id="announce-title" value={draft.title} onChange={e => set('title', e.target.value)} maxLength={ANNOUNCE_LIMITS.title} />
                  <CharCount value={draft.title} max={ANNOUNCE_LIMITS.title} />
                </div>
                <div>
                  <Label htmlFor="announce-body">Push body</Label>
                  <Textarea id="announce-body" rows={2} value={draft.body} onChange={e => set('body', e.target.value)} maxLength={ANNOUNCE_LIMITS.body} className="font-sans" />
                  <CharCount value={draft.body} max={ANNOUNCE_LIMITS.body} />
                </div>
                <div>
                  <Label htmlFor="announce-url">Push opens (optional)</Label>
                  <Input id="announce-url" value={url} onChange={e => setUrl(e.target.value)} maxLength={ANNOUNCE_LIMITS.url} placeholder="/board, or https://…" />
                </div>
                <div>
                  <Label htmlFor="announce-slack">Slack message</Label>
                  <Textarea id="announce-slack" rows={6} value={draft.slack_text} onChange={e => set('slack_text', e.target.value)} maxLength={ANNOUNCE_LIMITS.slack} />
                  <CharCount value={draft.slack_text} max={ANNOUNCE_LIMITS.slack} />
                </div>
              </div>

              {/* What people will actually see. */}
              <div className="space-y-3">
                <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider">Preview</p>
                <div className={cn('rounded-(--radius-card) border border-border bg-sumi/60 p-3 flex gap-3', !channels.has('push') && 'opacity-40')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icon-192.png" alt="" width={36} height={36} className="rounded-(--radius-control) shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink truncate">{draft.title || 'Push title'}</p>
                    <p className="text-[12px] text-ink-soft line-clamp-2">{draft.body || 'Push body'}</p>
                  </div>
                </div>
                <div className={cn('rounded-(--radius-card) border border-border p-3', !channels.has('slack') && 'opacity-40')}>
                  <p className="text-[12px] font-semibold text-ink mb-1">GuildBoard <span className="font-normal text-cha">APP</span></p>
                  <div className="text-[13px] text-ink-soft leading-relaxed whitespace-pre-wrap break-words">
                    <SlackPreview text={draft.slack_text || 'Slack message'} />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex items-center gap-4 text-[13px] text-ink-soft">
                {(['slack', 'push'] as const).map(c => (
                  <label key={c} className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={channels.has(c)} onChange={() => toggle(c)} className="accent-(--color-ink)" />
                    {c === 'slack' ? 'Slack' : 'Push'}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setDraft(null)} disabled={busy !== null}>Discard</Button>
                <Button icon={Megaphone} onClick={send} disabled={busy !== null || !ready}>
                  {busy === 'send' ? 'Sending…' : 'Send announcement'}
                </Button>
              </div>
            </div>
          </>
        )}

        {history.length > 0 && (
          <div className="border-t border-border pt-4">
            <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-2">Sent</p>
            <ul className="divide-y divide-border">
              {history.map(a => (
                <li key={a.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate">{a.title || a.slack_text.split('\n')[0]}</p>
                    <p className="text-[12px] text-cha tabular-nums">
                      {new Date(a.sent_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {a.channels.includes('slack') && (
                      <Badge tone={a.slack_ok === false ? 'vermillion' : 'neutral'}>{a.slack_ok === false ? 'Slack failed' : 'Slack'}</Badge>
                    )}
                    {a.channels.includes('push') && (
                      <Badge tone="neutral">Push · {a.push_sent ?? 0}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  )
}

/** Enough of Slack's mrkdwn to judge a draft: *bold*, _italic_, `code`. */
function SlackPreview({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|`[^`\n]+`)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\*[^*]+\*$/.test(p) ? <strong key={i} className="font-semibold text-ink">{p.slice(1, -1)}</strong>
        : /^_[^_]+_$/.test(p) ? <em key={i}>{p.slice(1, -1)}</em>
        : /^`[^`]+`$/.test(p) ? <code key={i} className="font-mono text-[12px] bg-kinu/60 px-1 rounded">{p.slice(1, -1)}</code>
        : <span key={i}>{p}</span>,
      )}
    </>
  )
}
