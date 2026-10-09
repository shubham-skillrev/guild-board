import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINES, line } from '../src/lines.ts'
import { guard } from '../src/guard.ts'
import { EXAMPLES, REPLY_EXAMPLES } from '../src/persona.ts'
import { droughtTier, moodFor } from '../src/mood.ts'

test('same seed, same line; placeholders filled', () => {
  const a = line('drought.smug', 'cycle-1', { days: 3, bot_posts: 3 })
  assert.equal(a, line('drought.smug', 'cycle-1', { days: 3, bot_posts: 3 }))
  assert.ok(a && !a.includes('{'))
})

test('lines missing a value are skipped, not printed raw', () => {
  assert.equal(line('mood.bored', 'x'), null)
  const l = line('cycle.open', 'x')
  assert.ok(l && !l.includes('{'))
})

test('every hand-written line passes the guard on its surface', () => {
  const surfaceFor = (key: string) =>
    key.startsWith('push') ? 'push' : key.startsWith('mood') || key.startsWith('ui') ? 'ui' : key.startsWith('chat') ? 'chat' : 'slack'
  const sample = { days: 9, bot_posts: 3, meeting_days: 4, month: 'October', theme: 'Problem Month', time: '11:00', count: 12, top: 'Flaky tests', comments: 40, top_thread: 'Flaky tests', posts: 5, lonely: 2, limit: 30 }
  for (const [key, pool] of Object.entries(LINES)) {
    for (const text of pool) {
      const filled = text.replace(/\{(\w+)\}/g, (_, k: string) => String(sample[k as keyof typeof sample]))
      const surface = surfaceFor(key) as 'push' | 'ui' | 'chat' | 'slack'
      // The one-time intro is allowed 900 characters (INTRO_MAX in the host).
      const res = guard(filled, { surface, ...(key === 'intro.slack' ? { maxLength: 900 } : {}) })
      assert.ok(res.ok, `${key}: ${filled} -> ${res.ok ? '' : res.reasons.join('; ')}`)
    }
  }
})

test('every example comment passes the guard', () => {
  for (const ex of EXAMPLES) {
    const res = guard(ex.comment, { surface: 'comment', allowedMentions: ex.post.roastMe ? [ex.post.roastMe] : [] })
    assert.ok(res.ok, `${ex.post.title} -> ${res.ok ? '' : res.reasons.join('; ')}`)
  }
  for (const ex of REPLY_EXAMPLES) assert.ok(guard(ex.reply, { surface: 'reply' }).ok, ex.reply)
})

test('mood and drought tiers', () => {
  assert.equal(moodFor({ daysSinceOpen: 1, daysToMeeting: 20, humanPosts: 0, botPosts: 3 }), 'smug')
  assert.equal(moodFor({ daysSinceOpen: 4, daysToMeeting: 15, humanPosts: 0, botPosts: 3 }), 'dramatic')
  assert.equal(moodFor({ daysSinceOpen: 10, daysToMeeting: 5, humanPosts: 2, botPosts: 3 }), 'bored')
  assert.equal(moodFor({ daysSinceOpen: 5, daysToMeeting: 9, humanPosts: 6, botPosts: 3 }), 'proud')

  const s = (daysSinceOpen: number, daysToMeeting: number | null, humanPosts = 0) => droughtTier({ daysSinceOpen, daysToMeeting, humanPosts, botPosts: 3 })
  assert.equal(s(2, 20), null)
  assert.equal(s(3, 20), 'drought.smug')
  assert.equal(s(6, 15), 'drought.dramatic')
  assert.equal(s(9, 12), 'drought.meltdown')
  assert.equal(s(4, 4), 'drought.meltdown')
  assert.equal(s(9, 12, 1), null)
})

test('one language everywhere: British spelling and GuildBoard words in every hand-written line', () => {
  const american = /\b(favorite|color|behavior|humor|optimiz|summariz|organiz|analyz|realiz|apologiz|recogniz|center)\w*/i
  const all = [
    ...Object.values(LINES).flat(),
    ...EXAMPLES.map(e => e.comment),
    ...REPLY_EXAMPLES.map(r => r.reply),
  ]
  for (const text of all) {
    assert.ok(!american.test(text), `American spelling: ${text}`)
    assert.ok(!/\bbytes\b/.test(text), `"Bytes" takes a capital B: ${text}`)
  }
})
