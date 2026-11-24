Status: resolved. Round 2 was auto-accepted: 20 fixes applied, 0 contested, 0 escalated, 1 declined (Issue 21).

# Goldfish Annotated Review Report

**Target:** `system_design_course_plan.md` (full file, lines 1-169)
**Round:** 2 of up to 5 (the round 1 report is in `goldfish_review_report_round1.md`)
**Reviewers:**
- implementation_readiness (implementation-readiness standard): completed
- zoom_out (zoom-out standard): completed
- design_critic (feature-spec standard): completed

**Raw totals:** 2 Blockers, 18 Majors, 17 Nits. After deduplication there are 21 issues.
**Round status:** Not clean. There are open Blockers and Majors.

## Churn warning

Three findings in this round target fixes I applied in round 1. Reverting those fixes, or making them simpler, resolves the findings:

| Round 2 issue | Round 1 fix it targets | What the reviewer says |
|---|---|---|
| Issue 1 | Issues 3 and 8 added the hybrid "rate mode" | It was optimizing too early, and it weakens the simulation exactly where cascades happen |
| Issue 5 | Issue 5 added persisted replays, a JSON schema and `engineVersion` | Compatibility machinery that nothing uses yet |
| Issue 10 | Issue 11 added an in-app AI reviewer with a local proxy | A Claude chat already does this for a single user |

Two things caused this. First, I over-built some round 1 fixes. Second, the round 1 fixes were written for a product, and your later answer ("personal learning project") made parts of them unnecessary. The proposed fixes below simplify or revert those parts. After you decide on this round, the loop rules ask you to choose between accepting and proceeding, continuing, or returning the plan to drafting.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Blocker
*   **Merges:** implementation_readiness-2-2 (Blocker), design_critic-2-B1 (Blocker), zoom_out-2-1 (Major), plus the trace part of design_critic-2-M1 and zoom_out-2-5
*   **Affected Scope:** Lines 90, 96, 137, 150 and 163-164 (Simulation engine, Alternatives, Risks, M1)
*   **Discrepancy Description:** The engine tracks each request only up to about 2k requests per second, then switches to "rate mode". The only M1 scenario goes up to 10k requests per second, but M1's scope doesn't include rate mode. Rate mode itself is never defined. It cannot produce p99 latency, cannot represent per-key state, and cannot show cascades. The claim that tracking every request is too slow was never measured.
*   **Rationale:** M1 cannot be evaluated as written. Rate mode would also make fidelity worst exactly where the course is supposed to teach failure. Rough numbers: 10k requests per second at 5–10 hops each is 50–100k events per second, and a heap-based event loop in V8 can plausibly handle around 10^6 events per second.
*   ***AI Suggestion:*** PROPOSE FIX (this reverts part of round 1)
*   ***Justification:*** All three reviewers agree. zoom_out and design_critic both point to the simplest fix: a single per-request engine that you measure before adding anything else.
*   ***Proposed Edit:***
    *   **Engine:** remove "Hybrid model" from Section 4 and say there is **one discrete-event engine that tracks every request**. If it can't keep up, playback simply slows down, since time is virtual. Scenarios can also be scaled down, because behavior matters more than raw numbers.
    *   **M1:** add a benchmark. Measure the engine at 10k requests per second on my laptop.
    *   **Alternatives (Section 5):** replace the "Simulation model" row. The choice is per-request discrete-event simulation. Rejected: closed-form queueing formulas, which can't show cascades, and rate/fluid mode, which can't produce p99 or per-key state. The fallback, used only if the M1 benchmark fails, is **weighted requests**: each simulated request stands for k real ones, which keeps p99, hot keys and stampedes.
    *   **Risks:** update the browser-load row to say the mitigation is the M1 benchmark, with weighted requests as the fallback.

