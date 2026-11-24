Status: resolved. Round 2 was auto-accepted: 19 fixes applied, 0 contested, 0 escalated, 1 declined (Issue 20), and 4 merged into other issues. `system_design_course_plan.md` was also updated: the M1 bench target is now 200k events/s, and the "unseen variant" criterion is reworded.

# Goldfish Annotated Review Report

**Target:** `m1_spec.md` (full file, lines 1-858)
**Round:** 2 of up to 5. The round 1 report is in `m1_review_report_round1.md`.
**Reviewers:** all three completed.
- zoom_out (zoom-out standard)
- implementation_readiness (implementation-readiness standard)
- design_critic (feature-spec standard)

**Raw totals:** 0 Blockers, 14 Majors, 26 Nits. After deduplication, that is 24 issues.
**Round status:** not clean. Majors are still open.
**Churn check:** none.
- Issue 1 refines a fix from round 1, the bottleneck rule. Reverting that fix would bring back the original misattribution, so it does not count as churn.
- No other finding targets a fix from round 1 in a way a revert would solve.

**Progress since round 1:**
- The Blockers dropped from 2 to 0.
- zoom_out now passes the spec, with one Major left.
- design_critic confirms every section the standard requires is present.
- Two reviewers independently re-checked the numbers. Reference cost is $2.00/h, and the design passes with margin. The guard case saturates the DB. The M/M/1 tolerances are consistent.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** design_critic-2-M1 (Major) and the hint-3 part of zoom_out-2-N4 (Nit).
*   **Affected Scope:** §9 bottleneck (lines 489-492), line 643 (guard), line 781 (checklist 1), §10.1 hints (lines 553-561), §13 (line 840).
*   **Discrepancy Description:**
    *   **What breaks:** in the starter design, the server's 16 workers are all held waiting (`heldUtil` ≈ 1.0), but its own work is only about 14%. The DB's own work is about 40%. The bottleneck rule picks by `serviceUtil`, so it reports **db**, while the error-rate hint correctly names server-1. The learner sees two contradictory answers on their very first run.
    *   **Why the checks miss it:** the guard test only covers the opposite case, and checklist item 1 accepts either node.
    *   **Dead hint:** hint 3 (cache saturated) can never fire with this catalog.
*   **Rationale:** `serviceUtil` fixed blaming upstream nodes whose workers are only waiting. But it can't see a worker pool running out while everything downstream is healthy, which is a classic lesson.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid and confirmed with numbers. The fix keeps the round 1 guard case working.
*   ***Proposed Edit:***
    *   **New bottleneck rule:**
        *   **Candidates:** the non-client nodes whose window-mean `heldUtil` ≥ 0.9.
        *   **Winner:** the candidate furthest downstream. That is the saturated node whose downstream is *not* saturated.
        *   **No candidates:** fall back to the highest `serviceUtil`.
        *   **Results:**
            *   Starter: server-1.
            *   Guard: db, because it saturates while the servers only wait on it.
            *   Reference: the highest `serviceUtil`.
    *   **`{util}`:** shows the metric that chose the node, as `Math.round(x×100) + "%"`.
    *   **Hints:** reword them as "{util} of its workers in use" and drop hint 3.
    *   **Tests and checklist:**
        *   Add a starter-design test that expects `server-1`.
        *   Change checklist item 1 to name `server-1`.
        *   Update the §13 row.

### [Issue 2] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-2-M1 and design_critic-2-M2.
*   **Affected Scope:** Lines 702, 704, 706, 712, 734-740.
*   **Discrepancy Description:**
    *   **The conflict:** the runner only accepts `pause` while in `playing`, but the UI lets you press Pause during Run to end and then shows "paused".
    *   **Result:** the worker keeps running to the end, and a later Play is ignored.
    *   **Contradiction:** line 712 says fast mode yields so that pause can be processed, which disagrees with the table.
*   **Rationale:** The UI state and the worker state drift apart.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Runner table:** `pause` is accepted in `playing` and in `fast`. Both go to `paused`.
    *   **Resuming:** `play` from `paused` restores `setSampleN` for the current speed.
    *   **Docs:** update line 712 and the UI table to match.

### [Issue 3] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-2-M2.
*   **Affected Scope:** Lines 350-361, 577, 607, 623-626.
*   **Discrepancy Description:** `Built.evaluate()` needs `evaluator.ts`, which doesn't exist until Phase 3. That means `tsc` fails at the end of Phase 2.
*   **Rationale:** Every phase must build.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Phase 2:** creates `engine/evaluator.ts` with the `Evaluation` type and a stub `evaluate` that throws `"not implemented"`.
    *   **Phase 3:** implements it.

