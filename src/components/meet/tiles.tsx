import { cn } from '@/lib/utils/cn'

/**
 * A poll option's tile identity, the same on the shared screen and on every
 * phone, so people match screen to phone at a glance: a shape and a soft
 * colour per option (the guild's own tokens at low alpha; saffron stays the
 * presenter's button). Full class strings, so Tailwind finds them.
 */
export const TILES = [
  { shape: 'triangle', name: 'Triangle', ink: 'text-vermillion', tile: 'bg-vermillion/[0.08] border-vermillion/25 dark:bg-vermillion/[0.12]', fill: 'bg-vermillion/[0.16] dark:bg-vermillion/[0.22]', bar: 'bg-vermillion/70', on: 'bg-vermillion/[0.2] border-vermillion/70 dark:bg-vermillion/[0.28]' },
  { shape: 'diamond', name: 'Diamond', ink: 'text-indigo-jp', tile: 'bg-indigo-jp/[0.07] border-indigo-jp/25 dark:bg-indigo-jp/[0.12]', fill: 'bg-indigo-jp/[0.15] dark:bg-indigo-jp/[0.22]', bar: 'bg-indigo-jp/70', on: 'bg-indigo-jp/[0.2] border-indigo-jp/70 dark:bg-indigo-jp/[0.28]' },
  { shape: 'circle', name: 'Circle', ink: 'text-matcha', tile: 'bg-matcha/[0.07] border-matcha/25 dark:bg-matcha/[0.12]', fill: 'bg-matcha/[0.15] dark:bg-matcha/[0.22]', bar: 'bg-matcha/70', on: 'bg-matcha/[0.2] border-matcha/70 dark:bg-matcha/[0.28]' },
  { shape: 'square', name: 'Square', ink: 'text-wisteria', tile: 'bg-wisteria/[0.08] border-wisteria/25 dark:bg-wisteria/[0.13]', fill: 'bg-wisteria/[0.16] dark:bg-wisteria/[0.24]', bar: 'bg-wisteria/70', on: 'bg-wisteria/[0.2] border-wisteria/70 dark:bg-wisteria/[0.3]' },
] as const

export type Tile = (typeof TILES)[number]
export const tileFor = (i: number): Tile => TILES[i % TILES.length]

/** The option's shape, filled in its colour. Decorative: the option's text is its name. */
export function OptionShape({ i, size = 20, className }: { i: number; size?: number; className?: string }) {
  const t = tileFor(i)
  return (
    <svg aria-hidden viewBox="0 0 20 20" width={size} height={size} className={cn('shrink-0', t.ink, className)}>
      {t.shape === 'triangle' && <path d="M10 2.5 18 17H2z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="1.5" />}
      {t.shape === 'diamond' && <path d="M10 1.5 18.5 10 10 18.5 1.5 10z" fill="currentColor" strokeLinejoin="round" stroke="currentColor" strokeWidth="1" />}
      {t.shape === 'circle' && <circle cx="10" cy="10" r="8" fill="currentColor" />}
      {t.shape === 'square' && <rect x="2.5" y="2.5" width="15" height="15" rx="2.5" fill="currentColor" />}
    </svg>
  )
}
