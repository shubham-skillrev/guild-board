import type { Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'

/**
 * GuildBot's face. A rounded head with the board's ◈ diamond for an antenna;
 * the eyes and mouth change with its mood (moodFor in the package):
 *
 *   smug      one eye open, one half-shut under a raised brow, a lopsided smirk
 *   bored     both eyes half-shut, a flat mouth
 *   dramatic  wide eyes under worried brows, a small open mouth
 *   proud     happy closed eyes, a wide smile
 *
 * Line work takes the text colour; the diamond is always saffron so it reads as
 * GuildBoard's mark.
 */
export function GuildBotMark({
  size = 20,
  mood = 'smug',
  className,
  title,
}: {
  size?: number
  mood?: Mood
  className?: string
  title?: string
}) {
  const line = { stroke: 'currentColor', strokeLinecap: 'round' as const, fill: 'none' }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={cn('shrink-0', className)}
    >
      {title && <title>{title}</title>}
      {/* Antenna: the ◈ diamond on a short stalk */}
      <path d="M12 1.25 14.25 3.5 12 5.75 9.75 3.5Z" className="fill-saffron" />
      <path d="M12 5.75v2" {...line} strokeWidth={1.6} />
      {/* Head */}
      <rect x={3.25} y={7.75} width={17.5} height={13.5} rx={4.75} {...line} strokeWidth={1.6} />
      <Face mood={mood} line={line} />
    </svg>
  )
}

function Face({ mood, line }: { mood: Mood; line: { stroke: string; strokeLinecap: 'round'; fill: string } }) {
  switch (mood) {
    case 'bored':
      return (
        <>
          {/* Half-lidded: flat lines sitting low, a dead-level mouth */}
          <path d="M6.9 14.3h3.4M13.7 14.3h3.4" {...line} strokeWidth={1.7} />
          <path d="M6.9 12.6h3.4M13.7 12.6h3.4" {...line} strokeWidth={1} opacity={0.55} />
          <path d="M9.8 17.9h4.4" {...line} strokeWidth={1.5} />
        </>
      )
    case 'dramatic':
      return (
        <>
          {/* Wide eyes, brows tilted up in the middle, a small open mouth */}
          <circle cx={8.6} cy={14} r={1.9} {...line} strokeWidth={1.4} />
          <circle cx={15.4} cy={14} r={1.9} {...line} strokeWidth={1.4} />
          <circle cx={8.6} cy={14.2} r={0.8} fill="currentColor" />
          <circle cx={15.4} cy={14.2} r={0.8} fill="currentColor" />
          <path d="M6.8 11.2 10.2 10.4M17.2 11.2 13.8 10.4" {...line} strokeWidth={1.3} />
          <ellipse cx={12} cy={18.1} rx={1.1} ry={0.9} {...line} strokeWidth={1.4} />
        </>
      )
    case 'proud':
      return (
        <>
          {/* Happy closed eyes and a wide, even smile */}
          <path d="M7 14.4c.6-1.1 2.6-1.1 3.2 0M13.8 14.4c.6-1.1 2.6-1.1 3.2 0" {...line} strokeWidth={1.6} />
          <path d="M8.7 16.9c1.9 1.6 4.7 1.6 6.6 0" {...line} strokeWidth={1.6} />
        </>
      )
    case 'smug':
    default:
      return (
        <>
          {/* Left eye open; right eye half-shut under a raised brow; a smirk */}
          <circle cx={8.75} cy={13.75} r={1.45} fill="currentColor" />
          <path d="M13.9 14.1h3.3" {...line} strokeWidth={1.7} />
          <path d="M13.7 11.35 17.4 10.5" {...line} strokeWidth={1.4} />
          <path d="M9.4 17.6c1.7.75 3.6.7 5.4-.55" {...line} strokeWidth={1.5} />
        </>
      )
  }
}
