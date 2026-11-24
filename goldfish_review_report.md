# Goldfish Annotated Review Report

**Target:** `m2_spec.md` (full file, lines 1-867)
**Round:** 1 of up to 5
**Reviewers:** all three completed.
- implementation_readiness (implementation-readiness standard)
- design_critic (feature-spec standard)
- zoom_out (zoom-out standard)

**Context given to reviewers:** `system_design_course_plan.md`, `m1_spec.md`, and the real M1 code at commit `c0787c5` (read-only). Several findings below come from checking the spec against that code.
**Raw totals:** 1 Blocker, 36 Majors, 26 Nits (63 findings). After deduplication there are 29 issues.
**Round status:** Not clean. There is 1 open Blocker and there are open Majors.
**Churn check:** none. This is the first review of this document.

**What held up:**
- Two reviewers independently confirmed every price in §9 against the catalog.
- All three confirmed the capacity math for `s0`, `s1-scale`, `s1-lb` and `s1-cdn`.
- The least-connections "black hole" (more than 60% of calls to a crashed server) holds up.
- The replay design is coherent: user actions run after normal events at the same instant, so a replay matches the live run.

**Scenario numbers are estimates.** The reviewers computed the hit ratios and utilizations by hand. They disagree with the spec on `s2-stampede`, `s2-ttl` and `s2-write-policy`. Issues 4–6 therefore add a prototyping step before any content is written.

**Key to raw finding IDs:**
- `IR-B1`, `IR-M1`–`IR-M16`: implementation_readiness Blocker and Majors, in the order reported.
- `IR-N1`–`IR-N10`: its Nits, in the order reported: hash string, partition test timing, `onEvent` seq type, `outcomeOf`/`accepted`, hit-ratio chart, router unknown ids, `p0-network` Predict, MDX dependency, phase titles, `held` map cost.
- `DC-1`–`DC-14`, `DC-A`–`DC-G`: design_critic Majors and Nits.
- `ZO-1`–`ZO-15`: zoom_out, in the order reported (Majors 1–6, Nits 7–15).

## Prioritized Findings & AI Suggestions

### [Issue 1] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Blocker
*   **Merges:** IR-B1 (Blocker), DC-1 (Major), ZO-1 (Major), ZO-7 (Nit), IR-N3 (Nit), the heap-test part of IR-M16 (Major)
*   **Affected Scope:** Lines 25, 38, 149-154, 168-175, 209-223, 246-252, 304, 392
*   **Discrepancy Description:**
    *   **The build gate fails.** §4.1 makes `algorithm`, `healthCheck`, `missCoalescing`, `writePolicy`, the heap `tier` and `unavailable` required. M1's code and tests build these objects without them:
        *   `scenarios/readHeavy.ts` and `scenarios/readHeavyVariant.ts`
        *   `tests/engine/heap.test.ts`
        *   `tests/fidelity/scenario.test.ts`
        *   `tests/engine/evaluator.test.ts`
    *   Every phase must end with `npm run build`, which runs `tsc --noEmit` over those folders. So every phase fails.
    *   **Silent bug:** `NodeStats` literals in the M1 evaluator test lack `unavailable`, so `rejected + dropped + unavailable` becomes NaN and breaks the M1 `rejectingNode` assertions.
    *   **Dangling reference:** line 154 says "type-only fixture updates in §4.4", but §4.4 lists none. Done criterion 4 ("M1 tests pass unchanged") contradicts the modified-tests list.
    *   **Missing type changes:** `HintRule.criterion`, the `Evaluation` criteria names, `Outcome` and `onRecord` are typed to the old values and need widening.
*   **Rationale:** The "M1 behavior is preserved" guarantee, the spec's hardest rule, cannot hold as designed.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Three reviewers found this independently. Optional fields with defaults at the point of use is the smallest root fix. It also removes `normalizeDesign`.
*   ***Proposed Edit:***
    *   **Optional fields:**
        *   `NodeConfig`: `algorithm?`, `healthCheck?`, `missCoalescing?` and `writePolicy?` are all optional.
        *   `NodeStats.unavailable?` and `Bucket.errors.unavailable?` are optional.
        *   Every read uses a default: `?? "roundRobin"`, `?? false`, `?? "invalidate"`, `?? 0`.
    *   **Remove `normalizeDesign`:** delete it, §4.3, and the §12 normalization step. Saved M1 designs load as they are.
    *   **Action ordering without a heap change:**
        *   Drop `tier` from heap entries.
        *   Action events take `seq = ACTION_BASE + actionSeq++`, where `ACTION_BASE = 1e15`. That is far above any normal seq and below 2^53.
        *   `engine/core/sim.ts` exports `formatSeq(seq)`, which returns `"a" + (seq − ACTION_BASE)` for action events and the number otherwise. Trace helpers use it. `onEvent` keeps `seq: number`.
        *   The heap code and `heap.test.ts` stay untouched.
    *   **Widen the unions:**
        *   `ComponentType` adds `"cdn"`; `Op` adds `"static"`; `ErrorKind` adds `"unavailable"`.
        *   `HintRule.criterion` and the `Evaluation` criteria name add `"p50"` and `"cacheHitRatio"`.
        *   `Outcome` and the `onRecord` parameter become `0 | 1 | 2 | 3 | 4`.
    *   **Allowed M1 file edits:**
        *   List which M1 files get type-only edits: `tests/fixtures.ts` (a `cdn` case in `defaultConfig`), plus the engine and app files already in §3.
        *   Reword done criterion 4 to "all M1 test assertions pass unchanged; new cases may be added to the same files".

