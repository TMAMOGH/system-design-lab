Status: resolved. Round 1 of the M1 spec review was auto-accepted: 24 fixes applied, 0 contested, 0 escalated, 1 declined (Issue 24). Issues 14 and 23 also edited `system_design_course_plan.md`. The M1 benchmark target in the plan was raised to 150k events/s to match Issue 10.

# Goldfish Annotated Review Report

**Target:** `m1_spec.md` (full file, lines 1-618)
**Round:** 1 of up to 5
**Reviewers:** implementation_readiness (implementation-readiness standard), design_critic (feature-spec standard) and zoom_out (zoom-out standard). All three completed.
**Context given to reviewers:** `system_design_course_plan.md`
**Raw totals:** 2 Blockers, 17 Majors, 30 Nits. After deduplication there are 25 issues.
**Round status:** Not clean. There are open Blockers and Majors.

**Checks that held up:**
- Two reviewers independently confirmed the cost arithmetic: $2.00/h for the reference design and $3.75/h for the no-cache design.
- Both M/M/1 formulas are correct.
- design_critic's rough calculation gives the reference design a p99 of about 50 ms, a cache hit ratio of about 0.82, about 57% DB utilization and about 60% server utilization. That should pass the 200 ms limit with room to spare.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`design_critic`] - Severity: Blocker
*   **Merges:** design_critic-1-2 (Blocker) and design_critic-1-8 (Major)
*   **Affected Scope:** Line 252 (held worker), lines 303-305 (utilization), line 342 (bottleneck), lines 344-350 and 390-394 (hints), and lines 397-409 and 594-597 (variant and prediction)
*   **Discrepancy Description:**
    *   **Inflated utilization:** a server worker stays "busy" while it waits on the DB. So when the DB saturates, every server upstream of it also reports about 100% utilization. Example: with a medium DB, `server-1` ties with or beats `db` and wins the tie-break. The hint then says "add servers", which fixes nothing.
    *   **Wrong error-rate hint target:** the error-rate hint names the node with the highest utilization, which may not be the node doing the rejecting.
    *   **No oracle for the prediction exercise:** "first bottleneck" doesn't say whether it means first in time or highest average. Also, the variant's parameters are published in the spec, so it isn't truly unseen.
*   **Rationale:** This breaks the core teaching loop (try, fail, fix). Wrong hints teach the wrong fix.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid and is the most important finding in the review. Keeping the held-worker model is right, because it is what makes failures cascade upstream. Attribution must look past it.
*   ***Proposed Edit:***
    *   **Two utilization figures per instance:** `heldUtil` counts all time a worker is held, and is what the canvas shows as "workers in use". `serviceUtil` counts only the instance's own service time.
    *   **Bottleneck rule:** the bottleneck is the node with the highest **window-mean `serviceUtil`**. Ties go to the node furthest downstream, using DB > cache > server > LB order.
    *   **Error-rate hints:** `{component}` becomes the node with the most rejections plus start-time timeouts in the window.
    *   **New evaluator test:** a medium DB behind 16 small servers. The test asserts that `db` is reported as the bottleneck.
    *   **Prediction oracle:** the evaluator's reported bottleneck, plus "the first second in which any node's `serviceUtil` exceeds 0.95".
    *   **Variant:** add a note that I know the parameters, so the exercise means "predict from the parameters before running". That is honest about what it tests.

### [Issue 2] [`design_critic`] - Severity: Blocker
*   **Merges:** design_critic-1-1
*   **Affected Scope:** Whole document. The underlying decisions are at lines 228-262, 303-330, 528-536 and 574-577.
*   **Discrepancy Description:** The spec has no Alternatives section for the choices it makes on its own: the held-worker model, fire-and-forget cache set, thinning for arrivals, the definition of utilization, the `setTimeout` runner, SVG `animateMotion`, `id % N` sampling, 1-second buckets, and exact sorting for p99.
*   **Rationale:** The feature-spec standard says a proposal without rejected alternatives fails.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. The parent plan's §5 covers only plan-level choices.
*   ***Proposed Edit:*** Add **§13 Alternatives considered**, with one row per decision and the reason each alternative was rejected:
    *   **Async server** (worker freed while waiting): rejected because nothing cascades upstream. Instead, the spec keeps the held worker and splits utilization (Issue 1).
    *   **Cache set that uses a worker:** rejected because it adds a second load path to the cache that M1 doesn't teach.
    *   **Per-phase exponential approximation** (instead of thinning): rejected because it is biased while the ramp is changing the arrival rate.
    *   **`requestAnimationFrame`:** rejected because it isn't available in workers.
    *   **Busy-loop runner:** rejected because it starves incoming messages.
    *   **Random sampling:** rejected because it consumes the RNG and so breaks determinism.
    *   **Canvas animation layer:** deferred until profiling shows it's needed.
    *   **Sliding-window metrics:** rejected because they cost more than 1-second buckets.
    *   **t-digest or HDR histograms:** rejected because exact sorting is affordable at around 1.2M values.