### [Issue 4] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:**
    *   Majors: implementation_readiness-2-M3, implementation_readiness-2-M6
    *   Nits: design_critic-2-N1, design_critic-2-N2, design_critic-2-N3, design_critic-2-N4, implementation_readiness-2-N3, implementation_readiness-2-N5
*   **Affected Scope:** Phase 2 and Phase 3 tests (lines 608-621, 636-639), and `override` (line 347).
*   **Discrepancy Description:**
    *   **No fixture:** the Phase 2 tests have no scenario fixture. `readHeavy` arrives in Phase 3, and `timeoutMs` and the window change the results.
    *   **Unbuildable tests:**
        *   The deadline test has no parameters.
        *   The flush test "starts before t = 0", which is impossible.
        *   The round-robin test counts accepts, but no counter exists.
        *   The write-invalidation test fails about 0.8% of the time because its timing is random.
        *   The hand-built evaluator test has no buckets or design.
    *   **Unclear override:** `override.readMeanMs` only has a clear meaning for the DB.
*   **Rationale:** The implementer would have to design the test cases themselves.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. The reviewers' suggested fixtures are checked against the engine semantics below.
*   ***Proposed Edit:***
    *   **Shared fixture:**
        *   Add `tests/fixtures.ts` to §3. It exports `testScenario(partial)` with every field filled in: seed 1, timeoutMs 1000, window [0, 1e9), all types allowed, budget 100, zipfS 0, keyspace 1000, readRatio 1, durationSec 1, and empty hints.
        *   It also exports `design(nodes, edges)`.
    *   **Override field:** rename it to `serviceMeanMs`. On the DB it applies to reads and writes; on other components it applies to all their work.
    *   **Test cases:**
        *   **Deadline:** client→db with db `{concurrency 1, queueLimit 10, serviceMeanMs 600, fixedService}`, timeoutMs 500, and two reads at t=0. Expected: both records are `timeout`, and db `dropped` = 1.
        *   **Flush:** client→db with db `{concurrency 2, serviceMeanMs 1500, fixedService}`, timeoutMs 3000, and one read at t=500. Expected: in bucket `sec=1`, db `heldUtil` = 0.5.
        *   **Held vs. own work:** client→server-1→db with db `{serviceMeanMs 100, fixedService}` and reads every 200 ms from 0 to 800. Expected: in bucket 0, server `heldUtil > 2 × serviceUtil`.
        *   **Round robin:** add an `accepted` counter to `Instance` and expose `Built.instances(nodeId)`. Expected: each instance gets 100 accepts, and the first three `accept` trace events are `#0`, `#1`, `#2`.
        *   **Write invalidation:** fix the DB service time with `{serviceMeanMs 20, fixedService}`.
        *   **Evaluator fixture:** the `readHeavy` scenario and reference design, with records at createdAt 60000+i and buckets 60..179 whose node stats are all 0, except bucket 60 where db has `rejected` = 1. Expected: `rejectingNode` = db.

### [Issue 5] [`implementation_readiness`, `zoom_out`] - Severity: Major
*   **Merges:**
    *   Majors: implementation_readiness-2-M4, implementation_readiness-2-M5
    *   Nits: zoom_out-2-N2 (LB hard-codes server-1), zoom_out-2-N3 (no home for `call`)
*   **Affected Scope:** §3.1 (lines 142-143), §4 TraceType (lines 173-177), §5.5 (lines 262-267), §5.7 (lines 318-328).
*   **Discrepancy Description:**
    *   **Undefined signatures:** the component factories have no signatures, and `call` and the hop buffer have no owning module.
    *   **Trace types:** there is no map from event to trace type. `start` is never actually scheduled, and `TraceMeta.node` doesn't say whether it is a node id or an instance id.
    *   **Hard-coded id:** the LB has `server-1` written into it.
