'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowArcLeft,
  ArrowArcRight,
  ArrowDown,
  ArrowUp,
  Check,
  DotsSixVertical,
  LockSimple,
  Plus,
  Sparkle,
  Trash,
  UploadSimple,
  X,
} from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { Wordmark } from '@/components/ui/Wordmark'
import { Kers } from '@/components/kers/Kers'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'
import { SlideBody, type HeroControls } from '@/components/meet/SlideBody'
import { rehearseActivity, REHEARSE_ROOM } from '@/lib/meet/rehearse'
import { DEFAULT_DURATION_S, durationFor, formatClock, MAX_DURATION_S, MIN_DURATION_S } from '@/lib/meet/timer'
import {
  ADD_LABELS,
  AUTOSAVE_MS,
  commit,
  editLocked,
  insertAfter,
  LOCKED_MESSAGE,
  makeSlides,
  moveSlide,
  redo,
  rehearsalActivities,
  removeSlide,
  startHistory,
  undo,
  updateSlide,
  withActivities,
  type AddKind,
  type History,
} from '@/lib/meet/agendaEdit'
import type { PublicActivity } from '@/lib/meet/activity'
import { activityKeyFor, KIND_LABELS, LIMITS, MEME_FACES, sectionsOf, slideKind, type Meeting, type MeetPost, type Meme, type Segment, type SlideActivity } from '@/lib/meeting'

/** The preview is drawn at this size, then scaled to fit, so it lays out as the shared screen does. */
const STAGE_W = 1600
const STAGE_H = 900

const SLIDE_NAMES: Record<string, string> = { title: 'Title', content: 'Content', activity: 'Activity', results: 'Results', text: 'Text', meme: 'Meme' }
const ACTIVITY_NAMES: Record<SlideActivity['kind'], string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Boss Round' }

type SaveState = { saving: boolean; error: string | null; at: string | null }

type Props = {
  cycleId: string
  label: string
  meeting: Meeting
  /** The seeded activities, by slide (the rehearsal's), for an agenda from before the editor. */
  stored: Record<string, PublicActivity>
  /** Posts the slides show, and this month's board (for Topic from the board). */
  posts: Record<string, MeetPost>
  board: MeetPost[]
  /** The server's time in the page's props (sample results are drawn at it). */
  serverNow: string
  now: () => number
  /** Leave the editor (after the last save), on this slide. */
  onDone: (agenda: Segment[], slideId: string | null) => void
  /** Each save that went through, so the preview behind runs on it. */
  onSaved: (agenda: Segment[]) => void
  initialSlide?: string | null
}

/**
 * The slide editor (docs/08-meeting-mode-v2.md, Batch 3), inside Preview
 * slides: admins only (the page is). Kers drafts the slides once; from then
 * on the admin owns them here.
 *
 *   rail     every slide in order: drag to reorder (or the up/down buttons,
 *            and Alt+↑/↓), delete, `+ Add` (after the selected slide)
 *   preview  the selected slide drawn by the presenter screen's own renderer
 *            (SlideBody), at the shared screen's size, scaled down
 *   panel    the slide's fields, an activity's question, options and timer,
 *            the presenter's notes, and "Rewrite with Kers" (a suggestion to
 *            take or leave, never written on its own)
 *
 * Every change saves itself (AUTOSAVE_MS after the last), through the API's
 * `save_agenda` (cleanAgenda, and the activity slides' rows). Undo goes back
 * 20 changes. Once the meeting or a live rehearsal starts it's read-only, and
 * the server refuses writes too (editLocked).
 */
