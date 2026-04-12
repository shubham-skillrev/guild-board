# GuildBoard — Copilot Project Setup Prompts
**PRD Version:** V1 (Alpha) | **Stack:** Next.js 14 + Supabase + Vercel + Tailwind CSS  
**Author:** Shubham Dalvi | **Purpose:** Production-grade app setup with full semantic graph documentation

---

> **How to use these prompts:**  
> Each prompt is a self-contained instruction block for GitHub Copilot (Chat or Workspace mode).  
> Run them **in order**. Each prompt ends with a documentation directive — Copilot must log what it did into a `SEMANTIC_GRAPH.md` file so a full knowledge graph of the repo can be assembled at the end.  
> Do NOT skip steps. Do NOT rename files unless a prompt explicitly says to.

---

## PROMPT 0 — Project Bootstrap & Documentation Contract

```
You are setting up a production-grade Next.js 14 application called GuildBoard.
Before writing any code, establish the documentation contract for this project.

1. Create a file at the root called `SEMANTIC_GRAPH.md`.
2. Inside it, create the following top-level sections:
   - ## Project Overview
   - ## File Tree (updated after every step)
   - ## Module Registry (every file gets an entry: path, purpose, exports, dependencies, notes)
   - ## Data Flow Map (which components call which APIs, which APIs touch which DB tables)
   - ## Type Registry (all TypeScript types and interfaces, where they are defined, where they are used)
   - ## Environment Variables (all env vars the project needs, what they control)
   - ## RLS Policy Register (all Supabase Row Level Security policies and what they protect)
   - ## DB Trigger Register (all database triggers and what they automate)
   - ## Change Log (every prompt step logged as a timestamped entry)

3. Under ## Project Overview, write:
   - App name: GuildBoard
   - Purpose: A structured, async topic discovery and voting platform for engineering guild meetings.
   - Stack: Next.js 14 (App Router), Supabase (Auth + DB + Realtime), Vercel (hosting), Tailwind CSS
   - Auth: Google OAuth via Supabase Auth
   - DB: PostgreSQL via Supabase with RLS enabled on all tables
   - Real-time: Supabase Realtime subscriptions for live vote counts
   - Key concepts: Cycles (monthly windows), Topics, Votes, Contributions, Sparks, Admin Panel

4. Under ## Change Log, log: "STEP 0 — Project initialized. SEMANTIC_GRAPH.md created."

Do not scaffold any Next.js code yet. Only create SEMANTIC_GRAPH.md.
```

---

## PROMPT 1 — Scaffold Next.js 14 Project

```
Scaffold a Next.js 14 project with the App Router for GuildBoard.

Run the following commands and document each one:
- `npx create-next-app@latest guildboard --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"`

After scaffolding:
1. Delete the default boilerplate content inside `src/app/page.tsx` and `src/app/globals.css` (keep the file, clear the content).
2. Create the following folder structure inside `src/`:

src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx          ← Login page (Google OAuth)
│   ├── (main)/
│   │   ├── layout.tsx            ← Authenticated layout with nav
│   │   ├── page.tsx              ← Home: current cycle topic board
│   │   ├── submit/
│   │   │   └── page.tsx          ← Topic submission form
│   │   ├── archive/
│   │   │   └── page.tsx          ← Archived topics by month
│   │   └── profile/
│   │       └── page.tsx          ← User profile and spark history
│   ├── admin/
│   │   └── page.tsx              ← Admin panel (404 for non-admins)
│   ├── api/
│   │   ├── topics/
│   │   │   └── route.ts          ← GET all topics, POST new topic
│   │   ├── votes/
│   │   │   └── route.ts          ← POST/DELETE vote on a topic
│   │   ├── contributions/
│   │   │   └── route.ts          ← POST/DELETE contribution flag
│   │   ├── sparks/
│   │   │   └── route.ts          ← POST spark to a user
│   │   ├── cycles/
│   │   │   └── route.ts          ← GET current cycle (admin: all cycles)
│   │   └── admin/
│   │       ├── select-topic/
│   │       │   └── route.ts      ← PATCH topic selected status
│   │       ├── outcome/
│   │       │   └── route.ts      ← PATCH topic outcome_tag and outcome_note
│   │       └── cycle-control/
│   │           └── route.ts      ← PATCH cycle status (open/freeze/close)
│   ├── layout.tsx                ← Root layout
│   └── globals.css
├── components/
│   ├── ui/                       ← Reusable primitives (Button, Badge, Card, Input, Modal)
│   ├── topics/                   ← TopicCard, TopicForm, TopicList
│   ├── voting/                   ← VoteButton, ContribButton, SparkButton
│   ├── admin/                    ← AdminTopicRow, CycleControls, OutcomeTagger
│   ├── layout/                   ← Navbar, CycleStatusBanner, Footer
│   └── auth/                     ← UsernameSetupModal
├── lib/
│   ├── supabase/
│   │   ├── client.ts             ← Browser-side Supabase client
│   │   ├── server.ts             ← Server-side Supabase client (cookies)
│   │   └── admin.ts              ← Service-role Supabase client (admin API routes only)
│   ├── utils/
│   │   ├── scoring.ts            ← Topic ranking score calculation
│   │   ├── cycle.ts              ← Cycle phase helpers (isOpen, isFrozen, isSparkActive)
│   │   └── cn.ts                 ← Tailwind class merge utility
│   └── constants.ts              ← App-wide constants (token limits, category tags, etc.)
├── hooks/
│   ├── useCurrentCycle.ts        ← Fetches and caches current cycle
│   ├── useTopics.ts              ← Fetches topics, subscribes to realtime updates
│   ├── useUserTokens.ts          ← Tracks remaining votes/contribs for current user in cycle
│   └── useAuth.ts                ← Current user session and role
└── types/
    └── index.ts                  ← All TypeScript types (User, Topic, Cycle, Vote, Spark, etc.)

