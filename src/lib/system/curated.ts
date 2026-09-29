import type { SystemTopicDraft } from '@/lib/system/topics'

/**
 * Hand-picked suggestions, keyed by cycle ("YYYY-MM"). When a month has an
 * entry here, the monthly job posts these instead of asking the model. Every
 * claim below was checked against the linked sources when it was written; if
 * you add a month, do the same.
 *
 * Kept deliberately free of exact prices: launch-day reports disagreed.
 */
export const CURATED: Record<string, SystemTopicDraft[]> = {
  '2026-10': [
    {
      kind: 'new_tech',
      title: 'Jev: an AI model that answers with probabilities, not text',
      why:
        'TypeSafe AI released Jev on 15 September. It does not write prose: you define the questions up front (a choice, a score, a yes/no) and it returns typed answers with calibrated confidence, for code to consume rather than people to read. The pitch is that it is far faster and cheaper than an LLM for these decisions, and cannot ramble. Where would a decision-only model fit in what we build, and where would it not?',
      sources: [
        { name: 'TechCrunch', url: 'https://techcrunch.com/2026/09/18/a-new-kind-of-ai-model-from-a-chatgpt-inventor-is-thrilling-developers/' },
        { name: 'The Register', url: 'https://www.theregister.com/devops/2026/09/23/shut-up-and-calculate-jevs-new-ai-primitives-for-coders/5298431' },
        { name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Jev_(AI_model)' },
      ],
    },
    {
      kind: 'take',
      title: 'Two frontier models shipped in the same hour. Does model choice still matter?',
      why:
        'On 22 September Anthropic released Claude Opus 5.5, and about an hour later OpenAI released GPT-6 Sol and Luna, both at lower prices than before. When the top models leapfrog each other every few weeks, is it worth standardising on one, or should we build so the model is a swappable part?',
      sources: [
        { name: 'Simon Willison', url: 'https://simonwillison.net/2026/Sep/22/opus-and-sol-and-luna/' },
        { name: 'SiliconANGLE', url: 'https://siliconangle.com/2026/09/22/anthropic-releases-claude-opus-5-5-and-openai-counters-with-two-cheaper-gpt-6-models/' },
      ],
    },
    {
      kind: 'new_tech',
      title: "Several models on one coding task: GitHub's HydraFusion",
      why:
        'A research preview in Copilot CLI that picks a workflow per task: one model, a cascade (a cheaper model drafts, a quality gate decides whether to escalate), or a critique (a model from another family reviews, the first revises). GitHub reports near Claude Opus 5 quality at 36 to 67 percent lower cost in its own offline evals. Would the same pattern work for the AI features we build?',
      sources: [
        { name: 'GitHub Blog', url: 'https://github.blog/ai-and-ml/github-copilot/project-hydrafusion-frontier-quality-via-multi-model-orchestration/' },
        { name: 'GitHub Community', url: 'https://github.com/orgs/community/discussions/206492' },
      ],
    },
  ],
}