### [Issue 2] [`zoom_out`, `implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** ZO-2, IR-M1, DC-6, DC-11, IR-N2
*   **Affected Scope:** Lines 18, 181, 184-191, 205, 254-265, 311-314, 370-379, 675-677, 681, 768-769
*   **Discrepancy Description:**
    *   **Count wrong:** deliverable 1 says "Eight failure types", but `ChaosSpec` and the §5.3 table define six.
    *   **Types without a consumer:** the only scheduled chaos is `crash` (`s1-lb`) and `cacheFlush` (`s2-stampede`). `latency`, `loss`, `surge` and `partition` appear in no lesson or Predict/Explain item. `partition` appears only in a manual checklist item.
    *   **Partition timing contradicts §5.5:** the test asserts "createdAt + 1000 + link back", which is only true on an internal edge. With the defaults, `connectTimeoutMs` (1000) equals the client timeout (1000), so the clamp always lands on the deadline and the parameter is inert.
    *   **Hot-path cost:** `loss` adds a random draw on the link path and a probabilistic test.
*   **Rationale:** The parent plan ties partitions and loss to Phase 7 (reliability), which is M4. They need per-call timeouts to be a meaningful lesson. The engine budget is 1.5 weeks.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. Cutting the two unused types removes a whole group of untested mechanics. It also resolves the partition timing contradiction.
*   ***Proposed Edit:***
    *   **Four failure types in M2:** `crash`, `latency`, `cacheFlush` and `surge`. Change "Eight" to "Four". Each is used by a named lesson in the Break column added by Issue 3.
    *   **Deferred to M4:** `partition` and `loss`. Record this in §13 and §15.
    *   **Remove:**
        *   `connectTimeoutMs` and the `linkTimeout` trace type;
        *   the dead-link branch of §5.5;
        *   the loss random draw;
        *   the partition and loss tests;
        *   manual checklist item 5, which becomes "inject latency on an edge and watch p99 rise".
    *   **Link fault state:** becomes just `{ extraMs }`.

### [Issue 3] [`zoom_out`, `design_critic`, `implementation_readiness`] - Severity: Major
*   **Merges:** ZO-3, DC-7, IR-M12, DC-D
*   **Affected Scope:** Lines 490, 498-499, 534, 558-568, 610-635
*   **Discrepancy Description:**
    *   **Break is undefined:** seven modules use the full loop, but only `s1-lb` and `s2-stampede` have scheduled chaos. `<Sandbox step="break">` passes on any passed evaluation. Break then duplicates Build, because it loads the saved Build design with no chaos required.
    *   **Impossible pass condition:** for `s1-scale`, a crash with round-robin and no health checks gives about 1/8 errors, which fails the 0.1% limit. So requiring a passing evaluation is not workable.
    *   **Unclear design source:** it is unstated which design Build and Break start from, whether a saved design, the `design` prop or `initialDesign` wins, and whether lesson steps share the free sandbox's saved design.
*   **Rationale:** Break is step 4 of the plan's lesson loop. As written the implementer would invent it.
*   ***AI Suggestion:*** PROPOSE FIX (**a design choice for you**)
*   ***Justification:*** Break should require actually causing a failure, and not depend on the design surviving it.
*   ***Proposed Edit:***
    *   **New "Break" column in the §10 table** (required chaos type, then what to observe):

        | Module | Required chaos | Observe |
        |---|---|---|
        | `p0-single-server` | `surge` ×2 for 30 s | when worker use crosses 90% and what fails first |
        | `p1-scaling` | `crash` of any server instance | failed share ≈ 1 / instances without health checks |
        | `p1-load-balancing` | `crash` of a different instance than the scheduled one | health checks on vs off |
        | `p1-cdn` | `latency` +100 ms on the CDN → origin edge | static hits unaffected, dynamic requests slower |
        | `p2-cache-write` | `cacheFlush` | hit-ratio recovery under each write policy |
        | `p2-eviction-ttl` | `cacheFlush` | how fast capacity and TTL refill |
        | `p2-stampede` | a second `cacheFlush` | the effect of coalescing |

    *   **Pass condition:** Break is done when a run reaches `done` and `done.actions` holds at least one user action of the required type. A passing evaluation is **not** required.
    *   **Build pass condition:** unchanged: a passed evaluation, with no chaos required.
    *   **Saved-design key:** `designs` is keyed by `${scenarioId}:${mode}`, where mode is `free`, `build` or `break`.
    *   **Design source:** Build starts from the saved design, or else the starter. Break starts from a copy of the Build design the first time it opens. Concept uses the reference design, read-only.
    *   **Reset control:** lesson sandboxes get a "Reset to starter" button.

### [Issue 4] [`zoom_out`, `design_critic`] - Severity: Major
*   **Merges:** ZO-4, DC-3
*   **Affected Scope:** Lines 347-352, 568, 580, 599-606, 634
*   **Discrepancy Description:**
    *   **Coalescing may not help much.** It is per server instance and only merges same-key misses within one database read of about 12 ms. After a flush the database load comes mostly from distinct cold keys refilling a 100k-key keyspace, so only a few hundred hot keys repeat. The reference (starter plus `missCoalescing`) may cut database load by only 5–15%.
    *   **Narrow margin:** the starter's errors are estimated at 0.5–1.5% of a 1.2M-request window against a 0.5% limit, with no margin the reviewers could defend. The spec itself calls the overload "brief compared with the window".
    *   **The tuning ladder can't repair it:** the tuning rule cannot change the window, the threshold or the flush time. If the starter passes, the only outcome is "stop and amend", after content has been written.
    *   **Predict answer:** "the database fails first" holds for timing, but the evaluator's rejecting node is probably the servers.