3. After creating the structure, update SEMANTIC_GRAPH.md:
   - Update ## File Tree with the full folder structure
   - Log in ## Change Log: "STEP 1 — Next.js 14 App Router scaffolded. Full folder structure created."

Only create empty files with a single comment `// TODO` inside each. Do not write any logic yet.
```

---

## PROMPT 2 — TypeScript Type Definitions

```
Define all TypeScript types for GuildBoard in `src/types/index.ts`.

Write the following types exactly:

```typescript
// src/types/index.ts

export type UserRole = 'user' | 'admin'

export type CycleStatus = 'upcoming' | 'open' | 'frozen' | 'closed'

export type CategoryTag = 'deep_dive' | 'discussion' | 'blog_idea' | 'project_showcase'

export type TopicStatus = 'active' | 'selected' | 'carry_forward' | 'dropped'

export type OutcomeTag = 'discussed' | 'blog_born' | 'project_started' | 'carry_forward' | 'dropped'

export interface User {
  id: string
  username: string
  real_name: string         // Admin-visible only
  email: string             // Admin-visible only
  role: UserRole
  spark_count: number
  hall_of_flame: boolean
  created_at: string
}

export interface PublicUser {
  id: string
  username: string
  spark_count: number
  hall_of_flame: boolean
}

export interface Cycle {
  id: string
  label: string
  month: number
  year: number
  status: CycleStatus
  opens_at: string | null
  freezes_at: string | null
  meeting_at: string | null
  spark_closes_at: string | null
  created_at: string
}

export interface Topic {
  id: string
  cycle_id: string
  user_id: string
  is_anonymous: boolean
  title: string
  description: string
  category: CategoryTag
  vote_count: number
  contrib_count: number
  score: number
  is_selected: boolean
  is_deleted: boolean
  status: TopicStatus
  outcome_tag: OutcomeTag | null
  outcome_note: string | null
  override_reason: string | null
  created_at: string
  // Joined fields
  author_username?: string  // 'ghost_dev' if anonymous (for non-admins)
}

export interface Vote {
  id: string
  topic_id: string
  user_id: string
  cycle_id: string
  created_at: string
}

export interface Contribution {
  id: string
  topic_id: string
  user_id: string
  cycle_id: string
  created_at: string
}

export interface Spark {
  id: string
  from_user_id: string
  to_user_id: string
  cycle_id: string
  created_at: string
}

export interface UserTokens {
  votes_remaining: number       // Max 3 per cycle
  contribs_remaining: number    // Max 2 per cycle
  spark_given: boolean          // True if user gave spark this cycle
  topic_submitted: boolean      // True if user submitted a topic this cycle
}

export interface TopicScore {
  topic_id: string
  raw_votes: number
  raw_contribs: number
  category_bonus: number
  final_score: number
}
```

After writing the file, update SEMANTIC_GRAPH.md:
- Under ## Type Registry, document every type: its name, file location, purpose, and which DB table it maps to (if any)
- Log in ## Change Log: "STEP 2 — All TypeScript types defined in src/types/index.ts. Type Registry populated."
```

---

## PROMPT 3 — Constants & Utility Functions

```
Write the constants and utility files for GuildBoard.

**File 1: `src/lib/constants.ts`**
```typescript
export const TOKEN_LIMITS = {
  VOTES_PER_CYCLE: 3,
  CONTRIBS_PER_CYCLE: 2,
  SPARKS_PER_CYCLE: 1,
  TOPICS_PER_CYCLE: 1,
} as const

export const CATEGORY_LABELS: Record<string, string> = {
  deep_dive: 'Deep Dive',
  discussion: 'Discussion',
  blog_idea: 'Blog Idea',
  project_showcase: 'Project Showcase',
}

export const CATEGORY_BONUS: Record<string, number> = {
  deep_dive: 0.10, // +10% of base score
  discussion: 0,
  blog_idea: 0,
  project_showcase: 0,
}

export const OUTCOME_LABELS: Record<string, string> = {
  discussed: 'Discussed',
  blog_born: 'Blog Born',
  project_started: 'Project Started',
  carry_forward: 'Carry Forward',
  dropped: 'Dropped',
}

export const ANONYMOUS_USERNAME = 'ghost_dev'

export const TITLE_MAX_LENGTH = 80
export const DESCRIPTION_MAX_LENGTH = 300
export const OUTCOME_NOTE_MAX_LENGTH = 500

export const SPARK_WINDOW_HOURS = 48
export const CARRY_FORWARD_MIN_VOTES = 2

export const HALL_OF_FLAME_THRESHOLD = 5 // Sparks needed for badge (admin-configurable in V2)
```

