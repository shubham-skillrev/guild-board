import { cn } from '@/lib/utils/cn'

/**
 * GuildBot's face. A rounded head with the board's ◈ diamond for an antenna,
 * one eye open and one half-shut under a raised brow, and a lopsided smirk:
 * unimpressed, but fond of you. Line work takes the text colour; the diamond
 * is always saffron so it reads as GuildBoard's mark.
 */
export function GuildBotMark({ size = 20, className, title }: { size?: number; className?: string; title?: string }) {
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
      <path d="M12 5.75v2" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
      {/* Head */}
      <rect x={3.25} y={7.75} width={17.5} height={13.5} rx={4.75} stroke="currentColor" strokeWidth={1.6} />
      {/* Left eye: open */}
      <circle cx={8.75} cy={13.75} r={1.45} fill="currentColor" />
      {/* Right eye: half-shut, under a raised brow */}
      <path d="M13.9 14.1h3.3" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" />
      <path d="M13.7 11.35 17.4 10.5" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      {/* Smirk: lifts on one side */}
      <path d="M9.4 17.6c1.7.75 3.6.7 5.4-.55" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}
