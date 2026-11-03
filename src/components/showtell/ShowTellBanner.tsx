'use client'

import { UserAvatar } from '@/components/ui/UserAvatar'
import { useShowTell } from '@/components/showtell/useShowTell'
import { formatLabel, type Slot } from '@/lib/showtell'

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * This month's Show & Tell, announced: once someone says yes (drawn,
 * invited or volunteered), they get the top of the board. Hidden until then:
 * an empty slot is the rail's job, not a banner's.
 */
export function ShowTellBanner() {
  const { data } = useShowTell()
  if (!data?.cycle || (!data.spotlight && !data.demo)) return null
  const slots = [
    data.spotlight && { label: 'Spotlight', slot: data.spotlight },
    data.demo && { label: 'Demo', slot: data.demo },
  ].filter(Boolean) as { label: string; slot: Slot }[]

  return (
    <section aria-label="This month's Show & Tell" className="overflow-hidden rounded-[20px] bg-ink text-parchment">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/60">Show & Tell · {data.cycle.label}</p>
        {data.cycle.meeting_at && <p className="text-meta text-parchment/60">{when(data.cycle.meeting_at)} IST</p>}
      </div>
      <ul className={slots.length > 1 ? 'grid sm:grid-cols-2' : 'grid'}>
        {slots.map(({ label, slot }) => (
          <li key={slot.id} className="flex items-center gap-4 px-5 py-4 sm:px-6">
            <span className="rounded-full ring-2 ring-parchment/20">
              <UserAvatar username={slot.username} size={56} />
            </span>
            <div className="min-w-0">
              <p className="text-meta text-parchment/60">{label}</p>
              <p className="truncate text-[17px] font-semibold tracking-[-0.01em]">@{slot.username}</p>
              <p className="truncate text-footnote text-parchment/75">{slot.title || formatLabel(slot.format)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