**File 2: `src/lib/utils/scoring.ts`**
```typescript
import { CATEGORY_BONUS } from '@/lib/constants'
import type { Topic, TopicScore } from '@/types'

export function calculateScore(
  votes: number,
  contribs: number,
  category: string
): number {
  const base = votes * 1 + contribs * 2
  const bonus = base * (CATEGORY_BONUS[category] ?? 0)
  return parseFloat((base + bonus).toFixed(2))
}

export function rankTopics(topics: Topic[]): Topic[] {
  return [...topics].sort((a, b) => b.score - a.score)
}

export function getTopicScore(topic: Topic): TopicScore {
  const base = topic.vote_count * 1 + topic.contrib_count * 2
  const bonus = base * (CATEGORY_BONUS[topic.category] ?? 0)
  return {
    topic_id: topic.id,
    raw_votes: topic.vote_count,
    raw_contribs: topic.contrib_count,
    category_bonus: parseFloat(bonus.toFixed(2)),
    final_score: parseFloat((base + bonus).toFixed(2)),
  }
}
```

**File 3: `src/lib/utils/cycle.ts`**
```typescript
import type { Cycle } from '@/types'
import { SPARK_WINDOW_HOURS } from '@/lib/constants'

export function isOpen(cycle: Cycle | null): boolean {
  return cycle?.status === 'open'
}

export function isFrozen(cycle: Cycle | null): boolean {
  return cycle?.status === 'frozen'
}

export function isClosed(cycle: Cycle | null): boolean {
  return cycle?.status === 'closed'
}

export function isSubmissionAllowed(cycle: Cycle | null): boolean {
  return isOpen(cycle)
}

export function isVotingAllowed(cycle: Cycle | null): boolean {
  return isOpen(cycle)
}

export function isSparkWindowActive(cycle: Cycle | null): boolean {
  if (!cycle || cycle.status !== 'closed') return false
  if (!cycle.spark_closes_at) return false
  return new Date() < new Date(cycle.spark_closes_at)
}
```

**File 4: `src/lib/utils/cn.ts`**
```typescript
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Install required packages: `npm install clsx tailwind-merge`

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Module Registry, add entries for all 4 files: path, purpose, all exported functions/constants, dependencies
- Log in ## Change Log: "STEP 3 — Constants, scoring, cycle, and cn utilities written."
```

---

## PROMPT 4 — Supabase Client Setup

```
Set up all Supabase clients for GuildBoard. There are three separate clients for different contexts.

**Install packages first:**
`npm install @supabase/supabase-js @supabase/ssr`

**File 1: `src/lib/supabase/client.ts`** — Browser-side client (for client components)
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**File 2: `src/lib/supabase/server.ts`** — Server-side client (for Server Components and API Routes)
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
```

**File 3: `src/lib/supabase/admin.ts`** — Service-role client (for admin API routes ONLY — bypasses RLS)
```typescript
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// WARNING: This client bypasses RLS. Only import in /api/admin/* routes.
// Never expose to the browser or client components.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**File 4: `.env.local`** — Create with placeholder values
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**File 5: `.env.example`** — Commit-safe version of env file
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Add `.env.local` to `.gitignore` if not already present.

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Environment Variables, document all 3 env vars: name, which client uses it, whether it is exposed to browser, what it controls
- Under ## Module Registry, add entries for all 3 client files
- Log in ## Change Log: "STEP 4 — Supabase browser, server, and admin clients configured. Env vars documented."
```

---

## PROMPT 5 — Supabase Database Schema & SQL

```
Create the full Supabase PostgreSQL schema for GuildBoard as a SQL migration file.

Create file: `supabase/migrations/001_initial_schema.sql`

Write the following SQL exactly:

```sql
-- ============================================================
-- GuildBoard V1 — Initial Schema
-- All tables use UUID PKs and timestamptz created_at
-- RLS is enabled on every table
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- Maps 1:1 with Supabase auth.users
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  real_name     TEXT,
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  spark_count   INTEGER NOT NULL DEFAULT 0,
  hall_of_flame BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: cycles
-- ============================================================
CREATE TABLE public.cycles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label           TEXT NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'frozen', 'closed')),
  opens_at        TIMESTAMPTZ,
  freezes_at      TIMESTAMPTZ,
  meeting_at      TIMESTAMPTZ,
  spark_closes_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: topics
-- ============================================================
CREATE TABLE public.topics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id        UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 80),
  description     TEXT NOT NULL CHECK (char_length(description) <= 300),
  category        TEXT NOT NULL CHECK (category IN ('deep_dive', 'discussion', 'blog_idea', 'project_showcase')),
  vote_count      INTEGER NOT NULL DEFAULT 0,
  contrib_count   INTEGER NOT NULL DEFAULT 0,
  score           NUMERIC NOT NULL DEFAULT 0,
  is_selected     BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'selected', 'carry_forward', 'dropped')),
  outcome_tag     TEXT CHECK (outcome_tag IN ('discussed', 'blog_born', 'project_started', 'carry_forward', 'dropped')),
  outcome_note    TEXT CHECK (char_length(outcome_note) <= 500),
  override_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: votes