### [Issue 2] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-2-4, the cost/budget part of design_critic-2-M7, and the steady-state part of design_critic-2-N6
*   **Affected Scope:** Lines 35, 86, 99, 104-105 and 163 (M1 scenario, Evaluator)
*   **Discrepancy Description:** The M1 scenario ramps traffic up and never holds steady, so the evaluator has no steady-state window to measure. The scenario also has no duration, no Zipf exponent or keyspace size, no cache capacity or eviction rule, no budget, and no cost model.
*   **Rationale:** Without a budget, you can pass by adding servers until it works, so the scenario teaches no trade-off. That undermines the gate question "is the loop teaching me?".
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The headline numbers go in the roadmap and the unit prices go in the M1 spec.
*   ***Proposed Edit:***
    *   **M1 scenario:** ramp from 1k to 10k requests per second over 60 s of virtual time (this is the warm-up), then hold 10k for 120 s. p99 must stay under 200 ms during the plateau. Use 90% reads, Zipf s = 1.0 over 100k keys, and a fixed budget.
    *   **Cache component:** has a capacity, evicts least-recently-used entries, and supports TTL.
    *   **Cost model:** every component instance has a price per virtual hour. The unit prices go in the M1 spec, and the evaluator checks the total cost against the budget from M1 onward.

### [Issue 3] [`zoom_out`, `design_critic`] - Severity: Major
*   **Merges:** zoom_out-2-2 and the Tier 2 part of design_critic-2-M7
*   **Affected Scope:** Line 58, compared with lines 11 and 161-169
*   **Discrepancy Description:** The 10 Tier 2 capstones are the classic interview questions, but no milestone includes them. Apart from the per-lesson drills, all interview practice is blocked behind about 24 weeks of building the simulator.
*   **Rationale:** These capstones serve Goal 3 most directly, and they need no engine at all.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid, and it costs nothing. It also helps with the "motivation fades" risk.
*   ***Proposed Edit:***
    *   **Roadmap:** add a **parallel interview track** above the milestone table. Starting in week 1, do one Tier 2 capstone every 2 weeks, timed at 45 minutes and self-scored against the rubric.
    *   **Risks:** point the "motivation fades" mitigation at this track.

### [Issue 4] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-2-6 and design_critic-2-M2
*   **Affected Scope:** Line 127 (Fidelity and testing)
*   **Discrepancy Description:** At 99% utilization, the M/M/1 test needs about 10^7 customers plus a long warm-up, which takes minutes per run and still fails at random. The test also says nothing about run length, warm-up, number of seeds, or queue limits. It checks the mean, while the evaluator grades p99.
*   **Rationale:** A test that is slow and flaky gets ignored.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The queueing math cited by design_critic is correct.
*   ***Proposed Edit:***
    *   **Replace the queueing-curve bullet** with a test at **50%, 80% and 90%** utilization. The queue is unbounded, the warm-up is discarded, and the result is the batch mean over 5 seeds.
    *   **Pass criteria:** mean latency within 10% of 1/(μ−λ), and p99 within 15% of ln(100)/(μ−λ).
    *   **Run length:** goes in the M1 spec.

### [Issue 5] [`zoom_out`, `design_critic`, `implementation_readiness`] - Severity: Major
*   **Merges:** zoom_out-2-3, design_critic-2-M3, implementation_readiness-2-5 (all Major), implementation_readiness-2-10 (Nit), and the JSON-validator part of implementation_readiness-2-13 (Nit)
*   **Affected Scope:** Lines 70, 98-102, 128, 152 and 165 (Scenarios, Replay, Risks)
*   **Discrepancy Description:** The reviewers point at two problems:
    *   **zoom_out:** persisted replays, JSON schema extraction and `engineVersion` serve no one in a project with a single author.
    *   **design_critic and implementation_readiness:** determinism is underspecified. The plan names no seeded random-number generator, doesn't put virtual timestamps on user actions, has no trace format or test runner, and has no protection against later engine changes quietly altering the results of earlier lessons.
