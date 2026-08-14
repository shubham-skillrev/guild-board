'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useToast } from '@/hooks/useToast'
import { IdeaCard } from '@/components/bank/IdeaCard'
import { BankIdeaModal } from '@/components/bank/BankIdeaModal'
import { Button } from '@/components/ui/Button'
import type { BankedIdea } from '@/types'

type Tab = 'mine' | 'open'

export default function BankPage() {
  const router = useRouter()
  const toast = useToast()
  const { cycle, phase } = useCurrentCycle()

  const [tab, setTab] = useState<Tab>('mine')
  const [mine, setMine] = useState<BankedIdea[]>([])
  const [open, setOpen] = useState<BankedIdea[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  // Promotion needs an open cycle before its meeting; banking never does.
  const canPromote = phase === 'open'

  const load = useCallback(async () => {
    try {
      const [mineRes, openRes] = await Promise.all([
        fetch('/api/idea-bank').then(r => r.json()),
        fetch('/api/idea-bank?scope=open').then(r => r.json()),
      ])
      setMine(Array.isArray(mineRes) ? mineRes : [])
      setOpen(Array.isArray(openRes) ? openRes : [])
    } catch {
      toast('Could not load your ideas', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handlePromote = async (idea: BankedIdea) => {
    const res = await fetch('/api/idea-bank/promote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error || 'Could not put it on the board', 'error'); return }
    toast('On the board 🎉', 'success')
    await load()
    router.push(`/board/${data.id}`)
  }

  const handleToggleOpen = async (idea: BankedIdea) => {
    const res = await fetch('/api/idea-bank', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id, is_open: !idea.is_open }),
    })
    if (!res.ok) { toast('Could not update', 'error'); return }
    toast(idea.is_open ? 'Back to private' : 'Offered to the guild 🙌', 'success')
    await load()
  }

  const handleDelete = async (idea: BankedIdea) => {
    const res = await fetch('/api/idea-bank', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: idea.id }),
    })
    if (!res.ok) { toast('Could not delete', 'error'); return }
    setMine(prev => prev.filter(i => i.id !== idea.id))
  }

  const unpromoted = mine.filter(i => !i.promoted_topic_id)
  const list = tab === 'mine' ? mine : open
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'mine', label: 'My bank', count: unpromoted.length },
    { key: 'open', label: 'Up for grabs', count: open.length },
  ]

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-3xl mx-auto pb-28 md:pb-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">Idea Bank</h1>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          Park an idea the moment you have it - any day, any cycle. Bank as many as you like;
          one goes on the board each cycle.
        </p>
      </div>

      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <Button onClick={() => setShowModal(true)}>+ Bank an idea</Button>
        {!canPromote && unpromoted.length > 0 && (
          <span className="text-[11px] text-cha">
            {cycle ? 'Board opens next cycle - ideas keep till then.' : 'No cycle open yet.'}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-all ${
              tab === t.key
                ? 'text-ink border-saffron'
                : 'text-ink-soft border-transparent hover:text-ink'
            }`}
          >
            {t.label}
            {t.count > 0 && <span className="ml-1.5 text-[11px] text-cha tabular-nums">{t.count}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-[13px] text-cha">Loading…</div>
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">{tab === 'mine' ? '💡' : '🙌'}</div>
          <p className="text-base font-medium text-ink-soft">
            {tab === 'mine' ? 'Nothing banked yet' : 'No ideas up for grabs'}
          </p>
          <p className="text-[13px] mt-1 text-cha max-w-sm mx-auto leading-relaxed">
            {tab === 'mine'
              ? 'Next time something annoys you in a standup, park it here. Takes ten seconds.'
              : 'When someone offers an idea they can’t get to, it shows up here for anyone to pitch.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {list.map(idea => (
            <IdeaCard
              key={idea.id}
              idea={idea}
              canPromote={canPromote}
              onPromote={handlePromote}
              onToggleOpen={tab === 'mine' ? handleToggleOpen : undefined}
              onDelete={tab === 'mine' ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {showModal && (
        <BankIdeaModal
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); toast('Banked 💡', 'success') }}
        />
      )}
    </div>
  )
}
