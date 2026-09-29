import { UserAvatar } from '@/components/ui/UserAvatar'
import { SYSTEM_DISPLAY_NAME } from '@/lib/system/identity'
import { cn } from '@/lib/utils/cn'

/**
 * Who posted it. A person gets their avatar and @handle; GuildBoard's own
 * suggestions get the ◈ mark, the name, and a "Suggested" tag, so nobody
 * mistakes a system pick for a colleague's post.
 */
export function AuthorMark({
  username,
  isSystem,
  size = 16,
  className,
}: {
  username: string | null | undefined
  isSystem?: boolean
  size?: number
  className?: string
}) {
  if (isSystem) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 min-w-0', className)}>
        <span
          aria-hidden
          style={{ width: size, height: size, fontSize: Math.round(size * 0.62) }}
          className="inline-flex items-center justify-center rounded-full bg-saffron-light text-saffron shrink-0"
        >
          ◈
        </span>
        <span className="font-medium text-ink-soft truncate">{SYSTEM_DISPLAY_NAME}</span>
        <span className="shrink-0 rounded-full border border-border px-1.5 text-[10px] leading-4 text-cha">Suggested</span>
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