-- ============================================================
CREATE TABLE public.votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_id   UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, user_id)
);

-- ============================================================
-- TABLE: contributions
-- ============================================================
CREATE TABLE public.contributions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_id   UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, user_id)
);

-- ============================================================
-- TABLE: sparks
-- ============================================================
CREATE TABLE public.sparks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_id     UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_user_id, cycle_id)
);

-- ============================================================
-- DB FUNCTIONS — Token enforcement
-- ============================================================

-- Enforce max 3 votes per user per cycle before inserting a vote
CREATE OR REPLACE FUNCTION check_vote_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.votes
    WHERE user_id = NEW.user_id AND cycle_id = NEW.cycle_id
  ) >= 3 THEN
    RAISE EXCEPTION 'Vote limit reached: max 3 votes per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_vote_limit
BEFORE INSERT ON public.votes
FOR EACH ROW EXECUTE FUNCTION check_vote_limit();

-- Enforce max 1 topic per user per cycle
CREATE OR REPLACE FUNCTION check_topic_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.topics
    WHERE user_id = NEW.user_id AND cycle_id = NEW.cycle_id AND is_deleted = FALSE
  ) >= 1 THEN
    RAISE EXCEPTION 'Topic limit reached: max 1 topic per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_topic_limit
BEFORE INSERT ON public.topics
FOR EACH ROW EXECUTE FUNCTION check_topic_limit();

-- Enforce max 2 contributions per user per cycle
CREATE OR REPLACE FUNCTION check_contrib_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.contributions
    WHERE user_id = NEW.user_id AND cycle_id = NEW.cycle_id
  ) >= 2 THEN
    RAISE EXCEPTION 'Contribution limit reached: max 2 per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_contrib_limit
BEFORE INSERT ON public.contributions
FOR EACH ROW EXECUTE FUNCTION check_contrib_limit();

-- ============================================================
-- DB TRIGGERS — Denormalized counter maintenance
-- ============================================================

-- Update topics.vote_count and topics.score on vote insert/delete
CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER AS $$
DECLARE
  v_category TEXT;
  v_votes INTEGER;
  v_contribs INTEGER;
  v_base NUMERIC;
  v_bonus NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET vote_count = vote_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;

  -- Recalculate score
  SELECT category, vote_count, contrib_count INTO v_category, v_votes, v_contribs
  FROM public.topics WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  v_base := (v_votes * 1) + (v_contribs * 2);
  v_bonus := CASE WHEN v_category = 'deep_dive' THEN v_base * 0.10 ELSE 0 END;

  UPDATE public.topics SET score = v_base + v_bonus
  WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_vote_change
AFTER INSERT OR DELETE ON public.votes
FOR EACH ROW EXECUTE FUNCTION update_vote_count();

