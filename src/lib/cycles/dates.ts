/**
 * Meeting-date arithmetic, in one place. The guild meets in India, so "the
 * day" is always an Asia/Kolkata calendar day, whatever the server's zone.
 *
 * Free of server-only imports: the admin form and the meeting pill use it.
 */

/** IST is a fixed +05:30, no daylight saving. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000

/** Day of the month of the 2nd Friday, e.g. 13 for November 2026. */
export function secondFridayDay(year: number, month: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  return 1 + ((5 - firstDow + 7) % 7) + 7
}

/** The default meeting: 2nd Friday of the month, 11:00 IST. */
export function defaultMeetingAt(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, secondFridayDay(year, month), 11) - IST_OFFSET_MS)
}

/** "2026-11-13": the calendar day an instant falls on in IST. */
export function istDate(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10)
}

/** Whole IST calendar days from `from` to `to`; 0 on the same day. */
export function istDaysBetween(from: Date, to: Date): number {
  const a = Date.parse(`${istDate(from)}T00:00:00Z`)
  const b = Date.parse(`${istDate(to)}T00:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

/** The month after (year, month). */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

/** "November 2026", the label format cycles have always used. */
export function cycleLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}
