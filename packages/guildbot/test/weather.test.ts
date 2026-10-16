import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dressFor, seasonOf } from '../src/weather.ts'
import { LINES } from '../src/lines.ts'

const MUMBAI = 19.07
const SYDNEY = -33.87

test('seasons follow the hemisphere', () => {
  assert.equal(seasonOf(0, MUMBAI), 'winter')
  assert.equal(seasonOf(0, SYDNEY), 'summer')
  assert.equal(seasonOf(6, MUMBAI), 'summer')
  assert.equal(seasonOf(3, SYDNEY), 'autumn')
})

test('a hot Mumbai winter: sweating, shades, and a remark about it', () => {
  const d = dressFor({ temperature: 35, code: 1, latitude: MUMBAI, month: 0 })
  assert.equal(d.line, 'weather.fake_winter')
  assert.ok(d.wear.sweat && d.wear.sunglasses)
  assert.ok(!d.wear.beanie)
})

test('rain, snow, cold and a cold summer', () => {
  assert.ok(dressFor({ temperature: 24, code: 63, latitude: MUMBAI, month: 7 }).wear.umbrella)
  const snow = dressFor({ temperature: -2, code: 73, latitude: 59, month: 0 })
  assert.equal(snow.look, 'snow')
  assert.ok(snow.wear.beanie && snow.wear.scarf)
  assert.equal(dressFor({ temperature: 12, code: 2, latitude: 51.5, month: 6 }).line, 'weather.cold_summer')
  assert.equal(dressFor({ temperature: 22, code: 1, latitude: MUMBAI, month: 3 }).line, null)
})

test('every weather line he can ask for exists', () => {
  for (const code of [0, 63, 73, 95]) for (const temperature of [-5, 12, 25, 36]) for (const month of [0, 6]) {
    const { line } = dressFor({ temperature, code, latitude: MUMBAI, month })
    if (line) assert.ok(LINES[line]?.length, line)
  }
})
