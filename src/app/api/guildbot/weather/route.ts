// ROUTE: GET /api/guildbot/weather?city=Mumbai
// AUTH: anyone who can see the board (members and guests)
// PURPOSE: The weather where the viewer says they are, so GuildBot can dress
//          for it (weather.ts in the package). The city comes from the
//          viewer's own browser and is not stored here.
// SOURCE: Open-Meteo (geocoding + current conditions, no key). Fetched on
//         the server so the viewer's address never reaches it, and cached per
//         city: the place for a day, the weather for 30 minutes.
// DB TABLES: none

import { NextResponse } from 'next/server'

const CITY = /^[\p{L}\p{M} .,'-]{2,60}$/u

export async function GET(request: Request) {
  const city = new URL(request.url).searchParams.get('city')?.trim() ?? ''
  if (!CITY.test(city)) return NextResponse.json({ error: 'Give a city name.' }, { status: 400 })

  try {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { next: { revalidate: 86_400 } },
    ).then(r => (r.ok ? r.json() : null))
    const place = geo?.results?.[0]
    if (!place) return NextResponse.json({ error: `Couldn't find ${city}.` }, { status: 404 })

    const now = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,is_day&timezone=auto`,
      { next: { revalidate: 1800 } },
    ).then(r => (r.ok ? r.json() : null))
    if (!now?.current) return NextResponse.json({ error: 'Weather is unavailable right now.' }, { status: 502 })

    return NextResponse.json({
      city: place.name as string,
      country: (place.country as string) ?? null,
      latitude: place.latitude as number,
      temperature: Math.round(now.current.temperature_2m),
      code: now.current.weather_code as number,
      isDay: now.current.is_day === 1,
    })
  } catch {
    return NextResponse.json({ error: 'Weather is unavailable right now.' }, { status: 502 })
  }
}
