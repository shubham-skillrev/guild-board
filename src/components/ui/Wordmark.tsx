import { cn } from '@/lib/utils/cn'

/**
 * The lockup: `◈ guildboard by SkillRev`, the same pattern as
 * `aiden by SkillRev`, so the two read as one family. The company name is part
 * of the brand, not a line in the footer.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    // Never wraps. On the narrowest phones the byline steps aside so the
    // header's actions keep their room; from 400px up the full lockup shows.
    <span className={cn('inline-flex items-baseline gap-2 whitespace-nowrap', className)}>
      <span className="inline-flex items-center gap-1.5 text-[16px] font-semibold tracking-[-0.02em] text-ink">
        <span className="text-saffron" aria-hidden>◈</span>
        guildboard
      </span>
      <span className="hidden min-[400px]:inline font-mono text-[11px] text-cha">by SkillRev</span>
    </span>
  )
}
