# Review history

Every spec in this project is checked by the **Goldfish review loop**: three independent reviewers read the document with no shared context, their findings are merged into one report, and each finding is fixed, contested or declined. This file records what each round found and what it changed. The full reports are in the repo root; see the [file key](README.md#review-report-files).

**Last updated:** 2026-11-24

## How the loop works

| Reviewer | Checks |
|---|---|
| **Implementation readiness** | Could someone build from this document without making any design decisions? |
| **Design critic** | Is the design sound, and does it document alternatives and risks? |
| **Zoom-out** | Is it bigger or more complicated than it needs to be? |

- **Severity:** Blocker (cannot build), Major (real gap), Nit (minor).
- **Convergence:** the loop is formally finished after **two consecutive clean rounds** (no unsettled Blockers or Majors). The cap is 5 rounds.
- **In practice:** the plan and the M1 spec each ran two rounds and were then accepted by choice, with findings shrinking. See [decision D17](decisions.md).

## Summary

| Document | Round | Raw findings (Blocker / Major / Nit) | Distinct issues | Outcome |
|---|---|---|---|---|
| Course plan | 1 | 8 / 31 / 11 | 20 | 20 fixed |
| Course plan | 2 | 2 / 18 / 17 | 21 | 20 fixed, 1 declined |
| M1 spec | 1 | 2 / 17 / 30 | 25 | 24 fixed, 1 declined |
| M1 spec | 2 | 0 / 14 / 26 | 20 | 19 fixed, 1 declined |
| **M2 spec** | 1 | 1 / 36 / 26 | 29 | **Open:** 28 fixes proposed, 1 decline proposed |

Blockers fell from 8 to 2 across the plan's two rounds, and from 2 to 0 across the M1 spec's. A round with raw findings in the dozens is normal: the same gap is often reported by all three reviewers and merged into one issue.

## Course plan (`system_design_course_plan.md`)

### Round 1
**Found:** the document was a vision, not a build plan. The audience and stack questions were open, yet the text assumed answers. The engine was a stateless queue model that could not show caches, replica lag or retry storms. There were no alternatives or risks sections, no scenario schema, and no test plan. The roadmap skipped phases and had no exit criteria.
**Changed:** added goals and non-goals, alternatives considered, risks and mitigations, fidelity and testing, a milestone-to-phase mapping with "done when" criteria, a go/no-go gate after M1, and a richer engine model.

### Round 2
**Found:** the "rate mode" added in round 1 could not produce p99 or per-key state. The stored replays, JSON schema and engine versioning added in round 1 served nobody. The in-app AI reviewer and its proxy duplicated what a Claude chat already does. The 10 classic interview questions were unscheduled. The M/M/1 test at 99% load would take minutes and fail at random.
**Changed:** one per-request engine with weighted requests as the fallback; typed TypeScript scenarios; a copy-paste AI review flow; an interview track from week 1; the M/M/1 test at 50, 80 and 90% load.
**Churn:** three findings undid round-1 fixes, because round 1 had been written as if for a product. Accepted anyway. See [D6, D9, D10](decisions.md).

## M1 spec (`m1_spec.md`)

### Round 1
**Found:** the evaluator would blame the wrong component: a saturated database makes every server look saturated too, so the hint told you to add servers, which fixes nothing. No alternatives or risks sections. The runner's messages were undefined. Several tests could not be built as described. The benchmark floor was too low for real-time playback.
**Changed:** two utilization numbers per node; alternatives and risks sections; a defined runner state machine with `runId`; a shared test fixture; exact validation messages; one server node scaled by instance count; a simpler end-of-run rule; the benchmark floor raised to 150k events/s.

### Round 2
**Found:** the round-1 bottleneck rule was wrong for the starter design, where the server's worker pool is exhausted in front of a healthy database. "Pause" during "Run to end" was ignored by the worker. Phase 2 would not compile because it needed the evaluator. Test timeouts did not fit the suites. The benchmark margin was about 2%. The done criterion was weaker than the plan's.
**Changed:** the bottleneck rule (D8); pause works in fast mode; a stub evaluator in Phase 2; component factory signatures; the slow tests moved to the fidelity suite; the floor raised to 200k events/s; the lagging badge smoothed; a correct prediction required to finish M1 (D13).
**Then:** the loop was stopped by choice and M1 was built. See [`architecture.md`](architecture.md).

## M2 spec (`m2_spec.md`): round 1, open

**Reviewers also read the real M1 code** this time, so they could check the spec against it.

**Found (29 issues, none applied yet). The most important:**
- **Blocker (Issue 1):** the spec makes new config fields required, but M1's scenario files and tests build those objects without them. The type-check would fail at the end of every phase. Proposed: optional fields with defaults.
- **Chaos scope (Issue 2):** the spec says eight failure types but defines six, and only two are used. Proposed: keep four, defer partition and loss to M4. *(Open decision O3.)*
- **Break step (Issue 3):** undefined for most modules, so it would pass automatically. *(Open decision O4.)*
- **Shaky scenarios (Issues 4–6):** `s2-stampede`, `s2-ttl` and `s2-write-policy` may not behave as the lessons claim. Proposed: a prototype step first. *(Open decision O6.)*
- **Engine correctness (Issues 8, 10–13):** overlapping chaos cancels itself; cache updates bypass link faults; a stale reply after a crash can leave new waiters stuck; the CDN is in the wrong place in the downstream order; same-instant ordering of chaos and health checks is undefined.
- **Missing definitions:** the lesson progress data model, golden-test contents, atomic and validated import, and the Windows golden-update script.

**Confirmed sound by the reviewers:** every price in the spec matches the catalog, and the capacity math for four of the seven scenarios holds.

**Next:** resolve the findings (interactive breakdown recommended, because Issues 2 and 3 are product decisions), then run round 2. The spec's own rule says no M2 code until the M1 gate says go and this spec passes review.

## How to add a round

1. Add a row to the summary table: raw findings, distinct issues, outcome.
2. Add a short entry under the document: what was **found**, what **changed**, and any churn.
3. Rename the finished report to `<doc>_review_report_roundN.md` and add it to the [file key](README.md#review-report-files).
4. Update any decisions in [`decisions.md`](decisions.md).
