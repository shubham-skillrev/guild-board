'use client'

/**
 * The component sheet.
 *
 * Not a product screen and not linked from anywhere. It exists so the design
 * system can be looked at directly instead of being inferred from whichever
 * screen happens to use a component. Every token and every primitive state
 * renders here, so a change to `globals.css` is visible in one place before it
 * reaches the app.
 *
 * Delete this route once the system is settled and the app is the reference.
 */

import { useState } from 'react'
import {
  ArrowBigUp,
  Calendar,
  CircleCheck,
  Handshake,
  Lightbulb,
  MessageSquare,
} from 'lucide-react'

import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Surface } from '@/components/ui/Surface'
import { Sheet } from '@/components/ui/Sheet'
import { Label, Input, Textarea, CharCount } from '@/components/ui/Field'
import {
  PageHeader,
  SectionHeader,
  StatTile,
  EmptyState,
  CardSkeleton,
  RowGroup,
  Row,
} from '@/components/ui/Section'
import { Icon } from '@/components/ui/Icon'

const SURFACES = [
  { token: '--color-parchment', value: '#08080C', role: 'L0 page ground' },
  { token: '--color-paper', value: '#101016', role: 'L1 cards, rows' },
  { token: '--color-sumi', value: '#161620', role: 'L2 sheets, modals' },
  { token: '--color-kinu', value: '#1E1E2A', role: 'L3 menus, popovers' },
]

const CONTENT = [
  { cls: 'text-label', role: 'Primary. Titles and body' },
  { cls: 'text-label-2', role: 'Secondary. Subtitles, metadata' },
  { cls: 'text-label-3', role: 'Tertiary. Hints, spent state' },
  { cls: 'text-label-4', role: 'Quaternary. Disabled only' },
]

const ACCENTS = [
  { token: '--color-accent', cls: 'bg-accent', role: 'Actions. The only accent' },
  { token: '--color-success', cls: 'bg-success', role: 'State: succeeded' },
  { token: '--color-danger', cls: 'bg-danger', role: 'State: destructive' },
]

const TYPE = [
  { cls: 'text-display', name: 'Display', spec: '32 / 36 / 600' },
  { cls: 'text-title', name: 'Title', spec: '22 / 28 / 600' },
  { cls: 'text-heading', name: 'Heading', spec: '17 / 24 / 600' },
  { cls: 'text-body', name: 'Body', spec: '15 / 22 / 400' },
  { cls: 'text-footnote', name: 'Footnote', spec: '13 / 18 / 500' },
  { cls: 'text-meta', name: 'Meta', spec: '11 / 14 / 500' },
]

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mb-(--gap-section)">
      <SectionHeader title={title} hint={hint} />
      {children}
    </section>
  )
}

