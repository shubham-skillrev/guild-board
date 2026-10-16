import type { Expression, Mood } from '@guildboard/guildbot'
import { Face } from '@/components/guildbot/GuildBotAvatar'
import { cn } from '@/lib/utils/cn'

/**
 * GuildBot as a postage stamp: the flat, 2D him in the chat's postcard
 * header. Perforated edge, flat colours, a postmark. The stamp itself
 * changes with the moment, like a real stamp series:
 *
 *   smug, bored, dramatic, proud   his mood (sparkle, z's, lightning, medal)
 *   genie                          the last three asks of the week
 *   meeting                        meeting day, uninvited (a crossed-out date)
 *   heatwave, chilly               the weather in your city (sun, snowflake)
 *
 * His face still follows his live expression. Festival stamps join later,
 * with the costumes. Always paper colours, so it reads on both themes.
 */
export type StampVariant = Mood | 'genie' | 'meeting' | 'heatwave' | 'chilly'

const FIELD: Record<StampVariant, string> = {
  smug: '#F8E6CF',
  bored: '#DCE2EA',
  dramatic: '#F5D3CD',
  proud: '#F4E2A6',
  genie: '#DDE7FA',
  meeting: '#EFD1C9',
  heatwave: '#F9D3A3',
  chilly: '#D6ECF1',
}

export function GuildBotStamp({
  expression,
  variant,
  className,
}: {
  expression: Expression
  variant: StampVariant
  className?: string
}) {
  // Scalloped edge: a rounded rectangle punched with half-circles all round.
  const holes: string[] = []
  for (let x = 6; x <= 38; x += 4) holes.push(`M${x - 1.4} 1a1.4 1.4 0 0 0 2.8 0`, `M${x - 1.4} 51a1.4 1.4 0 0 1 2.8 0`)
  for (let y = 6; y <= 46; y += 4) holes.push(`M1 ${y - 1.4}a1.4 1.4 0 0 1 0 2.8`, `M43 ${y - 1.4}a1.4 1.4 0 0 0 0 2.8`)
  const genie = variant === 'genie'
  return (
    <svg viewBox="0 0 44 52" width={40} height={47} aria-hidden className={cn('gb-stamp shrink-0', className)}>
      <rect x={1} y={1} width={42} height={50} rx={2} className="gb-stamp-paper" />
      <path d={holes.join('')} className="gb-stamp-hole" />
      <rect x={4.5} y={4.5} width={35} height={43} rx={1.5} fill={FIELD[variant]} stroke="#D9C7AE" strokeWidth={0.6} />
      <Motif variant={variant} />
      {/* Him, flat: head, visor, face, antenna. */}
      <g transform="translate(6 13) scale(0.5)">
        <path d="M32 6.5v6" className="gb-stamp-line" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M32 1 35.5 4.5 32 8 28.5 4.5Z" fill={genie ? '#2F5FC4' : '#C8640F'} />
        <rect x={6} y={12} width={52} height={45} rx={19} className="gb-stamp-head" strokeWidth={2.6} />
        <rect x={12.5} y={24} width={39} height={25} rx={12.5} className="gb-stamp-visor" />
        <g style={{ ['--gb-eye' as string]: genie ? '#8EC2FF' : '#F7A851' }}>
          <Face expression={expression} />
        </g>
      </g>
      {/* Postmark across the top right. */}
      <g className="gb-stamp-postmark" fill="none" strokeWidth={0.9}>
        <circle cx={37} cy={9} r={6} />
        <path d="M27 6q3-2 6 0t6 0 6 0M27 9.5q3-2 6 0t6 0 6 0M27 13q3-2 6 0t6 0 6 0" />
      </g>
    </svg>
  )
}

