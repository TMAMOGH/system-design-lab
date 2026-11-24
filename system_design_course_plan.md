# Plan: a visual system design course you learn by simulating

> **Scope of this document:** this is the curriculum and product roadmap. Each milestone gets its own build spec with the file list, tests and schemas: `m1_spec.md`, `m2_spec.md` and so on. **No code for a milestone starts until its spec passes an implementation-readiness review.**

## 0. Goals, non-goals and audience

- **Audience:** this is a personal learning project. I am building it to become ready for FAANG-level system design work and interviews. Building the simulator is part of the learning: writing a discrete-event simulator of distributed systems forces me to understand each topic deeply.
- **Goals:**
  1. Work through curriculum Phases 0–9 with hands-on practice, not just reading.
  2. Meet an SLO within budget under load in the sandbox, and explain the trade-offs behind the design.
  3. Run a 45-minute design drill and score at least 3 out of 4 on every rubric part.
- **Non-goals:** user accounts, a multi-user backend, hosting or deploying for other people, hosted labs, an AI integration inside the app, a custom spaced-repetition scheduler, and monetization.
- **Runs locally:** everything runs on my own machine. The only internet needs are Docker image pulls for the labs and the Claude chat I paste designs into for review.
- **Stack (provisional):** stack A. That is TypeScript, React (Vite), React Flow, Recharts and an engine running in a Web Worker. I'll review it at the M1 gate. Section 5 explains why A and when to fall back to C1 (Python SimPy engine, FastAPI on localhost, React UI).

## 1. The core idea

Most system design courses show you diagrams. This one lets you **build an architecture, send traffic through it, watch it break, and fix it.** Practising with feedback (predict, try, fail, fix) builds intuition that reading alone does not.

There are two kinds of interactive pieces:

| Type | What it is | Examples |
|---|---|---|
| **Architecture sandbox** (big picture) | A drag-and-drop canvas. You place components, set the load, inject failures and watch live metrics. | Scale a read-heavy app; survive a database failover |
| **Mechanism visualizers** (inner workings) | Step-by-step animations of one algorithm. You can pause, rewind and tweak them. | Consistent hashing ring, token bucket rate limiting, LSM-tree compaction, vector clocks. For Raft, link existing visualizers (see Section 5). |

## 2. How each lesson works

Most modules follow the full loop below. Topics that gain little from a sandbox, such as DNS/TCP/TLS and API design, use a **lighter loop**: concept, predict, then a small exercise.

| Step | What happens | How it is checked |
|---|---|---|
| 1. **Concept** | A short guided walkthrough of the module's own simulation | — |
| 2. **Predict** | A question like "Traffic triples. What fails first?" You commit to an answer before you see what happens. | Multiple choice, scored automatically |
| 3. **Build** | Meet the requirements in the sandbox. Example: 10k requests per second, p99 under 200 ms, cost within the scenario's budget. | Evaluator (Section 4) |
| 4. **Break** | Chaos events: the database primary dies, a cache stampede hits, a network partition opens, a key gets hot | Evaluator |
| 5. **Fix and explain** | Apply the right pattern and write down the trade-off | Compare against a model answer. From M6, the Claude review flow (Section 4) grades it too. |
| 6. **Real world** | A short summary of a public engineering blog post or paper on the same problem, with a link and attribution | — |
| 7. **Interview drill** | The same problem as a timed 45-minute design | Self-scored on the rubric checklist. From M6, the Claude review flow scores it too. |

Each module also gets a hand-written `cards.csv` file next to its content, which Anki imports directly.

## 3. Curriculum (10 phases)

| Phase | Topics | Signature exercise |
|---|---|---|
| **0. Foundations** | Latency numbers, back-of-envelope estimation, DNS/TCP/HTTP/TLS, single-server limits | Watch one server saturate as traffic grows |
| **1. Scaling basics** | Vertical vs. horizontal scaling, L4 vs. L7 load balancing and LB algorithms, CDN, stateless services | Add load balancers and servers until you meet the SLO within budget |
| **2. Caching** | Cache-aside, write-through and write-back, eviction, invalidation, stampedes, hot keys | Trigger a cache stampede, then fix it |
| **3. Data** | SQL vs. NoSQL, indexes, B-tree vs. LSM, transactions and isolation levels, replication, sharding, consistent hashing | Shard a database and rebalance it live |
| **4. Consistency** | CAP and PACELC, quorums, consistency models, replication lag, conflict resolution | Read your own write while replicas lag |
| **5. Async systems** | Queues, pub/sub, the Kafka log, delivery guarantees, idempotency, outbox, sagas, CQRS and event sourcing, backpressure | A consumer falls behind and the queue grows |
| **6. Distributed systems** | Clocks, leader election, Raft, distributed locks, gossip, failure detection, split brain | The database primary dies and a replica is promoted after the failure-detection timeout. Watch writes fail during the failover and measure the data lost. A linked Raft visualizer covers the consensus mechanism itself. |
| **7. Reliability** | Timeouts, retries with jitter, circuit breakers, retry budgets, bulkheads, rate limiting, graceful degradation, multi-region, disaster recovery (RTO/RPO) | A retry storm takes the system down. Under sustained overload, backoff alone is not enough. |
| **8. Operations** | Metrics, logs and traces; SLIs, SLOs and error budgets; canary and blue-green deploys; capacity planning; incident response | Find the root cause of a latency spike in a small Docker lab: 2–3 services, an OpenTelemetry collector and Jaeger, with injected faults |
| **9. API and security** | REST, gRPC and GraphQL; pagination; versioning; authentication and authorization; OAuth | A written API design exercise, scored against a rubric. This one does not use the sandbox. |

