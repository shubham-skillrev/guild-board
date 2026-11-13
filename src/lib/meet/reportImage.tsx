import { ImageResponse } from 'next/og'
import { NO_ANSWERS, type MeetingReport, type ReportActivity } from '@/lib/meet/report'

/** Portrait, 1200 wide: reads whole in a Slack preview and on a phone. Taller with more activities. */
const CARD_H = 280
export function reportSize(r: Pick<MeetingReport, 'activities' | 'rating'>): { width: number; height: number } {
  const rows = Math.max(1, Math.ceil(Math.min(r.activities.length, 6) / 2))
  return { width: 1200, height: Math.max(1200, 540 + rows * (CARD_H + 24) + (r.rating ? 230 : 0)) }
}
const INK = '#16181D'
const SOFT = '#4A4D55'
const MUTED = '#8A8C92'
const GROUND = '#FAFAF8'
const SAFFRON = '#A34C07'
const GRAPE = '#6C3A5C'
/** Soft pastels, one per card, in turn. */
const PASTELS = ['#EEF6F0', '#F3EEF8', '#FDF3E7', '#EAF1FA', '#FBEFF2', '#F1F4E6']
const KIND: Record<ReportActivity['kind'], string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Kers’ Boss Round' }

/**
 * The post-meeting report as one PNG (1200x1500) for the guild's Slack
 * channel (lib/meet/report.ts). Takes the anonymous report only, so no name
 * can ever be drawn.
 */
export function reportImage(r: MeetingReport): ImageResponse {
  return new ImageResponse(<ReportCard r={r} />, reportSize(r))
}

export function ReportCard({ r }: { r: MeetingReport }) {
  const acts = r.activities.slice(0, 6)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: GROUND, color: INK, padding: '56px 64px', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 20, color: MUTED, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', width: 13, height: 13, background: SAFFRON, transform: 'rotate(45deg)' }} />
          <span>GuildBoard · meeting report</span>
        </div>
        <span>{r.date ?? ''}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 820 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2, lineHeight: 1.05 }}>{`${r.month} guild meeting`}</div>
          <div style={{ display: 'flex', fontSize: 24, color: SOFT, marginTop: 14, lineHeight: 1.35 }}>{r.sections.join('  ·  ')}</div>
        </div>
        <Kers size={150} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 36, marginTop: 30, paddingBottom: 26, borderBottom: '2px solid #E6E4DE' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          <span style={{ fontSize: 96, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>{String(r.people.total)}</span>
          <span style={{ fontSize: 28, color: SOFT }}>{r.people.total === 1 ? 'person joined' : 'people joined'}</span>
        </div>
        <span style={{ fontSize: 26, color: SOFT }}>{`${r.people.members} ${r.people.members === 1 ? 'member' : 'members'} · ${r.people.guests} ${r.people.guests === 1 ? 'guest' : 'guests'}`}</span>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 28, flex: 1, alignContent: 'flex-start' }}>
        {acts.length === 0 && <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>No activities this month.</div>}
        {acts.map((a, i) => (
          <ActivityCard key={i} a={a} bg={PASTELS[i % PASTELS.length]} />
        ))}
      </div>

      {r.rating && <Rating a={r.rating} />}
    </div>
  )
}

function Eyebrow({ text }: { text: string }) {
  return <div style={{ display: 'flex', flexShrink: 0, fontSize: 16, color: MUTED, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'monospace' }}>{text}</div>
}

