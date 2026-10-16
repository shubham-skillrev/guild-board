// ROUTE: GET /hours/og?h=<scene>
// AUTH: none (public share card for /hours)
// PURPOSE: The preview image when /hours is shared: the building at that
//          hour (?h=) or, with no hour given, at the current hour in India
//          (link previews have no viewer clock; SkillRev is in India). A
//          story only: the lit windows are the scene's, never real people.

import { ImageResponse } from 'next/og'
import { line } from '@guildboard/guildbot'
import { indiaHour, sceneAt, sceneBySlug } from '@/lib/hours/scenes'

const SIZE = { width: 1200, height: 630 }

export async function GET(request: Request) {
  const h = new URL(request.url).searchParams.get('h')
  const scene = sceneBySlug(h) ?? sceneAt(indiaHour())
  const light = scene.tone === 'light'
  const ink = light ? '#F3EEE6' : '#1F1A14'
  const facade = light ? '#2A2C3A' : '#E9DCC6'
  const trim = light ? '#11121A' : '#3A2E22'
  const glassOff = light ? '#151A2C' : '#BFD7EA'

  const image = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: `linear-gradient(to bottom, ${scene.sky[0]}, ${scene.sky[1]})`, color: ink, padding: 64, fontFamily: 'serif' }}>
        {/* The words. (Each text node is one string: the renderer wants a flex
            box around anything with several children.) */}
        <div style={{ display: 'flex', flexDirection: 'column', width: 620, paddingRight: 40 }}>
          <div style={{ fontSize: 22, letterSpacing: 6, textTransform: 'uppercase', opacity: 0.7, fontFamily: 'monospace' }}>the guild building</div>
          <div style={{ fontSize: 60, lineHeight: 1.05, marginTop: 18 }}>One building, every hour of the day.</div>
          <div style={{ fontSize: 22, marginTop: 36, opacity: 0.75, fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }}>{`${scene.name} · ${scene.clock}`}</div>
          <div style={{ fontSize: 30, fontStyle: 'italic', lineHeight: 1.3, marginTop: 12 }}>{`\u201c${line(scene.line, scene.slug) ?? ''}\u201d`}</div>
        </div>
        {/* The building: sixteen windows over the shop window. */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', background: facade, border: `5px solid ${trim}`, padding: 22, gap: 16 }}>
            {[0, 1, 2, 3].map(row => (
              <div key={row} style={{ display: 'flex', gap: 16 }}>
                {[0, 1, 2, 3].map(col => {
                  const lit = scene.windows[row * 4 + col] === '1'
                  return (
                    <div
                      key={col}
                      style={{
                        width: 62, height: 70, border: `4px solid ${trim}`, borderRadius: 4,
                        background: lit ? 'linear-gradient(to bottom, #FFE3A3, #F2A84B)' : glassOff,
                        boxShadow: lit && light ? '0 0 40px 8px rgba(255,210,122,0.45)' : 'none',
                      }}
                    />
                  )
                })}
              </div>
            ))}
            {/* The shop window, with its awning. */}
            <div style={{ display: 'flex', height: 18, background: '#E8913A', border: `4px solid ${trim}`, marginTop: 6 }} />
            <div style={{ display: 'flex', height: 80, background: light ? '#FFE0A6' : '#F6EEDD', border: `4px solid ${trim}`, alignItems: 'center', justifyContent: 'center', fontSize: 22, fontFamily: 'monospace', color: '#3A2E22' }}>
              {scene.activity === 'sleeping' ? 'GuildBot is asleep' : 'GuildBot is in'}
            </div>
          </div>
        </div>
      </div>
    ),
    SIZE,
  )
  // An hour at most: the hour changes, and so should the card.
  image.headers.set('Cache-Control', 'public, max-age=600, s-maxage=3600')
  return image
}
