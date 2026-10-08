'use client'

import { useState } from 'react'
import { Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea, Label, CharCount } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { KINDS, type Kind } from '@/lib/kinds'
import { CATEGORY_LABELS, CATEGORY_TONE } from '@/lib/constants'
import { THEME_LIMITS, sanitizeTheme, type CycleTheme } from '@/lib/themes'
import { cn } from '@/lib/utils/cn'

const BLANK: CycleTheme = {
  name: '',
  title: '',
  accent: '',
  subtitle: '',
  blurb: '',
  cta: '',
  featured_kind: 'learned',
  open_line: '',
}

type TextField = keyof typeof THEME_LIMITS

const FIELDS: { key: TextField; label: string; hint: string; long?: boolean }[] = [
  { key: 'name', label: 'Name', hint: 'For the admin list. "Problem Month"' },
  { key: 'title', label: 'Headline', hint: 'Landing page. "Bring a problem."' },
  { key: 'accent', label: 'Accent word', hint: 'Optional. One word of the headline, set in italic' },
  { key: 'subtitle', label: 'Board subtitle', hint: "\"This month's theme: bring a problem\"" },
  { key: 'blurb', label: 'Landing blurb', hint: 'What to bring and why, with examples', long: true },
  { key: 'cta', label: 'Share button', hint: '"Share a problem"' },
  { key: 'open_line', label: 'Month-open message', hint: 'The push and Slack line when the month opens', long: true },
]

/** True when the theme would be accepted as it stands. */
export function isThemeComplete(theme: CycleTheme | null): boolean {
  return theme === null || sanitizeTheme(theme) !== null
}

/**
 * Pick a month's theme: ask Gemini for three, take one as a starting point or
 * write your own, then edit every word. `null` is "no theme", a plain month.
 * The parent decides when to save; this only edits.
 */
export function ThemeEditor({
  monthLabel,
  value,
  onChange,
}: {
  monthLabel: string
  value: CycleTheme | null
  onChange: (theme: CycleTheme | null) => void
}) {
  const toast = useToast()
  const [brief, setBrief] = useState('')
  const [options, setOptions] = useState<CycleTheme[]>([])
  const [busy, setBusy] = useState(false)

  const suggest = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'suggest', month_label: monthLabel, brief }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not get themes')
      setOptions(data.themes)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not get themes', 'error')
    } finally {
      setBusy(false)
    }
  }

  const set = (key: TextField, v: string) => value && onChange({ ...value, [key]: v })

  return (
    <div className="space-y-4">
      {/* Gemini first: three options to react to beat a blank form. */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex-1 min-w-[12rem]">
          <Label htmlFor="theme-brief">Direction for Gemini (optional)</Label>
          <Input
            id="theme-brief"
            value={brief}
            onChange={e => setBrief(e.target.value)}
            maxLength={300}
            placeholder="e.g. something about debugging war stories"
          />
        </div>
        <Button variant="tinted" icon={Sparkle} onClick={suggest} disabled={busy}>
          {busy ? 'Thinking…' : options.length ? 'Suggest again' : `Suggest themes for ${monthLabel}`}
        </Button>
        {!value && (
          <Button variant="ghost" onClick={() => onChange({ ...BLANK })}>
            Write my own
          </Button>
        )}
      </div>

      {options.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-3">
          {options.map(o => (
            <li key={o.name}>
              <button
                type="button"
                onClick={() => onChange({ ...BLANK, ...o })}
                className={cn(
                  'w-full h-full text-left rounded-(--radius-control) border p-3 transition-colors',
                  value?.name === o.name ? 'border-saffron/50 bg-saffron/8' : 'border-border hover:border-border-strong hover:bg-sumi/60',
                )}
              >
                <Badge tone={CATEGORY_TONE[o.featured_kind] ?? 'neutral'} dot>
                  {CATEGORY_LABELS[o.featured_kind] ?? o.featured_kind}
                </Badge>
                <span className="mt-1.5 block text-[14px] font-semibold text-ink leading-snug">{o.name}</span>
                <span className="mt-0.5 block text-[13px] text-ink-soft">{o.title}</span>
                <span className="mt-1.5 block text-[12px] text-cha leading-relaxed line-clamp-4">{o.blurb}</span>
                <span className="mt-2 block text-[12px] font-medium text-saffron">
                  {value?.name === o.name ? 'Using this' : 'Use this'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value && (
        <div className="space-y-3 rounded-(--radius-control) border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map(f => (
              <div key={f.key} className={f.long ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`theme-${f.key}`}>{f.label}</Label>
                {f.long ? (
                  <Textarea
                    id={`theme-${f.key}`}
                    rows={2}
                    value={value[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    maxLength={THEME_LIMITS[f.key]}
                    placeholder={f.hint}
                    className="font-sans"
                  />
                ) : (
                  <Input
                    id={`theme-${f.key}`}
                    value={value[f.key] ?? ''}
                    onChange={e => set(f.key, e.target.value)}
                    maxLength={THEME_LIMITS[f.key]}
                    placeholder={f.hint}
                  />
                )}
                <CharCount value={value[f.key] ?? ''} max={THEME_LIMITS[f.key]} />
              </div>
            ))}
            <div>
              <Label htmlFor="theme-kind">Featured kind</Label>
              <select
                id="theme-kind"
                value={value.featured_kind}
                onChange={e => onChange({ ...value, featured_kind: e.target.value as Kind })}
                className="w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-footnote text-ink focus:outline-none focus:border-saffron/50"
              >
                {KINDS.map(k => (
                  <option key={k.value} value={k.value}>{k.label}</option>
                ))}
              </select>
              <p className="text-[11px] text-cha mt-1">The share form opens on it, tagged &quot;this month&quot;.</p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] text-cha">
              {isThemeComplete(value) ? 'Ready.' : 'Fill in every field except the accent word.'}
            </p>
            <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
              No theme this month
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