*   **Rationale:** The machinery adds risk without adding learning. Meanwhile, the protection that actually matters (regression tests) is missing.
*   ***AI Suggestion:*** PROPOSE FIX (this reverts part of round 1)
*   ***Justification:*** Both sides are right, and the fixes don't conflict. Remove the compatibility machinery, and specify the determinism that the tests need.
*   ***Proposed Edit:***
    *   **Scenarios:** typed TypeScript files in `scenarios/`. Remove the JSON schema extraction, `engineVersion` and persisted replays from Section 4 and from M2.
    *   **Determinism:**
        *   a hand-written seeded random-number generator (mulberry32 or xoshiro128\*\*), which is itself good to learn;
        *   every event and user action is stamped with virtual time plus a global sequence ID;
        *   traces are compared as JSONL;
        *   tests run in Vitest.
    *   **Regression protection:** add golden-metric tests per scenario, run on every engine change. This replaces the risk row "Engine changes break saved scenarios" with "Engine changes silently alter earlier lessons".

### [Issue 6] [`implementation_readiness`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-2-3 (Major) and zoom_out-2-8 (Nit)
*   **Affected Scope:** Lines 84-92, compared with lines 50, 57 and 166
*   **Discrepancy Description:** The plan never says how a request moves through the graph:
    *   which algorithm the load balancer uses;
    *   whether the server does cache-aside, and what happens on a miss or a write;
    *   what distributions the service times follow;
    *   which connections are valid.

    Also, the `{key, op, size, deadline}` request shape only fits request/response traffic. Queues, pub/sub, fan-out and WebSockets would each force a change to the core.
*   **Rationale:** Whoever writes the M1 spec would have to invent all of this. The request shape is also a dead end for later milestones.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:*** Add an "M1 behavior" bullet to Section 4:
    *   **Load balancer:** round-robin. Other algorithms come in M2.
    *   **Server reads:** cache-aside. Read the cache first. On a miss, read the database and then fill the cache.
    *   **Server writes:** write to the database, then invalidate the cache entry.
    *   **Service times:** exponential by default, configurable per component.
    *   **Valid connections:** client → load balancer → server → {cache, database}.
    *   **Message model:** each message carries a `kind` field taken from an open set (`request` in M1; `message`, `event` and `push` added from M3), so async traffic can be added later without a rewrite.

### [Issue 7] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-2-7
*   **Affected Scope:** Lines 34, 60, 79, 84, 106, 113 and 163-169
*   **Discrepancy Description:** Several designed features have no milestone:
    *   playback speed
    *   the lesson shell with Predict
    *   evaluator hints
    *   IndexedDB storage
    *   the drill timer and rubric screens

    M2's "done when" also requires a self-scored drill, but M2 has no drill screen. And the rubric doesn't describe what each score from 0 to 4 means.
*   **Rationale:** M2 cannot meet its own "done when" criterion.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **M1:** add playback speed control and evaluator hints.
    *   **M2:** add:
        *   the lesson shell with Predict;
        *   IndexedDB storage with JSON export;
        *   a drill screen with a 45-minute timer and the rubric checklist.
    *   **Rubric:** in M2, write a description of each 0–4 score for each of the 6 rubric parts, before any self-scoring starts.

### [Issue 8] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-2-8, design_critic-2-M4 (both Major), and zoom_out-2-9 (Nit)
*   **Affected Scope:** Lines 96, 131, 147, 164-165 and 168
*   **Discrepancy Description:** Several checks have no pass criteria:
    *   "Fidelity review"
    *   "lab results match the scenario"
    *   the performance budget
    *   the gate question "Is stack A working?"

    "Match" also invites chasing exact numbers. And the plan doesn't say how simulator parameters get tuned to match the labs.
