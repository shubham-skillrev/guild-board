'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowFatUp, ChatCircle, EyeSlash } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'
import { KINDS } from '@/lib/kinds'
import { OUTCOME_LABELS } from '@/lib/constants'

export interface PipelineTopic {
  id: string
  title: string
  category: string | null
  /** As on the board: a ghost handle for anonymous posts. */
  by: string
  votes: number
  comments: number
  signals: number
  selected: boolean
  outcome: string | null
  outcomeNote: string | null
}

type Column = 'board' | 'picked' | 'discussed' | 'carry' | 'dropped'

const COLUMNS: { key: Column; title: string; short: string; hint: string }[] = [
  { key: 'board', title: 'On the board', short: 'Board', hint: 'Posted this month' },
  { key: 'picked', title: 'Picked for the meeting', short: 'Picked', hint: 'What we’ll talk about' },
  { key: 'discussed', title: 'Discussed', short: 'Discussed', hint: 'Talked about, with what came of it' },
  { key: 'carry', title: 'Carry forward', short: 'Carry', hint: 'Back next month' },
  { key: 'dropped', title: 'Dropped', short: 'Dropped', hint: 'Not this time' },
]

const DISCUSSED = ['discussed', 'blog_born', 'project_started']

function columnOf(t: PipelineTopic): Column {
  if (t.outcome && DISCUSSED.includes(t.outcome)) return 'discussed'
  if (t.outcome === 'carry_forward') return 'carry'
  if (t.outcome === 'dropped') return 'dropped'
  return t.selected ? 'picked' : 'board'
}

function kindLabel(category: string | null): string {
  return KINDS.find(k => k.value === category)?.label ?? 'Topic'
}

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not move it')
}

/**
 * The month's topics as a pipeline: on the board → picked for the meeting →
 * what happened (discussed, carried forward, dropped). Drag a card between
 * columns on a desktop; every card also has a "Move to" menu, which is the
 * way on a phone or a keyboard. Each move is one request, applied at once
 * and undone if it fails.
 */
