# GuildBoard docs

Written 2026-08-14, after the 12-commit batch. Read in order.

- **[00-diagnosis.md](./00-diagnosis.md)** — why idea submission decayed, why the batch did not fix it, and what the two halves of the long-term vision are actually worth. Six findings. _Finding 5 is partly superseded: see `04`._
- **[01-direction.md](./01-direction.md)** — product thesis, three pillars, target information architecture, screen block budgets, the design-system decision, and how to build hooks that work at 30 people.
- **[02-roadmap.md](./02-roadmap.md)** — ten product phases, cheapest and most load-bearing first. _P4 (Slack bridge) is deleted: there is no chat habitat. See `04` U10 and U12._
- **[03-audit-brief.md](./03-audit-brief.md)** — brief for the two in-repo audits, with the keep / cut / defer decisions closed.
- **[04-technical-plan.md](./04-technical-plan.md)** — the executable version. Eighteen units, nine architecture decisions, schema plan, testing strategy, and an honest score against the 9.5 target. **Start here for what to build next.**
- **[audits/ui-audit.md](./audits/ui-audit.md)** — per-screen block inventory, the overlay collision, 13 redundancies, scale drift, dead paths, and a mobile-first check. Section 10 is U4's deletion checklist, ready to execute.

Produced as the plan runs: `docs/metrics.md` (U1), `docs/design-system.md` (U5).

Outstanding: `docs/audits/feature-audit.md`. It is a decision record, not a gate on any unit.

**If you read one thing:** `00-diagnosis.md`, Finding 1. The board is closed to idea submission roughly 25 days out of 30, in a product that exists because ideas arrive unpredictably all month.

**If you read two:** the closing section of `04-technical-plan.md`. This plan lands at about 8.3, not 9.5, and the reason is not engineering.