*   **Rationale:** This is the Phase 2 signature exercise. It should be validated before content depends on it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Both reviewers recommend prototyping, and the hand calculations conflict.
*   ***Proposed Edit:***
    *   **New "Phase 2b: scenario prototypes"** between Phases 2 and 3. For each of `s2-stampede`, `s2-ttl` and `s2-write-policy`, run scratch runs (starter and reference, seeds 1–2) and record these in `notes/m2_log.md`:
        *   error rate and hit ratio;
        *   database and server `heldUtil`;
        *   the rejecting node.

        Apply the tuning ladder and amend this spec's tables **before** Phase 3 and Phase 6.
    *   **`s2-stampede` timing:** `durationSec` 130, traffic ramps to 10,000 rps over 60 s then holds, and the **window becomes 95 → 125 s**. That puts the flush at 100 s inside the window and shortens the run.
    *   **Extended tuning ladder (§9):**
        4. the window bounds, keeping any scheduled chaos inside the window;
        5. one criterion threshold: `cacheHitRatioMin` by at most ±0.10 absolute, or `errorRateMax` by at most a factor of 2 either way.
    *   **If coalescing alone doesn't separate starter from reference:** the reference may combine it with other changes within budget, such as a larger database tier. The lesson then teaches that defenses are complementary.
    *   **Predict item:** reword to "Right after the flush, which component's queue fills first?" with the answer "the database".

### [Issue 5] [`design_critic`] - Severity: Major
*   **Merges:** DC-4
*   **Affected Scope:** Lines 567, 579, 592
*   **Discrepancy Description:** The `s2-ttl` reference has almost no margin. Steady-state LRU with a 100k cache over 200k keys at Zipf 0.9 gives about 0.87, not the LFU figure of 0.91. The 5% writes invalidate hot keys, giving about 0.83. The window starts at 60 s, while the cache has seen only about 257k reads against an LRU characteristic time of about 430k. The window average is therefore about 0.80–0.83 against a 0.80 limit. The tuning ladder can't raise the hit ratio.
*   **Rationale:** A pass/fail criterion at the edge of its estimate will flip with a seed.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. It follows the hand calculation, which should be confirmed in the Issue 4 prototype step.
*   ***Proposed Edit:***
    *   **Threshold:** `cacheHitRatioMin` 0.80 → **0.75**.
    *   **Window:** 60 → 150 s becomes **90 → 150 s**, so the cache has warmed.
    *   **Capacity note:** replace the LFU row with: LRU steady state about 0.87 minus about 0.04 for writes ≈ 0.83 for the large cache. The small cache with a 10 s TTL is estimated at 0.55–0.60 and fails. These are estimates, confirmed in the Phase 2b prototype.

### [Issue 6] [`design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** DC-5, ZO-14
*   **Affected Scope:** Lines 566, 578, 591
*   **Discrepancy Description:**
    *   **Wrong reasoning.** The note says invalidate gives a hit ratio of about 0.3 because hot keys "lose the cache on roughly 2 of 3 reads". With 60% reads, a read on a hot key hits when the previous operation on that key was a read: about 0.6 for hot keys, about 0.5 overall.
    *   **The scenario is database write-bound.** At 6,000 rps with 40% writes, there are about 2,400 writes/s × 20 ms, which is about 48 of the large database's 64 workers on writes alone.
        *   The reference sits at about 83% (about 53 workers).
        *   The starter, with hit ratio about 0.5, needs about 66 workers, over the 64 available. So the starter also fails errors and p99, and the lesson stops being a clean hit-ratio story.
*   **Rationale:** The lesson is "write-through beats invalidate for hit ratio". It should fail only on that.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Fewer writes gives the starter room on the database, so only the hit ratio separates the designs.
*   ***Proposed Edit:***
    *   **Write share:** `readRatio` 0.60 → **0.75** (25% writes). Update the `p2-cache-write` Predict item from "40% writes" to "25% writes".
    *   **Capacity note:** replace it with these estimates, confirmed in the Phase 2b prototype:

        | Design | Hit ratio | Database workers busy |
        |---|---|---|
        | Starter (invalidate) | about 0.65 | about 46 of 64 (72%) |
        | Reference (write-through) | about 0.88 | about 37 of 64 (58%) |

    *   **Criterion:** the 0.75 hit-ratio threshold stays, so the starter fails only that criterion.

### [Issue 7] [`implementation_readiness`] - Severity: Major
*   **Merges:** IR-M2
*   **Affected Scope:** Lines 284, 564, 568
*   **Discrepancy Description:** `s1-lb` crashes `server-1#2` and `s2-stampede` flushes `cache`, but the learner edits the design freely. With 2 or fewer instances, or with the cache deleted, the target doesn't exist. §5.3 says an unknown target throws, but not when. A throw at 90 s or 100 s aborts the run. `handle()` has no try/catch around `inject`.
*   **Rationale:** A learner deleting the cache is a legitimate design choice and must not crash the run.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Scheduled chaos with a missing target:** `build` skips it and logs an `AppliedChaos` with `phase: "skipped"`. The ChaosPanel and dashboard show "skipped: no such target".
    *   **User `inject` with an unknown target:** `Built.inject` validates synchronously **before** logging the action, so the action log never holds an invalid action. It throws `Error("Unknown chaos target: …")`.
    *   **Runner:** `handle()` wraps `inject` in try/catch. On a throw it posts `error` and goes to `idle`, like any other engine error. The ChaosPanel only offers valid targets, so this path means a bug.

