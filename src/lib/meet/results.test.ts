import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cloudRows, fillWidth, pollColumns, pollTiles, REPORT_CLOUD, REPORT_FULL, REPORT_HALF, reportGrid, reportImageSize, sharesOf, wordToneIndex } from './results.ts'
import type { ReportActivity } from './report.ts'

test('shares add up to 100, and nobody voting is all zero', () => {
  assert.deepEqual(sharesOf([1, 1, 1]), [34, 33, 33])
  assert.deepEqual(sharesOf([0, 2, 0, 1]), [0, 67, 0, 33])
  assert.deepEqual(sharesOf([0, 0, 0]), [0, 0, 0])
  assert.deepEqual(sharesOf([5]), [100])
  for (const c of [[3, 3, 1], [7, 2, 2, 2], [1, 0, 0, 6]]) assert.equal(sharesOf(c).reduce((a, b) => a + b, 0), 100)
})

test('0% draws no fill at all', () => {
  assert.equal(fillWidth(0), 0)
  assert.equal(fillWidth(-3), 0)
  assert.equal(fillWidth(1), 1)
  assert.equal(fillWidth(140), 100)
})

test('poll tiles: the lead (ties too), none with no votes, and the phone’s own pick', () => {
  const { tiles, total } = pollTiles(['A', 'B', 'C'], [2, 2, 1], 2)
  assert.equal(total, 5)
  assert.deepEqual(tiles.map(t => t.lead), [true, true, false])
  assert.deepEqual(tiles.map(t => t.mine), [false, false, true])
  assert.deepEqual(tiles.map(t => t.pct), [40, 40, 20])
  const none = pollTiles(['A', 'B'], null)
  assert.equal(none.total, 0)
  assert.ok(none.tiles.every(t => !t.lead && t.pct === 0 && !t.mine))
})

test('poll columns: one for long options, three for three, else two', () => {
  assert.equal(pollColumns(['Yes', 'No']), 2)
  assert.equal(pollColumns(['a', 'b', 'c']), 3)
  assert.equal(pollColumns(['a', 'b', 'c'], 2), 2)
  assert.equal(pollColumns(['A very long option that wraps', 'b']), 1)
})

test('a word keeps its colour', () => {
  assert.equal(wordToneIndex('typescript'), wordToneIndex('typescript'))
  assert.ok(wordToneIndex('rust') >= 0 && wordToneIndex('rust') < 4)
})

test('cloud rows keep every word, and say how tall they are', () => {
  const words = ['flaky tests', 'meetings', 'ci', 'reviews', 'scope creep', 'docs', 'oncall', 'deploys'].map((word, i) => ({ word, n: 8 - i }))
  const { rows, height, scale } = cloudRows(words, 470, 0, REPORT_CLOUD)
  assert.equal(rows.flat().length, words.length)
  assert.ok(rows.every(r => r.length > 0))
  assert.ok(height > 0)
  assert.ok(scale <= 1)
  assert.deepEqual(cloudRows([], 400, 0), { rows: [], scale: 1, height: 0 })
})

const poll = (labels: string[]): ReportActivity => ({ kind: 'poll', section: '', prompt: 'Q', answered: 3, empty: false, options: labels.map(label => ({ label, n: 1, pct: 33 })) })
const cloud = (n: number): ReportActivity => ({ kind: 'cloud', section: '', prompt: 'Q', answered: 3, empty: false, words: Array.from({ length: n }, (_, i) => ({ word: `longish-word-${i}`, n: n - i })) })
const boss: ReportActivity = { kind: 'boss', section: '', prompt: 'Q', answered: 3, empty: false, boss: { problem: 'P', trying: 3, passed: 1, pct: 33 } }

test('report grid: an odd card out spans the row, so no empty cell', () => {
  const g = reportGrid([poll(['a', 'b']), cloud(4), boss])
  assert.equal(g.rows.length, 2)
  assert.deepEqual(g.rows[0].cards.map(c => c.width), [REPORT_HALF, REPORT_HALF])
  assert.deepEqual(g.rows[1].cards, [{ index: 2, width: REPORT_FULL }])
})

test('report grid: a big cloud makes its row taller instead of being clipped', () => {
  const small = reportGrid([cloud(2), boss]).rows[0].height
  const big = reportGrid([cloud(8), boss]).rows[0].height
  assert.ok(big >= small)
  const size = reportImageSize([cloud(8), boss, poll(['a', 'b', 'c', 'd'])], true)
  assert.equal(size.width, 1200)
  assert.ok(size.height >= 1200)
})
