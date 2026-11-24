Status: resolved. Round 1: 20 accepted through the interactive breakdown, 0 contested, 0 escalated, 0 declined. Issues 9, 11, 12 and 18 were adjusted for the personal-learning audience: a local proxy, local-only hosting, and the M1 exit test applied to the author rather than to 3 learners.

# Goldfish Annotated Review Report

**Target:** `system_design_course_plan.md` (full file, lines 1-80)
**Round:** 1 of up to 5
**Reviewers:** design_critic (feature-spec standard): completed · zoom_out (zoom-out standard): completed · implementation_readiness (implementation-readiness standard): completed
**Raw totals:** 8 Blockers, 31 Majors, 11 Nits. After deduplication there are 20 issues. Each issue below lists the raw finding IDs it merges (`<reviewer>-<round>-<n>`).
**Round status:** Not clean. There are open Blockers and Majors.

## The overall picture

All three reviewers say the same thing. As written, the document is a **product and curriculum vision**, but it is being judged as a **build plan**. Two root causes create most of the findings:

1. **The two open questions.** "Personal learning project or product?" and "Which tech stack?" are unanswered, but the rest of the plan already assumes answers to both.
2. **The engine and UI design is too thin.** It is a stateless queue model with per-request DOM animation, which cannot carry about half of the curriculum or the 10k requests per second target.

The suggested approach is to fix the vision document so it holds together: add goals and non-goals, alternatives, risks, a full roadmap mapping and exit criteria. The file-level M1 implementation detail goes into a **separate M1 spec**, written after the open questions are answered. That keeps this document readable and still meets the implementation-readiness bar where building actually happens.

## Prioritized Findings & AI Suggestions