### [Issue 8] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** IR-M3, DC-9
*   **Affected Scope:** Lines 259-265, 375-379, 457-470
*   **Discrepancy Description:** The ChaosPanel lets users inject repeatedly, but overlapping chaos is undefined. A 10 s latency injection ending inside a 60 s one resets `extraMs` to 0 and wipes out the longer one. A second crash on a down instance bumps `epoch` again, and the first recover revives it. A `surge` end needs a handle, but neither `ChaosSpec` nor `AppliedChaos` carries an id to link a start to its end.
*   **Rationale:** Interactive overlap is the expected use of the panel.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Giving each chaos its own id makes every revert exact.
*   ***Proposed Edit:***
    *   **Chaos ids:** every applied chaos gets a sequential `id`. `AppliedChaos` carries it, and end events reference it.
    *   **Revert rules:**
        *   **crash:** an instance is up when its active-crash count is 0.
        *   **latency:** an edge's `extraMs` is the sum of its active injections. An end removes only its own.
        *   **surge:** the generator is keyed by id.
        *   **cacheFlush:** nothing to revert.
    *   **Tests:** overlapping latency; double crash then recover; recover on an instance that is already up (no-op); overlapping surge.

### [Issue 9] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** IR-M4, DC-E
*   **Affected Scope:** Lines 370-379, 670, 681
*   **Discrepancy Description:** The chaos tests are "all using scripted arrivals", but in scripted mode there is no traffic generator, so a surge has nothing to scale. The surge generator is driven by `scenario.traffic`.
*   **Rationale:** The surge test cannot be written as described.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Surge test:** uses generated traffic, with a constant-rate scenario.
    *   **Scripted mode:** `startSurge` is a no-op.
    *   **Surge end:** a surge stops at `durationSec`.

### [Issue 10] [`implementation_readiness`, `zoom_out`, `design_critic`] - Severity: Major
*   **Merges:** IR-M5, ZO-6, DC-10
*   **Affected Scope:** Lines 242, 256-257, 260, 306-317, 346-347, 349, 365-367
*   **Discrepancy Description:**
    *   **Undefined interfaces:** the new `createLinks` signature, `links.setFault` and the `ctx` type for `applyChaos` are not given.
    *   **`edgeLatency` can't be reached:** it needs the endpoint types of an edge, but `call` only gets an edge id.
    *   **Cache updates skip faults:** M1's `fireAndForget(fn, meta)` has no edge id, so the cache set and invalidate (and the new write-through path) would ignore latency faults on `server → cache`.
    *   **Crashed cache still writes:** they would also write to the store of a crashed cache, which makes "crash clears the store" meaningless.
*   **Rationale:** `Links` is shared by chaos, network, server and CDN, so it needs one stated shape.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. All three reviewers flagged it.
*   ***Proposed Edit:***
    *   **`createLinks(sim, latency: number | ((edgeId: string) => number))`:** the number form is M1's, used by tests. The function form is precomputed once per edge at build time.
    *   **Fault state:** `Links` keeps `extraMs` per edge, and `setFault(edgeId, extraMs)` sets it.
    *   **`fireAndForget(edgeId, fn, meta)`:** uses that edge's latency plus its `extraMs`. The M1 call sites pass their edge ids.
    *   **Store writes while down:** cache set, invalidate and flush are no-ops while the cache instance is down.
    *   **`ChaosCtx`:**
        ```ts
        interface ChaosCtx { instances(nodeId: string): Instance[]; links: Links;
          stores: Map<string, LruTtlStore>; client: { startSurge(m: number): number; stopSurge(id: number): void } }
        ```

### [Issue 11] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** IR-M6, DC-2
*   **Affected Scope:** Lines 298, 348-352
*   **Discrepancy Description:**
    *   **`inflight` is out of reach.** The map lives in a behavior closure, but `Instance.crash()` can't clear it, because `Behavior` is a plain function.
    *   **Old callbacks still run.** The epoch guard only covers the instance's `finish`. A leader's database callback from before a crash still runs "set cache, call every waiter, delete the key".
    *   **It corrupts a new leader.** If a new leader has registered the same key after recovery, the stale callback deletes the new entry, so the new waiters are never answered. Their workers stay held until the client deadline.
    *   **No-cache case:** the spec doesn't say what coalescing does when there is no cache edge.
*   **Rationale:** This is a correctness bug in the stampede lesson's main mechanism.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Storage:** the `inflight` map lives on the `Instance`, and `crash()` clears it.
    *   **Leader closure:** captures the `epoch` and the waiters list. If the epoch has changed, the whole completion is a no-op: no cache set, no waiter calls. On normal completion it deletes the key only if the map still points at that same list.
    *   **No cache edge:** `missCoalescing` is ignored.
    *   **Test:** crash, recover, re-request the same key, then let the old reply arrive. The new request must still complete.