-- Update topics.contrib_count and score on contribution insert/delete
CREATE OR REPLACE FUNCTION update_contrib_count()
RETURNS TRIGGER AS $$
DECLARE
  v_category TEXT;
  v_votes INTEGER;
  v_contribs INTEGER;
  v_base NUMERIC;
  v_bonus NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET contrib_count = contrib_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET contrib_count = GREATEST(contrib_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;

  SELECT category, vote_count, contrib_count INTO v_category, v_votes, v_contribs
  FROM public.topics WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  v_base := (v_votes * 1) + (v_contribs * 2);
  v_bonus := CASE WHEN v_category = 'deep_dive' THEN v_base * 0.10 ELSE 0 END;

  UPDATE public.topics SET score = v_base + v_bonus
  WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_contrib_change
AFTER INSERT OR DELETE ON public.contributions
FOR EACH ROW EXECUTE FUNCTION update_contrib_count();

-- Increment users.spark_count on spark insert and check hall_of_flame threshold
CREATE OR REPLACE FUNCTION update_spark_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    spark_count = spark_count + 1,
    hall_of_flame = (spark_count + 1 >= 5)
  WHERE id = NEW.to_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_spark_given
AFTER INSERT ON public.sparks
FOR EACH ROW EXECUTE FUNCTION update_spark_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sparks ENABLE ROW LEVEL SECURITY;

-- users: anyone authenticated can read public fields; only service role sees real_name/email
CREATE POLICY "Users can read own row" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own username" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- cycles: all authenticated users can read
CREATE POLICY "Authenticated users can read cycles" ON public.cycles
  FOR SELECT USING (auth.role() = 'authenticated');

-- topics: authenticated can read non-deleted topics; owner can insert; service role manages rest
CREATE POLICY "Authenticated users can read active topics" ON public.topics
  FOR SELECT USING (auth.role() = 'authenticated' AND is_deleted = FALSE);

CREATE POLICY "Authenticated users can insert own topic" ON public.topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- votes: user can insert/delete own votes; all can read vote_count (via topics)
CREATE POLICY "Users can manage own votes" ON public.votes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read votes" ON public.votes
  FOR SELECT USING (auth.role() = 'authenticated');

-- contributions: same pattern as votes
CREATE POLICY "Users can manage own contributions" ON public.contributions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read contributions" ON public.contributions
  FOR SELECT USING (auth.role() = 'authenticated');

-- sparks: authenticated can insert own spark; all can read
CREATE POLICY "Users can insert own spark" ON public.sparks
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Authenticated users can read sparks" ON public.sparks
  FOR SELECT USING (auth.role() = 'authenticated');
```

After writing the file, update SEMANTIC_GRAPH.md:
- Under ## RLS Policy Register, document every policy: table, policy name, operation, rule, why it exists
- Under ## DB Trigger Register, document every trigger and function: name, table, event, what it does, what denormalized field it maintains
- Under ## Data Flow Map, add a section "Database Layer" showing which tables have FK relationships
- Log in ## Change Log: "STEP 5 — Full PostgreSQL schema with RLS, triggers, and DB functions written to supabase/migrations/001_initial_schema.sql"
```

---

## PROMPT 6 — Authentication Flow

```
Implement the full authentication flow for GuildBoard using Supabase Auth and Google OAuth.

**File 1: `src/app/(auth)/login/page.tsx`**
- Server Component
- Show GuildBoard branding (name + one-line description)
- A single "Sign in with Google" button
- On click, calls Supabase `signInWithOAuth` with provider `google`
- Redirect after auth to `/` 
- If user is already signed in, redirect to `/`

**File 2: `src/app/api/auth/callback/route.ts`** — OAuth callback handler
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Check if user exists in public.users
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, username')
        .eq('id', data.user.id)
        .single()

      if (!existingUser) {
        // First login — create user row without username (triggers username setup modal)
        await supabase.from('users').insert({
          id: data.user.id,
          email: data.user.email,
          real_name: data.user.user_metadata?.full_name ?? '',
          username: '', // Empty triggers username setup
        })
        return NextResponse.redirect(`${origin}/?setup=username`)
      }

      if (!existingUser.username) {
        return NextResponse.redirect(`${origin}/?setup=username`)
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
```

**File 3: `src/hooks/useAuth.ts`**
- Client-side hook
- Returns: `{ user, publicUser, isAdmin, isLoading, signOut }`
- Uses `createClient()` from browser client
- Subscribes to `onAuthStateChange`
- Fetches user role from `public.users` table

**File 4: `src/components/auth/UsernameSetupModal.tsx`**
- Modal shown when `?setup=username` is in URL
- Input: username (alphanumeric + underscore, 3-30 chars, lowercase)
- Validates uniqueness via API call before submit
- On submit, PATCHes `/api/auth/setup-username`
- Removes `?setup=username` from URL after success
- Cannot be dismissed — user MUST set username to proceed

**File 5: `src/app/api/auth/setup-username/route.ts`**
- POST: sets username for current user
- Validates: min 3 chars, max 30, alphanumeric + underscore only, unique
- Returns 409 if username taken, 200 on success

**File 6: `src/middleware.ts`** — Auth guard
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // Redirect unauthenticated users from protected routes to /login
  // Admin route: return 404 response for non-admins (do not redirect — 404 hides existence)
  // Public routes: /login, /api/auth/* — pass through
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/auth).*)'],
}
```

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Data Flow Map, add "Auth Flow": login page → Supabase OAuth → callback route → user row creation → username setup → home
- Under ## Module Registry, add entries for all 6 files
- Log in ## Change Log: "STEP 6 — Authentication flow implemented: OAuth, callback, middleware, username setup modal."
```

---

## PROMPT 7 — Core API Routes

