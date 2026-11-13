import { ImageResponse } from 'next/og'
import { NO_ANSWERS, type MeetingReport, type ReportActivity } from '@/lib/meet/report'
import {
  CARD_PAD_X,
  fillWidth,
  pollColumns,
  pollTiles,
  REPORT_CLOUD,
  REPORT_GAP,
  REPORT_HALF,
  REPORT_PAD,
  REPORT_TILE_GAP,
  REPORT_TILE_H,
  reportCloud,
  reportGrid,
  reportImageSize,
  SAFFRON_HEX,
  TILE_HEX,
  WORD_TONE_RGB,
  wordToneIndex,
} from '@/lib/meet/results'

/** Portrait, 1200 wide: reads whole in a Slack preview and on a phone. Taller with more (or bigger) activities. */
export function reportSize(r: Pick<MeetingReport, 'activities' | 'rating'>): { width: number; height: number } {
  return reportImageSize(r.activities, !!r.rating)
}
const INK = '#16181D'
const SOFT = '#4A4D55'
const MUTED = '#8A8C92'
const GROUND = '#FAFAF8'
const SAFFRON = SAFFRON_HEX
const GRAPE = '#6C3A5C'
/** Soft pastels, one per card, in turn. */
const PASTELS = ['#EEF6F0', '#F3EEF8', '#FDF3E7', '#EAF1FA', '#FBEFF2', '#F1F4E6']
const KIND: Record<ReportActivity['kind'], string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Kers’ Boss Round' }

/**
 * The post-meeting report as one PNG (1200 wide) for the guild's Slack
 * channel (lib/meet/report.ts). Takes the anonymous report only, so no name
 * can ever be drawn. The results are the screen's and the phones' (same
 * tiles, same shares, same word colours: lib/meet/results.ts), drawn with
 * inline styles for next/og. The grid (reportGrid) sizes each row to what its
 * cards need, so nothing is clipped, and an odd card out spans the row.
 */
export function reportImage(r: MeetingReport): ImageResponse {
  return new ImageResponse(<ReportCard r={r} />, reportSize(r))
}

export function ReportCard({ r }: { r: MeetingReport }) {
  const acts = r.activities
  const grid = reportGrid(acts)
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: GROUND, color: INK, padding: `56px ${REPORT_PAD}px`, fontFamily: 'sans-serif' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: REPORT_GAP, marginTop: 28, flex: 1 }}>
        {acts.length === 0 && <div style={{ display: 'flex', fontSize: 26, color: MUTED }}>No activities this month.</div>}
        {grid.rows.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', gap: REPORT_GAP, height: row.height }}>
            {row.cards.map(c => (
              <ActivityCard key={c.index} a={acts[c.index]} bg={PASTELS[c.index % PASTELS.length]} width={c.width} height={row.height} />
            ))}
          </div>
        ))}
      </div>

      {r.rating && <Rating a={r.rating} />}
    </div>
  )
}

function Eyebrow({ text }: { text: string }) {
  return <div style={{ display: 'flex', flexShrink: 0, fontSize: 16, color: MUTED, letterSpacing: 3, textTransform: 'uppercase', fontFamily: 'monospace' }}>{text}</div>
}

function ActivityCard({ a, bg, width, height }: { a: ReportActivity; bg: string; width: number; height: number }) {
  const answered = `${a.answered} ${a.kind === 'boss' ? 'tried' : 'answered'}`
  const inner = width - CARD_PAD_X * 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, height, background: bg, borderRadius: 24, padding: `24px ${CARD_PAD_X}px` }}>
      <Eyebrow text={`${KIND[a.kind]}${a.section && !KIND[a.kind].includes(a.section) ? ` · ${a.section}` : ''}`} />
      <div style={{ display: 'flex', flexShrink: 0, fontSize: 26, fontWeight: 700, marginTop: 10, lineHeight: 1.2, maxHeight: 64, overflow: 'hidden' }}>{a.kind === 'boss' && a.boss ? a.boss.problem : a.prompt}</div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 18 }}>
        {a.empty ? (
          <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>{NO_ANSWERS}</div>
        ) : a.kind === 'poll' && a.options ? (
          <Tiles bars={a.options} width={inner} wide={width > REPORT_HALF} />
        ) : a.kind === 'cloud' && a.words ? (
          <Cloud words={a.words} width={inner} />
        ) : a.boss ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ fontSize: 80, fontWeight: 700, letterSpacing: -3, lineHeight: 1 }}>{`${a.boss.pct}%`}</span>
            <span style={{ fontSize: 22, color: SOFT }}>{`passed every test (${a.boss.passed} of ${a.boss.trying})`}</span>
          </div>
        ) : null}
      </div>
      <div style={{ display: 'flex', fontSize: 18, color: SOFT, marginTop: 'auto' }}>{a.empty ? '' : answered}</div>
    </div>
  )
}

