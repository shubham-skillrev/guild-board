'use client'

import { SegmentedControl } from '@/components/ui/SegmentedControl'

/* Filter by what you have time for, not by where it came from. "Read" folds
   articles and reported pieces together because the decision a member is
   making is fifteen minutes of reading versus ten of watching. */
export type Format = 'all' | 'read' | 'watch'

export const FORMATS: { key: Format; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'read', label: 'Read' },
  { key: 'watch', label: 'Watch' },
]

/**
 * Format filter: Everything | Read | Watch, side by side.
 *
 * It was a dropdown for a while, on the theory that a filter is furniture.
 * With three one-word choices the dropdown only added a tap and hid the
 * options, and its menu never matched the rest of the page, so it is a
 * segmented control: every option visible, one tap to switch, same height as
 * the buttons and chips around it.
 */
export function FormatFilter({
  value,
  onChange,
}: {
  value: Format
  onChange: (next: Format) => void
}) {
  return <SegmentedControl label="Format" options={FORMATS} value={value} onChange={onChange} />
}