### [Issue 3] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-1-M6 (Major), design_critic-1-10 (Nit)
*   **Affected Scope:** Lines 303-305, 461 and 465
*   **Discrepancy Description:** `busyArea` only updates when `busy` changes. A worker that stays held across a sample boundary would therefore report 0. Also, a component with concurrency 0, as in the cache-error test, computes 0/0 and gets NaN.
*   **Rationale:** Utilization decides which bottleneck the evaluator reports.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Flush before reading:** before reading the areas, the sampler adds `busy × (now − lastChange)` (and the matching service-time area) and sets `lastChange = now`.
    *   **Zero concurrency:** utilization is 0 when concurrency × instances = 0.

### [Issue 4] [`zoom_out`, `implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** zoom_out-1-M3, implementation_readiness-1-M3, design_critic-1-6
*   **Affected Scope:** Line 142 (`Hop`), lines 221-224 (`call`), line 329, lines 576-577
*   **Discrepancy Description:**
    *   **Wrong recording time:** both hops are recorded at call time, before the response exists, so the back hop's `ok` can't be known yet.
    *   **No timestamp:** `Hop` carries no virtual time, so all of a snapshot's hops animate at once, as a single 10 Hz burst.
    *   **Undefined UI hop state:** the hop record the UI keeps isn't defined.