```
Implement all core API routes for GuildBoard. Every route must:
- Use the server Supabase client (not admin) unless explicitly marked [ADMIN]
- Validate that the user is authenticated before any DB operation
- Return proper HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500)
- Never expose real_name or email fields in non-admin routes

**Route 1: `src/app/api/cycles/route.ts`**
- GET: Returns the current active cycle (status = 'open' OR 'frozen' OR first 'upcoming')
- Admin GET (x-admin: true header): Returns all cycles ordered by year DESC, month DESC

**Route 2: `src/app/api/topics/route.ts`**
- GET: Returns all non-deleted topics for the current cycle, ordered by score DESC
  - If user is anonymous: return `author_username: 'ghost_dev'`
  - If user is not anonymous: return `author_username: <their username>`
  - Include: whether current user has voted, flagged contrib on each topic
- POST: Submit a new topic
  - Validate: cycle is open, user has not already submitted this cycle
  - Body: `{ title, description, category, is_anonymous }`
  - Returns created topic

**Route 3: `src/app/api/votes/route.ts`**
- POST: Cast a vote on a topic
  - Body: `{ topic_id, cycle_id }`
  - Validate: cycle is open, user has < 3 votes this cycle, user hasn't voted on this topic
  - DB insert into votes (trigger handles vote_count + score update)
- DELETE: Remove a vote
  - Body: `{ topic_id }`
  - Validate: cycle is open, user has a vote on this topic

**Route 4: `src/app/api/contributions/route.ts`**
- POST/DELETE: Same pattern as votes but for contributions table (max 2 per cycle)

**Route 5: `src/app/api/sparks/route.ts`**
- POST: Award a spark to a user
  - Body: `{ to_user_id, cycle_id }`
  - Validate: cycle spark window is active (status = 'closed' AND spark_closes_at > NOW())
  - Validate: user has not given a spark this cycle
  - Validate: user cannot spark themselves

**Route 6: `src/app/api/admin/cycle-control/route.ts`** [ADMIN — use createAdminClient()]
- PATCH: Update cycle status
  - Body: `{ cycle_id, status }` where status is one of: open | frozen | closed
  - Only callable by users with role = 'admin'
  - Validates admin role from public.users table using service role client

**Route 7: `src/app/api/admin/select-topic/route.ts`** [ADMIN]
- PATCH: Mark a topic as selected for the meeting
  - Body: `{ topic_id, is_selected, override_reason? }`

**Route 8: `src/app/api/admin/outcome/route.ts`** [ADMIN]
- PATCH: Tag a topic's post-meeting outcome
  - Body: `{ topic_id, outcome_tag, outcome_note }`

For every route, add a comment block at the top of the file:
```
// ROUTE: [METHOD] [path]
// AUTH: [required role]
// PURPOSE: [one sentence]
// DB TABLES: [comma-separated tables touched]
// RLS: [client type used — browser/server/admin]
```

After writing all routes, update SEMANTIC_GRAPH.md:
- Under ## Data Flow Map, document every route: method, path, auth requirement, tables touched, what it returns
- Log in ## Change Log: "STEP 7 — All 8 API routes implemented with auth guards and comment headers."
```

---

## PROMPT 8 — Realtime Hook & Topic Board UI

```
Implement the real-time topic board — the core UI of GuildBoard.

**File 1: `src/hooks/useTopics.ts`**
- Fetches topics from `GET /api/topics` on mount
- Subscribes to Supabase Realtime on the `topics` table (channel: `topics:cycle_id=eq.<currentCycleId>`)
- Listens for UPDATE events — updates `vote_count`, `contrib_count`, and `score` in local state without refetching
- Returns: `{ topics, isLoading, error, mutate }`
- Uses optimistic updates: when user votes, increment local count immediately, roll back on error

**File 2: `src/hooks/useCurrentCycle.ts`**
- Fetches current cycle from `GET /api/cycles`
- Returns: `{ cycle, isLoading, phase }` where phase is one of: 'upcoming' | 'open' | 'frozen' | 'closed' | 'spark_active'
- `spark_active` is a derived phase: cycle is closed AND spark window is still open

**File 3: `src/hooks/useUserTokens.ts`**
- Queries votes, contributions, topics tables for current user in current cycle
- Returns: `{ votes_remaining, contribs_remaining, spark_given, topic_submitted, isLoading }`
- Refreshes when topic or vote actions complete

**File 4: `src/components/topics/TopicCard.tsx`**
- Displays: title, category badge, description (truncated to 2 lines with expand), author username, vote count, contrib count, score
- If cycle is open: show VoteButton and ContribButton
- If cycle is frozen: show counts read-only
- If user is topic author: do not show vote/contrib buttons on own topic
- Category badge colors: deep_dive = indigo, discussion = amber, blog_idea = emerald, project_showcase = violet
- If topic has `status = 'carry_forward'`: show a "Returning" badge
- If topic is `is_selected = true`: show a highlighted "Selected" state (visible after admin selects)

**File 5: `src/components/voting/VoteButton.tsx`**
- Toggle button for voting
- Shows current vote count
- Disabled if: cycle not open, user has 0 remaining votes AND hasn't voted on this topic
- Optimistic update on click

**File 6: `src/components/voting/ContribButton.tsx`**
- Same pattern as VoteButton but for contribution flags
- Label: "I'll discuss this"

**File 7: `src/app/(main)/page.tsx`** — Home page (Topic Board)
- Server Component shell that passes cycle to client
- Renders: CycleStatusBanner, UserTokenDisplay, TopicList
- If cycle is `upcoming`: show "No active cycle. Check back soon." state
- If cycle is `open` or `frozen`: show ranked topic list
- Sort: by score DESC (ranking algorithm output)

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Data Flow Map, add "Realtime Flow": Supabase Realtime channel → useTopics hook → TopicCard re-render
- Under ## Module Registry, add all 7 files
- Log in ## Change Log: "STEP 8 — Realtime hooks and Topic Board UI implemented with optimistic updates."
```

---

## PROMPT 9 — Topic Submission, Archive & Profile Pages