/** An option's shape, as on the screen and the phones (components/meet/tiles.tsx). */
function Shape({ i, size }: { i: number; size: number }) {
  const t = TILE_HEX[i % TILE_HEX.length]
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
      {t.shape === 'triangle' && <path d="M10 2.5 18 17H2z" fill={t.hex} stroke={t.hex} strokeWidth="1.5" strokeLinejoin="round" />}
      {t.shape === 'diamond' && <path d="M10 1.5 18.5 10 10 18.5 1.5 10z" fill={t.hex} />}
      {t.shape === 'circle' && <circle cx="10" cy="10" r="8" fill={t.hex} />}
      {t.shape === 'square' && <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" fill={t.hex} />}
    </svg>
  )
}

/**
 * The poll as the voting tiles: each option's shape and label, its % big, a
 * soft fill to that level (none at 0%), the winner ringed in saffron.
 */
function Tiles({ bars, width, wide }: { bars: { label: string; n: number; pct: number }[]; width: number; wide: boolean }) {
  const labels = bars.map(b => b.label)
  const { tiles } = pollTiles(labels, bars.map(b => b.n))
  const cols = wide ? Math.min(Math.max(1, labels.length), 4) : pollColumns(labels, 2)
  const w = Math.floor((width - (cols - 1) * REPORT_TILE_GAP) / cols)
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: REPORT_TILE_GAP, width }}>
      {tiles.map(t => {
        const hue = TILE_HEX[t.i % TILE_HEX.length]
        const ring = t.lead
        const fill = fillWidth(bars[t.i].pct)
        return (
          <div
            key={t.i}
            style={{
              display: 'flex',
              position: 'relative',
              width: w,
              height: REPORT_TILE_H,
              borderRadius: 16,
              overflow: 'hidden',
              background: `rgba(${hue.rgb},0.07)`,
              border: ring ? `3px solid ${SAFFRON}` : `2px solid rgba(${hue.rgb},0.25)`,
            }}
          >
            {fill > 0 && <div style={{ display: 'flex', position: 'absolute', left: 0, top: 0, bottom: 0, width: `${fill}%`, background: `rgba(${hue.rgb},0.16)` }} />}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '0 16px' }}>
              <Shape i={t.i} size={22} />
              <div style={{ display: 'flex', flex: 1, fontSize: 19, lineHeight: 1.2, color: INK, maxHeight: 48, overflow: 'hidden' }}>{t.label}</div>
              <span style={{ fontSize: 30, fontWeight: t.lead ? 700 : 400, color: t.lead ? INK : SOFT, letterSpacing: -1 }}>{`${bars[t.i].pct}%`}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** The word cloud as on the screen: its rows (biggest in the middle), each word in its own pastel. */
function Cloud({ words, width }: { words: { word: string; n: number }[]; width: number }) {
  const { rows, scale } = reportCloud(words, width)
  const leader = words[0]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: REPORT_CLOUD.gap, width }}>
      {rows.map((row, r) => (
        <div key={r} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: REPORT_CLOUD.gap }}>
          {row.map(({ w, size }) => {
            const rgb = WORD_TONE_RGB[wordToneIndex(w.word)]
            const top = w.word === leader.word && leader.n > 1
            const px = Math.round(size * scale)
            return (
              <div
                key={w.word}
                style={{
                  display: 'flex',
                  fontSize: px,
                  lineHeight: 1.15,
                  padding: `${Math.round(px * 0.14)}px ${Math.round(px * 0.6)}px`,
                  borderRadius: 999,
                  background: `rgba(${rgb},${top ? 0.2 : 0.09})`,
                  border: `1.5px solid rgba(${rgb},${top ? 0.45 : 0.2})`,
                  fontWeight: top || size > REPORT_CLOUD.min + (REPORT_CLOUD.max - REPORT_CLOUD.min) * 0.45 ? 700 : 400,
                  color: INK,
                  whiteSpace: 'nowrap',
                }}
              >
                {w.word}
              </div>
            )
          })}
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