### [Issue 12] [`implementation_readiness`, `zoom_out`, `design_critic`] - Severity: Major
*   **Merges:** IR-M7, ZO-5, DC-14
*   **Affected Scope:** Lines 107-108, 143, 354-368, 397
*   **Discrepancy Description:**
    *   **Wrong order:** the downstream tie-break order is "database, cache, server, cdn, loadBalancer", but the topology is client → CDN → LB → server. The CDN is upstream of the LB.
    *   **Build would throw:** M1 has two copies of this order. `build.ts:85` (`DOWNSTREAM_FIRST`) also decides the construction order, so with this order the CDN is built before its target and throws.
    *   **Missing entries:** `LABEL`, `ORDER` and `TITLE` records in `validate.ts` and `nodeTypes.tsx` have no `cdn` entry.
*   **Rationale:** Copying the wrong order into both places gives a build-time throw on any CDN design.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. One shared constant removes the duplication.
*   ***Proposed Edit:***
    *   **Order:** `database, cache, server, loadBalancer, cdn`.
    *   **One constant:** exported from `engine/catalog.ts` as `DOWNSTREAM_ORDER`, and used by both `build.ts` and `evaluator.ts`.
    *   **Build order:** the CDN is built last, after the LB and server. It finds its origin through its single outgoing edge, as the LB does.
    *   **Add `cdn`** to `LABEL` and `ORDER` in `validate.ts`, and to `TITLE`, `HAS_INPUT`, `HAS_OUTPUT` and `detail()` in `nodeTypes.tsx`.

### [Issue 13] [`design_critic`] - Severity: Major
*   **Merges:** DC-8
*   **Affected Scope:** Lines 267, 333-337, 564, 589, 700-703
*   **Discrepancy Description:** Scenario chaos events and the health-check chain both fire on multiples of 1000 ms, and `s1-lb` crashes at exactly 90 s. Their order depends on the seq assigned at build time. If chaos runs first, detection takes 1 s; otherwise 2 s. That moves the "about 0.24%" figure between 0.12% and 0.24% and changes the goldens. The `lb.test` cases don't say whether the crash is user-injected or scenario-scheduled.
*   **Rationale:** An unpinned order makes results depend on implementation detail.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Build scheduling order:**
        1. finalize at `endMs`;
        2. scenario chaos events, in listed order, start then end;
        3. the health-check chain;
        4. the client;
        5. the sampler.

        Items 2 and 3 are scheduled only when present, so M1 seq numbers don't change.
    *   **Effect for `s1-lb`:** a scheduled crash at 90,000 applies before the check at 90,000, so detection takes 1–2 s. The capacity note keeps "about 0.12–0.24%".
    *   **Tests:** `lb.test` crashes use `inject` (an action, which runs after the check at the same instant). With a crash at 5000: checks at 6000 and 7000 fail, so the instance is excluded at 7000. The tests name the mechanism.

### [Issue 14] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** IR-M8, IR-M9, DC-A
*   **Affected Scope:** Lines 203, 552-565, 566, 568, 578, 580, 594-599
*   **Discrepancy Description:**
    *   **Missing fields:**
        *   `s2-write-policy` and `s2-stampede` give no cache TTL.
        *   `keyspace` and `zipfS` are missing for `s1-scale`, `s1-lb` and the non-static part of `s1-cdn`.
        *   No scenario has a title.
        *   `s1-cdn` gives two of its network fields.
        *   Line 203 says "all four latencies 0.5" but there are three latencies plus the timeout.
    *   **Hint ordering:** M1 uses the first rule whose criterion matches. The M1 generic `errorRate` rule would always match first, so the new scenario hints would never show.
    *   **Hints mention components a scenario doesn't allow:** the M1 server hint says "add instances behind a load balancer", but `s0` has no LB. The database hint mentions caching, which several scenarios disallow.
*   **Rationale:** Missing values are left to the implementer, and unreachable hints are dead content.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Defaults for unlisted fields:** keyspace 100k, `zipfS` 1.0, cache `ttlSeconds` 60 (`s2-ttl` and `s2-stampede` keep the values stated for them).
    *   **Titles:** each scenario's title is its module title from §10.
    *   **`s1-cdn` network:** `clientToEdgeMs` 5 and `clientToOriginMs` 45 (the CDN → origin leg is then 40 ms).
    *   **Hints:** each M2 scenario file defines its **own** `hints` array.
        *   Scenario-specific hints come first, then M1 hint texts that make sense for its `allowed` list.
        *   Hints that would mention a disallowed component are dropped or reworded, for example `s0` says "move to a bigger tier" without an LB.
    *   **Type widening:** already covered by Issue 1.

### [Issue 15] [`implementation_readiness`] - Severity: Major
*   **Merges:** IR-M13
*   **Affected Scope:** Lines 515, 644, 755-776, 796
*   **Discrepancy Description:** The Phase 4 manual checks need `s1-lb`, `s1-cdn` and a pre-M2 saved design, but the router, `SandboxView` and storage don't exist until Phase 5, and `state.ts` is hard-coded to `readHeavy`. Separately, `DrillView` in Phase 5 imports `content/drills.ts` and `content/rubric.ts`, which only appear in Phase 6. `tsc` would fail.
*   **Rationale:** A phase must be buildable and testable on its own.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Phase 4:** the M1 header's scenario `<select>` reads `SCENARIOS` from `scenarios/index.ts`, so every scenario is reachable. `state.ts`'s initial state becomes a function of the scenario. Manual checks 1–5 stay in Phase 4.
    *   **Check 6** (loading a pre-M2 saved design) moves to Phase 5, which introduces storage.
    *   **Phase 5 step:** first create stub `content/drills.ts` and `content/rubric.ts` with their final types, and empty or placeholder data. Phase 6 fills them in.

