# 05. Problem Month

A one-off guild format. Members bring one real tech problem instead of a topic,
and the meeting is built around the problems people relate to most. The only
goal is participation: more people posting and more people speaking.

If it doesn't work, go back to the usual format next month.

## What changed in the app

Everything is behind `PROBLEM_MONTH` in `src/lib/experiment.ts`.

- "Pitch an idea" is now "Share a problem". Nav, header, empty states, metadata
  and push copy all follow.
- The form asks "What's the problem?" and "What have you tried so far?", plus an
  optional context field. There is no category.
  - Both answers are stored in the existing `description` column as
    bold-labelled sections, so there is no schema change for the form.
- Anonymous posting is off by default, with the hint "Your name helps people
  follow up with you". There is also a note about keeping client details out.
- A vote is now "I've hit this too" and a hand raise is "I've dealt with this".
  Neither is capped (migration 023).
- Hidden for the month:
  - Top-3 medals.
  - Category badges.
  - The Top contributors rail.
  - The quota strip.
- Bytes stays on. It has its own switch, `HIDE_BYTES`, in the same file.
- `POST /api/topics` now refuses submissions once `meeting_at` has passed. That
  matches what the board already shows.

## Before the announcement

1. Apply migration 021 (already required by `main`), then 023.
2. In Admin, **open** this month's cycle and set `meeting_at`. Don't freeze it.
   - A frozen cycle still shows the button but rejects the post.
   - With no `meeting_at` set, the board shows a guessed date and never locks.
3. Post your own problem first, so the board isn't empty when people arrive.

## Running the hour

| Part | Time | What happens |
|---|---|---|
| Opening | 5 min | One sentence on why the format changed, then walk through your own problem as the example. |
| Breakouts | 30 min | Groups of 4–5. Each person shares their problem for about 3 min, then the group picks one to dig into. Spread the most "hit this too" problems across groups. Use "I've dealt with this" to seed a helper into each group. |
| Report back | 15 min | Each group shares one problem and the best idea that came up. |
| Close | 5 min | Show of hands: "Did anyone leave with something they'll actually try?" and "Should we do this again?" |

## What to write down afterward

Record these by hand:
- How many submissions came from DMs versus the announcement.
- How many distinct people spoke. The baseline is roughly 4–5.
- The two show-of-hands answers.

The rest comes from the database. Replace `:cycle_id` with the cycle's id.

```sql
-- Distinct people who shared a problem
SELECT COUNT(DISTINCT user_id) FROM topics
WHERE cycle_id = :cycle_id AND is_deleted = FALSE;

-- Distinct people who marked "I've hit this too", and how many marks each
SELECT COUNT(DISTINCT user_id) AS people, COUNT(*) AS marks
FROM votes WHERE cycle_id = :cycle_id;

-- Distinct people who said "I've dealt with this"
SELECT COUNT(DISTINCT user_id) FROM contributions WHERE cycle_id = :cycle_id;

-- Did the conversation continue after the meeting?
SELECT t.title, COUNT(c.id) AS comments_after_meeting
FROM comments c
JOIN topics t ON t.id = c.topic_id
JOIN cycles cy ON cy.id = t.cycle_id
WHERE t.cycle_id = :cycle_id
  AND c.is_deleted = FALSE
  AND c.created_at > cy.meeting_at
GROUP BY t.title
ORDER BY comments_after_meeting DESC;
```

## Going back

1. Set `PROBLEM_MONTH = false`.
2. Restore the caps with the two `CREATE TRIGGER` statements in the header of
   `023_problem_month_unlimited_signals.sql`, as a new migration.

Problems posted this month keep their "What I've tried" sections in the description.