export default function DesignSheet() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [note, setNote] = useState('')

  return (
    <div className="px-(--pad-page-x) py-8 w-full max-w-(--measure-wide) mx-auto pb-28 md:pb-10">
      <PageHeader
        title="Design system"
        subtitle="Every token and every primitive state. Not a product screen. Change globals.css and check the result here first."
      />

      <Block title="Surfaces" hint="depth from lightness, shadow only reinforces">
        <RowGroup>
          {SURFACES.map(s => (
            <Row key={s.token}>
              <span
                className="w-9 h-9 rounded-(--radius-control) border border-separator shrink-0"
                style={{ background: s.value }}
              />
              <span className="text-body text-label flex-1 min-w-0">{s.role}</span>
              <span className="num text-meta text-label-3">{s.value}</span>
            </Row>
          ))}
        </RowGroup>
      </Block>

      <Block title="Content" hint="one tinted near-white at four opacities">
        <RowGroup>
          {CONTENT.map(c => (
            <Row key={c.cls}>
              <span className={`text-body flex-1 ${c.cls}`}>The quick brown fox</span>
              <span className="num text-meta text-label-3">{c.cls}</span>
            </Row>
          ))}
        </RowGroup>
      </Block>

      <Block title="Accent and state" hint="one accent, two states, nothing decorative">
        <RowGroup>
          {ACCENTS.map(a => (
            <Row key={a.token}>
              <span className={`w-9 h-9 rounded-(--radius-control) shrink-0 ${a.cls}`} />
              <span className="text-body text-label flex-1 min-w-0">{a.role}</span>
              <span className="num text-meta text-label-3">{a.token}</span>
            </Row>
          ))}
        </RowGroup>
      </Block>

      <Block title="Type scale" hint="six steps, nothing heavier than 600">
        <Surface level={1} className="p-(--pad-card) space-y-4">
          {TYPE.map(t => (
            <div key={t.cls} className="flex items-baseline gap-4">
              <span className={`${t.cls} text-label flex-1 min-w-0 truncate`}>
                Ship what the guild decided
              </span>
              <span className="num text-meta text-label-3 shrink-0">{t.spec}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-separator flex items-baseline gap-4">
            <span className="num text-body text-label flex-1">1247 &middot; 03 &middot; 89.4</span>
            <span className="text-meta text-label-3 shrink-0">.num, tabular</span>
          </div>
        </Surface>
      </Block>

      <Block title="Elevation" hint="tinted shadows, never pure black on a near-black ground">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-(--gap-list)">
          {([1, 2, 3] as const).map(level => (
            <Surface key={level} level={level} className="p-(--pad-card)">
              <p className="text-heading text-label">Level {level}</p>
              <p className="text-footnote text-label-2 mt-1">
                {level === 1 ? 'Cards and rows' : level === 2 ? 'Sheets and modals' : 'Menus and popovers'}
              </p>
            </Surface>
          ))}
        </div>
      </Block>

      <Block title="Buttons" hint="height from --control-h: 44px touch, 36px pointer">
        <Surface level={1} className="p-(--pad-card) flex flex-wrap items-center gap-3">
          <Button variant="primary">Pitch an idea</Button>
          <Button variant="secondary">Bank it</Button>
          <Button variant="ghost">Cancel</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="primary" size="sm">Small</Button>
          <Button variant="primary" disabled>Disabled</Button>
        </Surface>
      </Block>

      <Block title="Chips" hint="four tones, because a category is a label and only state earns colour">
        <Surface level={1} className="p-(--pad-card) flex flex-wrap items-center gap-2">
          <Chip>Deep dive</Chip>
          <Chip tone="accent">Selected</Chip>
          <Chip tone="success">Shipped</Chip>
          <Chip tone="danger">Dropped</Chip>
          <Chip icon={Lightbulb}>With icon</Chip>
        </Surface>
      </Block>

      <Block title="Fields" hint="inputs sit on a fill, so a form reads as recessed into its card">
        <Surface level={1} className="p-(--pad-card) space-y-4 max-w-(--measure-read)">
          <div>
            <Label htmlFor="ds-title">Title</Label>
            <Input id="ds-title" placeholder="What should the guild look at?" />
          </div>
          <div>
            <Label htmlFor="ds-note">Why it matters</Label>
            <Textarea
              id="ds-note"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="One line is enough."
            />
            <CharCount value={note} max={280} />
          </div>
        </Surface>
      </Block>

      <Block title="Stat tiles" hint="a number with its meaning attached, tone carries urgency">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-(--gap-list)">
          <StatTile icon={Calendar} value={3} label="days to meeting" tone="active" />
          <StatTile icon={ArrowBigUp} value={2} label="votes left" tone="default" />
          <StatTile icon={Handshake} value={0} label="hand raises" tone="spent" />
          <StatTile icon={CircleCheck} value="1" label="idea pitched" tone="default" />
        </div>
      </Block>

      <Block title="Loading" hint="skeletons match the shape of what arrives">
        <CardSkeleton count={2} />
      </Block>

      <Block title="Empty" hint="an invitation to act, not a shrug">
        <EmptyState
          icon={Lightbulb}
          title="Nothing pitched yet"
          body="Be the first. One good question is enough to start a cycle."
          action={<Button>Pitch an idea</Button>}
        />
      </Block>

      <Block title="Rows" hint="grouped list, which reads better than stacked cards for dense content">
        <RowGroup>
          <Row onClick={() => {}}>
            <Icon icon={MessageSquare} className="text-label-3" />
            <span className="text-body text-label flex-1">How we handle flaky tests</span>
            <span className="num text-meta text-label-3">12</span>
          </Row>
          <Row onClick={() => {}}>
            <Icon icon={Lightbulb} className="text-label-3" />
            <span className="text-body text-label flex-1">Retiring the monolith cron</span>
            <span className="num text-meta text-label-3">7</span>
          </Row>
        </RowGroup>
      </Block>

      <Block title="Sheet" hint="bottom sheet on phone, centred dialog on desktop">
        <Surface level={1} className="p-(--pad-card)">
          <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
        </Surface>
        {sheetOpen && (
          <Sheet onClose={() => setSheetOpen(false)} title="Bank an idea">
            <div className="space-y-4">
              <p className="text-body text-label-2">
                On a phone this enters from the bottom edge with a grab handle. On a
                pointer it is a centred dialog. A centred dialog on a tall phone puts
                its controls in the dead zone above the thumb.
              </p>
              <Button onClick={() => setSheetOpen(false)}>Close</Button>
            </div>
          </Sheet>
        )}
      </Block>
    </div>
  )
}
