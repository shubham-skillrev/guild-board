'use client'

import type { HourScene } from '@/lib/hours/scenes'
import { Kers } from '@/components/kers/Kers'
import { GuildBotScene } from '@/components/guildbot/GuildBotScene'

/**
 * The guild building at one hour of the day: sky, a skyline behind, the
 * building with its sixteen windows, GuildBot in his ground-floor shop
 * window doing whatever his day says, and the street out front (a lamp post,
 * the chai cart, steam off the kettle).
 *
 * On /hours the lit windows are the scene's story. The focus room passes
 * `windows` instead (live, anonymous: '1' focusing, 'b' on a break, '0'
 * empty) and `you` to mark the viewer's own window, on their screen only.
 * Motion is CSS (globals.css, .gb-building) and stops under reduced motion.
 */
export function GuildBuilding({
  scene,
  windows,
  you,
  className,
}: {
  scene: HourScene
  /** Sixteen characters, top floor first: '1' lit, 'b' on a break, '0' dark. */
  windows?: string
  /** The viewer's own window (0 to 15), marked for them alone. */
  you?: number | null
  className?: string
}) {
  const night = scene.tone === 'light'
  const pattern = (windows ?? scene.windows).padEnd(16, '0').slice(0, 16)
  const c = night
    ? { facade: '#2A2C3A', facadeSide: '#1E2030', trim: '#11121A', glassOff: '#151A2C', skyline: '#141932', pavement: '#2A2B33', road: '#1A1B21', line: '#3A3B45', sign: '#E8B04B' }
    : { facade: '#E9DCC6', facadeSide: '#D4C2A6', trim: '#3A2E22', glassOff: '#BFD7EA', skyline: '#9DB5C9', pavement: '#BDB4A6', road: '#8E877D', line: '#F2EEE6', sign: '#A34C07' }
  const cols = [108, 158, 208, 258]
  const floors = [104, 152, 200, 248]

  return (
    <svg viewBox="0 0 400 440" className={className} role="img" aria-label={`The guild building at ${scene.name.toLowerCase()}`} data-night={night ? '' : undefined}>
      <defs>
        <linearGradient id="gb-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={scene.sky[0]} />
          <stop offset="100%" stopColor={scene.sky[1]} />
        </linearGradient>
        <linearGradient id="gb-lit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFE3A3" />
          <stop offset="100%" stopColor="#F2A84B" />
        </linearGradient>
        <linearGradient id="gb-break" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9CC8FF" />
          <stop offset="100%" stopColor="#4C7FD8" />
        </linearGradient>
        <radialGradient id="gb-glow">
          <stop offset="0%" stopColor="#FFD27A" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#FFD27A" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="gb-sunglow">
          <stop offset="0%" stopColor="#FFF1C2" stopOpacity={0.9} />
          <stop offset="100%" stopColor="#FFF1C2" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Sky. */}
      <rect width={400} height={440} fill="url(#gb-sky)" />
      {scene.stars && (
        <g className="gb-stars" fill="#FFFFFF">
          {STARS.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
        </g>
      )}
      {scene.celestial?.kind === 'sun' && (
        <g>
          <circle cx={scene.celestial.x} cy={scene.celestial.y} r={42} fill="url(#gb-sunglow)" />
          <circle cx={scene.celestial.x} cy={scene.celestial.y} r={16} fill="#FFE6A0" />
        </g>
      )}
      {scene.celestial?.kind === 'moon' && (
        <path
          d={`M${scene.celestial.x} ${scene.celestial.y - 15}a15 15 0 1 0 12 24 12 12 0 1 1-12-24Z`}
          fill="#F4E7B8"
        />
      )}

      {/* The city behind. */}
      <path d="M0 250h30v-40h24v20h20v-60h26v80h10v40H0ZM330 220h22v-50h30v30h18v100h-70Z" fill={c.skyline} opacity={0.85} />

      {/* Roof: water tank, the antenna with the board's ◈, and the sign. */}
      <g>
        <path d="M118 92V70M146 92V70" stroke={c.trim} strokeWidth={2} />
        <rect x={112} y={46} width={40} height={26} rx={4} fill={c.facadeSide} stroke={c.trim} strokeWidth={2} />
        <path d="M116 52h32M116 58h32M116 64h32" stroke={c.trim} strokeOpacity={0.3} strokeWidth={1} />
        <path d="M282 92V40" stroke={c.trim} strokeWidth={2} />
        <path className="gb-beacon" d="M282 28l6 6-6 6-6-6Z" fill="#E8913A" stroke={c.trim} strokeWidth={1} />
        <rect x={166} y={70} width={98} height={18} rx={3} fill={c.trim} />
        <text x={215} y={83} textAnchor="middle" fontSize={10} fontWeight={800} letterSpacing={1.6} fill={c.sign}>GUILDBOARD</text>
      </g>

      {/* The building. */}
      <rect x={90} y={92} width={220} height={292} fill={c.facade} stroke={c.trim} strokeWidth={2.5} />
      <rect x={84} y={88} width={232} height={8} rx={2} fill={c.facadeSide} stroke={c.trim} strokeWidth={2} />
      <path d="M90 300h220" stroke={c.trim} strokeWidth={2} />

      {/* Sixteen windows. */}
      {floors.map((y, row) => cols.map((x, col) => {
        const i = row * 4 + col
        const state = pattern[i]
        const lit = state === '1' || state === 'b'
        return (
          <g key={i} data-window={state}>
            {lit && night && <circle cx={x + 17} cy={y + 19} r={30} fill="url(#gb-glow)" />}
            <rect x={x} y={y} width={34} height={38} rx={2} fill={state === 'b' ? 'url(#gb-break)' : lit ? 'url(#gb-lit)' : c.glassOff} stroke={c.trim} strokeWidth={2} />
            {/* Someone at a screen: a monitor's glow and a desk. */}
            {state === '1' && <rect x={x + 10} y={y + 20} width={14} height={9} rx={1} fill="#2C2F48" opacity={0.85} />}
            {state === 'b' && <path d={`M${x + 12} ${y + 30}h10`} stroke="#1E2B57" strokeWidth={2} strokeLinecap="round" opacity={0.5} />}
            {!lit && !night && <path d={`M${x + 6} ${y + 30} ${x + 22} ${y + 8}`} stroke="#FFFFFF" strokeOpacity={0.55} strokeWidth={2} />}
            <path d={`M${x - 2} ${y + 40}h38`} stroke={c.trim} strokeWidth={2} strokeLinecap="round" />
            {you === i && (
              <g>
                <path d={`M${x + 17} ${y - 10}l-4-6h8Z`} fill="#E8913A" />
                <text x={x + 17} y={y - 18} textAnchor="middle" fontSize={8} fontWeight={700} fill={night ? '#FFFFFF' : '#3A2E22'}>you</text>
              </g>
            )}
          </g>
        )
      }))}

      {/* Ground floor: GuildBot's shop window, the awning, the door. */}
      <path d="M100 306h150l-6 14H106Z" fill="#E8913A" stroke={c.trim} strokeWidth={2} strokeLinejoin="round" />
      <path d="M118 306l-2 14M136 306l-1 14M154 306v14M172 306v14M190 306v14M208 306l1 14M226 306l2 14" stroke="#FFF4E0" strokeWidth={6} opacity={0.65} />
      <rect x={106} y={322} width={140} height={58} rx={3} fill={night ? '#FFE0A6' : '#F6EEDD'} stroke={c.trim} strokeWidth={2.5} />
      {scene.activity === 'sleeping' ? (
        // Asleep at his window: head down, z's drifting up.
        <g>
          <rect x={106} y={322} width={140} height={58} rx={3} fill="#1C2033" opacity={0.75} />
          <foreignObject x={140} y={330} width={60} height={46}>
            <div className="w-full h-full flex items-end justify-center"><Kers pose="asleep" size={36} motion="still" /></div>
          </foreignObject>
          <text className="gb-zz" x={196} y={340} fontSize={12} fontWeight={700} fill="#F4E7B8">z</text>
          <text className="gb-zz" x={204} y={330} fontSize={9} fontWeight={700} fill="#F4E7B8">z</text>
        </g>
      ) : (
        <foreignObject x={124} y={324} width={104} height={56}>
          <div className="w-full h-full flex items-end justify-center">
            <GuildBotScene scene={scene.activity} asks="normal" left={null} expression="smug" mug={false} width={74} />
          </div>
        </foreignObject>
      )}
      <rect x={262} y={326} width={34} height={58} rx={2} fill={c.facadeSide} stroke={c.trim} strokeWidth={2.5} />
      <circle cx={290} cy={356} r={2} fill="#E8B64B" />

      {/* Street: pavement, road, lamp post, the chai cart. */}
      <rect x={0} y={384} width={400} height={18} fill={c.pavement} />
      <rect x={0} y={402} width={400} height={38} fill={c.road} />
      <path d="M10 421h30M70 421h30M130 421h30M190 421h30M250 421h30M310 421h30M370 421h30" stroke={c.line} strokeWidth={2.5} strokeLinecap="round" opacity={0.6} />

      <g>
        {scene.lampsOn && <circle cx={352} cy={322} r={34} fill="url(#gb-glow)" />}
        <path d="M352 384v-56" stroke={c.trim} strokeWidth={3} strokeLinecap="round" />
        <path d="M342 326h20l-4-8h-12Z" fill={scene.lampsOn ? '#FFD27A' : c.facadeSide} stroke={c.trim} strokeWidth={2} strokeLinejoin="round" />
      </g>

      <g>
        {scene.lampsOn && <circle cx={44} cy={350} r={26} fill="url(#gb-glow)" />}
        {/* Canopy, cart, wheel, the kettle and its steam. */}
        <path d="M18 340h54l-6-10H24Z" fill="#C0392B" stroke={c.trim} strokeWidth={2} strokeLinejoin="round" />
        <path d="M24 340v18M66 340v18" stroke={c.trim} strokeWidth={2} />
        <rect x={16} y={358} width={58} height={20} rx={3} fill="#8B5A3C" stroke={c.trim} strokeWidth={2} />
        <text x={45} y={372} textAnchor="middle" fontSize={8} fontWeight={800} fill="#FBE8C8">CHAI</text>
        <circle cx={28} cy={382} r={5} fill={c.trim} />
        <circle cx={62} cy={382} r={5} fill={c.trim} />
        <path d="M38 358v-8a6 6 0 0 1 12 0v8Z" fill="#C9CED6" stroke={c.trim} strokeWidth={1.5} />
        <path className="gb-chai-steam" d="M44 346c-2-3 2-4 0-7M48 345c-2-3 2-4 0-7" stroke={night ? '#E6E1D8' : '#7A7268'} strokeWidth={1.4} fill="none" strokeLinecap="round" />
        {scene.lampsOn && <circle cx={45} cy={336} r={2.4} fill="#FFE3A3" />}
      </g>
    </svg>
  )
}

const STARS: [number, number, number][] = [
  [24, 30, 1.2], [60, 70, 0.9], [96, 22, 1], [150, 40, 0.8], [176, 18, 1.3], [230, 34, 0.9], [254, 12, 1],
  [356, 26, 1.2], [380, 80, 0.8], [12, 120, 1], [44, 160, 0.8], [372, 140, 1], [210, 56, 0.7], [120, 12, 0.8],
]