function ActivityCard({ a, bg }: { a: ReportActivity; bg: string }) {
  const answered = `${a.answered} ${a.kind === 'boss' ? 'tried' : 'answered'}`
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: 524, height: CARD_H, background: bg, borderRadius: 24, padding: '24px 28px', overflow: 'hidden' }}>
      <Eyebrow text={`${KIND[a.kind]}${a.section && !KIND[a.kind].includes(a.section) ? ` · ${a.section}` : ''}`} />
      <div style={{ display: 'flex', flexShrink: 0, fontSize: 26, fontWeight: 700, marginTop: 10, lineHeight: 1.2, maxHeight: 64, overflow: 'hidden' }}>{a.kind === 'boss' && a.boss ? a.boss.problem : a.prompt}</div>
      {a.empty ? (
        <div style={{ display: 'flex', fontSize: 24, color: MUTED, marginTop: 'auto', marginBottom: 'auto' }}>{NO_ANSWERS}</div>
      ) : a.kind === 'poll' && a.options ? (
        <Bars bars={a.options} width={468} />
      ) : a.kind === 'cloud' && a.words ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
          {a.words.map((w, i) => (
            <div key={w.word} style={{ display: 'flex', alignItems: 'baseline', gap: 8, background: 'rgba(255,255,255,0.75)', borderRadius: 999, padding: '6px 16px', fontSize: i === 0 ? 28 : 22, fontWeight: i === 0 ? 700 : 400 }}>
              <span>{w.word}</span>
              <span style={{ fontSize: 18, color: MUTED }}>{String(w.n)}</span>
            </div>
          ))}
        </div>
      ) : a.boss ? (
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginTop: 'auto', marginBottom: 'auto' }}>
          <span style={{ fontSize: 80, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{`${a.boss.pct}%`}</span>
          <span style={{ fontSize: 22, color: SOFT }}>{`passed every test (${a.boss.passed} of ${a.boss.trying})`}</span>
        </div>
      ) : null}
      <div style={{ display: 'flex', fontSize: 18, color: SOFT, marginTop: 'auto' }}>{a.empty ? '' : answered}</div>
    </div>
  )
}

/** One row per option: its label, the bar, votes and share. */
function Bars({ bars, width }: { bars: { label: string; n: number; pct: number }[]; width: number }) {
  const max = Math.max(1, ...bars.map(b => b.n))
  const labelW = 210
  const track = width - labelW - 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14, gap: 10 }}>
      {bars.map((b, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', width: labelW, fontSize: 17, color: SOFT, height: 22, overflow: 'hidden', paddingRight: 12 }}>{b.label}</div>
          <div style={{ display: 'flex', width: track, height: 12 }}>
            <div style={{ display: 'flex', width: Math.max(6, (b.n / max) * track), height: 12, background: b.n === max && b.n > 0 ? GRAPE : INK, opacity: b.n === max && b.n > 0 ? 0.85 : 0.35, borderRadius: '0 4px 4px 0' }} />
          </div>
          <div style={{ display: 'flex', marginLeft: 12, fontSize: 17, color: INK }}>{`${b.n} · ${b.pct}%`}</div>
        </div>
      ))}
    </div>
  )
}

/** "Rate today's meeting": one full-width strip, each option's share. */
function Rating({ a }: { a: ReportActivity }) {
  const opts = a.options ?? []
  return (
    <div style={{ display: 'flex', flexDirection: 'column', marginTop: 20, background: '#F3EEF8', borderRadius: 24, padding: '22px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Eyebrow text="How was today’s meeting?" />
        <span style={{ fontSize: 18, color: SOFT }}>{a.empty ? NO_ANSWERS : `${a.answered} answered`}</span>
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        {opts.map((o, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1, background: 'rgba(255,255,255,0.75)', borderRadius: 16, padding: '12px 16px' }}>
            <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{`${o.pct}%`}</span>
            <span style={{ fontSize: 20, color: SOFT }}>{o.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Kers, flat: a round grape blob, his googly eyes and a blush. */
function Kers({ size }: { size: number }) {
  const eye = size * 0.24
  const pupil = eye * 0.5
  return (
    <div style={{ display: 'flex', position: 'relative', width: size, height: size, borderRadius: size, background: GRAPE }}>
      {[0.24, 0.52].map((x, i) => (
        <div key={i} style={{ display: 'flex', position: 'absolute', left: size * x, top: size * 0.28, width: eye, height: eye, borderRadius: eye, background: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', width: pupil, height: pupil, borderRadius: pupil, background: INK, marginLeft: pupil * 0.3, marginTop: pupil * 0.2 }} />
        </div>
      ))}
      {[0.14, 0.7].map((x, i) => (
        <div key={`b${i}`} style={{ display: 'flex', position: 'absolute', left: size * x, top: size * 0.58, width: size * 0.16, height: size * 0.08, borderRadius: size, background: '#F4A3B8', opacity: 0.8 }} />
      ))}
      <div style={{ display: 'flex', position: 'absolute', left: size * 0.42, top: size * 0.62, width: size * 0.16, height: size * 0.07, borderBottom: '4px solid #FFFFFF', borderRadius: '0 0 999px 999px' }} />
    </div>
  )
}
