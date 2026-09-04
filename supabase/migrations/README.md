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

> **021 is required by what is on `main` right now.** The generator writes
> `content_html` on every insert, so until this is applied **every digest
> generation fails** — both crons and the admin button — and `/bytes/[id]`
> errors. The digest list page itself is fine, since `reading_minutes` came
> with 020.
>
> It adds a column and drops nothing, so applying it cannot break the running
> deployment.

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

## Bytes crons

`vercel.json` schedules two jobs. They are independent and must not gate each
other, which is why the every-other-day guard below only looks at `daily`
digests.

| Path | Schedule | Builds |
|---|---|---|
| `/api/cron/bytes` | `0 6 */2 * *` | 6 items from a 3-day window, only stories that have not run before |
| `/api/cron/bytes/monthly` | `0 7 1 * *` | 10 items from the month that just ended, re-ranked with the guild's own upvotes, repeats allowed |

Vercel's Hobby plan permits two cron jobs, so this is exactly at the limit; a
third needs Pro.

Two env vars gate both, set in the Vercel dashboard:

| Var | Required | Effect if missing |
|---|---|---|
| `CRON_SECRET` | **Yes** | Both routes refuse to run and return 500 on every fire. |
| `ANTHROPIC_API_KEY` | No | Digests are still built from the real feeds, with blank summaries to fill in by hand. |

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
  https://your-app.vercel.app/api/cron/bytes
```

Expected responses:

- `200 {"published":true,...}` on a successful run
- `200 {"skipped":true,"reason":"duplicate_period"}` if this period already ran,
  which is the normal no-op for a repeat firing
- `200 {"skipped":true,"reason":"too_soon"}` if the last daily drop was under
  36 hours ago
- `404` if the secret is wrong or absent
- `500 {"error":"Not configured"}` if `CRON_SECRET` is unset — check this first
  when the page has gone stale

The monthly job answers the same way at `/api/cron/bytes/monthly`. It can never
return `all_seen`: it runs with repeats allowed on purpose.
