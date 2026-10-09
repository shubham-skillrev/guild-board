# Migrations

Applied in numeric order.

## Live: 001 to 019

`001` to `019` are applied. Confirmed against the database rather than assumed:
rows written on 2026-08-24 carry `source_name`, `domain` and the `news`/`video`
sources, all of which 018 introduced, and the columns 015 and 019 add are
present on those same rows.

| # | File | Adds |
|---|---|---|
| 011 | `011_idea_bank.sql` | `idea_bank`, capture ideas any day, promote 1 per cycle |
| 012 | `012_topic_signals.sql` | `topic_signals`, one-tap responses, no negative option |
| 013 | `013_topic_asks.sql` | `topic_asks`, invite a member by name, max 2 per topic |
| 014 | `014_bytes.sql` | `byte_digests`, `bytes`, `byte_interests` |
| 015 | `015_bytes_weekly.sql` | weekly cadence, `domain` breadth, Lobsters source |
| 016 | `016_bytes_blog_source.sql` | engineering-blog source |
| 017 | `017_release_deleted_promotions.sql` | frees a banked idea when its topic is deleted |
| 018 | `018_bytes_media_mix.sql` | `news` and `video` sources, `source_name`, `thumbnail_url` |
| 019 | `019_bytes_daily_kind.sql` | `daily` digest kind, for the every-other-day cron |

## Live: 020

`020_bytes_reader.sql` is applied. It was written for an extraction service
that has since been retired; six rows still hold a `content_md` body it
fetched. The file is left exactly as applied — never edit a migration that has
run, or the repo stops describing the database.

## Pending: 021, and 022 when you want it