export function SlideEditor({ cycleId, label, meeting, stored, posts, board, serverNow, now, onDone, onSaved, initialSlide }: Props) {
  const toast = useToast()
  const rows = useMemo(() => Object.values(stored).map(a => ({ segment_id: a.segmentId, kind: a.kind, prompt: a.prompt, options: a.options, config: a.config })), [stored])
  const [hist, setHist] = useState<History<Segment[]>>(() => startHistory(withActivities(meeting.agenda, rows)))
  const agenda = hist.present
  const [saved, setSaved] = useState<Segment[]>(hist.present)
  const [save, setSave] = useState<SaveState>({ saving: false, error: null, at: null })
  const [refused, setRefused] = useState(false)
  const locked = refused || editLocked(meeting, now())
  const [selected, setSelected] = useState<string | null>(initialSlide && agenda.some(s => s.id === initialSlide) ? initialSlide : agenda[0]?.id ?? null)
  const idx = Math.max(0, agenda.findIndex(s => s.id === selected))
  const seg: Segment | undefined = agenda[idx]
  const dirty = agenda !== saved

  const change = useCallback(
    (next: Segment[] | ((a: Segment[]) => Segment[]), key: string | null = null) => {
      if (locked) return
      setHist(h => commit(h, typeof next === 'function' ? next(h.present) : next, key, Date.now()))
    },
    [locked],
  )
  const patch = useCallback((id: string, p: Partial<Segment>, field?: string) => change(a => updateSlide(a, id, p), field ? `${field}:${id}` : null), [change])

  // ─── Autosave ───
  const inflight = useRef(false)
  const send = useCallback(
    async (body: Segment[]): Promise<boolean> => {
      if (inflight.current) return false
      inflight.current = true
      setSave(s => ({ ...s, saving: true }))
      try {
        const res = await fetch('/api/admin/meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save_agenda', cycle_id: cycleId, agenda: body }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.status === 409 && data.locked) setRefused(true)
        if (!res.ok) throw new Error(data.error ?? 'Could not save')
        setSaved(body)
        setSave({ saving: false, error: null, at: data.savedAt ?? new Date().toISOString() })
        onSaved(data.agenda ?? body)
        if (data.sync?.kept?.length) toast('Some answered activities kept their options (people already voted).', 'info')
        return true
      } catch (err) {
        setSave(s => ({ ...s, saving: false, error: err instanceof Error ? err.message : 'Could not save' }))
        return false
      } finally {
        inflight.current = false
      }
    },
    [cycleId, onSaved, toast],
  )
  useEffect(() => {
    if (!dirty || locked) return
    const id = setTimeout(() => void send(agenda), AUTOSAVE_MS)
    return () => clearTimeout(id)
    // `save.at` / `save.error`: a save that was skipped (one in flight) is retried after it lands.
  }, [agenda, dirty, locked, send, save.at, save.saving])

  const done = async () => {
    if (dirty && !locked && !(await send(agenda)) && !window.confirm('The last changes didn’t save. Leave anyway?')) return
    onDone(dirty && locked ? saved : agenda, seg?.id ?? null)
  }

  const doUndo = useCallback(() => !locked && setHist(undo), [locked])
  const doRedo = useCallback(() => !locked && setHist(redo), [locked])

  // ─── Keys: undo / redo, Alt+↑↓ to move, Delete (outside fields) ───
  const move = useCallback(
    (by: number) => {
      if (!seg) return
      change(a => moveSlide(a, a.findIndex(s => s.id === seg.id), a.findIndex(s => s.id === seg.id) + by))
    },
    [seg, change],
  )
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const inField = !!(e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'z' && !inField) {
        e.preventDefault()
        if (e.shiftKey) doRedo()
        else doUndo()
      } else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !inField) {
        e.preventDefault()
        move(e.key === 'ArrowUp' ? -1 : 1)
      } else if (!inField && !mod && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const to = agenda[idx + (e.key === 'ArrowUp' ? -1 : 1)]
        if (to) { e.preventDefault(); setSelected(to.id) }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doUndo, doRedo, move, agenda, idx])

  // ─── Add / delete ───
  const add = (kind: AddKind, extra: { post?: MeetPost; meme?: Meme } = {}) => {
    const at = seg ?? agenda[agenda.length - 1]
    const slides = makeSlides(kind, agenda, { section: at?.section, kind: at?.kind, ...extra })
    change(a => insertAfter(a, at?.id ?? null, slides))
    setSelected(slides[0].id)
  }
  const remove = (id: string) => {
    const s = agenda.find(x => x.id === id)
    if (!s) return
    const i = agenda.indexOf(s)
    const next = removeSlide(agenda, id)
    const gone = agenda.length - next.length
    change(next)
    setSelected(next[Math.min(i, next.length - 1)]?.id ?? null)
    if (gone > 1) toast('Its results slide went with it. Undo brings both back.', 'info')
  }

  // ─── Reset to Kers draft ───
  const [resetting, setResetting] = useState(false)
  const reset = async () => {
    if (!window.confirm('Go back to Kers’ draft? Your edits are replaced (Undo brings them back).')) return
    setResetting(true)
    try {
      const res = await fetch('/api/admin/meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reset_agenda', cycle_id: cycleId }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not reset')
      const next = withActivities(data.agenda as Segment[], rows)
      setHist(h => commit(h, next, null, Date.now()))
      // Already saved: the draft is what's stored now.
      setSaved(next)
      onSaved(data.agenda)
      setSelected(next[0]?.id ?? null)
      toast('Back to Kers’ draft', 'success')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not reset', 'error')
    } finally {
      setResetting(false)
    }
  }

  const status = locked
    ? 'Locked · the meeting is on'
    : save.error
      ? `Not saved · ${save.error}`
      : save.saving
        ? 'Saving…'
        : dirty
          ? 'Editing…'
          : save.at
            ? 'Saved'
            : 'All changes save on their own'

  return (
    <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-parchment text-ink">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-border px-6">
        <Wordmark />
        <span aria-hidden className="h-5 w-px bg-border-strong" />
        <p className="eyebrow text-[13px]!">{label} slides</p>
        <p aria-live="polite" className={cn('inline-flex items-center gap-1.5 text-footnote', save.error ? 'text-vermillion' : 'text-ink-muted')}>
          {locked && <Icon icon={LockSimple} size="sm" />}
          {status}
        </p>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" icon={ArrowArcLeft} disabled={locked || !hist.past.length} onClick={doUndo} title="Undo (⌘Z)" aria-label="Undo" />
          <Button variant="ghost" icon={ArrowArcRight} disabled={locked || !hist.future.length} onClick={doRedo} title="Redo (⇧⌘Z)" aria-label="Redo" />
          {meeting.draftReady === false ? (
            <span className="px-2 text-footnote text-ink-muted" title="Kers’ draft is kept from migration 049 on">Reset: apply migration 049</span>
          ) : (
            <Button variant="ghost" disabled={locked || resetting} onClick={reset} title={meeting.hasDraft ? 'Go back to the slides as Kers drafted them' : 'Kept from your first save (or Kers’ next build)'}>
              {resetting ? 'Resetting…' : 'Reset to Kers draft'}
            </Button>
          )}
          <Button variant="secondary" onClick={done}>Done</Button>
        </div>
      </header>

      {locked && <p className="shrink-0 bg-fill/70 px-6 py-2 text-footnote text-ink-soft">{LOCKED_MESSAGE} The presenter can still move between slides.</p>}

      <div className="flex min-h-0 flex-1">
        <Rail agenda={agenda} selected={seg?.id ?? null} onSelect={setSelected} locked={locked} change={change} onRemove={remove} onAdd={add} board={board} cycleId={cycleId} memeUploads={meeting.draftReady !== false} />
        <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden p-6">
          {seg ? (
            <Preview seg={seg} agenda={agenda} idx={idx} posts={posts} stored={stored} serverNow={serverNow} now={now} />
          ) : (
            <div className="m-auto text-center text-footnote text-ink-muted">No slides yet. Add one from the rail.</div>
          )}
        </main>
        {seg && (
          <Panel
            key={seg.id}
            seg={seg}
            agenda={agenda}
            locked={locked}
            patch={patch}
            change={change}
            posts={posts}
            board={board}
            cycleId={cycleId}
            memeUploads={meeting.draftReady !== false}
          />
        )}
      </div>
    </div>
  )
}

