# SEMANTIC_GRAPH.md — GuildBoard Knowledge Graph

> **Purpose:** This file is the authoritative knowledge graph of the GuildBoard codebase.  
> It is updated after every implementation step and should allow any developer to understand the full architecture without reading source code.

---

## Project Overview

- **App name:** GuildBoard
- **Purpose:** A structured, async topic discovery and voting platform for engineering guild meetings.
- **Stack:** Next.js 14 (App Router), Supabase (Auth + DB + Realtime), Vercel (hosting), Tailwind CSS
- **Auth:** Google OAuth via Supabase Auth
- **DB:** PostgreSQL via Supabase with RLS enabled on all tables
- **Real-time:** Supabase Realtime subscriptions for live vote counts
- **Key concepts:** Cycles (monthly windows), Topics, Votes, Contributions, Sparks, Admin Panel

---

## File Tree

```
guildboard/
├── .env.example
├── .env.local              ← gitignored
├── .gitignore
├── AGENTS.md
├── CLAUDE.md
├── Plan.md
├── SEMANTIC_GRAPH.md
├── eslint.config.mjs
├── next-env.d.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts (generated)
├── tsconfig.json
├── public/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← (Prompt 5)
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── layout.tsx               ← Root layout
    │   ├── page.tsx                 ← Home: current cycle topic board
    │   ├── (auth)/
    │   │   └── login/
    │   │       └── page.tsx
    │   ├── (main)/
    │   │   ├── layout.tsx
    │   │   ├── archive/
    │   │   │   └── page.tsx
    │   │   ├── profile/
    │   │   │   └── page.tsx
    │   │   └── submit/
    │   │       └── page.tsx
    │   ├── admin/
    │   │   └── page.tsx
    │   └── api/
    │       ├── cycles/
    │       │   └── route.ts
    │       ├── topics/
    │       │   └── route.ts
    │       ├── votes/
    │       │   └── route.ts
    │       ├── contributions/
    │       │   └── route.ts
    │       ├── sparks/
    │       │   └── route.ts
    │       └── admin/
    │           ├── cycle-control/
    │           │   └── route.ts
    │           ├── outcome/
    │           │   └── route.ts
    │           └── select-topic/
    │               └── route.ts
    ├── components/
    │   ├── admin/
    │   │   ├── AdminTopicRow.tsx
    │   │   ├── CycleControls.tsx
    │   │   └── OutcomeTagger.tsx
    │   ├── auth/
    │   │   └── UsernameSetupModal.tsx
    │   ├── layout/
    │   │   ├── CycleStatusBanner.tsx
    │   │   ├── Footer.tsx
    │   │   └── Navbar.tsx
    │   ├── topics/
    │   │   ├── TopicCard.tsx
    │   │   ├── TopicForm.tsx
    │   │   └── TopicList.tsx
    │   ├── ui/
    │   │   ├── Badge.tsx
    │   │   ├── Button.tsx
    │   │   ├── Card.tsx
    │   │   ├── Input.tsx
    │   │   └── Modal.tsx
    │   └── voting/
    │       ├── ContribButton.tsx
    │       ├── SparkButton.tsx
    │       └── VoteButton.tsx
    ├── hooks/
    │   ├── useAuth.ts
    │   ├── useCurrentCycle.ts
    │   ├── useTopics.ts
    │   └── useUserTokens.ts
    ├── lib/
    │   ├── constants.ts
    │   ├── supabase/
    │   │   ├── admin.ts
    │   │   ├── client.ts
    │   │   └── server.ts
    │   └── utils/
    │       ├── cn.ts
    │       ├── cycle.ts
    │       └── scoring.ts
    └── types/
        └── index.ts
```

---

## Module Registry

### src/types/index.ts
- **Type:** type definition
- **Purpose:** Single source of truth for all TypeScript types and interfaces used across the app.
- **Exports:** `UserRole`, `CycleStatus`, `CategoryTag`, `TopicStatus`, `OutcomeTag`, `User`, `PublicUser`, `Cycle`, `Topic`, `Vote`, `Contribution`, `Spark`, `UserTokens`, `TopicScore`
- **Imports from:** (none)
- **Used by:** all components, hooks, API routes, and utility files
- **DB Tables:** maps to `users`, `cycles`, `topics`, `votes`, `contributions`, `sparks`
- **Notes:** `User.real_name` and `User.email` are admin-only fields; non-admin responses use `PublicUser`

