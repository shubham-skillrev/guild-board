'use client'

import Link from 'next/link'
import { SectionHeader } from '@/components/ui/Section'
import { useGuestGate } from '@/components/auth/GuestGate'
import { useRadar } from '@/components/radar/useRadar'
import { RadarRow } from '@/components/radar/RadarSection'
import { RADAR_TOP } from '@/lib/radar'

/** The Radar's top three, in the board rail. Hidden until something is on it. */
export function RadarTeaser() {
  const { data, vote } = useRadar()
  const { blockGuest } = useGuestGate()
  if (!data?.cycle || data.items.length === 0) return null
  return (
    <section aria-labelledby="board-radar">
      <SectionHeader id="board-radar" title="On the Radar" hint="Opens the meeting" href="/bytes#radar" hrefLabel="All" />
      <ol className="elev-1 rounded-(--radius-card) divide-y divide-separator overflow-hidden">
        {data.items.slice(0, RADAR_TOP).map((item, i) => (
          <RadarRow key={`${item.kind}:${item.id}`} item={item} rank={i + 1} compact onVote={() => { if (!blockGuest()) vote(item) }} />
        ))}
      </ol>
      <p className="mt-2 text-meta text-ink-muted">
        <Link href="/bytes#radar" className="hover:text-ink">Add a link or vote →</Link>
      </p>
    </section>
  )
}
