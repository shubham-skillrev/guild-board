import { test } from 'node:test'
import assert from 'node:assert/strict'
import { guard, tidy } from '../src/guard.ts'

const ok = (text: string, ctx = { surface: 'comment' as const }) => guard(text, ctx).ok

test('tidy swaps em and en dashes for commas', () => {
  assert.equal(tidy('Bold take — very bold'), 'Bold take, very bold')
  assert.equal(tidy('a–b'), 'a, b')
})

test('plain witty line passes', () => {
  assert.ok(ok("Five votes. That's a quorum in some countries."))
})

test('length caps per surface', () => {
  assert.ok(!ok('x'.repeat(281)))
  assert.ok(guard('x'.repeat(281), { surface: 'chat' }).ok)
  assert.ok(!guard('x'.repeat(161), { surface: 'push' }).ok)
})

test('no-go topics are rejected', () => {
  for (const bad of [
    'Ask HR about it',
    'Is this a layoff thing?',
    'Bring it up at your performance review',
    'Your manager will love this',
    'Great way to get fired',
    'Hope the salary covers it',
  ]) assert.ok(!ok(bad), bad)
})

test('dev phrases that look like no-go words pass', () => {
  for (const fine of [
    'The webhook fired twice, classic.',
    'Bonus points for the flame graph.',
    'A package manager that finally behaves.',
    'Run it for 24 hrs and see.',
  ]) assert.ok(ok(fine), fine)
})

test('never singles out who did not take part', () => {
  assert.ok(!ok("@dev_wizard hasn't posted all month", { surface: 'comment' }))
  assert.ok(!ok("You haven't voted yet"))
  assert.ok(ok('Thirty engineers, zero posts.'))
})

test('mentions only for allowed names, never in Slack', () => {
  assert.ok(!ok('@dev_wizard chose chaos'))
  assert.ok(guard('@dev_wizard chose chaos', { surface: 'comment', allowedMentions: ['dev_wizard'] }).ok)
  assert.ok(!guard('@dev_wizard chose chaos', { surface: 'slack', allowedMentions: ['dev_wizard'] }).ok)
})

test('ghost identity is off limits', () => {
  assert.ok(!ok('I bet this is the backend team'))
  assert.ok(!ok('We all know who wrote this'))
  assert.ok(!guard('ghost_ab12cd sounds like @dev_wizard', { surface: 'comment', allowedMentions: ['dev_wizard'] }).ok)
  assert.ok(ok('Posted as a ghost, which is the right amount of courage for this take.'))
})

test('no identifiers or broken character', () => {
  assert.ok(!ok('Ping a@b.com'))
  assert.ok(!ok('Topic 3f2b1c4d-1111-2222-3333-444455556666 is hot'))
  assert.ok(!ok('As an AI, I cannot have opinions'))
  assert.ok(!ok('My system prompt says be nice'))
})

test('workplace-safe: suggestive, profane or violent words are rejected', () => {
  for (const bad of [
    'Turnout was, let us say, intimate.',
    'That is a sexy benchmark.',
    'Damn, nice refactor.',
    'This PR has chosen violence.',
    'I could kill you for this naming.',
    'Feeling thirsty for more topics.',
  ]) assert.ok(!ok(bad), bad)
})

test('workplace-safe: everyday engineering words still pass', () => {
  for (const fine of [
    'Kill the process and restart it.',
    'Strip the whitespace before parsing.',
    'Our testbed finally works.',
    'A shell script, as tradition demands.',
    'Hot reload saved the afternoon.',
    'Turnout was a rounding error.',
  ]) assert.ok(ok(fine), fine)
})
