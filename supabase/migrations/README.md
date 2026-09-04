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

## Pending: 020

| # | File | Adds |
|---|---|---|
| 020 | `020_bytes_reader.sql` | `content_md` and friends, for reading a byte inside the app |

> **020 is required for the reader page.** `/bytes/[id]` and
> `/api/bytes/[id]/read` select and write `content_md`, `content_source`,
> `content_fetched_at`, `content_failed_at` and `reading_minutes`. Until it is
> applied, opening any story from the digest returns a Postgres error about a
> missing column. Everything else — the digest itself, the board teaser, the
> crons — works without it.
>
> It is additive only (`ADD COLUMN IF NOT EXISTS`), touches no existing data,
> and rewrites no rows, so it is safe to apply against the live database at any
> time.

### Applying them

Paste each file into the Supabase SQL editor **in order**, or use the CLI:

```sh
supabase db push          # if the project is linked
# or, per file:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/011_idea_bank.sql
```

`015` alters tables created by `014`, so those two must run in order. The rest
are independent, but numeric order keeps the convention intact.

### After applying

Verify the tables and their policies landed:

```sql
SELECT tablename, rowsecurity FROM pg_tables
 WHERE schemaname = 'public'
   AND tablename IN ('idea_bank','topic_signals','topic_asks',
                     'byte_digests','bytes','byte_interests')
 ORDER BY tablename;
-- expect 6 rows, rowsecurity = true on every one

SELECT tablename, policyname FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('idea_bank','topic_signals','topic_asks',
                     'byte_digests','bytes','byte_interests')
 ORDER BY tablename, policyname;
-- expect 15 policies (idea_bank 4, topic_signals 3, topic_asks 3, bytes tables 5)
```

Then confirm 015 specifically:

```sql
-- Lobsters must be an accepted source, or the weekly cron fails.
SELECT pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conname = 'bytes_source_check';
-- expect: CHECK (source IN ('hn','devto','github','lobsters'))

-- One automatic digest per week.
SELECT indexdef FROM pg_indexes WHERE indexname = 'uniq_byte_digest_period';
```

Two things worth checking by hand, because they are the security-relevant ones:

```sql
-- idea_bank must NOT be world-readable: a private bank stays private.
-- Expect exactly: (auth.uid() = user_id) OR (is_open = true)
SELECT qual FROM pg_policies
 WHERE tablename = 'idea_bank' AND cmd = 'SELECT';

-- Draft digests must be invisible to members until published.
SELECT qual FROM pg_policies
 WHERE tablename = 'byte_digests' AND cmd = 'SELECT';
```

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
