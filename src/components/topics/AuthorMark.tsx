import { UserAvatar } from '@/components/ui/UserAvatar'
import { SYSTEM_DISPLAY_NAME } from '@/lib/system/identity'
import { cn } from '@/lib/utils/cn'
import { GuildBotMark } from '@/components/guildbot/GuildBotMark'

/**
 * Who posted it. A person gets their avatar and @handle; GuildBot's
 * suggestions get its face, the name, and a "Suggested" tag, so nobody
 * mistakes a system pick for a colleague's post.
 */
export function AuthorMark({
  username,
  isSystem,
  size = 16,
  className,
  tag = 'Suggested',
}: {
  username: string | null | undefined
  isSystem?: boolean
  /** The pill after GuildBot's name: "Suggested" on topics, "Bot" in comments. */
  tag?: string
  size?: number
  className?: string
}) {
  if (isSystem) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
        <span
          aria-hidden
          style={{ width: size, height: size }}
          className="inline-flex items-center justify-center rounded-full bg-saffron-light text-ink shrink-0"
        >
          <GuildBotMark size={Math.round(size * 0.78)} />
        </span>
        <span className="font-medium text-ink-soft truncate">{SYSTEM_DISPLAY_NAME}</span>
        <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] leading-4 text-cha">{tag}</span>
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
      <UserAvatar username={username ?? 'user'} size={size} />
      <span className="text-ink-soft truncate">@{username}</span>
    </span>
  )
}
