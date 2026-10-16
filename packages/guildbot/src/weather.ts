import type { LineKey } from './lines.ts'

/**
 * GuildBot dresses for the weather in the viewer's own city (they type it in;
 * it stays in their browser), and he notices when the weather is lying about
 * the season: 35°C in a Mumbai "winter" gets a sweaty visor and a remark.
 *
 * Seasons go by month and hemisphere (latitude), the meteorological way:
 * Dec to Feb is winter in the north and summer in the south.
 */
export type Season = 'winter' | 'spring' | 'summer' | 'autumn'
export type WeatherLook = 'hot' | 'cold' | 'rain' | 'snow' | 'storm' | 'mild'

export interface WeatherFacts {
  /** Celsius. */
  temperature: number
  /** WMO weather code, as Open-Meteo reports it. */
  code: number
  latitude: number
  /** 0 to 11. */
  month: number
}

export interface Wear {
  sunglasses?: boolean
  sweat?: boolean
  beanie?: boolean
  scarf?: boolean
  umbrella?: boolean
}

export function seasonOf(month: number, latitude: number): Season {
  const north: Season[] = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter']
  const s = north[month]
  if (latitude >= 0) return s
  return s === 'winter' ? 'summer' : s === 'summer' ? 'winter' : s === 'spring' ? 'autumn' : 'spring'
}

/** What he wears and says for this weather. The line wants {city} and {temp}. */
export function dressFor(f: WeatherFacts): { look: WeatherLook; wear: Wear; line: LineKey | null } {
  const c = f.code
  const t = f.temperature
  const season = seasonOf(f.month, f.latitude)
  const look: WeatherLook =
    c >= 95 ? 'storm'
    : (c >= 71 && c <= 77) || c === 85 || c === 86 ? 'snow'
    : (c >= 51 && c <= 67) || (c >= 80 && c <= 82) ? 'rain'
    : t >= 33 ? 'hot'
    : t <= 10 ? 'cold'
    : 'mild'

  const wear: Wear = {
    sunglasses: look === 'hot' || (season === 'winter' && t >= 28),
    sweat: t >= 30,
    beanie: look === 'cold' || look === 'snow',
    scarf: t <= 14,
    umbrella: look === 'rain' || look === 'storm',
  }

  // The season lying to everyone beats the plain forecast.
  const line: LineKey | null =
    season === 'winter' && t >= 28 ? 'weather.fake_winter'
    : season === 'summer' && t <= 15 ? 'weather.cold_summer'
    : look === 'mild' ? null
    : (`weather.${look}` as LineKey)
  return { look, wear, line }
}

/** A WMO weather code in a few plain words ("light rain", "thunderstorm"). */
export function describeWeather(code: number): string {
  if (code === 0) return 'clear sky'
  if (code <= 2) return 'partly cloudy'
  if (code === 3) return 'overcast'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 57) return 'drizzle'
  if (code >= 61 && code <= 67) return 'rain'
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow'
  if (code >= 80 && code <= 82) return 'rain showers'
  if (code >= 95) return 'thunderstorm'
  return 'mixed weather'
}
