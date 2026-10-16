import type { Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { PlushBot } from '@/components/guildbot/PlushBot'

/**
 * GuildBot's mark, wherever he's named in a line of UI (his posts, the
 * Konami egg, small cards): the plush, small and still, in his mood's colour
 * and face. No felt fuzz at this size.
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
  return (
    <span role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className={cn('inline-flex shrink-0', className)}>
      <PlushBot size={size} colour={mood} expression={mood} motion="still" limbs={false} />
    </span>
  )
}