**Capstones** come in two tiers:
- **Tier 1, simulated in the sandbox (M5):** URL shortener, rate limiter, news feed and chat. These add three components to the catalog: blob store, WebSocket gateway and background worker.
- **Tier 2, written design exercises (interview track, from week 1):** notifications, video streaming, ride matching, distributed key-value store, search autocomplete, payments, web crawler, collaborative editor, ticket booking and top-K leaderboard.

**Interview rubric:** the rubric has 6 parts: requirements, estimation, API, data model, high-level design, and deep dives with trade-offs. Each part is scored 0–4. In M2 I write a description of what each score means for each part, before any self-scoring starts.

**Hands-on labs:** labs run locally only and need Docker Desktop with WSL2 and at least 8 GB of RAM. Each lab is a resource-limited `labs/<topic>/docker-compose.yml` with a README that states its pass criteria and its matching sandbox scenario. The first labs are:
- Postgres replication lag
- Redis cache-aside
- Kafka consumer lag
- a k6 load test
- the Phase 8 tracing lab

The simulator builds intuition, and the labs check it against real systems.

## 4. Tech design (stack A, provisional)

- **Repo layout:**
  ```
  engine/        simulation core, components, Web Worker entry
  app/           React UI: canvas, dashboard, lesson shell, drill screen
  scenarios/     typed TypeScript scenario definitions
  visualizers/   mechanism step-machines (hashing ring, token bucket, LSM, vector clocks)
  content/       MDX lessons, cards.csv per module, reviewer_prompt.md
  labs/          docker-compose labs, one folder per topic
  ```
- **Frontend:**
  - React + TypeScript, built with Vite.
  - **React Flow** for the canvas. Sampled requests are animated with React Flow's animated SVG edges, plus CSS transitions.
  - A separate Canvas layer gets added only if the M1 benchmark misses its fps target.
  - **Recharts** draws the metrics from throttled snapshots.
- **Content:** MDX lessons compiled with `@mdx-js/rollup`. Run with `npm run dev`, or build static files that work offline.
- **Simulation engine:** a single discrete-event engine running in a Web Worker. It tracks **every request**.
  - **Time:** virtual. Playback runs at a speed the user chooses. If the engine can't keep up, playback slows down instead of losing accuracy.
  - **Messages:** each carries `{kind, key, op, size, deadline}`.
    - `kind` comes from an open set: `request` in M1, then `message`, `event` and `push` from M3. This lets async traffic arrive without rewriting the core.
    - Keys follow a Zipf distribution, set per scenario.
  - **Components:**
    - Each has a concurrency limit and a queue limit, and rejects or times out requests when full.
    - Service times are exponential by default and configurable.
    - Components can hold minimal state:
      - cache contents, with a capacity, LRU eviction and TTL
      - a replica's log position
      - a database's primary/replica role and failover timeout
      - a consumer's offset
      - a shard map and migration traffic (M3)
  - **Links:** first-class objects with their own latency and faults (partition, packet loss).
  - **Client policies:** timeouts, retries with jitter, retry budgets, circuit breaker.
  - **Chaos events:** typed changes to a component's or link's state, applied at a given time.
  - **M1 behavior:**
    - The load balancer uses round-robin. Other algorithms come in M2.
    - Servers read with cache-aside: on a miss, read the database and then fill the cache.
    - Writes go to the database and then invalidate the cache.
    - Valid connections are client → load balancer → server → {cache, database}.
  - **Out of scope for the sandbox:** the internals of collaborative editing, video encoding and payment providers. Visualizers or written design exercises cover those.
- **Determinism:**
  - A hand-written seeded random number generator (mulberry32 or xoshiro128\*\*).
  - Every event and user action is stamped with its virtual time and a global sequence ID.
  - The same seed plus the same action log always produces the same trace.
  - Traces are compared as plain trace lines, and tests run in Vitest.
