'use client'

import { createContext, useCallback, useEffect, useState } from 'react'
import { dressFor, type LineKey, type Wear } from '@guildboard/guildbot'

const CITY = 'guildbot:city'
const REFRESH_MS = 30 * 60_000

export interface Weather { city: string; country: string | null; latitude: number; temperature: number; code: number }

/** What GuildBot is wearing for the weather, for every drawing of him on screen. */
export const WearContext = createContext<Wear>({})

/**
 * The weather in the city the viewer typed in (kept in this browser only),
 * refreshed every half hour, and what GuildBot wears and says for it.
 */
export function useWeather() {
  const [city, setCityState] = useState<string | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setCityState(localStorage.getItem(CITY)), 0)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!city) return
    let cancelled = false
    const load = () =>
      fetch(`/api/guildbot/weather?city=${encodeURIComponent(city)}`)
        .then(async r => {
          const data = await r.json().catch(() => null)
          if (cancelled) return
          if (r.ok && data) { setWeather(data); setError(null) } else setError(data?.error ?? 'No weather for that city.')
        })
        .catch(() => {})
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [city])

  const setCity = useCallback((next: string | null) => {
    const value = next?.trim() || null
    if (value) localStorage.setItem(CITY, value); else localStorage.removeItem(CITY)
    setCityState(value)
    setWeather(null)
    setError(null)
  }, [])

  const dressed = weather ? dressFor({ temperature: weather.temperature, code: weather.code, latitude: weather.latitude, month: new Date().getMonth() }) : null
  return {
    city,
    setCity,
    weather,
    error,
    wear: dressed?.wear ?? {},
    line: dressed?.line ?? null as LineKey | null,
  }
}