/** The little picture that marks each stamp in the series, in its bottom corners. */
function Motif({ variant }: { variant: StampVariant }) {
  const ink = '#3A2E22'
  switch (variant) {
    case 'smug':
      return <path d="M10 41l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z" fill="#C8640F" />
    case 'bored':
      return <path d="M8 39h3.5l-3.5 3.5h3.5M33 41h2.5l-2.5 2.5h2.5" fill="none" stroke="#5A6678" strokeWidth={0.9} strokeLinecap="round" strokeLinejoin="round" />
    case 'dramatic':
      return <path d="M10 37l-2.5 5h2.5l-1.5 4.5 4-6h-2.6l1.6-3.5Z" fill="#C0392B" />
    case 'proud':
      return (
        <g>
          <path d="M8.5 38l1.6 4 1.6-4Z" fill="#C0392B" />
          <circle cx={10.1} cy={44} r={2.4} fill="#E2A72E" stroke={ink} strokeWidth={0.5} />
        </g>
      )
    case 'genie':
      return <path d="M9 40l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8ZM33.5 38l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" fill="#2F5FC4" />
    case 'meeting':
      return (
        <g>
          <rect x={7} y={38} width={7} height={7} rx={1} fill="#fff" stroke={ink} strokeWidth={0.6} />
          <path d="M7 40h7" stroke="#C0392B" strokeWidth={1.2} />
          <path d="M8.5 41.5l4 3M12.5 41.5l-4 3" stroke="#C0392B" strokeWidth={0.8} strokeLinecap="round" />
        </g>
      )
    case 'heatwave':
      return (
        <g>
          <circle cx={10} cy={42} r={2.6} fill="#E8752A" />
          <path d="M10 37.6v1.2M10 45.2v1.2M5.6 42h1.2M13.2 42h1.2M6.9 38.9l.8.8M12.3 44.3l.8.8M6.9 45.1l.8-.8M12.3 39.7l.8-.8" stroke="#E8752A" strokeWidth={0.8} strokeLinecap="round" />
        </g>
      )
    case 'chilly':
      return <path d="M10 37.5v9M6.1 39.75l7.8 4.5M6.1 44.25l7.8-4.5" stroke="#3E7C8C" strokeWidth={0.9} strokeLinecap="round" />
  }
}

/**
 * His mood as a tiny bit of weather floating over the stamp: sun when he's
 * proud, sun behind a cloud when smug, a drizzling cloud when bored, a storm
 * when dramatic. Never a sky: the real weather in your city stays on him.
 */
export function MoodCloud({ mood, className }: { mood: Mood; className?: string }) {
  const sun = <circle cx={10} cy={9} r={5} fill="#F2B33D" />
  const cloud = (fill: string) => <path d="M7 17h13a4 4 0 0 0 .3-8 5.5 5.5 0 0 0-10.4-1.2A4.5 4.5 0 0 0 7 17Z" fill={fill} stroke="#3A3F4F" strokeWidth={1} strokeLinejoin="round" />
  return (
    <svg viewBox="0 0 26 26" width={24} height={24} aria-hidden className={cn('gb-mood-cloud', className)}>
      {mood === 'proud' && <>{sun}<path d="M10 1.5v2M10 14.5v2M2.5 9h2M15.5 9h2M4.7 3.7l1.4 1.4M14 13l1.4 1.4M4.7 14.3l1.4-1.4M14 5l1.4-1.4" stroke="#F2B33D" strokeWidth={1.4} strokeLinecap="round" /></>}
      {mood === 'smug' && <>{sun}{cloud('#F4F1EA')}</>}
      {mood === 'bored' && <>{cloud('#C9CFD8')}<path data-drop d="M10 20v2.5M14.5 20v2.5M19 20v2.5" stroke="#6B8EC2" strokeWidth={1.2} strokeLinecap="round" /></>}
      {mood === 'dramatic' && <>{cloud('#8E95A3')}<path data-bolt d="M14 17.5l-2.5 4h2.2l-1.2 3.5 3.5-5h-2.2l1.2-2.5Z" fill="#F2C94C" /></>}
    </svg>
  )
}
