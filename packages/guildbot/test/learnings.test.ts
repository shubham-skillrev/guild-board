import { test } from 'node:test'
import assert from 'node:assert/strict'
import { summariseLearnings, type AskedQuestion } from '../src/learnings.ts'
import type { LlmClient } from '../src/types.ts'

function fake(draft: unknown, approve = true) {
  const labels: string[] = []
  const llm: LlmClient = {
    async json<T>(a: { label: string }) {
      labels.push(a.label)
      return (a.label.endsWith('review') ? { approve, reason: '' } : draft) as T
    },
  }
  return { llm, labels }
}

const q = (person: string, text: string): AskedQuestion => ({ person, text })
const two = [q('p1', 'how do we stop flaky e2e tests'), q('p2', 'flaky tests again, any ideas'), q('p2', 'what is in bytes this week')]
const good = { line: 'Turns out you have questions. Who knew.', themes: ['A few of you want flaky tests gone. Same.'] }

test('one asker can never produce themes, and the model is not even called', async () => {
  const f = fake(good)
  assert.equal(await summariseLearnings(f.llm, [q('p1', 'a'), q('p1', 'b')]), null)
  assert.equal(f.labels.length, 0)
})

test('approved, guarded themes are returned', async () => {
  assert.deepEqual(await summariseLearnings(fake(good).llm, two), good)
})

test('labels, names or a rejected review mean nothing is shared', async () => {
  assert.equal(await summariseLearnings(fake({ ...good, themes: ['p2 really wants flaky tests gone.'] }).llm, two), null)
  assert.equal(await summariseLearnings(fake({ ...good, themes: ['@dev_wizard asked about tests.'] }).llm, two), null)
  assert.equal(await summariseLearnings(fake({ ...good, themes: ['Someone asked HR about it.'] }).llm, two), null)
  assert.equal(await summariseLearnings(fake(good, false).llm, two), null)
  assert.equal(await summariseLearnings(fake({ line: 'x', themes: [] }).llm, two), null)
})