```
Implement the remaining user-facing pages.

**File 1: `src/app/(main)/submit/page.tsx`** + `src/components/topics/TopicForm.tsx`
- Show form only if cycle is open AND user has not submitted this cycle
- If cycle is not open: show message "Submissions are closed for this cycle."
- If user already submitted: show their existing topic with a "You've already submitted this cycle" message
- Form fields:
  - Title (text input, max 80 chars, live char counter)
  - Category (radio group with 4 options, each with a description tooltip)
  - Description (textarea, max 300 chars, live char counter)
  - Submit as: toggle between "your username" and "anonymously (ghost_dev)"
- Submit calls `POST /api/topics`
- On success: redirect to `/` with a success toast

**File 2: `src/app/(main)/archive/page.tsx`**
- Server Component
- Horizontal month navigation (pill tabs) — shows all cycles ordered latest → oldest
- Selected month shows: all topics from that cycle ordered by score DESC
- Each topic shows: title, category, vote_count, contrib_count, status badge, outcome_tag badge, outcome_note
- Filters: by category tag, by outcome_tag
- Search: keyword search on title + description (client-side filter, no API needed for V1)
- Carry Forward topics show a "→ Carried to [next month]" indicator

**File 3: `src/app/(main)/profile/page.tsx`**
- Server Component — fetches current user's public.users row
- Shows: username, spark_count, hall_of_flame badge (if true), member since date
- Shows: topics submitted across all cycles (their own, even anonymous ones since it's their profile)
- Shows: sparks received (from_user: 'ghost_dev' to preserve giver anonymity, cycle label, date)
- If spark window is active: show SparkButton to award spark to other users

**File 4: `src/components/voting/SparkButton.tsx`**
- Only shown during spark_active phase
- Opens a modal: "Award your Spark to a teammate whose contribution changed your thinking"
- Input: username search/select (autocomplete from users list)
- Cannot spark yourself (filter self from list)
- Calls `POST /api/sparks` on submit
- One-time: disabled after spark is given this cycle

**File 5: `src/components/layout/CycleStatusBanner.tsx`**
- Sticky banner at top of main layout
- Shows: cycle label, current phase, days until freeze (if open), days until meeting (if frozen)
- Color: green for open, amber for frozen, gray for closed, purple for spark_active

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Module Registry, document all 5 files
- Log in ## Change Log: "STEP 9 — Submit, Archive, and Profile pages implemented."
```

---

## PROMPT 10 — Admin Panel

```
Implement the Admin Panel for GuildBoard.

**Important:** The `/admin` route must return a 404 response for non-admin users. Do NOT redirect — redirecting reveals the route exists. The 404 must be indistinguishable from a real 404.

**File 1: `src/app/admin/page.tsx`**
- Server Component
- First: fetch current user's role via server Supabase client
- If role !== 'admin': return `notFound()` from next/navigation (this renders the 404 page)
- If role === 'admin': render the admin layout

Admin panel sections:

**Section A — Cycle Control**
- Shows current cycle: label, status, all timestamps
- Buttons: "Open Cycle" | "Freeze Cycle" | "Close Cycle" (only contextually valid state shown)
- Each action calls `PATCH /api/admin/cycle-control`

**Section B — Ranked Topic List**
- Shows ALL non-deleted topics for current cycle ordered by score DESC
- Each row shows: rank, title, author real_name (admin sees real identities), category, votes, contribs, score breakdown (base + category bonus), status
- Score breakdown tooltip: shows the math (e.g., "3 votes × 1 + 2 contribs × 2 + 10% Deep Dive = 10.5")
- "Select for meeting" checkbox per topic (calls `PATCH /api/admin/select-topic`)
- Override reason field: shown if selecting a lower-ranked topic
- Soft-delete button: marks `is_deleted = true` (spam removal)

**Section C — User Management**
- Table: username, real_name, email, role, spark_count, hall_of_flame, created_at, topics this cycle, votes this cycle
- Read-only in UI (role changes done via Supabase dashboard as per PRD)

**Section D — Post-Meeting Outcome Tagging**
- Shown only when cycle status is 'closed'
- Lists selected topics
- Each topic has: outcome_tag dropdown, outcome_note textarea (max 500 chars), Save button
- Calls `PATCH /api/admin/outcome`

**Section E — CSV Export**
- Button: "Export Archive as CSV"
- Client-side: fetches all topics from all cycles and generates a CSV download
- Columns: cycle_label, title, author_username, category, votes, contribs, score, status, outcome_tag, outcome_note, created_at

**File 2: `src/components/admin/AdminTopicRow.tsx`** — Single topic row in admin ranked list
**File 3: `src/components/admin/CycleControls.tsx`** — Cycle open/freeze/close buttons
**File 4: `src/components/admin/OutcomeTagger.tsx`** — Post-meeting outcome tagging form

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Data Flow Map, add "Admin Flow": admin page → role check → admin API routes → admin Supabase client (bypasses RLS)
- Under ## Module Registry, document all 4 files
- Log in ## Change Log: "STEP 10 — Admin panel implemented with 404 guard, ranked list, cycle control, and outcome tagging."
```

---

## PROMPT 11 — Carry Forward Logic & Cycle Closure