*   **Rationale:** Red dots on return trips are the main way you see a failure. As written, the animation of failures is undefined.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. All three reviewers flagged it.
*   ***Proposed Edit:***
    *   **Hop type:** `Hop = {edgeId, dir, ok, vt}`.
    *   **Forward hop:** recorded when `call` is made, with `ok: true` (links can't fail in M1).
    *   **Back hop:** recorded when `reply` runs, with `ok = res.ok`.
    *   **UI record:** `{...Hop, receivedAt}`.
    *   **Staggered animation:** each dot starts at `receivedAt + min(100, (hop.vt − snapshotFirstVt) / speed)` ms.
    *   **Pruning:** hops are pruned once they are more than 400 ms old.

### [Issue 5] [`implementation_readiness`, `zoom_out`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-1-M2 (Major), zoom_out-1-M2 (Major), part of design_critic-1-9 (Nit)
*   **Affected Scope:** Line 439 (`build` returns), lines 445 and 328 (sample rate N), lines 533-535
*   **Discrepancy Description:** `build()` returns only `{sim, metrics, runToEnd, runUntil}`. The runner also needs:
    *   a way to check that the run is finished
    *   a way to change N mid-run
    *   access to new buckets and hops, all buckets and the records
    *   evaluation

    Separately, `sampleN` is fixed at build time, but N must change on Play and on every speed change.
*   **Rationale:** As written, whoever builds the runner would have to invent this API.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. A setter is simpler than recording every hop and filtering later.
*   ***Proposed Edit:*** `build` returns:

    ```ts
    interface Built {
      sim; endMs: number;
      isFinished(): boolean;
      runUntil(tMs, wallBudgetMs): number;
      setSampleN(n: number): void;
      drainBuckets(): Bucket[];
      drainHops(): Hop[];
      allBuckets(): Bucket[];
      records(): Records;
      evaluate(): Evaluation;
    }
    ```

    `sampleN` is removed from `BuildOptions`.

### [Issue 6] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:**
    *   Majors: implementation_readiness-1-M7, design_critic-1-7
    *   Nits: zoom_out-1-N5 (run end), zoom_out-1-N6 (scenario id), zoom_out-1-N3 (cost duplication), implementation_readiness-1-N9, implementation_readiness-1-N10, implementation_readiness-1-N11
*   **Affected Scope:** Lines 264-267 (run end), lines 515-536 (runner and protocol), lines 546-567 (state and Controls)
*   **Discrepancy Description:**
    *   **`end` is undefined.** Because the sampler keeps the event heap non-empty, every run would run to the cap.
    *   **The UI sends `play` before the `load` result arrives**, and resuming from a pause rebuilds the run from scratch.
    *   **`runToEnd` may never yield**, so it can starve `pause` and `reset` messages.
    *   **There is no run id**, so stale snapshots can arrive after a reset.
    *   **`lagging` is never cleared.**
    *   **The protocol names a variant id before the variant file exists.**
    *   **Cost is computed in two places.**
*   **Rationale:** The sequence of messages between UI and worker has to be decided somewhere. As written, it is left to the implementer.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. zoom_out also points out a simpler run end that gives the same results.
*   ***Proposed Edit:***
    *   **Run end:** `endMs = durationSec×1000 + timeoutMs`, or `+ 60,000` when the timeout is `Infinity`. Any request still outstanding at `endMs` is recorded as a timeout. This is exact, because any reply after the deadline already counts as a timeout. The outstanding-request counter and the 20-second cap are removed.
    *   **Protocol:**
        *   Add `runId` to every message, and have the UI drop messages whose `runId` is stale.
        *   `load` carries `scenario: Scenario` as data instead of an id, so the scenario registry and the forward reference both go away.
        *   `loaded` carries nothing else.
        *   The UI computes cost itself, using `costPerHour` from `catalog.ts`.
    *   **New state-transition table:**

        | UI action, by status | Messages sent |
        |---|---|
        | Play from `editing` | `load`; when `loaded` arrives, `play` |
        | Play from `paused` | `play` only |
        | Run to end from `editing` | `load`, then `runToEnd` |
        | Run to end from `paused` | `runToEnd` |
        | Pause or speed change before `load` | Ignored |
        | Engine throws | Worker posts `error`; status becomes `editing` |
        | Reset | Clears buckets, hops, evaluation and errors; `runId++` |

    *   **Yielding:** `runToEnd` yields with `setTimeout(0)` between 50 ms chunks.
    *   **Lagging:** `lagging` becomes false whenever a tick reaches its target time.

### [Issue 7] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-1-M1
*   **Affected Scope:** Lines 437-463 (component tests) and 446-450 (`override`)
*   **Discrepancy Description:**
    *   **Scripted inputs:** most component tests need specific messages at specific times. `build()` only offers the client's random arrival generator.
    *   **Small caches:** the LRU test needs a cache with capacity 2, but the smallest cache in the catalog holds 10k keys.
    *   **Constructors:** no component constructor signatures are given.
*   **Rationale:** As written, the tests can't be written.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Pure cache state class:** export `class LruTtlStore { constructor(capacity, ttlMs); get(key, now): boolean; set(key, now); invalidate(key) }` from `cache.ts`. The LRU and TTL tests call it directly with explicit `now` values.
    *   **Scripted arrivals:** add `arrivals?: { tMs: number; key: number; op: Op }[]` to `BuildOptions`. When it is set, the client sends exactly those requests and generates nothing else. Every other component test uses `build` with scripted arrivals.

### [Issue 8] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-1-M4 (Major), design_critic-1-13 (Nit)
*   **Affected Scope:** Lines 309-311, 334, 475 and 490
*   **Discrepancy Description:** The type of the evaluator's input records is never defined. That leaves open the array layout, how outcomes are encoded, how the arrays grow, and what latency a forced timeout gets.
*   **Rationale:** The evaluator tests, the M/M/1 test and the code must all agree on this shape.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Type:** `interface Records { n: number; createdAt: Float64Array; latency: Float64Array; outcome: Uint8Array }`.
    *   **Outcome codes:** 0 ok, 1 rejected, 2 timeout, 3 downstream.
    *   **Growth:** start at 65,536 entries and double when full.
    *   **Forced timeouts:** latency is `endMs − createdAt`. Only `ok` latencies count toward p99.

### [Issue 9] [`implementation_readiness`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-M5 (Major), zoom_out-1-N4 (Nit)
*   **Affected Scope:** Lines 290-298, 472 and 560
*   **Discrepancy Description:**
    *   **Validation messages:** only rule 4 has exact text, but the tests check every rule's message.
    *   **Ordering:** the spec doesn't say whether all errors are collected or only the first, or in what order.
    *   **Canvas rule:** it's unclear where the canvas gets its rule for which connections are allowed.
*   **Rationale:** The implementer would be writing user-facing text that the tests then lock in.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:***
    *   **Exact message texts:** add one per rule in §7.
    *   **Ordering:** collect all errors, in rule order.
    *   **Shared rule:** export `canConnect(sourceType, targetType): string | null` from `validate.ts`. It returns the refusal reason or `null`, and `Canvas.tsx` imports it. That way the rule exists in one place.

### [Issue 10] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:**
    *   Majors: implementation_readiness-1-M8, design_critic-1-4, design_critic-1-5
    *   Nits: implementation_readiness-1-N16, implementation_readiness-1-N17
*   **Affected Scope:** Lines 485, 503 and 508-511 (timeouts and bench), lines 529-531 (runner), lines 584 and 590-592 (checklist and FPS)
*   **Discrepancy Description:**
    *   **Real-time cost:** a request costs about 11 events, so 1× playback at 10k rps needs about 110k events/s. With the runner's 12/16 ms duty cycle, that is about 150k events/s.
    *   **Weak floor:** the 50k events/s floor can pass while 1× playback crawls at a third of real time.
    *   **Bench timeout:** the bench has no timeout, so Vitest's 5-second default fails it.
    *   **Fidelity timeouts:** the fidelity timeouts don't match the throughput floor.
    *   **Phase 3 gate:** it doesn't run the slow suites, so an unsolvable scenario could slip through.
*   **Rationale:** As written, the benchmark could pass while the product is unusable.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid. The numbers check out.
*   ***Proposed Edit:***
    *   **Bench:** the benchmark asserts at least **150,000 events/s** in Node, has a timeout of `600_000`, and measures wall time with `performance.now()` around the run.
    *   **Per-test timeouts:** each fidelity `it` gets its own `timeout: 300_000`. At the floor, a full scenario run takes about 115 s and the ρ=0.9 M/M/1 run about 170 s.
    *   **Phase 3 gate:** add `test:fidelity` and `bench` to it.
    *   **Checklist item 4:** the lagging badge must **not** appear on the plateau at 1×. It may appear at 5×.
    *   **Browser rate:** record the in-browser events/s from a `snapshot` counter during the FPS check.

### [Issue 11] [`zoom_out`] - Severity: Major
*   **Merges:** zoom_out-1-M1
*   **Affected Scope:** Lines 153, 258, 292, 295, 297 and 557
*   **Discrepancy Description:** There are two ways to scale servers horizontally: adding more server nodes, or raising a node's `instances` field. Supporting both brings in ordering by canvas edge, a round-robin across nodes, reachability checks for each server, and id allocation. No test or scenario needs more than one server node.
*   **Rationale:** `instances` alone teaches horizontal scaling. The cache and DB are already capped at one node each.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid, and it removes several pieces of machinery.
*   ***Proposed Edit:***
    *   **Fixed server node:** exactly one server node, `server-1`. It is pre-placed by the scenario and can't be deleted.
    *   **Palette:** remove the Add Server button.
    *   **Validation:** rule 1 becomes "exactly 1 server", and rule 6 becomes "the server has an edge to the db, and to the cache if a cache exists".
    *   **Load balancer:** round-robins across `server-1`'s instances.
    *   **Id allocation:** "next free N" is dropped.

### [Issue 12] [`design_critic`] - Severity: Major
*   **Merges:** design_critic-1-3
*   **Affected Scope:** Whole document
*   **Discrepancy Description:** There is no Risks section. It should cover throughput, the misattribution problem, memory for records, design-size limits, GC pressure from per-event closures, and a security statement.
*   **Rationale:** The feature-spec standard requires one.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is valid.
*   ***Proposed Edit:*** Add **§14 Risks**:

    | Risk | Mitigation |
    |---|---|
    | Throughput (Issue 10) | The bench floor, with weighted requests as the fallback |
    | Misattribution (Issue 1) | Split utilization and add a test for it |
    | Memory | About 1.2M records × 17 B ≈ 20 MB, plus about 40 MB pooled for M/M/1. Both are acceptable. |
    | Design size | Bounded: 5 nodes and at most 20 instances |
    | GC pressure from closures | Measured by the bench. If it falls short, reuse pooled event objects (needs a spec amendment). |
    | Security | Local only: no network, no persistence, and the only input is my own design through the UI |

### [Issue 13] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N1, implementation_readiness-1-N2, part of design_critic-1-9
*   **Affected Scope:** Lines 190, 194-197, 208 and 214
*   **Discrepancy Description:**
    *   **Heap:** `runUntil` uses `heap.peek()`, but the heap API doesn't define it. The spec also doesn't say who assigns `seq`.
    *   **Types:** `Rng` and `Instance` are never defined.
    *   **Export names:** most module exports are unnamed.
*   **Rationale:** Tests and code have to agree on names.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:*** Add an exports list:
    *   **Heap:** `class EventHeap {push, pop, peek, size}`. `Simulation` assigns `seq`.
    *   **RNG:** `createRng(seed): Rng` and `interface Rng {next(), exp(mean)}`.
    *   **Instance:** `class Instance`.
    *   **Other modules:** `build`, `costPerHour`, `validate`, `canConnect`, `evaluate`, `createRunner`.

### [Issue 14] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N3
*   **Affected Scope:** Lines 191 and 483
*   **Discrepancy Description:** `TraceMeta.type` has no defined set of values. Also, the "JSONL" lines in the spec are space-separated text, not JSON.
*   **Rationale:** The trace format must be the same on every run for the determinism test to work.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **Vocabulary:** define the values `arrive`, `accept`, `start`, `serviceDone`, `reply`, `cacheSet`, `cacheInvalidate`, `sample` and `end`.
    *   **Naming:** call the format "trace lines" (space-separated), not JSONL. Make the same correction in the plan's determinism bullet.

### [Issue 15] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N4
*   **Affected Scope:** Lines 438 and 470
*   **Discrepancy Description:** Phase 2 says to implement §5.5–§8, which includes §7 (validation). But `validate.ts` belongs to Phase 3.
*   **Rationale:** The two phases contradict each other.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is a one-line fix.
*   ***Proposed Edit:*** Change Phase 2 to "Implement §5.5–§6 and §8".

### [Issue 16] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N5, implementation_readiness-1-N12, design_critic-1-12
*   **Affected Scope:** Lines 304 and 315-322 (buckets), line 571 (error-rate chart), line 532 (update rate)
*   **Discrepancy Description:**
    *   **Bucket wording:** "a bucket per node" conflicts with the `Bucket` type.
    *   **Partial seconds:** the spec doesn't say what happens to a final partial second.
    *   **Empty seconds:** `hitRatio` is undefined when a second has 0 cache reads.
    *   **Error rate:** the formula for the error-rate chart is never given.
    *   **Update rate:** the dashboard only updates once per virtual second, even though snapshots arrive 10 times per second.
*   **Rationale:** These are precision gaps.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** These are cheap fixes. A 1 Hz dashboard at 1× is fine for learning.
*   ***Proposed Edit:***
    *   **Buckets:** there is one `Bucket` per virtual second, holding a `nodes` map. A final partial second is not bucketed.
    *   **Hit ratio:** `hitRatio` is omitted for a second with 0 cache reads.
    *   **Error-rate formula:** errors ÷ (ok + errors), or 0 when there were no requests.
    *   **Update rate:** state explicitly that the dashboard and node bars update once per completed virtual second.

### [Issue 17] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N6, implementation_readiness-1-N7, design_critic-1-11
*   **Affected Scope:** Lines 349-350 and 390-395
*   **Discrepancy Description:** It's unclear whether `{util}` includes the % sign. Separately, `"${amount}"` would be treated as interpolation if the hint is written as a template literal.
*   **Rationale:** Either could put the wrong text on screen.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **`{util}`:** renders as `"97%"`, with the sign included.
    *   **Hint strings:** must be written as plain `"…"` string literals.

### [Issue 18] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N8
*   **Affected Scope:** Lines 379-387
*   **Discrepancy Description:** The starter and reference designs give no canvas positions and no edge ids.
*   **Rationale:** As written, the implementer has to choose them.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **Positions:** client (0, 200), lb (200, 200), server-1 (400, 200), cache (650, 100), db (650, 300).
    *   **Edge ids:** `e-${source}-${target}`.

### [Issue 19] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N13, implementation_readiness-1-N14
*   **Affected Scope:** Lines 81, 547, 557 and 562
*   **Discrepancy Description:** Several UI details are unspecified:
    *   what the Inspector shows for client and LB nodes
    *   whether removing a node also removes its edges
    *   how invalid instance input is handled
    *   whether Speed is a select or buttons
    *   what `useSimWorker` exposes
*   **Rationale:** These are small UI decisions left to the implementer.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **Inspector:** shows "No settings" for client and LB nodes.
    *   **Node removal:** removing a node also removes its edges.
    *   **Instances input:** rounds and clamps to 1–20 when it loses focus.
    *   **Speed:** a `<select>`.
    *   **`useSimWorker(dispatch)`:** returns `{ play, pause, setSpeed, runToEnd, reset }`. It owns the worker and `runId`, and dispatches incoming messages.

### [Issue 20] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-1-N15
*   **Affected Scope:** Lines 432-433
*   **Discrepancy Description:** The Zipf test tolerance doesn't say whether it is relative or absolute. The s=0 case also gives no n or sample count.
*   **Rationale:** The test as written is ambiguous.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:***
    *   **Tolerance:** "within 2% relative".
    *   **s=0 case:** n = 1000 with 10⁶ samples; each of the 10 buckets has frequency 0.1 ± 0.005 (absolute).

### [Issue 21] [`zoom_out`] - Severity: Nit
*   **Merges:** zoom_out-1-N1, zoom_out-1-N2
*   **Affected Scope:** Lines 135, 446-450 and 463
*   **Discrepancy Description:** There is a test that only proves the unused `size` field has no effect. The `override` option also has two fields no test uses: `writeMeanMs` and `serviceMeanMs`.
*   **Rationale:** These are YAGNI (built before anything needs them).
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is a free cut.
*   ***Proposed Edit:***
    *   **Size test:** drop it. Keep the field, because the plan's message shape includes it.
    *   **`override`:** trim to `concurrency`, `queueLimit`, `readMeanMs` and `fixedService`.

### [Issue 22] [`design_critic`] - Severity: Nit
*   **Merges:** design_critic-1-14
*   **Affected Scope:** Lines 7-14
*   **Discrepancy Description:** §1 lists deliverables but doesn't state the problem or the measurable done criteria.
*   **Rationale:** The standard asks for a problem statement and goals.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix.
*   ***Proposed Edit:*** Add a purpose line and a "Done when" list, matching the plan's M1 row and the updated benchmark from Issue 10.

### [Issue 23] [`zoom_out`] - Severity: Nit
*   **Merges:** zoom_out-1-N7 (dashboard part)
*   **Affected Scope:** Lines 568-572, and plan line 213
*   **Discrepancy Description:** The M1 dashboard already covers p50/p99, throughput and errors. But the plan lists the "full dashboard" as M2 work.
*   **Rationale:** As written, M2 is estimated for work already done in M1.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is cheap to fix and keeps the documents consistent.
*   ***Proposed Edit:***
    *   **Spec:** add a note that M1 already includes these charts.
    *   **Plan:** change the M2 row from "full dashboard (p50/p99, throughput, errors, cost)" to "cost chart and chaos-event markers on the dashboard".

### [Issue 24] [`zoom_out`] - Severity: Nit
*   **Merges:** zoom_out-1-N7 (worker cast part)
*   **Affected Scope:** Line 538
*   **Discrepancy Description:** The `postMessage` cast is a workaround. Adding `/// <reference lib="webworker" />` would be cleaner.
*   **Rationale:** It is a cleanliness issue.
*   ***AI Suggestion:*** DECLINE
*   ***Justification:*** `tsconfig.json` type-checks `app/` and `engine/` as one program with the DOM lib. Adding the WebWorker lib reference to one file pulls it into the whole program, which gives the known DOM/WebWorker duplicate-declaration errors. The one-line cast is the smaller trade-off.
*   ***Proposed Edit:*** None.

### [Issue 25] [`design_critic`] - Severity: Nit
*   **Merges:** design_critic-1-8 ("unseen" part; the oracle part is in Issue 1)
*   **Affected Scope:** Lines 397-409
*   **Discrepancy Description:** The variant's parameters are published in the spec, so it is not really "unseen".
*   **Rationale:** The exercise is weaker than the plan describes.
*   ***AI Suggestion:*** PROPOSE FIX (covered by Issue 1's edit)
*   ***Justification:*** Since I am the only author, randomizing the parameters or having someone else write them isn't practical. Rewording the exercise honestly is enough.
*   ***Proposed Edit:*** See Issue 1. Phase 6 is reworded to "predict from the parameters before running".

## Summary

| Category | Count |
|---|---|
| PROPOSE FIX | 24 |
| CONTEST | 0 |
| ESCALATE | 0 |
| DECLINE | 1 (Issue 24) |

No reviewer was recorded as not run.