*   **Rationale:** These are the only mitigations for the top risk, so they have to be checkable.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. All three reviewers flagged it.
*   ***Proposed Edit:***
    *   **Fidelity review checklist:**
        *   the latency knee appears at the expected utilization (±10%);
        *   components fail in the expected order;
        *   recovery happens after the fault is removed;
        *   each metric's trend has the right direction.
    *   **Lab match:** the shape must match, not the numbers. The same bottleneck appears first, and lag grows or shrinks under the same load ratio. First tune the simulator's service times to the throughput a single lab node measures.
    *   **M1 benchmark:** run on my laptop, which is the reference machine. Pass criteria:
        *   at least 50k events per second at 10k requests per second;
        *   at least 30 fps at 1× playback.
    *   **Gate:** stack A counts as "working" if the benchmark passes and no tooling problem has blocked me for more than a week.

### [Issue 9] [`design_critic`] - Severity: Major
*   **Merges:** design_critic-2-M1, without its trace part (covered by Issue 1)
*   **Affected Scope:** Lines 48, 51, 86, 140 and 167
*   **Discrepancy Description:** Some phases' main exercises can't be built in the sandbox:
    *   **Phase 6:** "Raft: kill the leader" depends on a linked external visualizer, which the sandbox can't score.
    *   **Phase 3:** "rebalance shards live" needs shard-map state and migration traffic, which the component-state list doesn't include.
*   **Rationale:** As written, those exercises can't follow the predict, build, break and evaluate loop.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Phase 6 main exercise:** change it to **"Database primary dies: a replica is promoted after the failure-detection timeout. Watch writes fail during the failover, and measure the data lost."** To support this, add primary/replica roles and a failover timeout to the database component's state. The Raft visualizer stays as supporting material for the concept.
    *   **Component state (line 86):** add a shard map and migration traffic, scheduled for M3.

### [Issue 10] [`zoom_out`, `design_critic`, `implementation_readiness`] - Severity: Major
*   **Merges:** zoom_out-2-4, design_critic-2-M5 (both Major), and design_critic-2-N3, design_critic-2-N4 and implementation_readiness-2-12 (all Nits)
*   **Affected Scope:** Lines 13, 60, 74 and 115-120 (AI reviewer), plus lines 153 and 169
*   **Discrepancy Description:** The reviewers raised four problems:
    *   **zoom_out:** for one user, pasting the design and a rubric prompt into Claude gives the same result as an in-app reviewer, with no proxy and no API-key risk.
    *   **design_critic, calibration:** it may be circular, since nothing says who writes the reference scores. ±1 on a 0–4 scale is loose, and a single run proves little.
    *   **design_critic, the proxy:** a local proxy can be reached by any web page.
    *   **The token cap:** it has no number.
*   **Rationale:** M6 builds a lot of machinery for very little gain. The calibration problem is real either way.
*   ***AI Suggestion:*** PROPOSE FIX (this reverts part of round 1)
*   ***Justification:*** The zoom_out simplification removes the proxy's exposure problem, the token budget and the key-leak risk all at once. The calibration fix still applies.
*   ***Proposed Edit:***
    *   **Replace the AI reviewer bullet** with **"Export design and copy reviewer prompt"**. The app exports the design JSON plus my notes, and a reviewer prompt file (`content/reviewer_prompt.md`, kept under version control) is pasted into a Claude chat or Claude Code.
    *   **Calibration:**
        *   reference scores come from an outside source, such as published worked solutions or a mock-interview partner;
        *   each design is reviewed 3 times, and the mean and spread are reported;
        *   the bar is exact agreement on at least 60% of the parts, and never more than 1 point off;
        *   the model version is pinned.
    *   **Removals:** delete `proxy/` from the repo layout, the key-leak risk row and the token cap.
    *   **Internet:** state that the app needs internet only for Docker image pulls. The reviewer runs in Claude itself.

