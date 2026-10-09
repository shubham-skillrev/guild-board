# @guildboard/guildbot

GuildBot, the board's resident bot: a dry, deadpan host that teases the group, the board and itself, never a person.

This package is the bot's brain only. It has no database, HTTP or app imports. The host app passes in sanitized views and an LLM client, so the bot cannot leak what it never sees, such as who is behind a ghost post.

| File | What it holds |
|---|---|
| `src/lines.ts` | Hand-written lines for every moment that doesn't need a model, with a stable seeded pick |
| `src/persona.ts` | The system prompt and example comments for model-written comments and replies |
| `src/guard.ts` | The last check before anything is shown. Fails closed. |
| `src/mood.ts` | Mood and drought tier from board counts |
| `src/comments.ts` | Model-written comments and replies: persona, guard, then a review call |
| `src/chat.ts` | One-to-one chat: answers from host-supplied context, can draft a post |
| `src/learnings.ts` | Meeting-day themes from the month's chats: only themes two or more people raised, reviewed, never quotes or names |

## Rules every line follows

- English only. No em dashes, exclamation marks or emojis.
- Never names anyone, except users who opted in to being teased, and only in the app (never Slack).
- Never jokes about jobs, pay, appraisals, managers or HR; never points out who hasn't posted; never guesses who a ghost is.
- Serious, not funny, on problem posts.

`guard()` enforces what can be checked mechanically. A test runs every line in `lines.ts` and every example in `persona.ts` through it, so a new line that breaks a rule fails the tests before it reaches anyone.

## Using it from the app

App glue lives in `src/lib/guildbot-host/`. `botSays(key, seed, surface, vars)` returns a guarded line or `null`, and every caller falls back to plain copy on `null`.

Switch the voice off everywhere with `NEXT_PUBLIC_GUILDBOT_SASS=0` (redeploy to apply). Every surface then shows the plain copy.

## Models

The host supplies one `LlmClient`. Comments use the `quality` tier and are
rare (capped). Chat defaults to `bulk`, because it is frequent and the
quality model's free quota is 20 requests a day. No web search yet: it
needs a billed Gemini project.

## Tests

```bash
npm run test:guildbot
```