### src/lib/constants.ts
- **Type:** utility
- **Purpose:** App-wide constants for token limits, category labels/bonuses, outcome labels, and field constraints.
- **Exports:** `TOKEN_LIMITS`, `CATEGORY_LABELS`, `CATEGORY_BONUS`, `OUTCOME_LABELS`, `ANONYMOUS_USERNAME`, `TITLE_MAX_LENGTH`, `DESCRIPTION_MAX_LENGTH`, `OUTCOME_NOTE_MAX_LENGTH`, `SPARK_WINDOW_HOURS`, `CARRY_FORWARD_MIN_VOTES`, `HALL_OF_FLAME_THRESHOLD`
- **Imports from:** (none)
- **Used by:** `src/lib/utils/scoring.ts`, `src/lib/utils/cycle.ts`, API routes, components
- **DB Tables:** (none — pure constants)
- **Notes:** `HALL_OF_FLAME_THRESHOLD` is hardcoded at 5; admin-configurable in V2

### src/lib/utils/scoring.ts
- **Type:** utility
- **Purpose:** Topic ranking score calculation — base score from votes/contribs plus category bonus.
- **Exports:** `calculateScore`, `rankTopics`, `getTopicScore`
- **Imports from:** `@/lib/constants`, `@/types`
- **Used by:** Admin panel score display, topic board sorting
- **DB Tables:** (none — pure computation)
- **Notes:** Score formula: `(votes × 1 + contribs × 2) × (1 + category_bonus)`. DB triggers also compute this independently to keep `topics.score` denormalized.

### src/lib/utils/cycle.ts
- **Type:** utility
- **Purpose:** Cycle phase helper functions to determine what actions are currently allowed.
- **Exports:** `isOpen`, `isFrozen`, `isClosed`, `isSubmissionAllowed`, `isVotingAllowed`, `isSparkWindowActive`
- **Imports from:** `@/types`, `@/lib/constants`
- **Used by:** API route guards, `useCurrentCycle` hook, UI gating logic
- **DB Tables:** (none — pure logic on Cycle object)
- **Notes:** `isSparkWindowActive` checks `spark_closes_at` timestamp, not just cycle status

### src/lib/utils/cn.ts
- **Type:** utility
- **Purpose:** Tailwind class merge utility combining clsx and tailwind-merge to avoid conflicting class names.
- **Exports:** `cn`
- **Imports from:** `clsx`, `tailwind-merge`
- **Used by:** all components that conditionally apply Tailwind classes
- **DB Tables:** (none)
- **Notes:** Standard shadcn/ui pattern

### src/proxy.ts
- **Type:** proxy (formerly middleware)
- **Purpose:** Auth guard — redirects unauthenticated users to /login; returns 404 for non-admins on /admin routes; refreshes Supabase session cookies on every request.
- **Exports:** `proxy` (named), `config`
- **Imports from:** `@supabase/ssr`, `next/server`
- **Used by:** Next.js runtime (automatically applied to matched routes)
- **DB Tables:** `users` (role check for /admin)
- **Notes:** Replaces deprecated `middleware.ts` convention as of Next.js 16. Must NOT be called from app code. Skips enforcement when `NEXT_PUBLIC_SUPABASE_URL` is not configured.
- **Type:** utility
- **Purpose:** Browser-side Supabase client for use in Client Components only.
- **Exports:** `createClient`
- **Imports from:** `@supabase/ssr`
- **Used by:** `src/hooks/useAuth.ts`, `src/hooks/useTopics.ts`, all client-side data hooks
- **DB Tables:** (all — depends on calling context)
- **Notes:** Uses ANON key only. Safe for browser. RLS enforced by Supabase.

### src/lib/supabase/server.ts
- **Type:** utility
- **Purpose:** Server-side Supabase client for Server Components and API Routes; reads/writes cookies for session management.
- **Exports:** `createClient` (async)
- **Imports from:** `@supabase/ssr`, `next/headers`
- **Used by:** all `src/app/api/*/route.ts` files (non-admin), Server Components
- **DB Tables:** (all — depends on calling context)
- **Notes:** Must be called with `await`. Uses ANON key; RLS is enforced.

### src/lib/supabase/admin.ts
- **Type:** utility
- **Purpose:** Service-role Supabase client that bypasses RLS. Strictly for admin API routes.
- **Exports:** `createAdminClient`
- **Imports from:** `@supabase/supabase-js`
- **Used by:** `src/app/api/admin/*/route.ts` only
- **DB Tables:** (all — unrestricted)
- **Notes:** NEVER import in client components or non-admin routes. Uses `SUPABASE_SERVICE_ROLE_KEY`.

---

## Data Flow Map

> Data flows will be documented as features are implemented.

---

## Type Registry

### UserRole
- **Maps to DB:** `users.role` column
- **Used in:** `User`, middleware, admin guards
- **Values:** `'user' | 'admin'`