### [Issue 11] [`design_critic`] - Severity: Major
*   **Merges:** design_critic-2-M6
*   **Affected Scope:** Lines 14, 138, 155 and 164
*   **Discrepancy Description:** The plan never says why stack A was chosen over C1. And C1 would make the most likely failure, engine throughput, worse: SimPy on CPython is slower per event than JavaScript on V8.
*   **Rationale:** The fallback might not fix the problem that triggers it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid, and it is technically correct.
*   ***Proposed Edit:***
    *   **"Where it runs" row:**
        *   **Why A:** no server, a single language, works offline as a static build, and has React Flow.
        *   **Fallback triggers:** if **engine throughput** fails, the fallback is weighted requests (Issue 1), not C1. C1 is the fallback only if **UI or tooling productivity** fails, because I find React/TypeScript too slow to work in.
    *   **Goals and Risks:** update to match.

### [Issue 12] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-2-1
*   **Affected Scope:** Lines 3 and 92
*   **Discrepancy Description:** Most of the work is deferred to `m1_spec.md`, but the plan only lists 2 things that spec must decide. Nothing says code waits until the spec passes review, and nothing names which spec owns each later decision.
*   **Rationale:** A deferred decision needs a named owner, otherwise it gets made by accident.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   **Line 3:** add "No code for a milestone starts until its spec passes an implementation-readiness review."
    *   **Line 92:** replace it with **"`m1_spec.md` must decide:"**
        *   component parameter tables
        *   the worker message protocol
        *   cost unit prices
        *   M1 scenario details and test run lengths
        *   the snapshot fields
        *   the file list and test cases

        Later decisions belong to the spec for their milestone (`m2_spec.md`, `m3_spec.md`, and so on).

### [Issue 13] [`implementation_readiness`, `zoom_out`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-2-11, zoom_out-2-10 (the visualizer part) and design_critic-2-N2
*   **Affected Scope:** Lines 25, 140 and 167
*   **Discrepancy Description:** The plan says "build three, link Raft", then refers to "all five", and M4 builds a vector-clocks visualizer that isn't on the "build" list.
*   **Rationale:** The counts don't agree.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** This is a real inconsistency. All three reviewers caught it.
*   ***Proposed Edit:*** Change the Visualizers row to "**Build** the hashing ring, token bucket, LSM and vector clocks; **link** Raft".

### [Issue 14] [`zoom_out`, `implementation_readiness`] - Severity: Nit
*   **Merges:** zoom_out-2-6 and the sample-rate part of implementation_readiness-2-13
*   **Affected Scope:** Lines 79 and 81
*   **Discrepancy Description:** A separate Canvas layer synced to React Flow's pan and zoom, plus Framer Motion, means two mitigations for a problem nobody has measured. The sampling rate N is also not chosen.
*   **Rationale:** Same principle the plan already applies to Recharts: add complexity only when profiling shows a need.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** It's cheaper, and it follows the plan's own rule.
*   ***Proposed Edit:***
    *   **Start simple:** animate sampled requests with React Flow's animated SVG edges, and use CSS transitions.
    *   **Escalate on evidence:** add the Canvas layer only if the M1 benchmark misses its fps target.
    *   **Dependencies:** drop Framer Motion.
    *   **Spec:** N goes in `m1_spec.md`.

### [Issue 15] [`zoom_out`] - Severity: Nit
*   **Merges:** zoom_out-2-7
*   **Affected Scope:** Lines 121 and 169
*   **Discrepancy Description:** Anki already imports CSV, so building an export feature isn't needed.
*   **Rationale:** No code is needed for this.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** It's a free scope cut.
*   ***Proposed Edit:***
    *   **Content:** each module gets a hand-written `cards.csv` file next to it, which Anki imports directly.
    *   **M6:** remove "Anki export".