*   **Rationale:** This is internal API design that the standard says the spec must settle.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Links:** add a `Links` object, created in `build.ts` and exported for tests. It provides `call(edgeId, target, msg, cb)` and `fireAndForget(fn, meta)`, and it owns the link latency, `sampleN` and the hop buffer.
    *   **Factory signatures:**
        *   `type Behavior = (msg, done) => void`, exported from `instance.ts`
        *   `createLbBehavior(links, edgeId, targets: Instance[])`
        *   `createServerBehavior(links, { db: {edgeId, instance}, cache?: {edgeId, instance, store} })`
        *   `createCacheBehavior(store, counters)`
        *   `createDbBehavior()`
        *   `createClient(sim, links, { scenario, edgeId, target, zipf, arrivals?, onRecord })`, which returns `{ finalize(endMs) }`
    *   **LB targets:** the LB routes to the instances of the target of its single outgoing edge.
    *   **Trace map:** add a table mapping each event to its trace fields. Remove `start` from `TraceType`.

        | Event | type | node | msg |
        |---|---|---|---|
        | Client arrival | `arrive` | `"client"` | message id (0 for rejected thinning candidates) |
        | Forward delivery | `accept` | target instance id | message id |
        | Service completion | `serviceDone` | instance id | message id |
        | Back delivery | `reply` | replying instance id | message id |
        | Cache set / invalidate | `cacheSet` / `cacheInvalidate` | cache instance id | message id |
        | Sampler | `sample` | `""` | 0 |
        | Finalize | `end` | `""` | 0 |

### [Issue 6] [`design_critic`] - Severity: Major
*   **Merges:** design_critic-2-M3.
*   **Affected Scope:** Line 50 (`npm test` < 30 s), line 643 (guard), lines 645-647 (determinism), lines 663-664 (scenario seeds).
*   **Discrepancy Description:**
    *   **Guard test:** it simulates about 7M events (about 46 s at the floor), runs under `npm test`, and has no timeout. Vitest's default 5 s timeout kills it.
    *   **Determinism test:** it is close to 5 s.
    *   **Scenario seeds:** if all three seeds share one `it`, they need about 340 s, which is over 300 s.
*   **Rationale:** As written, the test suites would fail on timeouts, not on real bugs.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid and confirmed with numbers.
*   ***Proposed Edit:***
    *   **Move to fidelity:** the guard and the new starter-bottleneck test (Issue 1) move to `tests/fidelity/scenario.test.ts`. They run a 70 s scenario with the window at 60-70 s and `timeout: 300_000`.
    *   **Determinism:** `timeout: 60_000`.
    *   **Scenario test:** one `it` per seed.

### [Issue 7] [`design_critic`, `implementation_readiness`] - Severity: Major
*   **Merges:** design_critic-2-M4 (Major) and implementation_readiness-2-N8 (Nit).
*   **Affected Scope:** Lines 24-25, 674-675, 708-711, 852.
*   **Discrepancy Description:**
    *   **Thin margin:** 150k events/s is only about 2% above the 147k needed.
    *   **Unchecked assumption:** the bench never checks the events-per-request figure.
    *   **Fragile badge:** `lagging` turns on for a single slow tick, so one garbage-collection pause fails the 1× criterion.
    *   **Undefined `wallElapsed`:** after a resume, the first tick jumps forward.
*   **Rationale:** As written, the done criterion would fail at random.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Bench floor:** raise it to **200,000 events/s**. The bench also prints events per request (`eventsProcessed / requests`).
    *   **`wallElapsed`:** `performance.now()` minus the previous tick's timestamp. The baseline resets whenever ticking starts (play or resume).
    *   **`lagging`:** true when at least 30 of the last 60 ticks (about 1 s) fell short of their target.
    *   **Plan:** update the M1 row to 200k.

### [Issue 8] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-2-M8 (Major) and implementation_readiness-2-N10 (Nit).
*   **Affected Scope:** Lines 722-731, 736, 739.
*   **Discrepancy Description:**
    *   **Hook signatures:** the `useSimWorker` functions have no signatures.
    *   **Pending action:** there's no home for remembering the Play or Run-to-end request until `loaded` arrives.
    *   **Message mapping:** nothing says which reducer actions each incoming message dispatches.
    *   **Initial state:** it isn't defined.
*   **Rationale:** As written, the implementer would design the UI data flow.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Signature:** `useSimWorker(state, dispatch): { play(): void; pause(): void; setSpeed(s): void; runToEnd(): void; reset(): void }`. It reads the design, scenario and speed from `state`.
    *   **Pending action:** kept in `pendingRef: "play" | "runToEnd" | null`.
    *   **Message → action table:**

        | Incoming message | Actions dispatched |
        |---|---|
        | `loaded` | send the pending action, then `setStatus("running")` |
        | `snapshot` | `appendSnapshot` |
        | `done` | `setEvaluation` and `setStatus("done")` |
        | `error` | `setErrors` and `setStatus("editing")` |

    *   **Initial state:** scenario `readHeavy`, design = its starter, speed 1, status `editing`, errors `[]`.
    *   **Clearing errors:** on the next Play, Run to end, or design edit.