### CycleStatus
- **Maps to DB:** `cycles.status` column
- **Used in:** `Cycle`, `useCurrentCycle`, cycle utility functions, API route guards
- **Values:** `'upcoming' | 'open' | 'frozen' | 'closed'`

### CategoryTag
- **Maps to DB:** `topics.category` column
- **Used in:** `Topic`, `TopicForm`, `TopicCard`, scoring utilities, constants
- **Values:** `'deep_dive' | 'discussion' | 'blog_idea' | 'project_showcase'`

### TopicStatus
- **Maps to DB:** `topics.status` column
- **Used in:** `Topic`, carry-forward logic, archive page
- **Values:** `'active' | 'selected' | 'carry_forward' | 'dropped'`

### OutcomeTag
- **Maps to DB:** `topics.outcome_tag` column
- **Used in:** `Topic`, admin outcome tagger, archive page
- **Values:** `'discussed' | 'blog_born' | 'project_started' | 'carry_forward' | 'dropped'`

### User
- **Maps to DB:** `public.users`
- **Used in:** `useAuth`, admin panel, server-side user checks
- **Admin-only fields:** `real_name`, `email`

### PublicUser
- **Maps to DB:** subset of `public.users`
- **Used in:** non-admin facing components, spark award modal
- **Notes:** Safe to expose to all authenticated users

### Cycle
- **Maps to DB:** `public.cycles`
- **Used in:** `useCurrentCycle`, cycle API route, CycleStatusBanner, all phase-gated UI

### Topic
- **Maps to DB:** `public.topics`
- **Used in:** `useTopics`, TopicCard, TopicForm, TopicList, all topic API routes
- **Notes:** `author_username` is a joined field — set to `'ghost_dev'` for anonymous topics in non-admin context

### Vote
- **Maps to DB:** `public.votes`
- **Used in:** votes API route, `useUserTokens`

### Contribution
- **Maps to DB:** `public.contributions`
- **Used in:** contributions API route, `useUserTokens`

### Spark
- **Maps to DB:** `public.sparks`
- **Used in:** sparks API route, profile page

### UserTokens
- **Maps to DB:** derived from `votes`, `contributions`, `topics`, `sparks` counts
- **Used in:** `useUserTokens`, VoteButton, ContribButton, SparkButton, submit page guard

### TopicScore
- **Maps to DB:** (none — computed value)
- **Used in:** `getTopicScore` utility, admin score breakdown tooltip

---

## Environment Variables

| Variable | Used In | Browser-exposed | Controls |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `client.ts`, `server.ts`, `admin.ts`, `proxy.ts` | Yes | Supabase project API endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `client.ts`, `server.ts`, `proxy.ts` | Yes | Publishable (anon-equivalent) key; RLS enforced by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `admin.ts` only | **No** | Bypasses RLS — admin API routes only. Get from Supabase dashboard → Settings → API |

---

## RLS Policy Register

> All Supabase Row Level Security policies will be documented here after Prompt 5.

| Table | Policy Name | Operation | Rule | Purpose |
| --- | --- | --- | --- | --- |

---

## DB Trigger Register

> All database triggers will be documented here after Prompt 5.

| Trigger Name | Table | Event | Function Called | Effect |
| --- | --- | --- | --- | --- |

---

## Change Log

| Step | Description | Date |
| --- | --- | --- |
| STEP 0 | Project initialized. SEMANTIC_GRAPH.md created. | 2026-04-10 |
| STEP 1 | Next.js 14 App Router scaffolded. Full folder structure created (46 files). | 2026-04-12 |
| STEP 2 | All TypeScript types defined in src/types/index.ts. Type Registry populated. | 2026-04-12 |
| STEP 3 | Constants, scoring, cycle, and cn utilities written. clsx + tailwind-merge installed. | 2026-04-12 |
| STEP 4 | Supabase browser, server, and admin clients configured. Env vars documented. Key: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (not ANON_KEY). | 2026-04-12 |
| STEP 4b | Supabase setup verified with real credentials. middleware.ts renamed to proxy.ts per Next.js 16 convention. .env.example updated. | 2026-04-12 |
| STEP 5 | Full PostgreSQL schema with RLS, triggers, and DB functions written to supabase/migrations/001_initial_schema.sql. | 2026-04-12 |
| STEP 6 | Authentication flow implemented: OAuth login, callback, middleware (proxy.ts), username setup modal. | 2026-04-12 |
| STEP 7 | All 8 API routes implemented with auth guards and comment headers. | 2026-04-12 |
| STEP 8 | Realtime hooks and Topic Board UI implemented with optimistic updates. | 2026-04-12 |
