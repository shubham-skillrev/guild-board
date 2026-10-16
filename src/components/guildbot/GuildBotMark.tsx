import type { Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { Kers } from '@/components/kers/Kers'

/**
 * GuildBot's mark, wherever he's named in a line of UI (his posts, the
 * Konami egg, small cards): Kers, small and still, filled with his mood.
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
      <Kers size={size} colour={mood} expression={mood} motion="still" />
    </span>
  )
}
