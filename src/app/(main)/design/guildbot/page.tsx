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
import { MiniKers, type MiniBlush, type MiniFace, type MiniShape } from '@/components/kers/MiniKers'

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

const MINI_SHAPES: { shape: MiniShape; label: string }[] = [
  { shape: 'cursor', label: 'Soft cursor' },
  { shape: 'blob', label: 'Round blob' },
  { shape: 'drop', label: 'Gumdrop' },
  { shape: 'hex', label: 'Rounded hex' },
]
const MINI_FACES: MiniFace[] = ['curious', 'happy', 'smug', 'bored', 'shocked', 'sleepy', 'sulky', 'sad', 'proud']
const MINI_BLUSH: { blush: MiniBlush; face: MiniFace; label: string }[] = [
  { blush: null, face: 'curious', label: 'Ordinary day (no blush)' },
  { blush: 'proud', face: 'proud', label: 'Proud · gold' },
  { blush: 'dramatic', face: 'shocked', label: 'Dramatic · red' },
  { blush: 'genie', face: 'happy', label: 'Genie · lavender' },
  { blush: 'meeting', face: 'sulky', label: 'Meeting sulk · plum' },
]

/** The minimal experiment (after grokbots.ai): four shapes, cut-out pill eyes, mint, no limbs, blush for strong moods. */
function MiniSheet() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-footnote font-semibold text-ink mb-4">Four shapes × eight faces</h2>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-x-3 border-spacing-y-2">
            <thead>
              <tr>
                <th />
                {MINI_FACES.map(f => <th key={f} className="text-caption font-normal text-cha">{f}</th>)}
              </tr>
            </thead>
            <tbody>
              {MINI_SHAPES.map(s => (
                <tr key={s.shape}>
                  <th className="text-caption font-normal text-cha text-left pr-2 whitespace-nowrap">{s.label}</th>
                  {MINI_FACES.map(f => <td key={f}><MiniKers shape={s.shape} face={f} size={76} motion="still" /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <Section title="Alive: idling (eyes follow your pointer), hopping, dancing">
        {MINI_SHAPES.map(s => (
          <Cell key={s.shape} label={s.label}>
            <span className="flex items-end gap-2">
              <MiniKers shape={s.shape} size={84} follow />
              <MiniKers shape={s.shape} face="happy" size={64} motion="dance" />
            </span>
          </Cell>
        ))}
      </Section>
      <Section title="Mood in the blush only (strong moods)">
        {MINI_BLUSH.map(b => <Cell key={b.label} label={b.label}><MiniKers shape="blob" face={b.face} blush={b.blush} size={96} /></Cell>)}
      </Section>
      <Section title="At his desk">
        {MINI_SHAPES.map(s => (
          <Cell key={s.shape} label={s.label}>
            <GuildBotScene scene="coding" asks="normal" expression="smug" width={170} figure={size => <MiniKers shape={s.shape} face="curious" size={size} />} />
          </Cell>
        ))}
      </Section>
    </div>
  )
}

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
        <h2 className="text-title-3 text-label mt-2">Minimal Kers <span className="text-label-2">· experiment</span></h2>
        <div className="rounded-(--radius-card) border border-border bg-paper p-6"><MiniSheet /></div>
        <div className="dark rounded-(--radius-card) border border-border bg-parchment p-6"><MiniSheet /></div>
        <h2 className="text-title-3 text-label mt-6">Kers <span className="text-label-2">· live now</span></h2>
        <div className="rounded-(--radius-card) border border-border bg-paper p-6"><Sheet /></div>
        <div className="dark rounded-(--radius-card) border border-border bg-parchment p-6"><Sheet /></div>
      </div>
    </div>
  )
}
