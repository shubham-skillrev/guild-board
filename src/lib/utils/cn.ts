import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * The type scale in globals.css (text-footnote, text-title-1, ...) is custom,
 * so tailwind-merge did not know these are font sizes. It read `text-footnote`
 * as a text colour, and when a real colour like `text-parchment` came later in
 * the same class list it dropped `text-footnote` as a conflict. Buttons and
 * chips then fell back to the inherited 16px. Registering the scale as font
 * sizes makes a colour and a size coexist, as they should.
 */
const TYPE_SCALE = [
  'display', 'title', 'title-1', 'title-2', 'title-3', 'heading',
  'body', 'footnote', 'callout', 'meta', 'caption',
]

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: TYPE_SCALE }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
