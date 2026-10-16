'use client'

/**
 * GuildBot's character sheet: the plush, every colour, face, move, job and
 * costume, on light and dark. Not linked from anywhere, like /design: it's
 * where the character gets signed off before it reaches the app.
 */
import { useState } from 'react'
import type { Expression } from '@guildboard/guildbot'
import { PlushBot, type PlushColour, type PlushHands, type PlushMotion, type PlushWear } from '@/components/guildbot/PlushBot'
import { WearContext } from '@/components/guildbot/useWeather'
import type { Variant, Wear } from '@guildboard/guildbot'
import { GuildBotScene, type Scene } from '@/components/guildbot/GuildBotScene'

const COLOURS: { colour: PlushColour; face: Expression; label: string }[] = [
  { colour: 'smug', face: 'smug', label: 'Smug · saffron' },
  { colour: 'bored', face: 'bored', label: 'Bored · lilac' },
  { colour: 'dramatic', face: 'dramatic', label: 'Dramatic · tomato' },
  { colour: 'proud', face: 'proud', label: 'Proud · gold' },
  { colour: 'genie', face: 'excited', label: 'Genie · blue' },
  { colour: 'meeting', face: 'grumpy', label: 'Meeting sulk · plum' },
]
const FACES: Expression[] = ['smug', 'bored', 'dramatic', 'proud', 'relieved', 'excited', 'nosy', 'lonely', 'sleepy', 'grumpy']
const MOTIONS: PlushMotion[] = ['idle', 'dance', 'stretch', 'walk']
const HANDS: PlushHands[] = ['rest', 'typing', 'mug', 'wave', 'brush']
const COSTUMES: { label: string; weather: Wear; wear?: PlushWear }[] = [
  { label: 'Heatwave', weather: { sunglasses: true, sweat: true } },
  { label: 'Cold', weather: { beanie: true, scarf: true } },
  { label: 'Rain', weather: { umbrella: true } },
  { label: 'Music', weather: {}, wear: 'headphones' },
  { label: 'Asleep', weather: {}, wear: 'sleepmask' },
]

const DAY: { label: string; scene: Scene; variant?: Variant }[] = [
  { label: 'Coding', scene: 'coding' },
  { label: 'Coffee', scene: 'coffee' },
  { label: 'Iced coffee (hot day)', scene: 'coffee', variant: 'iced' },
  { label: 'Lunch', scene: 'lunch' },
  { label: 'Tiffin lunch', scene: 'lunch', variant: 'tiffin' },
  { label: 'Music', scene: 'music' },
  { label: 'Guitar', scene: 'music', variant: 'guitar' },
  { label: 'Walk', scene: 'walking' },
  { label: 'Too hot: the garden', scene: 'garden' },
  { label: 'Rain: chai at the window', scene: 'rainwatch' },
  { label: 'Meeting sulk', scene: 'meeting' },
]

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="h-[118px] flex items-end">{children}</div>
      <figcaption className="text-caption text-cha text-center">{label}</figcaption>
    </figure>
  )
}

function Sheet() {
  const [hop, setHop] = useState(0)
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Colour follows his mood (and two moments)</h2>
        <div className="flex flex-wrap gap-8">
          {COLOURS.map(c => <Cell key={c.colour} label={c.label}><PlushBot colour={c.colour} expression={c.face} size={96} follow /></Cell>)}
        </div>
      </section>
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Faces: googly eyes, no mouth</h2>
        <div className="flex flex-wrap gap-6">
          {FACES.map(f => <Cell key={f} label={f}><PlushBot expression={f} size={80} /></Cell>)}
        </div>
      </section>
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Toy physics</h2>
        <div className="flex flex-wrap gap-8 items-end">
          {MOTIONS.map(m => <Cell key={m} label={m}><PlushBot motion={m} expression={m === 'dance' ? 'excited' : m === 'stretch' ? 'relieved' : 'smug'} size={90} /></Cell>)}
          <Cell label="hop (one-shot)">
            <button type="button" onClick={() => setHop(h => h + 1)} className="flex flex-col items-center gap-1">
              <PlushBot key={hop} motion={hop ? 'hop' : 'idle'} expression="excited" size={90} />
              <span className="text-caption text-saffron">replay</span>
            </button>
          </Cell>
        </div>
      </section>
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Floating hands and feet, on faint lines</h2>
        <div className="flex flex-wrap gap-10">
          {HANDS.map(h => <Cell key={h} label={h}><PlushBot hands={h} expression={h === 'wave' ? 'excited' : h === 'mug' ? 'relieved' : 'smug'} size={90} /></Cell>)}
        </div>
      </section>
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Dressed by the weather and the hour</h2>
        <div className="flex flex-wrap gap-10">
          {COSTUMES.map(c => (
            <WearContext.Provider key={c.label} value={c.weather}>
              <Cell label={c.label}><PlushBot wear={c.wear} expression={c.wear === 'sleepmask' ? 'sleepy' : c.label === 'Heatwave' ? 'dramatic' : 'proud'} size={90} /></Cell>
            </WearContext.Provider>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">His day, and today&rsquo;s take on it</h2>
        <div className="flex flex-wrap gap-6 items-end">
          {DAY.map(d => (
            <Cell key={d.label} label={d.label}>
              <GuildBotScene scene={d.scene} variant={d.variant ?? null} asks="normal" left={null} expression="smug" colour={d.scene === 'meeting' ? 'meeting' : 'smug'} width={150} />
            </Cell>
          ))}
        </div>
      </section>
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Sizes (felt fuzz from 56px up)</h2>
        <div className="flex flex-wrap gap-8 items-end">
          {[24, 40, 64, 120].map(s => <Cell key={s} label={`${s}px`}><PlushBot size={s} /></Cell>)}
        </div>
      </section>
    </div>
  )
}

export default function GuildBotSheet() {
  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-5xl mx-auto">
      <h1 className="text-title-1 text-label">GuildBot, the plush</h1>
      <p className="text-callout text-label-2 mt-1.5 max-w-prose">Character sheet for sign-off. Not linked from the app.</p>
      <div className="mt-8 grid gap-6">
        <div className="rounded-(--radius-card) border border-border bg-paper p-6"><Sheet /></div>
        <div className="dark rounded-(--radius-card) border border-border bg-parchment p-6"><Sheet /></div>
      </div>
    </div>
  )
}
