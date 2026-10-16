'use client'

/**
 * GuildBot's character sheet: Kers, the living cursor, drawn in SVG. Every
 * pose, mood, face, cursor state, costume, scene from his day, and size, on
 * light and dark. Not linked from anywhere, like /design: it's where the
 * character gets checked before changes reach the app.
 */
import type { Expression, Variant, Wear } from '@guildboard/guildbot'
import type { KersColour } from '@/components/kers/look'
import { WearContext } from '@/components/guildbot/useWeather'
import { GuildBotScene, type Scene } from '@/components/guildbot/GuildBotScene'
import { Kers, type KersEyes, type KersState, type KersWear } from '@/components/kers/Kers'
import { RIGS, type KersPose } from '@/components/kers/poses'

const POSES = (Object.keys(RIGS) as KersPose[]).filter(p => p !== 'walk-b')
const COLOURS: { colour: KersColour; face: Expression; label: string }[] = [
  { colour: 'smug', face: 'smug', label: 'Smug · tangerine' },
  { colour: 'bored', face: 'bored', label: 'Bored · slate lilac' },
  { colour: 'dramatic', face: 'dramatic', label: 'Dramatic · cherry' },
  { colour: 'proud', face: 'proud', label: 'Proud · sunflower' },
  { colour: 'genie', face: 'excited', label: 'Genie · grape' },
  { colour: 'meeting', face: 'grumpy', label: 'Meeting sulk · teal' },
]
const FACES: Expression[] = ['smug', 'bored', 'dramatic', 'proud', 'relieved', 'excited', 'nosy', 'lonely', 'sleepy', 'grumpy']
const SPECIAL: { eyes: KersEyes; label: string }[] = [
  { eyes: 'happy', label: 'Pleased ^^' },
  { eyes: 'swirl', label: 'Shocked @@' },
  { eyes: 'heart', label: 'Patted ♥' },
]
const STATES: { state: KersState; label: string }[] = [
  { state: 'thinking', label: 'Thinking: loader ring' },
  { state: 'writing', label: 'Writing: I-beam caret' },
  { state: 'pleased', label: 'Pleased: click ripple' },
  { state: 'refusing', label: 'Refusing: not allowed' },
]
const COSTUMES: { label: string; weather: Wear; wear?: KersWear }[] = [
  { label: 'Heatwave', weather: { sunglasses: true, sweat: true } },
  { label: 'Cold', weather: { beanie: true, scarf: true } },
  { label: 'Rain', weather: { umbrella: true } },
  { label: 'Music', weather: {}, wear: 'headphones' },
]
const DAY: { label: string; scene: Scene; variant?: Variant }[] = [
  { label: 'Coding', scene: 'coding' },
  { label: 'Coffee', scene: 'coffee' },
  { label: 'Iced coffee (hot day)', scene: 'coffee', variant: 'iced' },
  { label: 'Lunch', scene: 'lunch' },
  { label: 'Tiffin lunch', scene: 'lunch', variant: 'tiffin' },
  { label: 'Reading', scene: 'learning' },
  { label: 'Music', scene: 'music' },
  { label: 'Guitar', scene: 'music', variant: 'guitar' },
  { label: 'Meditating', scene: 'meditating' },
  { label: 'Waking up', scene: 'waking' },
  { label: 'Brushing', scene: 'brushing' },
  { label: 'Walk', scene: 'walking' },
  { label: 'Too hot: the garden', scene: 'garden' },
  { label: 'Rain: chai at the window', scene: 'rainwatch' },
  { label: 'Meeting sulk', scene: 'meeting' },
  { label: 'Asleep (his house)', scene: 'sleeping' },
]

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <figure className="flex flex-col items-center gap-2">
      <div className="min-h-29.5 flex items-end">{children}</div>
      <figcaption className="text-caption text-cha text-center">{label}</figcaption>
    </figure>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-footnote font-semibold text-ink mb-4">{title}</h2>
      <div className="flex flex-wrap gap-6 items-end">{children}</div>
    </section>
  )
}

function Sheet() {
  return (
    <div className="space-y-10">
      <Section title="Poses (the walk and the dance are live)">
        {POSES.map(p => <Cell key={p} label={p === 'walk-a' ? 'walking' : p}><Kers pose={p} size={120} /></Cell>)}
        <Cell label="dancing"><Kers motion="dance" expression="excited" size={120} /></Cell>
      </Section>
      <Section title="His fill takes his mood (tangerine on an ordinary day)">
        {COLOURS.map(c => <Cell key={c.colour} label={c.label}><Kers colour={c.colour} expression={c.face} size={120} follow /></Cell>)}
      </Section>
      <Section title="Googly eyes, stitched brows">
        {FACES.map(f => <Cell key={f} label={f}><Kers expression={f} size={100} /></Cell>)}
      </Section>
      <Section title="Eyes for a moment">
        {SPECIAL.map(e => <Cell key={e.label} label={e.label}><Kers special={e.eyes} expression="excited" size={100} /></Cell>)}
      </Section>
      <Section title="Away from his desk (walking or dancing)">
        <Cell label="Coding, away"><GuildBotScene scene="coding" asks="normal" expression="smug" away width={150} /></Cell>
        <Cell label="Asleep, away"><GuildBotScene scene="sleeping" asks="normal" expression="smug" away width={150} /></Cell>
      </Section>
      <Section title="Cursor states">
        {STATES.map(s => <Cell key={s.label} label={s.label}><Kers state={s.state} size={100} /></Cell>)}
      </Section>
      <Section title="Dressed by the weather and what he's doing">
        {COSTUMES.map(c => (
          <WearContext.Provider key={c.label} value={c.weather}>
            <Cell label={c.label}><Kers wear={c.wear ?? null} expression={c.label === 'Heatwave' ? 'dramatic' : 'proud'} size={120} /></Cell>
          </WearContext.Provider>
        ))}
      </Section>
      <Section title="His day, and today's take on it">
        {DAY.map(d => (
          <Cell key={d.label} label={d.label}>
            <GuildBotScene scene={d.scene} variant={d.variant ?? null} asks="normal" expression="smug" colour="smug" width={150} />
          </Cell>
        ))}
      </Section>
      <Section title="Sizes">
        {[20, 30, 48, 68, 120].map(s => <Cell key={s} label={`${s}px`}><Kers size={s} /></Cell>)}
      </Section>
    </div>
  )
}

export default function GuildBotSheet() {
  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-5xl mx-auto">
      <h1 className="text-title-1 text-label">Kers <span className="text-label-2">· GuildBot</span></h1>
      <p className="text-callout text-label-2 mt-1.5 max-w-prose">The mouse cursor come to life, drawn and animated in SVG. Not linked from the app.</p>
      <div className="mt-8 grid gap-6">
        <div className="rounded-(--radius-card) border border-border bg-paper p-6"><Sheet /></div>
        <div className="dark rounded-(--radius-card) border border-border bg-parchment p-6"><Sheet /></div>
      </div>
    </div>
  )
}