| # | File | Adds | Safe to apply |
|---|---|---|---|
| 021 | `021_bytes_feed_html.sql` | `content_html`, for bodies the feed syndicated | Yes — additive only |
| 022 | `022_drop_extractor_columns.sql` | drops the four retired extractor columns | **Destructive** — deletes 6 cached bodies |
| 023 | `023_problem_month_unlimited_signals.sql` | drops the per-cycle vote and contribution caps for Problem Month | Yes — drops two triggers, keeps their functions |
| 024 | `024_discussion_kinds.sql` | five discussion kinds (problem, learned, new tech, take, show & tell) allowed in `category` on topics and the idea bank | Yes — widens two CHECKs, old values stay valid |
| 026 | `026_themes_announcements.sql` | `cycles.theme` (per-month theme, Oct 2026 seeded as Problem Month) and `announcements` (admin announcement history) | Yes — additive only |
| 027 | `027_three_posts_per_cycle.sql` | raises the per-person post cap from 1 to 3 per cycle | Yes — replaces one function body |
| 028 | `028_anonymity_hardening.sql` | column-level grants hiding `topics.user_id`, `comments.user_id`, `idea_bank.user_id`/`promoted_by`, `topic_asks.asker_id`, `users.real_name`/`email`; members may only update their username and insert topics with the six form fields; `comments.is_anonymous`; `my_topic_count()`; drops `topics` from realtime | **Ship together with the code** — see below |
| 029 | `029_retire_contributions_add_polls.sql` | score from votes only (backfills every topic's `score`); members can no longer write `contributions`; `topic_polls`, `poll_options`, `poll_votes` with cached counts, hidden per-option counts and no member access to who voted | **Ship together with the code**, after 028 |
| 030 | `030_live_channels.sql` | RLS on `realtime.messages`: anyone may listen on `board:*` / `topic:*` private broadcast channels and join presence on `topic:*`; only the service role may send | Yes — the pages poll every 15s until it is applied |
| 031 | `031_guildbot_events.sql` | `guildbot_events` (what GuildBot said on its own, for idempotency and daily caps; service role only) and `users.roast_me` (opt-in to being teased by name, readable by members, written via the API) | **Ship together with the code** |

> **028 and its code ship in the same deploy.** Apply 028 right after the code
> goes live; never before. The old code reads `topics.user_id` and
> `comments.user_id` with the member's session, so with 028 applied first the
> board and comments return errors. The new code runs fine on the old schema
> except ghost comments, which need the `is_anonymous` column (posting a
> comment fails until 028 is in). Set `GHOST_HANDLE_SECRET` before the deploy.
> Existing ghost handles change once, because they are now keyed by that secret.
>
> After 028, a column added to `topics`, `comments`, `idea_bank`, `topic_asks`
> or `users` is invisible to members until granted:
> `GRANT SELECT (new_col) ON public.<table> TO authenticated;`

> **029 ships with the polls code, after 028.** Apply it right after that
> deploy. Before 029 the new code shows no polls and rejects a post that has
> one ("Could not save the poll"), but everything else works. The old code
> keeps working with 029 applied. Topic order changes once, because scores are
> recomputed from votes alone.

> **030 can go in any time after the realtime code.** Until it is applied the
> private channels refuse to join and the board and topic pages poll every 15s,
> exactly as before. It only adds policies. It cannot be tested on plain
> Postgres (the `realtime` schema is Supabase's), so after applying it, open a
> topic in two browsers and check that a vote shows up in the other one.

> **031 ships with GuildBot's comments.** Without it every bot reaction stays
> silent (claims fail closed), and the profile page errors on `roast_me`, so
> apply it right after that deploy.

> **027 goes out with the three-posts change.** The board offers a second and
> third post as soon as the code ships; until 027 is applied the old trigger
> rejects them with "You've shared three things this cycle" after just one.

> **026 must be applied before the themes and announcements code ships.** The
> cycle reads select `theme`, so without the column `/api/cycles` errors and the
> board cannot load. It adds a column and a table and drops nothing.

> **021 is required by what is on `main` right now.** The generator writes
> `content_html` on every insert, so until this is applied **every digest
> generation fails** — both crons and the admin button — and `/bytes/[id]`
> errors. The digest list page itself is fine, since `reading_minutes` came
> with 020.
>
> It adds a column and drops nothing, so applying it cannot break the running
> deployment.

> **023 goes with the Problem Month branch.** Apply it after 021, before the
> announcement. It is independent of 022. The code already treats both signals
> as unlimited while `PROBLEM_MONTH` is on; without 023 a member hits a raw
> "limit reached" error at their fourth vote. The file header has the two
> statements that put the caps back.

> **024 must be applied before the new share form ships.** The form posts
> `category = 'problem'` (or another kind), which the old CHECK rejects, so
> without it every new post fails. It only widens the allowed values.

> **022 can wait indefinitely.** Run it only after 021 is applied and a digest
> has generated cleanly. It makes rollback to any earlier deployment impossible,
> because that code selects `content_md`.

### Which rows get a reader page

Only the ones whose feed shipped the whole article, in `content:encoded` (or
Atom `content`, or a `description` long enough to be a body rather than a
teaser). Measured against the live feeds:

| Full body in feed | Link-out only |
|---|---|
| Cloudflare, Netflix, GitHub, Meta, Airbnb, Slack, Pinterest, Sentry, Fly.io, AWS Architecture, Grafana, IEEE Spectrum | Stripe, Shopify, Datadog, Spotify, Canva, Google Research, Simon Willison, Pragmatic Engineer, Ars Technica, InfoQ |

Hacker News rows never qualify: they point at arbitrary sites the feed knows
nothing about. Videos always link out to the platform.

A feed carrying the full text is the publisher syndicating it deliberately, so
nothing is scraped and no extraction service is involved. A truncated feed is
the publisher asking readers to come to them, and the answer to that is to send
them.

Feed HTML is third-party input and reaches the DOM through
`dangerouslySetInnerHTML`, so it is filtered through the allowlist in
`lib/bytes/articleHtml.ts` on **read**, not on write — a hole closed in that
file is closed for every row already in the table. Fourteen payloads (script,
svg onload, `javascript:` href, form, base, meta refresh, nested-tag smuggling)
were checked against it, and eight live feeds survive filtering with 77–100% of
their markup intact.

## Crons

`vercel.json` schedules three daily jobs.

| Path | Schedule (UTC) | Does |
|---|---|---|
| `/api/cron/autopilot` | `30 3 * * *` (~09:00 IST) | Runs the month: closes the cycle the day after its meeting, opens next month (2nd Friday 11:00 IST, a theme from `src/lib/themes/catalog.ts`, Slack + push), and publishes Bytes: 10 stories ~15 days before the meeting and 10 more ~3 days before |
| `/api/cron/system-topics` | `0 4 * * *` | GuildBot's suggested topics for a newly opened month |
| `/api/cron/meeting-reminder` | `30 5 * * *` | "Guild tomorrow" on Slack and push |

Every autopilot step decides from stored state (cycle status, existing
digests), so a late, skipped or repeated run is safe. `?dry=1` returns what it
would do today without writing or notifying. `AUTOPILOT_DISABLED=1` turns it
off. The every-other-day and 1st-of-month Bytes jobs it replaced are gone; the
admin page's "Fetch more now" and "Rebuild top of the month" still work by hand.

Two env vars matter, set in the Vercel dashboard:

| Var | Required | Effect if missing |
|---|---|---|
| `CRON_SECRET` | **Yes** | Every cron refuses to run and returns 500 on every fire. |
| `GEMINI_API_KEY` | No | Gemini curates the pool and writes summaries. Without it digests are still built from the real feeds, uncurated, with blank summaries to fill in by hand. |

> **This is the failure that stopped the digest.** Between 2026-08-24 and
> 2026-09-04 no digest published: five exist, all `kind = monthly` from the
> admin's manual button, and not one `daily` row has ever been written despite
> the job being scheduled since 2026-08-14. Every published byte also has
> `summary = NULL`. Both symptoms are the two variables above being unset in
> the deployment. Set them and the schedule resumes on its own.

Generate the secret with `openssl rand -hex 32`. Vercel sends it automatically
as `Authorization: Bearer $CRON_SECRET`; the route compares it in constant time
and returns **404** (not 403) to anything else, so the endpoint does not confirm
it exists.

Test it without waiting for the schedule:

```sh
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  "https://guildboard.skillrev.in/api/cron/autopilot?dry=1"
```

Expected responses:

- `200 {"steps":[...]}` listing what ran (or, with `?dry=1`, would run)
- `200 {"steps":"nothing to do today"}` on most days
- `200 {"skipped":true,"reason":"disabled"}` when `AUTOPILOT_DISABLED=1`
- `404` if the secret is wrong or absent
- `500 {"error":"Not configured"}` if `CRON_SECRET` is unset; check this first
  when the page has gone stale