### [Issue 1] [`design_critic`, `implementation_readiness`, `zoom_out`] - Severity: Blocker
*   **Merges:** implementation_readiness-1-1 (Blocker), design_critic-1-3 (Blocker), design_critic-1-4 (Major), zoom_out-1-1 (Major)
*   **Affected Scope:** [Lines 3-5](system_design_course_plan.md#L3-L5), [Lines 47-57](system_design_course_plan.md#L47-L57), [Lines 77-80](system_design_course_plan.md#L77-L80) (Core idea, Tech design, Open questions)
*   **Discrepancy Description:** The audience question (personal learning or product) and the stack question are unresolved. Yet Section 4 already commits to React, TypeScript, React Flow and Framer Motion, M6 aims at "a complete product", and Section 6 assumes a personal portfolio project. There is no Goals or Non-Goals section.
*   **Rationale:** The audience decides whether the backend, accounts, AI-reviewer key protection, hosted labs and content quality bar are in scope at all. The M1 estimate also depends on the stack.
*   ***AI Suggestion:*** PROPOSE FIX. **Your answer is needed.**
*   ***Justification:*** The critique is valid, and only you can answer it. The fix cannot be written until you answer the two questions.
*   ***Proposed Edit:***
    *   Location: Replace Section 7 "Open questions" with a new **"0. Goals, non-goals and audience"** section placed right after the title.
    *   Change: Record your answers. Goals: the learner can meet an SLO under load in the sandbox and can run a 45-minute design drill. Non-goals (if personal): no accounts, no multi-user backend, no hosted labs, no custom spaced-repetition scheduler. Mark the Section 4 stack as **confirmed** or **provisional**. Trim M5 and M6 to match the audience.

### [Issue 2] [`design_critic`, `zoom_out`, `implementation_readiness`] - Severity: Blocker
*   **Merges:** implementation_readiness-1-5 (Blocker), design_critic-1-6 (Major), zoom_out-1-2 (Major), implementation_readiness-1-8 (Major)
*   **Affected Scope:** [Lines 50-53](system_design_course_plan.md#L50-L53) (Simulation engine), against [Lines 21](system_design_course_plan.md#L21) and [32-41](system_design_course_plan.md#L32-L41)
*   **Discrepancy Description:** "Each component is a queue with a capacity, a latency distribution..." cannot express what the curriculum needs: cache hit ratio and hot keys, replica lag and read-your-writes, shard rebalancing, consumer offsets, retry storms, network partitions, LB algorithms. There is no time model, no meaning for capacity or overflow, no routing rules, no worker message protocol, and chaos events are not mapped to changes in engine state.
*   **Rationale:** M3 would force a rewrite of the M1 engine, or the core lessons would have to be faked with scripts.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The extension model belongs in the plan now. The parameter tables belong in the M1 spec.
*   ***Proposed Edit:***
    *   Location: Section 4, "Simulation engine" bullet.
    *   Change: Replace it with an engine model that has these parts:
        *   **Time:** virtual sim time, played back at a user-chosen speed.
        *   **Requests:** each carries `{key, op: read|write, size, deadline}`, and keys follow a Zipf distribution set per scenario.
        *   **Components:** each has a concurrency limit and a queue limit. On overflow they reject or time out. They can hold minimal state, such as cache contents with TTL, a replica log position or a consumer offset.
        *   **Links:** first-class, with their own latency and partition or loss faults.
        *   **Client policies:** timeouts, retries with jitter, circuit breaker.
        *   **Chaos events:** each is a typed state change on a component or link, applied at a given time.
        *   **Out of scope for the sandbox:** internals of collaborative editing, video encoding and payment-provider internals. These are covered by visualizers or written design exercises.
        *   **M1 spec:** the per-component parameter tables and the worker protocol go there.

### [Issue 3] [`design_critic`, `zoom_out`] - Severity: Blocker
*   **Merges:** design_critic-1-1 (Blocker), zoom_out-1-5 (Major)
*   **Affected Scope:** [Lines 47-59](system_design_course_plan.md#L47-L59) (Tech design), [Line 12](system_design_course_plan.md#L12), [Line 18](system_design_course_plan.md#L18)
*   **Discrepancy Description:** There is no Alternatives section. Several things are chosen without considering other options: per-request discrete-event simulation versus rate-based (fluid) simulation, browser versus server, a custom engine and visualizers versus reusing existing ones (for example RaftScope and The Secret Lives of Data for Raft), and producing a new animated video for every module.
*   **Rationale:** Both the feature-spec and zoom-out standards require documented trade-offs and a build-or-reuse decision.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   Location: New section **"Alternatives considered"** after Section 4.
    *   Change: One row per decision:
        *   **Simulation model:** a hybrid. Per-request DES up to about 2k simulated requests per second, a rate-based mode above that. Rejected: pure closed-form queueing models, because they cannot show cascades.
        *   **Where it runs:** in the browser, in a Web Worker. Rejected: a server-side simulator, because it adds hosting cost and latency.
        *   **Visualizers:** link existing Raft visualizations and build only the ones that are missing.
        *   **Explainers:** use the interactive simulation itself or a short screen capture, not a custom animated video.
        *   **Personal-learning audience:** if that is the answer to Issue 1, building the engine yourself is a deliberate choice, and the section should say so.

### [Issue 4] [`design_critic`] - Severity: Blocker
*   **Merges:** design_critic-1-2 (Blocker)
*   **Affected Scope:** Whole document. Only [Line 75](system_design_course_plan.md#L75) touches risk.
*   **Discrepancy Description:** There is no Risks and Mitigations section. Unaddressed risks: low fidelity teaching wrong intuitions, browser performance, the AI key and its cost and abuse, lab security and resources, the cost of producing content, and versioning of scenarios and the engine.
*   **Rationale:** The feature-spec standard requires it.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Most entries already appear as Issues 2, 5, 7, 11, 14 and 16.
*   ***Proposed Edit:***
    *   Location: New section **"Risks and mitigations"** before the roadmap.
    *   Change: A table with columns risk, impact, mitigation and milestone, with one row for each of the risks listed above. It absorbs the "Watch scope creep" tip as a row whose mitigation is "M1 scope freeze".

### [Issue 5] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Blocker
*   **Merges:** implementation_readiness-1-4 (Blocker), design_critic-1-11 (Major), zoom_out-1-8 (Nit), plus "JSON or YAML" from implementation_readiness-1-6 and zoom_out-1-10
*   **Affected Scope:** [Lines 53-54](system_design_course_plan.md#L53-L54) (Scenarios as data, seeded replay)
*   **Discrepancy Description:** The scenario schema is undefined, and the format is "JSON or YAML". "Add lessons without writing code" is overstated, because new components or chaos types need engine code. Seeded replay is only deterministic if the engine version is pinned, ties between events are broken deterministically and user inputs are logged.
*   **Rationale:** The schema is the main contract between content and engine. Reviewers disagree on timing: implementation_readiness wants the full schema now, while zoom_out wants it extracted after 2-3 hand-written scenarios.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. It follows zoom_out on timing, which fits the MVP-first approach in the plan, while fixing the format and listing the required fields.
*   ***Proposed Edit:***
    *   Location: Section 4, "Scenarios as data" bullet.
    *   Change: Specify these points:
        *   **Format:** JSON, validated by a versioned schema.
        *   **Required field groups:** traffic pattern, request mix, allowed components and budget, chaos events, success criteria (metric, percentile, threshold, window), seed, and `engineVersion`.
        *   **Replay:** stores the seed, the engine version and a log of user actions. Ties between events are broken by sequence id.
        *   **When to write the schema:** hand-write the first 2-3 scenarios in TypeScript and extract the formal schema from them, by the end of M2.
        *   **Narrowed claim:** "add scenarios built from existing components and chaos types without code".

### [Issue 6] [`implementation_readiness`] - Severity: Blocker
*   **Merges:** implementation_readiness-1-2 (Blocker)
*   **Affected Scope:** [Lines 47-70](system_design_course_plan.md#L47-L70) (Tech design and roadmap)
*   **Discrepancy Description:** There is no repo layout and no list of files to create for any milestone.
*   **Rationale:** The implementation-readiness standard requires an explicit file boundary.
*   ***AI Suggestion:*** PROPOSE FIX (deferred to the M1 spec)
*   ***Justification:*** Valid for any document that someone builds from. Adding file lists for M1-M6 to a vision document would be premature, since the stack is still open (Issue 1). The fix states the document's scope and adds a top-level layout. The exact M1 file list goes into the M1 spec.
*   ***Proposed Edit:***
    *   Location: Just below the title, plus a new bullet in Section 4.
    *   Change: Add a scope note: "This is the product and curriculum plan. Each milestone gets its own build spec (file list, tests, schemas) before work starts. The first is `m1_spec.md`." Add a top-level layout: `engine/` (simulation, worker), `app/` (canvas, dashboard), `scenarios/`, `visualizers/`, `content/` (MDX), `labs/`.

### [Issue 7] [`implementation_readiness`, `design_critic`] - Severity: Blocker
*   **Merges:** implementation_readiness-1-3 (Blocker), design_critic-1-7 (Major)
*   **Affected Scope:** [Line 59](system_design_course_plan.md#L59) (Fidelity rule), [Line 53](system_design_course_plan.md#L53)
*   **Discrepancy Description:** There is no test plan. The fidelity rule cannot be checked, and nothing verifies determinism.
*   **Rationale:** Wrong intuitions are the main teaching risk of a simulation course.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The fidelity tests are core to the product, so they belong in the plan. The test cases for each file go into the M1 spec.
*   ***Proposed Edit:***
    *   Location: Expand the "Fidelity rule" into a **"Fidelity and testing"** subsection.
    *   Change: Add these checks:
        *   **Queueing curve:** a single-server M/M/1 run at utilization 0.5, 0.9 and 0.99 gives mean latency within 10% of 1/(μ−λ).
        *   **Determinism:** the same seed, engine version and action log produce an identical event trace.
        *   **Cascades:** a known retry-storm scenario must fail under the naive configuration and pass with jittered backoff.
        *   **Evaluator:** pass/fail is checked against hand-calculated cases.
        *   **Release gate:** every scenario has a fidelity review before release. When a Docker lab exists, compare its results with the matching simulation.

### [Issue 8] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-7, design_critic-1-5, zoom_out-1-3 (all Major)
*   **Affected Scope:** [Line 20](system_design_course_plan.md#L20), [Lines 49-50](system_design_course_plan.md#L49-L50)
*   **Discrepancy Description:** Animating every request with Framer Motion or the DOM at 10k requests per second is not feasible. The boundary between worker and UI and the frame budget are not stated.
*   **Rationale:** Getting this wrong means redoing the rendering in M2.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. All three reviewers raised it independently.
*   ***Proposed Edit:***
    *   Location: Section 4, "Frontend" bullet, plus a new "Engine–UI boundary" bullet.
    *   Change: Make these the plan:
        *   **Worker output:** the worker posts aggregated metric snapshots at 10 Hz.
        *   **Animation:** the UI animates a 1-in-N sample of requests on a Canvas layer over React Flow. Framer Motion is used only for UI transitions.
        *   **Budget:** 60 fps on a mid-range laptop, and at least 50k simulated events per second in the worker.
        *   **High load:** above the DES threshold, switch to rate mode (see Issue 3).

### [Issue 9] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-11, design_critic-1-13, zoom_out-1-6 (all Major)
*   **Affected Scope:** [Lines 26-39](system_design_course_plan.md#L26-L39) against [Lines 61-70](system_design_course_plan.md#L61-L70)
*   **Discrepancy Description:** The roadmap does not cover the curriculum:
    *   Phases 6-9 have no milestone.
    *   M2's Phase 1 lessons need a CDN, which only arrives in M3.
    *   M3's Phase 3 lessons need the consistent-hashing and LSM visualizers, which only arrive in M4.
    *   Phase 8 needs simulated logs and traces.
    *   Phase 9 is not a simulation.
    *   Only M1 has an estimate.
*   **Rationale:** As written, the roadmap cannot deliver the curriculum.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Three reviewers agree.
*   ***Proposed Edit:***
    *   Location: Section 5 roadmap table.
    *   Change: Rebuild the roadmap so every phase and capstone has a milestone:
        *   **M2:** Phases 0-2, including a basic CDN component.
        *   **M3:** Phases 3-5, plus the hashing-ring and LSM visualizers they need.
        *   **M4:** Phases 6-7, plus the Raft and vector-clock visualizers and client retry/circuit-breaker policies.
        *   **M5:** Phase 8 with simulated logs and traces, Phase 9 as a written design exercise (not a sandbox), and the first capstones.
        *   **M6:** interview mode and the AI reviewer (backend first; see Issue 11).
        *   **Estimates:** a rough size for each milestone.

### [Issue 10] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-10, design_critic-1-9, the "one template for every topic" part of zoom_out-1-6 (all Major)
*   **Affected Scope:** [Lines 16-24](system_design_course_plan.md#L16-L24), [Line 55](system_design_course_plan.md#L55)
*   **Discrepancy Description:** The 7-step loop is required for every module, but several steps have no assessment mechanism before M5: Predict, free-text "explain", and the rubric-scored drill. How hints are produced is not specified. Some topics (DNS/TLS, API design) do not suit the full loop.
*   **Rationale:** The lessons built in M2-M4 cannot carry out the loop as described.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   Location: Section 2, after the list, plus the Section 4 "Evaluator" bullet.
    *   Change: Make the loop the **default** and allow lighter modules (concept → predict → small lab). Define how each step is assessed:
        *   **Predict:** multiple choice, scored automatically.
        *   **Fix and explain:** before the AI reviewer exists, the learner compares their answer with a model answer.
        *   **Interview drill:** before the AI reviewer exists, the learner scores themselves against the rubric checklist.
        *   **Evaluator:** p99 is computed over a steady-state window that the scenario defines. Hints come from a rule table in the scenario, keyed by which criterion or component failed.

### [Issue 11] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-14 (Major), design_critic-1-10 (Major), zoom_out-1-9 (Nit), implementation_readiness-1-21 (Nit)
*   **Affected Scope:** [Line 43](system_design_course_plan.md#L43), [Line 57](system_design_course_plan.md#L57), [Lines 69-70](system_design_course_plan.md#L69-L70)
*   **Discrepancy Description:** The AI reviewer ships in M5, before the backend. Calling the Claude API from the client exposes the key. There is no cost or rate cap, no way to serialize the design for grading, no calibration, and "pushes back like a FAANG interviewer" is not specified.
*   **Rationale:** This combines a security problem, a cost problem and an ordering problem.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. How heavy the fix needs to be depends on Issue 1: for personal use, a local proxy with your own key is enough.
*   ***Proposed Edit:***
    *   Location: Section 3 "Interview mode" and Section 4 "Later" bullet.
    *   Change: Specify these points:
        *   **Key protection:** the AI reviewer always calls through a server-side proxy. For personal use, that is a small local proxy.
        *   **Grading input:** the design JSON (canvas graph) plus the learner's written notes.
        *   **Grading output:** a score from 0 to 4 for each of the 6 rubric parts, plus follow-up questions taken from a fixed list of probe categories for each part.
        *   **Limits:** a per-session token cap and a rate limit.
        *   **Calibration:** check grading against 5 or more reference designs with known scores.

### [Issue 12] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-12, design_critic-1-8, zoom_out-1-7 (all Major)
*   **Affected Scope:** [Lines 61-70](system_design_course_plan.md#L61-L70), [Line 75](system_design_course_plan.md#L75)
*   **Discrepancy Description:** The milestones have no exit criteria. M1's goal, "proves it teaches", cannot be measured. The M1 scenario is not named, and there is no go/no-go gate before M2.
*   **Rationale:** Without a gate, M2-M6 will follow by momentum.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   Location: Section 5. Add a "Done when" column and a gate after M1.
    *   Change:
        *   **M1 scenario:** name it "Scale a read-heavy app": 1k growing to 10k requests per second, 90% reads, p99 under 200 ms.
        *   **M1 done when:** all tests from Issue 7 pass, and at least 3 learners each correctly predict the first bottleneck in a new variant of the scenario they have not seen.
        *   **Gate:** M2 starts only if M1 is done. Otherwise change the approach.
        *   **Scope freeze:** M1 scope is frozen. This replaces the scope-creep tip.

### [Issue 13] [`implementation_readiness`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-13, zoom_out-1-4 (both Major)
*   **Affected Scope:** [Line 12](system_design_course_plan.md#L12), [Line 68](system_design_course_plan.md#L68), Section 4
*   **Discrepancy Description:** The architecture of the mechanism visualizers is undefined. It is not said whether they share the engine, how rewind works, how they embed in MDX, or how far each one goes (for example, how much of Raft).
*   **Rationale:** If this stays open, two separate state and animation systems may get built.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   Location: New Section 4 bullet, "Mechanism visualizers".
    *   Change: Specify these points:
        *   **Design:** small step machines, separate from the DES engine.
        *   **Interface:** `init(params)`, `step(state, event) → state`, and a history of snapshots for rewind.
        *   **Embedding:** each is an MDX component that takes `{params, script}`.
        *   **Scope:** Raft covers leader election plus basic log replication, with no membership changes. The other visualizers get similarly bounded scopes.
        *   **Reuse:** link existing visualizers where they are good enough (see Issue 3).

### [Issue 14] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-1-18, design_critic-1-12 (both Major)
*   **Affected Scope:** [Line 45](system_design_course_plan.md#L45)
*   **Discrepancy Description:** The Docker labs have no delivery model (local or hosted), no resource requirements (Windows/WSL, RAM), no list of labs, and no pass criteria.
*   **Rationale:** Running Postgres, Redis and Kafka together is heavy. Hosting labs for other learners has security and cost implications.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   Location: Section 3 "Hands-on labs".
    *   Change: Specify these points:
        *   **Delivery:** local only, with no hosted labs.
        *   **Requirements:** Docker Desktop with WSL2 and 8 GB of RAM.
        *   **Layout:** one resource-limited `labs/<topic>/docker-compose.yml` per lab.
        *   **Initial labs:** Postgres replication lag, Redis cache-aside, Kafka consumer lag, and a k6 load test.
        *   **Pass criteria:** each lab has a README with pass criteria and a matching sandbox scenario.

### [Issue 15] [`implementation_readiness`] - Severity: Major
*   **Merges:** implementation_readiness-1-16 (Major)
*   **Affected Scope:** [Line 41](system_design_course_plan.md#L41), [Line 51](system_design_course_plan.md#L51)
*   **Discrepancy Description:** The 14 capstones need components that are never defined: blob storage, a search index, WebSocket gateways, workers and schedulers. None of the capstones is specified.
*   **Rationale:** As written, the capstone list cannot be built.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. Cutting the list also addresses the content-cost concern in Issue 16.
*   ***Proposed Edit:***
    *   Location: Section 3 "Capstones".
    *   Change: Split the list into two tiers:
        *   **Tier 1, simulated:** URL shortener, rate limiter, news feed and chat. Add the components they need (blob store, WebSocket gateway, worker) to the component catalog.
        *   **Tier 2, written design exercises with a rubric only:** the remaining capstones.

### [Issue 16] [`design_critic`] - Severity: Major
*   **Merges:** design_critic-1-14 (Major), design_critic-1-19 (Nit)
*   **Affected Scope:** [Line 18](system_design_course_plan.md#L18), [Line 23](system_design_course_plan.md#L23), [Line 41](system_design_course_plan.md#L41), [Line 56](system_design_course_plan.md#L56)
*   **Discrepancy Description:** The content load is large and unplanned: an animated explainer for every module, case studies for each topic and 14 capstones. There is no production method, no effort estimate and no sources for the "real world" step.
*   **Rationale:** Producing the content is likely the largest cost in the project.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid.
*   ***Proposed Edit:***
    *   Location: Section 2 steps 1 and 6, plus a new row in the risks table.
    *   Change:
        *   **Explainer (step 1):** a short guided walkthrough of the module's own simulation, not a custom video.
        *   **Real world (step 6):** a summary of a public engineering blog post or paper, with a link and attribution.
        *   **Effort:** estimate the content effort per module and record it in the risks table.

### [Issue 17] [`implementation_readiness`, `design_critic`, `zoom_out`] - Severity: Major
*   **Merges:** implementation_readiness-1-6 (Major), the "D3 or Recharts" part of zoom_out-1-10 (Nit)
*   **Affected Scope:** [Line 49](system_design_course_plan.md#L49)
*   **Discrepancy Description:** The dependency choice "D3 or Recharts" is unresolved.
*   **Rationale:** The implementation-readiness standard does not allow open dependency choices.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. At a 10 Hz snapshot rate (Issue 8), Recharts is good enough and simpler.
*   ***Proposed Edit:***
    *   Location: Line 49.
    *   Change: Pick Recharts, fed by throttled 10 Hz snapshots. Revisit only if profiling shows a frame-budget problem.

### [Issue 18] [`implementation_readiness`, `design_critic`] - Severity: Major
*   **Merges:** implementation_readiness-1-15 (Major), implementation_readiness-1-17 (Major), design_critic-1-16 (Nit), design_critic-1-17 (Nit)
*   **Affected Scope:** [Lines 47-57](system_design_course_plan.md#L47-L57)
*   **Discrepancy Description:** The MDX toolchain, hosting and persistence before the backend are all unspecified, and there is no serialization format for saved designs.
*   **Rationale:** Saved designs feed both the AI reviewer and any future migration to a backend.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** Valid. The choice is marked provisional until the stack question in Issue 1 is answered.
*   ***Proposed Edit:***
    *   Location: Section 4, new bullets.
    *   Change: Add these provisional choices:
        *   **Build:** Vite with React, plus `@mdx-js/rollup`.
        *   **Hosting:** a static site.
        *   **Persistence:** designs and progress go in IndexedDB, with JSON export and import.
        *   **Serialization:** one design JSON format (nodes, edges, config) used by the canvas, replay and the AI reviewer.

### [Issue 19] [`zoom_out`] - Severity: Nit
*   **Merges:** the spaced-repetition part of zoom_out-1-10 (Nit)
*   **Affected Scope:** [Line 57](system_design_course_plan.md#L57), [Line 70](system_design_course_plan.md#L70)
*   **Discrepancy Description:** A custom spaced-repetition system duplicates what existing tools such as Anki already do.
*   **Rationale:** Building it adds scope without adding much value.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** It is a cheap scope cut.
*   ***Proposed Edit:***
    *   Location: Lines 57 and 70.
    *   Change: Replace "spaced-repetition review" with "export each module's key facts as an Anki deck".

### [Issue 20] [`implementation_readiness`, `design_critic`] - Severity: Nit
*   **Merges:** implementation_readiness-1-19, design_critic-1-15 ("$X" placeholder); implementation_readiness-1-20, design_critic-1-18 (Section 6 tips and unsupported claims)
*   **Affected Scope:** [Line 5](system_design_course_plan.md#L5), [Line 20](system_design_course_plan.md#L20), [Lines 72-75](system_design_course_plan.md#L72-L75)
*   **Discrepancy Description:** There is a leftover "$X" placeholder. Section 6 is personal advice rather than plan content. "People remember what they have broken" is stated without support.
*   **Rationale:** These are clarity issues.
*   ***AI Suggestion:*** PROPOSE FIX
*   ***Justification:*** These are cheap fixes.
*   ***Proposed Edit:***
    *   Location: Lines 5, 20 and 72-75.
    *   Change:
        *   **Line 20:** replace "cost under $X" with "cost under the scenario's budget".
        *   **Line 5:** soften the claim to "Active practice with feedback (predict, try, fail, fix) builds intuition that reading alone does not".
        *   **Section 6:** remove it. Move the scope-creep tip into Issue 12's scope freeze. Move "build it while you learn it" into the Goals section as the reason for the personal-learning option, if that is the answer to Issue 1.

## Summary

| Category | Count |
|---|---|
| PROPOSE FIX | 20 (Issue 1 needs your answers first) |
| CONTEST | 0 |
| ESCALATE | 0 |
| DECLINE | 0 |

No reviewer was recorded as not run.