- **Engine–UI boundary:**
  - The worker aggregates metrics over virtual-time windows and posts snapshots at 10 Hz of wall-clock time. It never sends every event.
  - The UI animates only a 1-in-N sample of requests.
  - Performance targets are set and checked by the M1 benchmark (Section 7).
- **Scenarios:**
  - Scenarios are typed TypeScript files in `scenarios/`, checked at compile time. A scenario defines:
    - the traffic pattern
    - the request mix (read/write ratio and key distribution)
    - which components are allowed, and the budget
    - chaos events
    - success criteria (metric, percentile, threshold, measurement window)
    - hint rules
    - the seed
  - New scenarios that use only existing components and chaos types need no engine changes.
- **Cost model:** each component instance has a price per virtual hour. The evaluator checks total cost against the scenario's budget from M1 onward.
- **Evaluator:**
  - Computes p99 over the scenario's steady-state window.
  - Checks each success criterion and the budget.
  - Hints come from the scenario's hint rules, keyed by which criterion or component failed.
- **Mechanism visualizers:**
  - Small step machines, kept separate from the simulation engine.
  - Interface: `init(params)`, `step(state, event) → state`, and a history of snapshots so you can rewind.
  - Each is an MDX component that takes `{params, script}`.
  - Each has a bounded scope. For example, vector clocks covers 3 processes, message passing and concurrency detection.
- **Persistence:**
  - Designs and progress live in IndexedDB. The app calls `navigator.storage.persist()` and reminds me to export JSON weekly.
  - One design JSON format (nodes, edges, config) is shared by the canvas and the review export.
- **Claude review flow (M6):**
  - An "Export design for review" action copies the design JSON plus my notes.
  - I paste that, with the version-controlled `content/reviewer_prompt.md`, into a Claude chat or Claude Code.
  - The prompt asks for a 0–4 score on each rubric part, plus follow-up questions drawn from a fixed list of probe categories for each part.
- **What `m1_spec.md` must decide:**
  - component parameter tables
  - the worker message protocol and snapshot fields
  - cost unit prices
  - M1 scenario details and test run lengths
  - the sample rate N
  - the file list and test cases

  Later decisions belong to each milestone's own spec.

### Fidelity and testing

The models should be simple but behave the right way. Queueing behavior (latency exploding as load nears 100%) and failure cascades matter far more than exact numbers. These checks enforce that:

- **Queueing curve:** M/M/1 runs at 50%, 80% and 90% utilization.
  - Setup: unbounded queue, warm-up discarded, batch means over 5 seeds.
  - Pass: mean latency within 10% of 1/(μ−λ), and p99 within 15% of ln(100)/(μ−λ).
- **Determinism:** the same seed and action log always produce an identical event trace.
- **Cascade:** a retry-storm scenario fails with naive retries and passes once jittered backoff is added.
  - A second variant puts the system under sustained overload. There, backoff alone still fails, and a retry budget or circuit breaker is needed to pass.
- **Evaluator:** pass/fail decisions are checked against cases worked out by hand.
- **Golden-metric regression:** every scenario has golden metrics that run on each engine change. This catches a later milestone quietly changing what earlier lessons teach.
- **Fidelity review checklist:** every scenario must pass this before I rely on it:
  - the latency knee falls at the expected utilization (±10%)
  - components fail in the expected order
  - the system recovers after the fault is removed
  - every metric trends in the right direction
- **Lab match:** compare the shape, not the numbers. The same bottleneck should appear first, and lag should grow or shrink under the same load ratio. Before comparing, I tune the simulator's service times to the throughput a single lab node actually measures.

## 5. Alternatives considered

| Decision | Chosen | Rejected and why |
|---|---|---|
| Simulation model | **Discrete-event, tracking every request** | Closed-form queueing formulas can't show cascades. A rate or fluid mode can't produce p99, per-key state or traces. **Fallback, only if the M1 benchmark fails:** weighted requests, where one simulated request stands for k real ones. That keeps p99, hot keys and stampedes. |
| Where it runs | **Browser, in a Web Worker (stack A).** No server, one language, offline static build, and React Flow. | Stack C1 (Python, local server). It is the fallback only if **UI or tooling productivity** fails. It would not help with engine throughput, because SimPy on CPython costs more per event than V8. Throughput problems use the weighted-requests fallback instead. |
| Engine | **Build it myself** | Not using existing simulation libraries, on purpose: building the engine is the learning goal. |
| Visualizers | **Build** the hashing ring, token bucket, LSM and vector clocks. **Link** existing Raft visualizers. | Building Raft too would cost a lot of effort for little extra learning, unless I later choose to learn Raft by implementing it. |
| Explainers | **A guided walkthrough of the module's own simulation** | A custom animated video for each module would cost too much to produce. |
| AI review | **Paste the exported design and a versioned prompt into Claude** | An in-app reviewer with a local proxy adds API-key risk, a token budget and code, all for one user. |