```
Implement the carry-forward logic and post-meeting cycle closure automation.

**File 1: `src/app/api/admin/close-cycle/route.ts`** [ADMIN]
When an admin closes a cycle, this route runs the following logic atomically:

1. Fetch all topics for the closing cycle where `is_deleted = false`
2. For each topic:
   - If `vote_count >= 2` AND `is_selected = false` AND `status = 'active'`:
     - Set `status = 'carry_forward'`
     - Duplicate the topic into the NEXT cycle (create new topic row with same content, `status = 'carry_forward'`, `vote_count = 0`, `contrib_count = 0`, `score = 0`)
   - If `vote_count < 2` AND `is_selected = false`:
     - Set `status = 'dropped'`
   - If `is_selected = true`:
     - Status already set to 'selected' — leave unchanged
3. Set cycle status to 'closed'
4. Find or create the next cycle (next month) with status 'upcoming'

All of this must happen in a single Supabase RPC call or a sequential transaction with proper error handling. If any step fails, return a detailed error.

**File 2: `src/lib/utils/csv.ts`**
```typescript
export function generateCSV(topics: any[]): string {
  const headers = [
    'cycle_label', 'title', 'author_username', 'category',
    'votes', 'contribs', 'score', 'status', 'outcome_tag',
    'outcome_note', 'created_at'
  ]
  const rows = topics.map(t => [
    t.cycle_label, t.title, t.author_username, t.category,
    t.vote_count, t.contrib_count, t.score, t.status,
    t.outcome_tag ?? '', t.outcome_note ?? '', t.created_at
  ])
  return [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n')
}

export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
```

After writing all files, update SEMANTIC_GRAPH.md:
- Under ## Data Flow Map, add "Cycle Closure Flow": admin close action → close-cycle API → carry forward duplication → next cycle creation
- Log in ## Change Log: "STEP 11 — Carry forward logic and CSV export utility implemented."
```

---

## PROMPT 12 — Final Assembly: SEMANTIC_GRAPH.md Completion

```
GuildBoard implementation is complete. Your final task is to produce a fully completed SEMANTIC_GRAPH.md that serves as the authoritative knowledge graph of this codebase.

Do a full pass and ensure the following sections are exhaustive and accurate:

**## File Tree**
Generate the COMPLETE file tree of the project as it now exists, using tree-style indentation. Include every file created, every config file, every migration, every route, every component.

**## Module Registry**
For EVERY file in the project (not just source files — include next.config.js, tailwind.config.ts, package.json, .env.example, SEMANTIC_GRAPH.md itself), write an entry:
```
### src/path/to/file.ts
- **Type:** [component | hook | API route | utility | type definition | config | migration | doc]
- **Purpose:** [one sentence]
- **Exports:** [comma-separated named exports]
- **Imports from:** [comma-separated internal paths it imports]
- **Used by:** [comma-separated files that import this file]
- **DB Tables:** [tables this file reads or writes, if any]
- **Notes:** [any special considerations — e.g., "uses admin client, bypasses RLS"]
```

**## Data Flow Map**
Document every data flow in the app as a directed chain. Format:
```
[Trigger] → [Handler] → [DB Operation] → [Return] → [UI Update]
```
Cover: user login, topic submission, voting, contribution flagging, spark award, admin cycle control, carry forward.

**## Type Registry**
For every exported type/interface in `src/types/index.ts`:
- Name
- Maps to DB table (if applicable)
- Used in (list of files)
- Admin-only fields (if any)

**## Environment Variables**
| Variable | Used In | Browser-exposed | Controls |
| --- | --- | --- | --- |

**## RLS Policy Register**
| Table | Policy Name | Operation | Rule | Purpose |

**## DB Trigger Register**
| Trigger Name | Table | Event | Function Called | Effect |

**## Change Log**
Ensure all 12 steps are logged with their descriptions. Add final entry:
"STEP 12 — SEMANTIC_GRAPH.md finalized. Full project knowledge graph complete."

This file should be comprehensive enough that any developer who joins the project can understand the entire architecture without reading a single line of source code.
```

---

## Quick Reference — Prompts Execution Order

| # | Prompt | Output |
|---|--------|--------|
| 0 | Documentation Contract | `SEMANTIC_GRAPH.md` skeleton |
| 1 | Project Scaffold | Next.js folder structure |
| 2 | TypeScript Types | `src/types/index.ts` |
| 3 | Constants & Utils | `scoring.ts`, `cycle.ts`, `cn.ts`, `constants.ts` |
| 4 | Supabase Clients | `client.ts`, `server.ts`, `admin.ts`, `.env.local` |
| 5 | Database Schema | `supabase/migrations/001_initial_schema.sql` |
| 6 | Auth Flow | Login page, OAuth callback, middleware, username modal |
| 7 | API Routes | 8 routes covering topics, votes, contribs, sparks, admin |
| 8 | Realtime & Topic Board | Hooks + TopicCard + Home page |
| 9 | User Pages | Submit, Archive, Profile pages |
| 10 | Admin Panel | Admin page with 404 guard, all admin sections |
| 11 | Carry Forward & CSV | Cycle closure logic + CSV export |
| 12 | SEMANTIC_GRAPH Final | Complete knowledge graph |

---

*GuildBoard PRD V1 — Prompt Suite authored for GitHub Copilot Workspace*  
*Shubham Dalvi | April 2026*