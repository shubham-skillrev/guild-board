# Migrations

Applied in numeric order. `001`–`010` are already live.

## Pending: 011 – 014

These four ship with the activation work and are **not yet applied**. Nothing
in the Idea Bank, signals, ask-by-name, or Bytes features works until they are.

| # | File | Adds |
|---|---|---|
| 011 | `011_idea_bank.sql` | `idea_bank` — capture ideas any day, promote 1/cycle |
| 012 | `012_topic_signals.sql` | `topic_signals` — one-tap responses, no negative option |
| 013 | `013_topic_asks.sql` | `topic_asks` — invite a member by name, max 2/topic |
| 014 | `014_bytes.sql` | `byte_digests`, `bytes`, `byte_interests` — monthly digest |

### Applying them

Paste each file into the Supabase SQL editor **in order**, or with the CLI:

```sh
supabase db push          # if the project is linked
# or, per file:
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/011_idea_bank.sql
```

Each is independent of the others except `014`, which references `topics` and
`cycles` (both from `001`). Order still matters for the numbering convention.

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

### Not applied by these migrations

`ANTHROPIC_API_KEY` is optional — see `.env.example`. Without it the Bytes
digest is still built from the real feeds, just with blank summaries for you
to write by hand.
