import { test } from 'node:test'
import assert from 'node:assert/strict'
import { writeComment, writeReply } from '../src/comments.ts'
import type { LlmClient, TopicView } from '../src/types.ts'

/** A fake model: answers the comment call with `comment`, the review with `approve`. */
function fakeLlm(comment: string | null, approve = true) {
  const calls: { label: string; system: string; prompt: string }[] = []
  const llm: LlmClient = {
    async json<T>(args: { label: string; system: string; prompt: string }) {
      calls.push(args)
      if (args.label === 'guildbot.review') return { approve, reason: 'test' } as T
      return (comment === null ? null : { comment }) as T
    },
  }
  return { llm, calls }
}

const topic = (over: Partial<TopicView> = {}): TopicView => ({
  id: 't1', title: 'Microservices were a mistake', body: 'We split too early.', kind: 'take',
  author: 'dev_wizard', authorIsGhost: false, authorRoastMe: false, voteCount: 2, commentCount: 0, ...over,
})

test('a clean, approved comment is returned', async () => {
  const { llm, calls } = fakeLlm("Bold take. I'll bring popcorn.")
  assert.equal(await writeComment(llm, topic()), "Bold take. I'll bring popcorn.")
  assert.deepEqual(calls.map(c => c.label), ['guildbot.comment', 'guildbot.review'])
})

test('silence when the model fails, returns empty, or the review says no', async () => {
  assert.equal(await writeComment(fakeLlm(null).llm, topic()), null)
  assert.equal(await writeComment(fakeLlm('').llm, topic()), null)
  assert.equal(await writeComment(fakeLlm('Fine comment.', false).llm, topic()), null)
})

test('the guard runs before the review and blocks the draft', async () => {
  const { llm, calls } = fakeLlm('Ask HR about it.')
  assert.equal(await writeComment(llm, topic()), null)
  assert.equal(calls.length, 1, 'review is never called on a draft the guard rejected')
})

test('@name only for an opted-in, named author', async () => {
  const line = '@dev_wizard has chosen violence again.'
  assert.equal(await writeComment(fakeLlm(line).llm, topic()), null)
  assert.equal(await writeComment(fakeLlm(line).llm, topic({ authorRoastMe: true })), line)
  // A ghost is never named, even if their account opted in.
  assert.equal(await writeComment(fakeLlm(line).llm, topic({ authorRoastMe: true, authorIsGhost: true, author: 'ghost_ab12cd' })), null)
})

test('the prompt never carries more than the post', async () => {
  const { llm, calls } = fakeLlm('ok then.')
  await writeComment(llm, topic({ authorIsGhost: true, author: 'ghost_ab12cd', authorRoastMe: true }))
  const prompt = calls[0].prompt
  assert.ok(!prompt.includes('ghost_ab12cd'), 'a ghost handle is not sent as a teasable name')
  assert.ok(prompt.includes('"may_tease_by_name":null'))
})

test('replies: one guarded line, ghosts never named', async () => {
  assert.equal(
    await writeReply(fakeLlm("Nobody. That's never stopped me.").llm, { topic: topic(), botSaid: 'x', theySaid: 'Who asked you?', replier: 'dev_wizard', replierRoastMe: false }),
    "Nobody. That's never stopped me.",
  )
  assert.equal(
    await writeReply(fakeLlm('@ghost_ab12cd fair point.').llm, { topic: topic(), botSaid: 'x', theySaid: 'y', replier: 'ghost_ab12cd', replierRoastMe: true }),
    null,
  )
})