## 6. Risks and mitigations

| Risk | Impact | Mitigation | When |
|---|---|---|---|
| The simulation teaches wrong intuitions | High | Fidelity tests and checklist, golden-metric regression, and lab shape-matching | Every milestone |
| Scope creep stalls the project | High | M1 scope freeze, a go/no-go gate after M1, and a "Done when" for each milestone | M1 onward |
| Motivation fades partway through | High | Interview track from week 1, and small milestones that each produce something usable | All |
| The engine is too slow at high load | Medium | M1 benchmark. Playback slows down instead of losing accuracy. Fallback: weighted requests. | M1 |
| Engine changes quietly change earlier lessons | Medium | Golden-metric tests per scenario, run on every engine change | M2 onward |
| Writing content takes too long | Medium | Explainers are walkthroughs of the simulation itself, real-world sections link to sources, only 4 capstones are simulated, and Anki cards are a plain CSV. Budget about 1 week of content per phase. | M2 onward |
| Labs are too heavy for my machine | Low | Resource-limited compose files, with 8 GB RAM stated up front | M3 onward |
| Stack A slows down my UI work | Low | Review at the M1 gate, with C1 as the fallback (Section 5) | M1 |
| AI review is inconsistent or too generous | Low | Calibration in M6: outside reference scores, repeated runs, a pinned model | M6 |

## 7. Build roadmap (MVP first)

**Interview track (parallel, from week 1):** do one Tier 2 capstone every 2 weeks as a timed 45-minute design, scored against the rubric. Until M2, score with the rough rubric. After that, use the written score descriptions.

Size estimates are rough. Re-estimate at each gate.

| Milestone | Scope | Done when | Size |
|---|---|---|---|
| **M1** | Engine core (virtual time, keyed messages, components with limits, links, seeded RNG), canvas, and 5 components (client, load balancer, server, cache, database). Also: cost model, evaluator with hints, playback speed control, and 10 Hz snapshots feeding a basic dashboard. One scenario, **"Scale a read-heavy app"**: ramp from 1k to 10k requests per second over 60 s of virtual time (warm-up), then hold 10k for 120 s. 90% reads, Zipf s = 1.0 over 100k keys, a fixed budget, and p99 under 200 ms on the plateau, within budget. | The M/M/1, determinism and evaluator tests pass. **Benchmark** on my laptop, the reference machine: at least 200k events per second in the engine benchmark, and 1× playback at 10k requests per second with no lagging, at 30 fps or more. On a new variant of the scenario, predicting from its parameters before running it, I correctly predict the bottleneck and can explain why. | 2–3 weeks |
| **Gate** | Is the loop teaching me? Did the benchmark pass? Has any tooling problem blocked me for more than a week? | Go to M2. Or use weighted requests if the benchmark failed, or switch to C1 if UI or tooling was the problem. | — |
| **M2** | Chaos injection, a cost chart and chaos-event markers on the dashboard, more load balancer algorithms, a CDN component, the lesson shell with the Predict step, IndexedDB storage with JSON export, the drill screen (45-minute timer plus rubric checklist), written rubric score descriptions, golden-metric tests, and the Phase 0–2 lessons | Every Phase 0–2 scenario passes the fidelity checklist and its golden tests, and I complete each lesson's loop, including the drill | ~4 weeks |
| **M3** | Async message kinds, queues and consumers, replication with primary/replica roles, sharding with a shard map and migration traffic, the hashing-ring and LSM visualizers, the Postgres, Redis and Kafka labs, and the Phase 3–5 lessons | Same standard as M2 for Phases 3–5, and each lab's shape matches its scenario | ~5 weeks |
| **M4** | Client policies (timeouts, retries, retry budgets, circuit breaker), failover, multi-region links, the vector-clock and token-bucket visualizers, the Raft link, and the Phase 6–7 lessons | Both retry-storm variants pass, and Phases 6–7 meet the same standard | ~5 weeks |
| **M5** | Phase 8 tracing lab, Phase 9 written exercises, Tier 1 capstones (with blob store, WebSocket gateway and worker components), and the k6 lab | I find the Phase 8 root cause from the traces in Jaeger, and every Tier 1 capstone passes its scenario | ~4 weeks |
| **M6** | Claude review flow (export plus `reviewer_prompt.md`) and its calibration, plus polish | **Calibration:** reference scores come from an outside source (published worked solutions or a mock-interview partner). Each of 5 or more designs is reviewed 3 times on a pinned model. The review scores the exact rubric value on at least 60% of parts, is never more than 1 point off, and the spread across runs is reported. | ~2 weeks |
