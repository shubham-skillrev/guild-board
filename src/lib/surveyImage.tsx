import { ImageResponse } from 'next/og'
import { ROLES, labelOf, type Role } from '@/lib/survey'
import { pct, type Bar, type SurveyStats } from '@/lib/surveyStats'

const SIZE = { width: 1600, height: 900 }
const INK = '#16181D'
const SOFT = '#4A4D55'
const MUTED = '#8A8C92'
const GROUND = '#FAFAF8'
const SAFFRON = '#A34C07'

/**
 * The survey totals as one 16:9 PNG (1600x900), for a meeting slide or a
 * Slack post. Takes counts only, so no name or email can ever be drawn.
 */
export function surveyImage(stats: SurveyStats, role: Role | 'all'): ImageResponse {
  const q = (key: string) => stats.questions.find(x => x.key === key)?.bars ?? []
  // Who answered, or (filtered to one role) whether they have been before.
  const side = role === 'all'
    ? { title: 'Who answered', bars: q('role') }
    : { title: 'Been to a guild meeting', bars: q('attended') }

  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: GROUND, color: INK, padding: '64px 80px', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 22, color: MUTED, letterSpacing: 4, textTransform: 'uppercase', fontFamily: 'monospace' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* The ◈ mark, drawn: the default image font has no glyph for it. */}
            <div style={{ display: 'flex', width: 14, height: 14, background: SAFFRON, transform: 'rotate(45deg)' }} />
            <span>{`Guild survey${role === 'all' ? '' : ` · ${labelOf(ROLES, role)}`}`}</span>
          </div>
          <span>guildboard.skillrev.in/survey</span>
        </div>

        <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, letterSpacing: -2, marginTop: 28, lineHeight: 1.05 }}>
          What SkillRev wants from the guild
        </div>

        <div style={{ display: 'flex', flex: 1, marginTop: 48, gap: 72 }}>
          {/* The headline numbers. */}
          <div style={{ display: 'flex', flexDirection: 'column', width: 300 }}>
            <div style={{ display: 'flex', fontSize: 160, fontWeight: 700, letterSpacing: -6, lineHeight: 1 }}>{String(stats.total)}</div>
            <div style={{ display: 'flex', fontSize: 28, color: SOFT, marginTop: 8 }}>answers</div>
            <Figure value={stats.newVoices} label="without an account" />
            <Figure value={stats.couldDemo} label="could show something" />
          </div>

          <Bars title="What would make them join" bars={q('join').slice(0, 6)} total={stats.total} width={620} />

          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: 28 }}>
            <Bars title={side.title} bars={side.bars.slice(0, 3)} total={stats.total} width={400} />
            <Bars title="Best time" bars={q('slot').slice(0, 3)} total={stats.total} width={400} />
          </div>
        </div>
      </div>
    ),
    SIZE,
  )
}

function Figure({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 28, fontSize: 24, color: SOFT }}>
      <span style={{ fontSize: 40, fontWeight: 700, color: INK }}>{String(value)}</span>
      <span>{label}</span>
    </div>
  )
}

/** Ranked bars, one hue, count and share at the tip. */
function Bars({ title, bars, total, width }: { title: string; bars: Bar[]; total: number; width: number }) {
  const max = Math.max(1, ...bars.map(b => b.n))
  const track = width - 120
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width }}>
      <div style={{ display: 'flex', fontSize: 26, fontWeight: 700, marginBottom: 14 }}>{title}</div>
      {bars.length === 0 && <div style={{ display: 'flex', fontSize: 22, color: MUTED }}>No answers yet</div>}
      {bars.map(b => (
        <div key={b.value} style={{ display: 'flex', flexDirection: 'column', marginBottom: 14 }}>
          <div style={{ display: 'flex', fontSize: 22, color: SOFT }}>{b.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 6 }}>
            <div style={{ display: 'flex', width: track, height: 14 }}>
              <div style={{ display: 'flex', width: Math.max(6, (b.n / max) * track), height: 14, background: INK, opacity: 0.75, borderRadius: '0 4px 4px 0' }} />
            </div>
            <div style={{ display: 'flex', marginLeft: 16, fontSize: 22, color: INK }}>{`${b.n} · ${total ? pct(b.share) : '0%'}`}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