### [Issue 9] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-2-M7.
*   **Affected Scope:** §7 (lines 403-412), line 631.
*   **Discrepancy Description:** Rules 4-7 refer to "the client", "the server" and "the cache", but nothing says what happens when there are zero or two of them. Edges to node ids that don't exist aren't handled either.
*   **Rationale:** As written, the output of `validate` is ambiguous.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Skipping dependent rules:** rules 4-7 are skipped for any type that failed rule 1.
    *   **New rule 3a:** `"Edge {id} points to a missing node."` Later rules ignore such edges.
    *   **Rule-1 test:** two cache nodes.

### [Issue 10] [`zoom_out`, `design_critic`] - Severity: Major
*   **Merges:** zoom_out-2-M1 and design_critic-2-M5.
*   **Affected Scope:** §1 (lines 10-11, 26), Phase 6 steps 3-4 (lines 794-806), parent plan line 211.
*   **Discrepancy Description:**
    *   **The gap:** the parent plan requires a **correct** prediction on an unseen variant. The spec only requires recording one, so a wrong prediction still completes M1.
    *   **Consequence:** "Is the loop teaching me?" has no pass/fail input.
    *   **Unrecorded change:** the spec never says it relaxed the "unseen" requirement.
*   **Rationale:** One of the two jobs of M1 has no gate.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. Two reviewers flagged it.
*   ***Proposed Edit:***
    *   **Pass condition:** the prediction matches the oracle bottleneck (Issue 1's rule), and the explanation names the mechanism.
    *   **If it's wrong:**
        *   The gate answer to "Is the loop teaching me?" is "not yet".
        *   Write down the mechanism I missed.
        *   Change one parameter of the variant (recorded in notes), predict again, and run again before M2.
    *   **New §13 row:** "A blind variant isn't possible for a single author. The prediction is made from the parameters instead."
    *   **Parent plan:** reword "unseen variant" to "a new variant, predicted from its parameters".

### [Issue 11] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-2-N1 and design_critic-2-N7.
*   **Affected Scope:** Line 474.
*   **Discrepancy Description:** `peakRps` is never defined.
*   **Rationale:** The sampling formula depends on it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is a one-line fix.
*   ***Proposed Edit:*** `peakRps` = λmax, the maximum of `fromRps` and `toRps` across all phases.

### [Issue 12] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-2-N4 and design_critic-2-N5.
*   **Affected Scope:** Lines 481-494.
*   **Discrepancy Description:** Two edge cases are undefined:
    *   With n = 0, `errorRate` is NaN.
    *   With no buckets in the window, the bottleneck is 0/0, and `bottleneck` isn't allowed to be null.
*   **Rationale:** These are edge cases.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **errorRate with n = 0:** value `null`, and the criterion fails.
    *   **No window buckets:** `bottleneck` is `null`.
    *   **Null bottleneck:** hint rules that require a bottleneck don't match, and `{component}` falls back to `"the system"`.

### [Issue 13] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-2-N6, implementation_readiness-2-N7 and design_critic-2-N8.
*   **Affected Scope:** Lines 374, 427-441.
*   **Discrepancy Description:**
    *   **Counter resets:** nothing says how the counters are reset.
    *   **Boundary records:** a record completing exactly at a second boundary may land in the wrong bucket.
    *   **End-time ordering:** at `endMs`, the order of finalization and the sampler is undefined, so finalized timeouts can be lost from the dashboard.
*   **Rationale:** These are precision gaps.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **Counter resets:** the sampler resets the per-second counters.
    *   **Bucket assignment:** a record goes into bucket `min(floor(now/1000), floor(endMs/1000) − 1)`.
    *   **Finalize ordering:** `build` schedules the finalize event at `endMs` first, so it pops before any sampler event at the same instant.

### [Issue 14] [`design_critic`] - Severity: Nit
*   **Merges:** design_critic-2-N6.
*   **Affected Scope:** Lines 444, 855.
*   **Discrepancy Description:** The memory estimate ignores how the arrays double in size. The real figure is about 36 MB, with a peak of about 53 MB while copying.
*   **Rationale:** The stated figure is too low.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:*** Correct the figure in the risks table.

### [Issue 15] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-2-N9.
*   **Affected Scope:** Lines 774-778.
*   **Discrepancy Description:** The RequestEdge spec has three gaps:
    *   no path helper is named;
    *   delaying the start of an SMIL animation doesn't work, because `begin` is relative to the document;
    *   there's no `fill="freeze"`, so dots snap back to the start.
*   **Rationale:** As written, the animation would misbehave.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid, and the SMIL `begin` problem in particular is real.
*   ***Proposed Edit:***
    *   **Path:** `getBezierPath`.
    *   **Timing:** a 50 ms interval re-renders the edge. A circle is mounted when its start time arrives and unmounted after 300 ms.
    *   **Animation:** `<animateMotion begin="indefinite" dur="0.3s" fill="freeze">`, with `beginElement()` called in a ref callback when it mounts.

### [Issue 16] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-2-N11.
*   **Affected Scope:** Lines 604, 721.
*   **Discrepancy Description:** The phase file lists use globs.
*   **Rationale:** The standard wants exact file paths.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:*** List the exact files in Phases 2 and 5.

### [Issue 17] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-2-N12.
*   **Affected Scope:** Line 718.
*   **Discrepancy Description:** The runner's state machine has no automated tests, and round 2 just found a bug in it (Issue 2).
*   **Rationale:** It is cheap to test once the clock can be injected.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid and worth doing.
*   ***Proposed Edit:***
    *   **Injected clock:** change the signature to `createRunner(post, deps = { now: () => performance.now(), setTimeout })`.
    *   **New test file:** add `tests/engine/runner.test.ts` to §3. Using a fake clock, it covers:
        *   an invalid load → `error`
        *   load → play → pause → play
        *   runToEnd → `done`
        *   pause during fast → `paused`
        *   reset → idle

### [Issue 18] [`design_critic`, `zoom_out`] - Severity: Nit
*   **Merges:** design_critic-2-N9 and zoom_out-2-N5.
*   **Affected Scope:** Lines 326, 441, and parent plan lines 171-175.
*   **Discrepancy Description:**
    *   **Late timeouts:** a timeout is recorded when its late reply arrives, so the dashboard shows it in a later second.
    *   **Checklist not mapped:** the parent plan's fidelity checklist isn't mapped to M1's tests.
*   **Rationale:** These gaps aren't stated anywhere.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** One sentence each closes them, with no new tests.
*   ***Proposed Edit:***
    *   **New §14 note:** the dashboard timeout lag is an accepted limitation.
    *   **New sentence in §11 Phase 3:**
        *   Knee check: covered by the M/M/1 test.
        *   Failure order: covered by the bottleneck tests.
        *   Recovery: not applicable until M2 introduces faults.
        *   Trends: covered by the starter and reference outcomes.

### [Issue 19] [`zoom_out`] - Severity: Nit
*   **Merges:** the `size` part of zoom_out-2-N4.
*   **Affected Scope:** Line 166.
*   **Discrepancy Description:** `Message.size` is a YAGNI field: it's unused in M1.
*   **Rationale:** The reviewer said keeping it is defensible because the parent plan's message shape includes it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Keep the field, but state why.
*   ***Proposed Edit:*** Change the comment to say it is kept to match the parent plan's message shape, and that it is first used in M3.

### [Issue 20] [`zoom_out`] - Severity: Nit
*   **Merges:** zoom_out-2-N6.
*   **Affected Scope:** Lines 716-717, 778, 444.
*   **Discrepancy Description:** Some details sit at code level, below what a spec needs.
*   **Rationale:** The reviewer noted this so later specs don't copy the habit, and said explicitly that no action is needed.
*   ***AI Suggestion:*** DECLINE
*   ***Justification:*** The reviewer's own guidance is no action. Several of these details were added to fix earlier findings: the cast in round 1 Issue 24, and Records in round 1 Issue 8.
*   ***Proposed Edit:*** None.

### Issues 21-24: already covered above

These raw findings are merged into the issues listed, so no further edit is needed:
*   implementation_readiness-2-N2 (`{util}` rounding) → Issue 1
*   implementation_readiness-2-N3 (`readMeanMs` meaning) → Issue 4
*   design_critic-2-N2 (round-robin counter) → Issue 4
*   zoom_out-2-N4 (hint 3) → Issue 1

## Summary

| Category | Count |
|---|---|
| PROPOSE FIX | 19 (Issues 1-19) |
| CONTEST | 0 |
| ESCALATE | 0 |
| DECLINE | 1 (Issue 20) |
| Merged into other issues | 4 (Issues 21-24) |

All three reviewers completed this round.
