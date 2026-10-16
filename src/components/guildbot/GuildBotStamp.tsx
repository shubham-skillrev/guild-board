import type { Expression } from '@guildboard/guildbot'
import { Face } from '@/components/guildbot/GuildBotAvatar'
import { cn } from '@/lib/utils/cn'

/**
 * GuildBot as a postage stamp: the flat, 2D version of him for the chat
 * header, so the screen has one GuildBot in the round (the one standing by
 * the dock) and this one on paper. Perforated edge, flat colours, no shading,
 * a postmark across the corner. His face still follows his mood; in the last
 * three asks the stamp goes genie blue.
 */
export function GuildBotStamp({ expression, genie = false, className }: { expression: Expression; genie?: boolean; className?: string }) {
  // Scalloped edge: a rounded rectangle punched with half-circles all round.
  const holes: string[] = []
  for (let x = 6; x <= 38; x += 4) holes.push(`M${x - 1.4} 1a1.4 1.4 0 0 0 2.8 0`, `M${x - 1.4} 51a1.4 1.4 0 0 1 2.8 0`)
  for (let y = 6; y <= 46; y += 4) holes.push(`M1 ${y - 1.4}a1.4 1.4 0 0 1 0 2.8`, `M43 ${y - 1.4}a1.4 1.4 0 0 0 0 2.8`)
  return (
    <svg viewBox="0 0 44 52" width={40} height={47} aria-hidden className={cn('gb-stamp shrink-0', className)} data-genie={genie ? '' : undefined}>
      <rect x={1} y={1} width={42} height={50} rx={2} className="gb-stamp-paper" />
      <path d={holes.join('')} className="gb-stamp-hole" />
      <rect x={4.5} y={4.5} width={35} height={43} rx={1.5} className="gb-stamp-field" />
      {/* Him, flat: head, visor, face, antenna. */}
      <g transform="translate(6 9) scale(0.5)">
        <path d="M32 6.5v6" className="gb-stamp-line" strokeWidth={2.6} strokeLinecap="round" />
        <path d="M32 1 35.5 4.5 32 8 28.5 4.5Z" className="gb-stamp-accent" />
        <rect x={6} y={12} width={52} height={45} rx={19} className="gb-stamp-head" strokeWidth={2.6} />
        <rect x={12.5} y={24} width={39} height={25} rx={12.5} className="gb-stamp-visor" />
        <g style={{ ['--gb-eye' as string]: genie ? '#8EC2FF' : '#F7A851' }}>
          <Face expression={expression} />
        </g>
      </g>
      <text x={22} y={45} textAnchor="middle" fontSize={4.6} fontWeight={800} letterSpacing={0.4} className="gb-stamp-ink">GUILDBOT</text>
      {/* Postmark across the top right. */}
      <g className="gb-stamp-postmark" fill="none" strokeWidth={0.9}>
        <circle cx={37} cy={9} r={6} />
        <path d="M27 6q3-2 6 0t6 0 6 0M27 9.5q3-2 6 0t6 0 6 0M27 13q3-2 6 0t6 0 6 0" />
      </g>
    </svg>
  )
}