### [Issue 16] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** IR-M11, DC-C
*   **Affected Scope:** Lines 488-503, 529, 627-635
*   **Discrepancy Description:**
    *   **Untyped data model:** `StepId` is never defined. The shape of the `progress` argument to `isModuleComplete` and `phaseSummary` is not given. `isModuleComplete(def, progress)` reads `drills[drillId]`, but the progress store holds one module per record.
    *   **Undefined terms:** a "scored attempt" is not defined, and neither is which action marks `predict` done.
    *   **Shared drills:** three modules share `d1-url-shortener` and three share `d2-catalog-cache`, so one attempt completes the drill step for all of them, which the spec doesn't say.
    *   **Tests:** `progress.test.ts` can't be written without these shapes.
*   **Rationale:** The completion rule drives the M2 done criterion (11 of 11 modules).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Types** in `app/lessons/progress.ts`:
        ```ts
        type StepId = "concept" | "predict" | "build" | "break" | "explain" | "realWorld" | "drill";
        interface ModuleProgress { moduleId: string; steps: Partial<Record<StepId, { done: boolean; at: number; data?: unknown }>> }
        interface DrillAttempt { id?: number; drillId: string; startedAt: number; durationSec: number; notes: string; scores: number[] } // 6 scores, 0-4
        type ModuleMeta = Omit<ModuleDef, "load">;
        isModuleComplete(def: ModuleMeta, p: ModuleProgress | undefined, attempts: DrillAttempt[]): boolean
        phaseSummary(defs: ModuleMeta[], byModule: Record<string, ModuleProgress>, attempts: DrillAttempt[])
        ```
    *   **Predict done:** on the first submit.
    *   **Scored attempt:** an attempt with all 6 scores set, each in 0–4. The UI doesn't allow saving until they are.
    *   **Shared drills:** one scored attempt completes the drill step for **every** module that references that drill. State this explicitly.
    *   **Tests:** progress tests build `ModuleMeta` objects inline and never import `registry.ts`, because the Vitest config doesn't process MDX.

### [Issue 17] [`design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** DC-12, ZO-9
*   **Affected Scope:** Lines 522-543, 812-816, 845
*   **Discrepancy Description:**
    *   **Import is not atomic.** It does `clearAll()` and then writes. A failure partway (quota error, bad record) leaves partial or no data.
    *   **Shallow validation:** only `version === 1` and the three arrays are checked. A malformed progress entry can crash the app on load.
    *   **No tests** cover `db.ts` or `exportImport.ts`, though import is the only recovery path.
    *   **Weak rationale:** §14 rejects localStorage as "too small", but the data is a few KB.
*   **Rationale:** §12 promises safe data handling.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Keep IndexedDB, because the parent plan names it.
*   ***Proposed Edit:***
    *   **Pure validation:** `validateImport(json): { ok: true; data } | { ok: false; error: string }` in `exportImport.ts`. It checks each record's shape: `designs` entries have `scenarioId` and `design`; `progress` entries have `moduleId` and `steps`; `drills` entries have `drillId` and 6 scores in 0–4.
    *   **Atomic write:** import clears and writes all three stores in one IndexedDB transaction, so a failure rolls everything back.
    *   **New test file:** `tests/app/exportImport.test.ts` for `validateImport`, covering valid input, missing arrays, wrong version, malformed records and out-of-range scores.
    *   **§14 rationale:** "the parent plan specifies IndexedDB" replaces "localStorage is too small".

### [Issue 18] [`implementation_readiness`] - Severity: Major
*   **Merges:** IR-M10
*   **Affected Scope:** Line 737
*   **Discrepancy Description:** The golden record contains `p50`, `cacheHitRatio` and `throughputOk`. But `Evaluation.criteria` only includes p50 and the hit ratio when the scenario configures them. `throughputOk` is not defined anywhere. `toFixed(6)` on `null` throws. The golden test has no timeout, and `read-heavy` is a 180 s run.
*   **Rationale:** The golden file contents are undefined, so two implementers would produce different goldens.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:*** Define the golden record as computed from `records()` and the buckets, independent of the criteria:
    *   **`p50`, `p99`:** nearest-rank over the ok latencies in the window.
    *   **`errorRate`:** the share of window records with outcome ≠ 0.
    *   **`cacheHitRatio`:** `Σhits / Σ(hits+misses)` over cache nodes in the window buckets, or `null` if there are none or no lookups.
    *   **`throughputOk`:** the count of ok records in the window divided by the window length in seconds.
    *   **Bottleneck:** `bottleneckNodeId` and `bottleneckMetric` from the evaluator, or `null`.
    *   **`eventsProcessed`:** from `sim.eventsProcessed`.
    *   **Format:** numbers rounded with `toFixed(6)`, `null` kept as `null`.
    *   **Each golden `it`:** `timeout: 300_000`, using `runToEndYielding`.

### [Issue 19] [`design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** DC-13, ZO-13, IR-N10 (the bench-margin part)
*   **Affected Scope:** Lines 653, 731-740, 751, 866
*   **Discrepancy Description:**
    *   **Very slow suite:** 7 scenarios × (3 reference seeds + starter + bottleneck), plus golden runs for every scenario, is about 35 sequential runs. Each is 130–180 s of virtual time at up to 10k rps, about 1.5M requests, and about 50 s of wall time. All run in one file, and every phase from Phase 3 must pass all of it.
    *   **Hot-path cost:** the new per-request `held` map and epoch closures sit on the bench-critical path. The §16 argument only covers extra draws and events.
    *   **No baseline:** the spec has no M1 bench number to measure headroom against.
