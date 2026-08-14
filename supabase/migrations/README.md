# Migrations

Applied in numeric order. `001` to `010` are already live.

## Pending: 011 to 015

These five ship with the activation work and are **not yet applied**. Nothing
in the Idea Bank, signals, ask-by-name, or Bytes features works until they are.

| # | File | Adds |
|---|---|---|
| 011 | `011_idea_bank.sql` | `idea_bank`, capture ideas any day, promote 1 per cycle |
| 012 | `012_topic_signals.sql` | `topic_signals`, one-tap responses, no negative option |
| 013 | `013_topic_asks.sql` | `topic_asks`, invite a member by name, max 2 per topic |
| 014 | `014_bytes.sql` | `byte_digests`, `bytes`, `byte_interests` |
| 015 | `015_bytes_weekly.sql` | weekly cadence, `domain` breadth, Lobsters source |

> **015 is required for the weekly cron.** Without it the source CHECK still
> rejects Lobsters, so every automatic run dies on `bytes_source_check`. This
> was confirmed against a live run, not assumed.

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

## Weekly Bytes cron

`vercel.json` schedules `/api/cron/bytes` for **06:00 UTC every Monday**. Two
env vars gate it, both set in the Vercel dashboard:

| Var | Required | Effect if missing |
|---|---|---|
| `CRON_SECRET` | **Yes** | The route refuses to run and returns 500. |
| `ANTHROPIC_API_KEY` | No | The digest is still built from the real feeds, with blank summaries to fill in by hand. |

Generate the secret with `openssl rand -hex 32`. Vercel sends it automatically
as `Authorization: Bearer $CRON_SECRET`; the route compares it in constant time
and returns **404** (not 403) to anything else, so the endpoint does not confirm
it exists.

Test it without waiting for Monday:

```sh
curl -i -H "Authorization: Bearer $CRON_SECRET" \
  https://your-app.vercel.app/api/cron/bytes
```

Expected responses:

- `200 {"published":true,...}` on a successful run
- `200 {"skipped":true,"reason":"duplicate_period"}` if this week already ran,
  which is the normal no-op for a repeat firing
- `404` if the secret is wrong or absent