export function PipelineBoard({ topics: initial }: { topics: PipelineTopic[] }) {
  const toast = useToast()
  const [topics, setTopics] = useState(initial)
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<Column | null>(null)

  const move = async (t: PipelineTopic, to: Column) => {
    const from = columnOf(t)
    if (from === to) return
    const next: PipelineTopic =
      to === 'board' ? { ...t, selected: false, outcome: null, outcomeNote: null }
      : to === 'picked' ? { ...t, selected: true, outcome: null, outcomeNote: null }
      : { ...t, outcome: to === 'discussed' ? 'discussed' : to === 'carry' ? 'carry_forward' : 'dropped' }
    setTopics(ts => ts.map(x => (x.id === t.id ? next : x)))
    try {
      if (next.outcome !== t.outcome) {
        await send('/api/admin/outcome', 'PATCH', { topic_id: t.id, outcome_tag: next.outcome, outcome_note: next.outcomeNote ?? undefined })
      }
      if (next.selected !== t.selected) {
        await send('/api/admin/select-topic', 'PATCH', { topic_id: t.id, is_selected: next.selected })
      }
    } catch (err) {
      setTopics(ts => ts.map(x => (x.id === t.id ? t : x)))
      toast(err instanceof Error ? err.message : 'Could not move it', 'error')
    }
  }

  const setOutcome = async (t: PipelineTopic, outcome: string, note: string | null) => {
    const prev = t
    setTopics(ts => ts.map(x => (x.id === t.id ? { ...x, outcome, outcomeNote: note } : x)))
    try {
      await send('/api/admin/outcome', 'PATCH', { topic_id: t.id, outcome_tag: outcome, outcome_note: note ?? undefined })
    } catch (err) {
      setTopics(ts => ts.map(x => (x.id === t.id ? prev : x)))
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    }
  }

  const hide = async (t: PipelineTopic) => {
    if (!window.confirm(`Hide "${t.title}" from the board? The author can't undo this.`)) return
    try {
      await send('/api/topics', 'DELETE', { id: t.id })
      setTopics(ts => ts.filter(x => x.id !== t.id))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not hide it', 'error')
    }
  }

  if (!topics.length) {
    return <p className="rounded-(--radius-card) border border-dashed border-border-strong p-6 text-center text-footnote text-ink-muted">No topics this month yet.</p>
  }

  return (
    <div className="-mx-(--pad-page-x) overflow-x-auto px-(--pad-page-x) pb-2 [scrollbar-width:thin]">
      <div className="grid min-w-[1000px] grid-cols-5 gap-3">
        {COLUMNS.map(col => {
          const cards = topics.filter(t => columnOf(t) === col.key).sort((a, b) => b.votes - a.votes)
          return (
            <section
              key={col.key}
              aria-labelledby={`col-${col.key}`}
              onDragOver={e => { if (dragging) { e.preventDefault(); setOver(col.key) } }}
              onDragLeave={() => setOver(o => (o === col.key ? null : o))}
              onDrop={e => {
                e.preventDefault()
                const t = topics.find(x => x.id === dragging)
                setOver(null)
                setDragging(null)
                if (t) move(t, col.key)
              }}
              className={cn(
                'flex min-h-[220px] flex-col rounded-[16px] border p-2.5 transition-colors',
                over === col.key ? 'border-ink/40 bg-kinu/60' : 'border-border bg-kinu/25',
              )}
            >
              <header className="px-1.5 pb-2.5 pt-1">
                <h3 id={`col-${col.key}`} className="flex items-baseline justify-between text-footnote font-medium text-ink">
                  {col.title}
                  <span className="text-meta font-normal text-ink-muted tabular">{cards.length}</span>
                </h3>
                <p className="text-meta text-ink-muted">{col.hint}</p>
              </header>
              <ul className="flex flex-1 flex-col gap-2">
                {cards.map(t => (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={e => { setDragging(t.id); e.dataTransfer.effectAllowed = 'move' }}
                    onDragEnd={() => { setDragging(null); setOver(null) }}
                    className={cn(
                      'cursor-grab rounded-[12px] border border-border bg-paper p-3 shadow-[0_2px_8px_var(--shadow-tint)] active:cursor-grabbing',
                      dragging === t.id && 'opacity-50',
                    )}
                  >
                    <p className="text-meta text-ink-muted">{kindLabel(t.category)}</p>
                    <Link href={`/board/${t.id}`} className="mt-0.5 block text-footnote font-medium leading-snug text-ink hover:underline">
                      {t.title}
                    </Link>
                    <p className="mt-1 truncate text-meta text-ink-muted">{t.by}</p>
                    <div className="mt-2 flex items-center gap-3 text-meta text-ink-soft tabular">
                      <span className="inline-flex items-center gap-1" title="Votes"><Icon icon={ArrowFatUp} size="sm" />{t.votes}</span>
                      <span className="inline-flex items-center gap-1" title="Comments"><Icon icon={ChatCircle} size="sm" />{t.comments}</span>
                      {t.signals > 0 && <span title="Signals">+{t.signals}</span>}
                      <button type="button" onClick={() => hide(t)} aria-label={`Hide ${t.title}`} className="ml-auto rounded p-0.5 text-ink-muted hover:text-vermillion">
                        <Icon icon={EyeSlash} size="sm" />
                      </button>
                    </div>

                    {col.key === 'discussed' && <OutcomeEditor topic={t} onSave={setOutcome} />}

                    <label className="mt-2 flex items-center gap-2 border-t border-border pt-2 text-meta text-ink-muted">
                      Move to
                      <select
                        value={col.key}
                        onChange={e => move(t, e.target.value as Column)}
                        className="h-7 min-w-0 flex-1 rounded-(--radius-control) border border-border bg-paper px-1.5 text-meta text-ink"
                      >
                        {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.short}</option>)}
                      </select>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </div>
  )
}

/** What came of a discussed topic: the tag and one line, saved on blur. */
function OutcomeEditor({ topic, onSave }: { topic: PipelineTopic; onSave: (t: PipelineTopic, outcome: string, note: string | null) => void }) {
  const [note, setNote] = useState(topic.outcomeNote ?? '')
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {DISCUSSED.map(o => (
          <button
            key={o}
            type="button"
            onClick={() => onSave(topic, o, note || null)}
            aria-pressed={topic.outcome === o}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[11px] transition-colors',
              topic.outcome === o ? 'border-ink bg-ink text-parchment' : 'border-border text-ink-soft hover:text-ink',
            )}
          >
            {OUTCOME_LABELS[o]}
          </button>
        ))}
      </div>
      <Input
        aria-label="What came of it"
        placeholder="What came of it (optional)"
        maxLength={500}
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => { if (note !== (topic.outcomeNote ?? '')) onSave(topic, topic.outcome ?? 'discussed', note || null) }}
        className="h-7 py-1 text-meta"
      />
    </div>
  )
}