*   **Rationale:** A slow gate gets skipped.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **One file per scenario:** `tests/fidelity/m2/<id>.test.ts`, so Vitest runs them in parallel.
    *   **Gate seeds:** the phase gate runs reference seeds 1 and 2. Seed 3 runs during tuning only.
    *   **Targeted runs:** document `npx vitest run tests/fidelity/m2/<id>.test.ts` for tuning.
    *   **Baseline:** in Phase 1 step 0, also record the M1 bench rate (about 549k events/s on Node 26, 2026-11-24) in `notes/m2_log.md`.
    *   **§16 risk:** add "the held map and epoch checks slow the engine", with the bench floor as the mitigation.

### [Issue 20] [`implementation_readiness`] - Severity: Major
*   **Merges:** IR-M16 (remaining part)
*   **Affected Scope:** Lines 664-723
*   **Discrepancy Description:** The test plan has no cases for these:
    *   the action ordering after the heap change (see Issue 1);
    *   `staticRatio` share and key distribution;
    *   scenario-scheduled chaos start and end, including the `AppliedChaos` log;
    *   `inject` validation timing;
    *   `edgeLatency`'s clamp, exercised through `build`;
    *   multi-error ordering for the new CDN validation rules.

    (`normalizeDesign` tests are no longer needed after Issue 1.)
*   **Rationale:** New behavior without tests is how M1-style bugs creep in.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:*** Add:
    *   **Action ordering:** an action and a normal event at the same time run in that order, and two actions run in `actionSeq` order.
    *   **`staticRatio`:** with 0.7, the static share is 0.7 ± 0.02 over 20,000 requests, and static keys follow the asset Zipf.
    *   **Scheduled chaos:** start and end events appear in `allBuckets`' chaos log at the right virtual times, with `source: "scenario"`. A missing target is logged as skipped (Issue 7).
    *   **`inject`:** validation happens before logging, so an invalid action leaves the action log empty.
    *   **`edgeLatency`:** the `cdn → origin` edge clamps to 0.5 ms when `clientToOriginMs ≤ clientToEdgeMs`.
    *   **Validate:** a design with a CDN breaking two rules returns both messages, in rule order.

### [Issue 21] [`implementation_readiness`] - Severity: Major
*   **Merges:** IR-M14
*   **Affected Scope:** Lines 63-66
*   **Discrepancy Description:** `scripts/golden-update.mjs` is described as spawning `npx vitest …` on Windows, where a literal `spawnSync("npx", …)` fails with ENOENT or EINVAL because `npx` is `npx.cmd`. The spawn API and options are not named.
*   **Rationale:** The spec says its goal is working on Windows without extra tools.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:*** Specify: `spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", "tests/golden"], { stdio: "inherit", env: { ...process.env, UPDATE_GOLDEN: "1" } })`, and exit with the child's status code.

### [Issue 22] [`implementation_readiness`] - Severity: Major
*   **Merges:** IR-M15
*   **Affected Scope:** Lines 456, 548
*   **Discrepancy Description:** The CDN node id is never stated (implied `cdn` by the instance id `cdn#0`). The position constants live in `POSITIONS` in `scenarios/readHeavy.ts`, which is declared unmodified. The spec doesn't say where the CDN position goes, or what happens to the client position when the CDN is removed.
*   **Rationale:** M1's Palette imports `POSITIONS` from that file.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Node id:** `cdn`, with instance id `cdn#0`.
    *   **Position:** `CDN_POSITION = { x: -150, y: 200 }` and `CLIENT_WITH_CDN = { x: -300, y: 200 }` are defined in `Palette.tsx`. `scenarios/readHeavy.ts` stays unmodified.
    *   **Move rule:** adding a CDN moves the client to (−300, 200). Removing the CDN moves the client back to (0, 200).
    *   **Deletion:** the CDN is deletable. `PROTECTED` in `state.ts` stays `client`, `server-1` and `db`.

### [Issue 23] [`implementation_readiness`] - Severity: Nit
*   **Merges:** IR-N1
*   **Affected Scope:** Lines 227, 658
*   **Discrepancy Description:** The exact string that is hashed isn't defined, and neither is where the recorded constant lives.
*   **Rationale:** Two implementers could hash differently.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** One sentence.
*   ***Proposed Edit:*** The hash is the SHA-256 of the string produced by the existing `trace()` helper in `determinism.test.ts`, which is `lines.join("\n")`. The recorded constant is hard-coded in that test and noted in `notes/m2_log.md`.

### [Issue 24] [`implementation_readiness`, `zoom_out`] - Severity: Nit
*   **Merges:** IR-N4, IR-N5, IR-N6, IR-N8, IR-N9, ZO-12
*   **Affected Scope:** Lines 45-48, 304, 443-445, 473-474, 633-636
*   **Discrepancy Description:** Several small details are unspecified:
    *   **Outcome 4:** that `outcomeOf` maps `"unavailable"` to code 4, and whether `accepted` increments on a refused connection.
    *   **Hit-ratio chart:** which node it plots when the design has both a CDN and a cache, and what to show for zero-lookup buckets.
    *   **Router:** what a valid route with an unknown id does.
    *   **MDX dependency:** whether `@mdx-js/rollup` is a dependency or a devDependency.
    *   **Phase titles** for the home page.
    *   **Reuse:** that p50 uses the existing `percentile()` and hit/miss reporting uses `cacheCounters` on `MeteredNode`.