### [Issue 16] [`zoom_out`, `design_critic`] - Severity: Nit
*   **Merges:** zoom_out-2-5 and the M5-load part of design_critic-2-N6
*   **Affected Scope:** Lines 53 and 168
*   **Discrepancy Description:** Phase 8 is about operations tooling. Real OpenTelemetry and Jaeger teach more than simulated logs and traces. M5 is also overloaded for 5 weeks.
*   **Rationale:** Using real tools is closer to the job. It also takes engine work out of M5.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** It improves learning and makes M5 lighter.
*   ***Proposed Edit:***
    *   **Phase 8 main exercise:** "Find the root cause of a latency spike in a small Docker lab: 2–3 services, an OTel collector and Jaeger, with injected faults, fitting in 8 GB of RAM."
    *   **M5:** remove "simulated logs and traces" from scope.

### [Issue 17] [`design_critic`] - Severity: Nit
*   **Merges:** design_critic-2-N1
*   **Affected Scope:** Lines 129 and 167
*   **Discrepancy Description:** The retry-storm test teaches that jittered backoff fixes retry storms. Under sustained overload it doesn't: you also need a retry budget or a circuit breaker.
*   **Rationale:** As written, the test reinforces a wrong intuition.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** It's correct, and it's a valuable lesson.
*   ***Proposed Edit:*** Add a second variant: under sustained overload, backoff alone still fails, and a retry budget or circuit breaker is needed to pass.

### [Issue 18] [`design_critic`] - Severity: Nit
*   **Merges:** design_critic-2-N5
*   **Affected Scope:** Line 113
*   **Discrepancy Description:** IndexedDB storage is best-effort, so the browser can evict your progress.
*   **Rationale:** You could lose work.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** It's a cheap fix.
*   ***Proposed Edit:*** Call `navigator.storage.persist()`, and remind me to export JSON weekly.

### [Issue 19] [`design_critic`] - Severity: Nit
*   **Merges:** design_critic-2-N6 (the snapshot timing, Goal 3 threshold and internet parts)
*   **Affected Scope:** Lines 11, 13 and 94
*   **Discrepancy Description:**
    *   The 10 Hz snapshots are not aggregated in virtual time.
    *   "Score well" (Goal 3) has no threshold.
    *   The "internet" line ignores Docker image pulls.
*   **Rationale:** These are precision gaps.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Cheap fixes.
*   ***Proposed Edit:***
    *   **Snapshots:** aggregate metrics over virtual-time windows, and post them to the UI at 10 Hz of wall-clock time.
    *   **Goal 3:** "score at least 3 out of 4 on every rubric part".
    *   **Internet line:** see Issue 10.

### [Issue 20] [`implementation_readiness`] - Severity: Nit
*   **Merges:** implementation_readiness-2-9
*   **Affected Scope:** Lines 99 and 106
*   **Discrepancy Description:** The scenario's field groups leave out the hint-rule table, even though the evaluator reads it.
*   **Rationale:** The scenario type would be incomplete.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** A one-word fix.
*   ***Proposed Edit:*** Add "hint rules" to the scenario field groups, which are now TypeScript types (Issue 5).

### [Issue 21] [`zoom_out`] - Severity: Nit
*   **Merges:** zoom_out-2-10 (the "too low-level" part)
*   **Affected Scope:** Lines 82 and 109-110
*   **Discrepancy Description:** `@mdx-js/rollup`, `npm run dev` and the visualizer `init`/`step` signatures are build-spec detail.
*   **Rationale:** Line 3 says that kind of detail belongs in each milestone's spec.
*   ***AI Suggestion:*** DECLINE
*   ***Justification:*** The visualizer interface defines how visualizers plug in, and round 1 Issue 13 asked for it to be in this document. The two tooling names are one line each and make the stack concrete. Moving them adds churn without adding clarity.
*   ***Proposed Edit:*** None.

## Summary

| Category | Count |
|---|---|
| PROPOSE FIX | 20 (Issues 1, 5 and 10 revert or simplify round 1 fixes) |
| CONTEST | 0 |
| ESCALATE | 0 |
| DECLINE | 1 (Issue 21) |

No reviewer was recorded as not run.