// ─── Rail ──────────────────────────────────────────────────────

function Rail({
  agenda,
  selected,
  onSelect,
  locked,
  change,
  onRemove,
  onAdd,
  board,
  cycleId,
  memeUploads,
}: {
  agenda: Segment[]
  selected: string | null
  onSelect: (id: string) => void
  locked: boolean
  change: (next: (a: Segment[]) => Segment[]) => void
  onRemove: (id: string) => void
  onAdd: (kind: AddKind, extra?: { post?: MeetPost; meme?: Meme }) => void
  board: MeetPost[]
  cycleId: string
  memeUploads: boolean
}) {
  const [drag, setDrag] = useState<number | null>(null)
  const [over, setOver] = useState<number | null>(null)
  const sections = sectionsOf(agenda)
  const drop = (to: number) => {
    if (drag === null || locked) return
    // Dropped below itself: the gap it leaves shifts the target up by one.
    const target = to > drag ? to - 1 : to
    change(a => moveSlide(a, drag, target))
    setDrag(null)
    setOver(null)
  }
  const selectedRef = useRef<HTMLLIElement | null>(null)
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  return (
    <nav aria-label="Slides" className="flex w-[232px] shrink-0 flex-col border-r border-border">
      <ol className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3" onDragLeave={e => { if (e.currentTarget === e.target) setOver(null) }}>
        {agenda.map((s, i) => {
          const sec = sections.find(x => x.start === i)
          const on = s.id === selected
          const kind = slideKind(s, !!s.activity)
          return (
            <li
              key={s.id}
              ref={on ? selectedRef : undefined}
              draggable={!locked}
              onDragStart={e => { setDrag(i); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', s.id) }}
              onDragEnd={() => { setDrag(null); setOver(null) }}
              onDragOver={e => { if (drag === null) return; e.preventDefault(); const r = e.currentTarget.getBoundingClientRect(); setOver(e.clientY > r.top + r.height / 2 ? i + 1 : i) }}
              onDrop={e => { e.preventDefault(); if (over !== null) drop(over) }}
              className="relative"
            >
              {sec && <p className="mb-1 mt-2 truncate px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted first:mt-0">{sec.title}</p>}
              {over === i && drag !== null && drag !== i && drag !== i - 1 && <span aria-hidden className="absolute -top-0.5 left-0 right-0 h-0.5 rounded-full bg-ink/60" />}
              {over === i + 1 && i === agenda.length - 1 && drag !== null && drag !== i && <span aria-hidden className="absolute -bottom-0.5 left-0 right-0 h-0.5 rounded-full bg-ink/60" />}
              <div className={cn('group flex items-stretch gap-1 rounded-(--radius-control) border transition-colors', on ? 'border-ink/30 bg-paper' : 'border-transparent hover:bg-kinu/40', drag === i && 'opacity-40')}>
                <button type="button" onClick={() => onSelect(s.id)} aria-current={on ? 'true' : undefined} className="flex min-w-0 flex-1 items-start gap-2 px-2 py-1.5 text-left">
                  <span className="mt-0.5 w-5 shrink-0 font-mono text-[11px] tabular text-ink-muted">{String(i + 1).padStart(2, '0')}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-footnote text-ink">{thumbTitle(s)}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{s.activity ? ACTIVITY_NAMES[s.activity.kind] : SLIDE_NAMES[kind]}{s.of ? ' · results' : ''}{s.slide === 'activity' && s.duration_s ? ` · ${formatClock(s.duration_s * 1000)}` : ''}</span>
                  </span>
                </button>
                {!locked && (
                  <span aria-hidden className="flex w-4 shrink-0 cursor-grab items-center text-ink-muted opacity-0 group-hover:opacity-100">
                    <Icon icon={DotsSixVertical} size="sm" />
                  </span>
                )}
              </div>
              {on && !locked && (
                <div className="mt-1 flex items-center gap-0.5 px-1">
                  <Button variant="ghost" size="sm" icon={ArrowUp} disabled={i === 0} onClick={() => change(a => moveSlide(a, i, i - 1))} aria-label="Move up" title="Move up (Alt+↑)" />
                  <Button variant="ghost" size="sm" icon={ArrowDown} disabled={i === agenda.length - 1} onClick={() => change(a => moveSlide(a, i, i + 1))} aria-label="Move down" title="Move down (Alt+↓)" />
                  <Button variant="ghost" size="sm" icon={Trash} onClick={() => onRemove(s.id)} className="ml-auto" aria-label="Delete slide">Delete</Button>
                </div>
              )}
            </li>
          )
        })}
      </ol>
      {!locked && <AddMenu onAdd={onAdd} board={board} cycleId={cycleId} memeUploads={memeUploads} full={agenda.length >= LIMITS.segments} />}
    </nav>
  )
}

function thumbTitle(s: Segment): string {
  if (s.slide === 'meme') return s.meme?.caption || s.meme?.panels?.[0]?.text || (s.meme?.src ? 'Image meme' : 'Meme')
  if (s.activity?.prompt) return s.activity.prompt
  return s.title || s.section || 'Untitled'
}

function AddMenu({ onAdd, board, cycleId, memeUploads, full }: { onAdd: (kind: AddKind, extra?: { post?: MeetPost; meme?: Meme }) => void; board: MeetPost[]; cycleId: string; memeUploads: boolean; full: boolean }) {
  const [open, setOpen] = useState<null | 'menu' | 'topic' | 'meme'>(null)
  const toast = useToast()
  const [uploading, setUploading] = useState(false)
  const pick = (kind: AddKind, extra?: { post?: MeetPost; meme?: Meme }) => {
    onAdd(kind, extra)
    setOpen(null)
  }
  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    const src = await uploadMeme(file, cycleId).catch((err: Error) => { toast(err.message, 'error'); return null })
    setUploading(false)
    if (src) pick('meme', { meme: { src, alt: '' } })
  }
  return (
    <div className="relative shrink-0 border-t border-border p-3">
      <Button variant="secondary" icon={Plus} disabled={full} onClick={() => setOpen(o => (o ? null : 'menu'))} aria-expanded={!!open} className="w-full justify-center" title={full ? `Up to ${LIMITS.segments} slides` : undefined}>
        Add
      </Button>
      {open && (
        <div role="menu" className="absolute bottom-14 left-3 z-10 w-[300px] rounded-(--radius-card) border border-border bg-parchment p-1.5 shadow-lg">
          {open === 'menu' && (
            <>
              {(['poll', 'cloud'] as const).map(k => (
                <MenuItem key={k} onClick={() => pick(k)} hint="with its results slide">{ADD_LABELS[k]}</MenuItem>
              ))}
              <MenuItem onClick={() => setOpen('topic')} hint={`${board.length} posts`}>{ADD_LABELS.topic}</MenuItem>
              <MenuItem onClick={() => pick('text')}>{ADD_LABELS.text}</MenuItem>
              <MenuItem onClick={() => pick('title')}>{ADD_LABELS.title}</MenuItem>
              <MenuItem onClick={() => setOpen('meme')}>{ADD_LABELS.meme}</MenuItem>
            </>
          )}
          {open === 'topic' && (
            <div className="max-h-[50vh] overflow-y-auto">
              <SubHead onBack={() => setOpen('menu')}>This month’s board</SubHead>
              {board.length === 0 && <p className="px-2.5 py-2 text-footnote text-ink-muted">No posts this month yet.</p>}
              {board.map(p => (
                <MenuItem key={p.id} onClick={() => pick('topic', { post: p })} hint={`@${p.author_username}`}>{p.title}</MenuItem>
              ))}
            </div>
          )}
          {open === 'meme' && (
            <div>
              <SubHead onBack={() => setOpen('menu')}>Meme</SubHead>
              <p className="px-2.5 pb-1 text-[11px] text-ink-muted">Kers’ faces: pick one to start a Kers meme.</p>
              <div className="grid grid-cols-5 gap-1 px-1.5 pb-2">
                {MEME_FACES.map(face => (
                  <button key={face} type="button" title={face} onClick={() => pick('meme', { meme: { panels: [{ label: 'Me', text: 'A quick one, I promise.', face }] } })} className="press-sm flex flex-col items-center rounded-(--radius-control) py-1 hover:bg-kinu/60">
                    <Kers size={34} expression={face} motion="idle" />
                    <span className="mt-0.5 text-[10px] text-ink-muted">{face}</span>
                  </button>
                ))}
              </div>
              {memeUploads ? (
                <label className={cn('press flex h-8 cursor-pointer items-center gap-2 rounded-(--radius-control) px-2.5 text-footnote text-ink-soft hover:bg-kinu/60', uploading && 'pointer-events-none opacity-60')}>
                  <Icon icon={UploadSimple} size="sm" />
                  {uploading ? 'Uploading…' : 'Upload an image'}
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={e => upload(e.target.files?.[0])} />
                </label>
              ) : (
                <p className="px-2.5 py-1.5 text-[11px] text-ink-muted">Uploads: apply migration 049.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({ children, hint, onClick }: { children: React.ReactNode; hint?: string; onClick: () => void }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} className="press-sm flex w-full items-baseline gap-2 rounded-(--radius-control) px-2.5 py-1.5 text-left text-footnote text-ink hover:bg-kinu/60">
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint && <span className="shrink-0 text-[11px] text-ink-muted">{hint}</span>}
    </button>
  )
}

function SubHead({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div className="flex items-center gap-1 px-1 pb-1">
      <Button variant="ghost" size="sm" icon={X} onClick={onBack} aria-label="Back" />
      <p className="text-footnote font-medium text-ink">{children}</p>
    </div>
  )
}

async function uploadMeme(file: File, cycleId: string): Promise<string> {
  const form = new FormData()
  form.set('file', file)
  form.set('cycle_id', cycleId)
  const res = await fetch('/api/admin/meeting/meme', { method: 'POST', body: form })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || typeof data.src !== 'string') throw new Error(data.error ?? 'Could not upload it')
  return data.src
}

// ─── Preview ───────────────────────────────────────────────────

const NO_HERO: HeroControls = { presenting: false, now: () => 0, call: async () => null, busy: null, onClose: () => {}, onResults: null }

/** The selected slide, drawn by the presenter screen's renderer at the shared screen's size, scaled to fit. */
function Preview({ seg, agenda, idx, posts, stored, serverNow, now }: { seg: Segment; agenda: Segment[]; idx: number; posts: Record<string, MeetPost>; stored: Record<string, PublicActivity>; serverNow: string; now: () => number }) {
  const box = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.5)
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    // By width, then by height when there is one (a flex parent can report 0 before it settles).
    const fit = () => setScale(Math.min(el.clientWidth / STAGE_W, el.clientHeight > 0 ? el.clientHeight / STAGE_H : Infinity) || 0.5)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const t = new Date(serverNow).getTime()
  const acts = useMemo(() => rehearsalActivities(agenda, stored), [agenda, stored])
  const key = activityKeyFor(agenda, seg.id)
  const base = key ? acts[key] : undefined
  const kind = slideKind(seg, !!base)
  // An activity slide as it opens (no answers yet); a results slide with sample answers.
  const activity = !base ? null : kind === 'results' ? rehearseActivity(base, { status: 'closed', openedAt: new Date(t - 60_000).toISOString() }, t) : base
  const sections = sectionsOf(agenda)
  const section = sections.find(x => idx >= x.start && idx < x.start + x.slides)
  const hero = useMemo(() => ({ ...NO_HERO, now }), [now])

  return (
    <div ref={box} className="relative min-h-0 flex-1">
      <div
        className="absolute left-1/2 top-0 overflow-hidden rounded-(--radius-card) border border-border bg-parchment shadow-sm"
        style={{ width: STAGE_W * scale, height: STAGE_H * scale, transform: 'translateX(-50%)' }}
      >
        <div
          aria-label="Slide preview"
          className="pointer-events-none flex select-none flex-col px-14 pb-6 pt-8 [&_.eyebrow]:text-[13px]!"
          style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})`, transformOrigin: 'top left' }}
        >
          <SlideBody
            seg={seg}
            kind={kind}
            activity={activity}
            posts={posts}
            section={section?.title}
            first={idx === 0}
            last={idx === agenda.length - 1}
            participants={REHEARSE_ROOM}
            joinPath={idx === 0 && kind === 'title' ? '/meet' : null}
            hero={hero}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Panel ─────────────────────────────────────────────────────

function Panel({
  seg,
  agenda,
  locked,
  patch,
  change,
  posts,
  board,
  cycleId,
  memeUploads,
}: {
  seg: Segment
  agenda: Segment[]
  locked: boolean
  patch: (id: string, p: Partial<Segment>, field?: string) => void
  change: (next: (a: Segment[]) => Segment[]) => void
  posts: Record<string, MeetPost>
  board: MeetPost[]
  cycleId: string
  memeUploads: boolean
}) {
  const toast = useToast()
  const kind = slideKind(seg, !!seg.activity)
  const set = (p: Partial<Segment>, field?: string) => patch(seg.id, p, field)
  const [suggestion, setSuggestion] = useState<Partial<Segment> | null>(null)
  const [asking, setAsking] = useState(false)
  const rewrite = async () => {
    setAsking(true)
    try {
      const res = await fetch('/api/admin/meeting', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'rewrite_slide', cycle_id: cycleId, slide: seg }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Kers couldn’t rewrite it')
      setSuggestion(data.suggestion)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kers couldn’t rewrite it', 'error')
    } finally {
      setAsking(false)
    }
  }
  const take = () => {
    if (!suggestion) return
    change(a => updateSlide(a, seg.id, suggestion))
    setSuggestion(null)
  }

  const post = seg.cards?.find(c => c.kind === 'post')
  const topic = post && post.kind === 'post' ? posts[post.postId] : null
  const prep = seg.prep ?? { points: [], opener: '', by: 'admin' as const, at: null }
  const setPrep = (p: Partial<typeof prep>, field: string) => set({ prep: { ...prep, ...p, by: 'admin' } }, field)
  const activitySlides = agenda.filter(s => slideKind(s, !!s.activity) === 'activity')
  const canRewrite = !(kind === 'meme' && seg.meme?.src)

  return (
    <aside aria-label="Slide fields" className="w-[340px] shrink-0 overflow-y-auto border-l border-border">
      <fieldset disabled={locked} className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-footnote font-medium text-ink">
            {seg.activity ? ACTIVITY_NAMES[seg.activity.kind] : SLIDE_NAMES[kind]} slide
          </p>
          {canRewrite && (
            <Button variant="secondary" icon={Sparkle} disabled={locked || asking} onClick={rewrite}>
              {asking ? 'Kers is writing…' : 'Rewrite with Kers'}
            </Button>
          )}
        </div>

        {suggestion && <Suggestion seg={seg} suggestion={suggestion} onTake={take} onDismiss={() => setSuggestion(null)} />}

        <Field label="Section" hint="Slides next to each other with the same section are grouped.">
          <div className="flex gap-2">
            <Input value={seg.section ?? ''} maxLength={LIMITS.section} onChange={e => set({ section: e.target.value }, 'section')} className="h-8 py-0" />
            <select
              aria-label="Section kind"
              value={seg.kind}
              onChange={e => set({ kind: e.target.value as Segment['kind'] })}
              className="h-8 shrink-0 rounded-(--radius-control) border border-border bg-sumi px-2 text-footnote text-ink"
            >
              {Object.entries(KIND_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </Field>

        {kind !== 'meme' && (
          <Field label={kind === 'text' ? 'The line' : 'Title'}>
            <Input value={seg.title} maxLength={LIMITS.title} onChange={e => set({ title: e.target.value }, 'title')} className="h-8 py-0" />
          </Field>
        )}
        {kind !== 'meme' && (
          <Field label="Line under it" hint="What the room does now. One line.">
            <Input value={seg.cue ?? ''} maxLength={LIMITS.cue} onChange={e => set({ cue: e.target.value }, 'cue')} className="h-8 py-0" />
          </Field>
        )}

        {kind === 'activity' && seg.activity && <ActivityFields seg={seg} set={set} />}
        {kind === 'activity' && !seg.activity && <p className="text-footnote text-ink-muted">No activity seeded for this slide yet.</p>}

        {kind === 'results' && (
          <Field label="Shows the results of">
            <select value={seg.of ?? ''} onChange={e => set({ of: e.target.value })} className="h-8 w-full rounded-(--radius-control) border border-border bg-sumi px-2 text-footnote text-ink">
              <option value="">Pick an activity slide</option>
              {activitySlides.map(s => <option key={s.id} value={s.id}>{s.activity?.prompt || s.title || s.id}</option>)}
            </select>
          </Field>
        )}

        {kind === 'content' && (
          <Field label="Topic from the board">
            <select
              value={topic?.id ?? ''}
              onChange={e => {
                const p = board.find(b => b.id === e.target.value)
                if (!p) return
                const others = (seg.cards ?? []).filter(c => c.kind !== 'post')
                set({ topicIds: [p.id], cards: [{ kind: 'post' as const, postId: p.id }, ...others].slice(0, LIMITS.cards), title: seg.title || p.title.slice(0, LIMITS.title) })
              }}
              className="h-8 w-full rounded-(--radius-control) border border-border bg-sumi px-2 text-footnote text-ink"
            >
              <option value="">{topic ? topic.title : 'None (text only)'}</option>
              {board.filter(b => b.id !== topic?.id).map(b => <option key={b.id} value={b.id}>{b.title} · @{b.author_username}</option>)}
            </select>
          </Field>
        )}

        {kind === 'meme' && <MemeFields seg={seg} set={set} cycleId={cycleId} uploads={memeUploads} />}

        {kind !== 'meme' && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-footnote font-medium text-ink">Your notes <span className="font-normal text-ink-muted">· only you see these</span></p>
            <Field label="Say first">
              <Input value={prep.opener} maxLength={LIMITS.opener} onChange={e => setPrep({ opener: e.target.value }, 'opener')} className="h-8 py-0" />
            </Field>
            <Field label="Points" hint="One per line, up to three.">
              <Textarea
                rows={3}
                value={prep.points.join('\n')}
                onChange={e => setPrep({ points: e.target.value.split('\n').slice(0, LIMITS.points).map(p => p.slice(0, LIMITS.point)) }, 'points')}
                className="font-sans text-footnote"
              />
            </Field>
          </div>
        )}
      </fieldset>
    </aside>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-footnote text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-muted">{hint}</span>}
    </label>
  )
}

function ActivityFields({ seg, set }: { seg: Segment; set: (p: Partial<Segment>, field?: string) => void }) {
  const a = seg.activity!
  const put = (p: Partial<SlideActivity>, field: string) => set({ activity: { ...a, ...p } }, field)
  const options = a.options ?? []
  const filled = options.filter(o => o.trim()).length
  const def = durationFor(a.kind, null)
  const current = durationFor(a.kind, seg)
  return (
    <div className="space-y-4">
      <Field label="Question" hint="On every phone, and big on the screen.">
        <Input value={a.prompt} maxLength={LIMITS.prompt} onChange={e => put({ prompt: e.target.value }, 'prompt')} className="h-8 py-0" />
      </Field>
      {!a.prompt.trim() && <p className="-mt-2 text-[11px] text-vermillion">Write the question: it isn’t saved to the room until it has one.</p>}
      {a.kind === 'poll' && (
        <div>
          <Label className="mb-1">Options</Label>
          <ol className="space-y-1.5">
            {options.map((o, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Input
                  aria-label={`Option ${i + 1}`}
                  value={o}
                  maxLength={LIMITS.option}
                  onChange={e => put({ options: options.map((x, j) => (j === i ? e.target.value : x)) }, `option${i}`)}
                  className="h-8 py-0"
                />
                <Button variant="ghost" size="sm" icon={X} disabled={options.length <= 2} onClick={() => put({ options: options.filter((_, j) => j !== i) }, 'options')} aria-label={`Remove option ${i + 1}`} />
              </li>
            ))}
          </ol>
          {options.length < LIMITS.options && (
            <Button variant="ghost" size="sm" icon={Plus} onClick={() => put({ options: [...options, ''] }, 'options')} className="mt-1.5">Option</Button>
          )}
          {filled < 2 && <p className="mt-1 text-[11px] text-vermillion">A poll needs at least two options.</p>}
        </div>
      )}
      {a.kind === 'boss' && <p className="text-[11px] text-ink-muted">The Boss Round’s problem is set separately.</p>}
      <Field label="Timer" hint={`${formatClock(MIN_DURATION_S * 1000)} to ${formatClock(MAX_DURATION_S * 1000)}. Default for a ${ACTIVITY_NAMES[a.kind].toLowerCase()}: ${formatClock(DEFAULT_DURATION_S[a.kind] * 1000)}.`}>
        <DurationInput key={seg.duration_s ?? 'default'} value={seg.duration_s} fallback={def} shown={current} onChange={v => set({ duration_s: v }, 'duration')} />
      </Field>
    </div>
  )
}

/** m:ss (or plain seconds), clamped on blur; empty means the kind's default. */
function DurationInput({ value, fallback, shown, onChange }: { value: number | undefined; fallback: number; shown: number; onChange: (v: number | undefined) => void }) {
  const [text, setText] = useState(value ? formatClock(value * 1000) : '')
  const commitText = () => {
    const t = text.trim()
    if (!t) return onChange(undefined)
    const m = /^(\d{1,2}):(\d{1,2})$/.exec(t)
    const secs = m ? Number(m[1]) * 60 + Number(m[2]) : /^\d+$/.test(t) ? Number(t) : NaN
    if (!Number.isFinite(secs)) {
      setText(value ? formatClock(value * 1000) : '')
      return
    }
    const v = Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, Math.round(secs)))
    setText(formatClock(v * 1000))
    onChange(v === fallback ? undefined : v)
  }
  return (
    <div className="flex items-center gap-2">
      <Input value={text} placeholder={formatClock(fallback * 1000)} onChange={e => setText(e.target.value)} onBlur={commitText} onKeyDown={e => { if (e.key === 'Enter') commitText() }} className="h-8 w-24 py-0 font-mono tabular" aria-label="Timer, minutes:seconds" />
      <span className="text-[11px] text-ink-muted">Runs {formatClock(shown * 1000)}</span>
    </div>
  )
}

function MemeFields({ seg, set, cycleId, uploads }: { seg: Segment; set: (p: Partial<Segment>, field?: string) => void; cycleId: string; uploads: boolean }) {
  const toast = useToast()
  const meme = seg.meme ?? {}
  const put = (p: Partial<Meme>, field?: string) => set({ meme: { ...meme, ...p } }, field)
  const panels = meme.panels ?? []
  const [uploading, setUploading] = useState(false)
  const upload = async (file: File | undefined) => {
    if (!file) return
    setUploading(true)
    try {
      const src = await uploadMeme(file, cycleId)
      put({ src, panels: undefined })
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not upload it', 'error')
    } finally {
      setUploading(false)
    }
  }
  return (
    <div className="space-y-4">
      {meme.src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- the uploaded meme, any size */}
          <img src={meme.src} alt="" className="max-h-40 w-full rounded-(--radius-control) border border-border object-contain" />
          <Field label="Alt text" hint="What it shows, for screen readers.">
            <Input value={meme.alt ?? ''} maxLength={LIMITS.cardText} onChange={e => put({ alt: e.target.value }, 'alt')} className="h-8 py-0" />
          </Field>
          <Button variant="ghost" size="sm" onClick={() => put({ src: undefined, alt: undefined, panels: [{ label: 'Me', text: 'A quick one, I promise.', face: 'smug' }] })}>Use a Kers meme instead</Button>
        </>
      ) : (
        <>
          {panels.map((p, i) => (
            <div key={i} className="space-y-2 rounded-(--radius-control) border border-border p-3">
              <div className="flex items-center gap-2">
                <p className="flex-1 text-footnote text-ink-soft">Panel {i + 1}</p>
                {panels.length > 1 && <Button variant="ghost" size="sm" icon={X} onClick={() => put({ panels: panels.filter((_, j) => j !== i) })} aria-label={`Remove panel ${i + 1}`} />}
              </div>
              <Input aria-label="Label" placeholder="Label" value={p.label} maxLength={LIMITS.label} onChange={e => put({ panels: panels.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) }, `label${i}`)} className="h-8 py-0" />
              <Input aria-label="Line" placeholder="Line" value={p.text} maxLength={LIMITS.memeText} onChange={e => put({ panels: panels.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) }, `text${i}`)} className="h-8 py-0" />
              <div role="radiogroup" aria-label="Kers’ face" className="grid grid-cols-5 gap-1">
                {MEME_FACES.map(face => (
                  <button
                    key={face}
                    type="button"
                    role="radio"
                    aria-checked={p.face === face}
                    title={face}
                    onClick={() => put({ panels: panels.map((x, j) => (j === i ? { ...x, face } : x)) })}
                    className={cn('flex justify-center rounded-(--radius-control) py-1', p.face === face ? 'bg-kinu ring-1 ring-ink/30' : 'hover:bg-kinu/60')}
                  >
                    <Kers size={26} expression={face} motion="idle" />
                  </button>
                ))}
              </div>
            </div>
          ))}
          {panels.length < 2 && <Button variant="ghost" size="sm" icon={Plus} onClick={() => put({ panels: [...panels, { label: '', text: '', face: 'dramatic' }] })}>Panel</Button>}
          {uploads && (
            <label className={cn('press inline-flex h-6.5 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-[12px] text-ink-muted hover:bg-kinu/60 hover:text-ink', uploading && 'pointer-events-none opacity-60')}>
              <Icon icon={UploadSimple} size="sm" />
              {uploading ? 'Uploading…' : 'Use an image instead'}
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={e => upload(e.target.files?.[0])} />
            </label>
          )}
        </>
      )}
      <Field label="Caption">
        <Input value={meme.caption ?? ''} maxLength={LIMITS.memeText} onChange={e => put({ caption: e.target.value }, 'caption')} className="h-8 py-0" />
      </Field>
    </div>
  )
}

/** Kers' rewrite beside what's there: take it (one undoable change) or leave it. */
function Suggestion({ seg, suggestion: s, onTake, onDismiss }: { seg: Segment; suggestion: Partial<Segment>; onTake: () => void; onDismiss: () => void }) {
  const lines: [string, string][] = []
  if (s.title && s.title !== seg.title) lines.push(['Title', s.title])
  if (s.cue && s.cue !== seg.cue) lines.push(['Line', s.cue])
  if (s.activity?.prompt && s.activity.prompt !== seg.activity?.prompt) lines.push(['Question', s.activity.prompt])
  if (s.activity?.options && JSON.stringify(s.activity.options) !== JSON.stringify(seg.activity?.options)) lines.push(['Options', s.activity.options.join(' / ')])
  if (s.meme) {
    for (const [i, p] of (s.meme.panels ?? []).entries()) lines.push([`Panel ${i + 1}`, `${p.label ? `${p.label}: ` : ''}${p.text} (${p.face})`])
    if (s.meme.caption) lines.push(['Caption', s.meme.caption])
  }
  return (
    <div className="rounded-(--radius-card) border border-dashed border-border-strong p-3">
      <p className="text-[11px] text-ink-muted">Kers suggests</p>
      {lines.length ? (
        <dl className="mt-1.5 space-y-1">
          {lines.map(([k, v]) => (
            <div key={k} className="text-footnote">
              <dt className="inline text-ink-muted">{k}: </dt>
              <dd className="inline text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-1 text-footnote text-ink-soft">Nothing to change. He likes it as it is.</p>
      )}
      <div className="mt-2.5 flex gap-1.5">
        {lines.length > 0 && <Button variant="secondary" size="sm" icon={Check} onClick={onTake}>Use it</Button>}
        <Button variant="ghost" size="sm" onClick={onDismiss}>Dismiss</Button>
      </div>
    </div>
  )
}