*   **Rationale:** Small, but each is a choice the implementer would otherwise make.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** One line each.
*   ***Proposed Edit:***
    *   **Outcome 4:** `outcomeOf` maps `"unavailable"` to 4. A refused connection does **not** increment `accepted`.
    *   **Hit-ratio chart:** one line per cache or CDN node, with gaps for buckets with zero lookups.
    *   **Router:** a known route with an unknown id redirects to `#/`.
    *   **MDX:** `@mdx-js/rollup` and `@types/mdx` go in `devDependencies`.
    *   **Phase titles:** Phase 0 "Foundations", Phase 1 "Scaling basics", Phase 2 "Caching".
    *   **Reuse:** say p50 uses `percentile()`, and hit/miss reporting reuses `cacheCounters`.

### [Issue 25] [`zoom_out`] - Severity: Nit
*   **Merges:** ZO-10, ZO-11
*   **Affected Scope:** Lines 278-282, 446-452, 461-475, 490
*   **Discrepancy Description:**
    *   **Duplicate logs:** `Built` exposes `actionLog()`, `drainChaos()` and `allChaos()`. Nothing consumes `allChaos`. `UserAction` and `AppliedChaos` record overlapping events, and the UI shows two similar lists.
    *   **Underspecified UI:** moving the M1 UI into `SandboxView` needs `initialState` to depend on props, and the scenario `<select>` should be hidden in lesson mode. `<Sandbox step="concept">` has a "caption bar" that appears nowhere else.
*   **Rationale:** Speculative surface with no consumer.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Cutting both is cheaper than defining them.
*   ***Proposed Edit:***
    *   **Drop `allChaos()`.** The ChaosPanel's list comes from the accumulated `drainChaos` results.
    *   **`SandboxView`:** hides the scenario `<select>` when `mode === "lesson"`. Its initial state is built from the `scenario` prop.
    *   **Concept step:** plays the reference design read-only with the normal Play and speed controls. The caption bar is dropped from M2.

### [Issue 26] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** IR-N7, DC-B
*   **Affected Scope:** Line 626
*   **Discrepancy Description:** The `p0-network` Predict answer "2 round trips before the first byte" counts the TCP handshake and TLS 1.3. The request needs a third round trip for the first response byte. The answer is right only for "before the request can be sent".
*   **Rationale:** It would teach a slightly wrong number.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:*** Reword the question to "How many round trips does a brand-new HTTPS connection (TCP + TLS 1.3) need before the request can be sent?" The answer stays 2, plus DNS if uncached.

### [Issue 27] [`zoom_out`] - Severity: Nit
*   **Merges:** ZO-8
*   **Affected Scope:** Lines 177-182, 229-242
*   **Discrepancy Description:** Only `s1-cdn` changes the network, and it sets two of the four `Network` fields. `internalMs` is a knob that no scenario overrides. A separate `engine/network.ts` module, a 4-field type and a per-row test table serve one lesson.
*   **Rationale:** After Issue 2 removes `connectTimeoutMs`, the machinery is even less justified.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Scenario fields:** `network` becomes two optional fields, `clientToEdgeMs` and `clientToOriginMs`. `internalMs` is the constant 0.5.
    *   **No new module:** `edgeLatency` lives in `build.ts` next to `createLinks`. Remove `engine/network.ts` from §3.
    *   **Tests:** `network.test.ts` merges into `tests/engine/cdn.test.ts`.

### [Issue 28] [`design_critic`] - Severity: Nit
*   **Merges:** DC-F, DC-G
*   **Affected Scope:** Lines 333-338, 748
*   **Discrepancy Description:** The spec doesn't say that health checks read `up` only. They don't detect high latency, so the "health checks fix it" lesson could mislead. The recovery assertion is worded two ways: "within 5 s after the crash ends" and "each of the 5 s after recover + 2 s".
*   **Rationale:** Precision.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Health checks:** state that they read the instance's `up` flag only, so they do not detect latency faults.
    *   **Recovery assertion:** "the error count in each of the 5 s starting at (crash end + 2 s) is 0". The crash ends at 120 s, so the instance is eligible again from 122 s.

### [Issue 29] [`zoom_out`] - Severity: Nit
*   **Merges:** ZO-15
*   **Affected Scope:** Lines 54, 66, 293-296, 346-352, 686-687, 737
*   **Discrepancy Description:** Some details sit at code level: the `held: Map<msgId, reply>` field, the `inflight` map's element type, the `vite.config.ts` plugin line, the golden script mechanics, `toFixed(6)`, and `runUntil(7_300.25)`.
*   **Rationale:** The reviewer noted that this matches the M1 house style and may not match the altitude the standard asks for.
*   ***AI Suggestion:*** DECLINE
*   ***Justification:*** The implementation-readiness standard forbids leaving design choices to the implementer. Several of these details exist to close earlier findings. Issues 11, 18 and 21 also depend on them.
*   ***Proposed Edit:*** None.

## Summary

| Category | Count |
|---|---|
| PROPOSE FIX | 28 (Issues 1–28) |
| CONTEST | 0 |
| ESCALATE | 0 |
| DECLINE | 1 (Issue 29) |

All three reviewers completed this round.

**Two issues contain product decisions worth your eye** before auto-accepting:
*   **Issue 2:** deferring `partition` and `loss` chaos to M4.
*   **Issue 3:** how the Break step works (it requires causing a failure, not surviving one).
