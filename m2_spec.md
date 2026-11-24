# M2 build spec: chaos, more components and the first lessons (Phases 0–2)

> **Parent plan:** `system_design_course_plan.md`, Section 7, milestone M2.
> **Builds on:** `m1_spec.md` and the M1 code at commit `c0787c5`. Everything M1 defines still applies unless this spec changes it.
> **Rules:**
> - No M2 code until (a) the M1 gate in `notes/m1_prediction.md` says "go", and (b) this spec passes an implementation-readiness review.
> - **Size:** about 4 weeks. Roughly 1.5 weeks of engine work, 1 week of lesson shell and UI, and 1.5 weeks of content.
> - **Out of scope:** §13.

## 1. Purpose, deliverables and done criteria

**Purpose.** M1 proved the simulator. M2 turns it into a course: the first 11 modules (Phases 0–2) can be taken end to end using the 7-step lesson loop from plan §2. To support those lessons the engine gains:
- failures you can inject (chaos)
- network distance
- three new teaching features: load-balancer algorithms with health checks, a CDN, and two cache write behaviors

**Deliverables:**
1. **Chaos.** Eight failure types, defined in §5.3. Scenarios can schedule them, or you can inject them during a run. Injected actions are logged so a run can be replayed exactly.
2. **Network distance.** Links get a latency based on what they connect: client→edge, client→origin, or internal.
3. **New component features:**
   - load balancer: round-robin, random and least-connections algorithms, plus optional health checks
   - server: a large tier, request coalescing, and a write-through cache policy
   - a **CDN** component
   - static-asset requests
4. **New evaluation criteria:** p50 and cache hit ratio. Chaos markers on the dashboard charts.
5. **Lesson shell:**
   - a home page listing the 11 modules, with progress
   - a lesson page made from MDX content plus embedded sandbox, Predict, Explain and Real-world blocks
   - a 45-minute drill screen with the 6-part rubric
   - storage in IndexedDB, with JSON export and import
6. **Content:** 11 modules for Phases 0–2 (§10), 7 new scenarios (§9), 3 drill prompts, the rubric score descriptions, and a `cards.csv` for each module.
7. **Golden-metric tests** for every scenario.

**M2 is done when** all four hold:
1. `npm test`, `npm run test:fidelity`, `npm run test:golden` and `npm run bench` all pass. The bench stays at **≥ 200,000 events/s** on `read-heavy`.
2. Every M2 scenario passes the fidelity checklist (§11 Phase 3): the reference design passes, the starter fails the named criterion, and the expected bottleneck is reported.
3. I complete every module's loop in the app, including the three drills with written self-scores. The home page shows all 11 as complete.
4. The M1 tests still pass unchanged, so M1 behavior is preserved (§4.4).

## 2. Toolchain and dependencies

Everything in m1_spec §2 still applies, plus:

| Item | Choice |
|---|---|
| MDX | `@mdx-js/rollup@^3.1.0`, `@types/mdx@^2.0.13` |
| Routing | Hash routing written by hand (`#/`, `#/lesson/:id`, `#/sandbox/:scenarioId`, `#/drill/:id`). No router library. |
| Storage | The browser's built-in IndexedDB API, wrapped in about 80 lines. No library. |

No other dependencies may be added.

**Vitest stays on 3.x.** The `npm audit` advisories affect only the local test runner, and moving to 5.x is a breaking upgrade (see §14).

**`vite.config.ts`:** `plugins: [{ enforce: "pre", ...mdx() }, react()]`.

**`package.json` scripts:**

| Script | Command |
|---|---|
| `test` | `vitest run tests/engine tests/app` |
| `test:fidelity` | `vitest run tests/fidelity` |
| `test:golden` | `vitest run tests/golden` |
| `golden:update` | `node scripts/golden-update.mjs` |
| `bench` | `vitest run tests/bench` |

`scripts/golden-update.mjs` sets `process.env.UPDATE_GOLDEN = "1"` and runs `npx vitest run tests/golden` with `stdio: "inherit"`. It uses a script rather than inline env syntax so that it works on Windows without `cross-env`.

## 3. File boundary

**New files:**
```
m2_spec.md (this file)
scripts/golden-update.mjs

engine/chaos.ts
engine/network.ts
engine/components/cdn.ts

scenarios/index.ts
scenarios/s0SingleServer.ts
scenarios/s1Scale.ts
scenarios/s1Lb.ts
scenarios/s1Cdn.ts
scenarios/s2WritePolicy.ts
scenarios/s2Ttl.ts
scenarios/s2Stampede.ts

app/router.ts
app/views/HomeView.tsx
app/views/SandboxView.tsx
app/views/LessonView.tsx
app/views/DrillView.tsx
app/panels/ChaosPanel.tsx
app/storage/db.ts
app/storage/exportImport.ts
app/lessons/progress.ts
app/lessons/registry.ts
app/lessons/components.tsx
app/mdx.d.ts

content/rubric.ts
content/drills.ts
content/lessons/p0-latency.mdx
content/lessons/p0-network.mdx
content/lessons/p0-single-server.mdx
content/lessons/p1-scaling.mdx
content/lessons/p1-load-balancing.mdx
content/lessons/p1-cdn.mdx
content/lessons/p1-stateless.mdx
content/lessons/p2-cache-write.mdx
content/lessons/p2-eviction-ttl.mdx
content/lessons/p2-stampede.mdx
content/lessons/p2-hot-keys.mdx
content/cards/p0-latency.csv
content/cards/p0-network.csv
content/cards/p0-single-server.csv
content/cards/p1-scaling.csv
content/cards/p1-load-balancing.csv
content/cards/p1-cdn.csv
content/cards/p1-stateless.csv
content/cards/p2-cache-write.csv
content/cards/p2-eviction-ttl.csv
content/cards/p2-stampede.csv
content/cards/p2-hot-keys.csv

tests/engine/chaos.test.ts
tests/engine/network.test.ts
tests/engine/lb.test.ts
tests/engine/server.test.ts
tests/engine/cdn.test.ts
tests/app/progress.test.ts
tests/app/router.test.ts
tests/fidelity/m2Scenarios.test.ts
tests/golden/golden.test.ts
tests/golden/*.json            (generated by golden:update; one file per scenario)
notes/m2_log.md
```

**Modified files:**
- **Engine:**
  - `engine/core/types.ts`, `engine/core/heap.ts`, `engine/core/sim.ts`
  - `engine/components/instance.ts`, `client.ts`, `loadBalancer.ts`, `server.ts`, `cache.ts`
  - `engine/catalog.ts`, `engine/build.ts`, `engine/metrics.ts`, `engine/evaluator.ts`, `engine/validate.ts`, `engine/runner.ts`, `engine/protocol.ts`
- **App:**
  - `app/App.tsx` (becomes the router shell), `app/state.ts`, `app/useSimWorker.ts`
  - `app/canvas/nodeTypes.tsx`, `app/canvas/Canvas.tsx`
  - `app/panels/Palette.tsx`, `Inspector.tsx`, `Controls.tsx`, `Dashboard.tsx`, `EvaluationPanel.tsx`
  - `app/styles.css`
- **Tests:**
  - `tests/fixtures.ts`
  - `tests/engine/validate.test.ts`, `evaluator.test.ts`, `determinism.test.ts`, `runner.test.ts`, `components.test.ts`
- **Root files:** `package.json`, `vite.config.ts`, `tsconfig.json` (`include` adds `"content"`), `README.md`, `system_design_course_plan.md` (M2 row; see §15).

**Not modified:** `scenarios/readHeavy.ts` and `scenarios/readHeavyVariant.ts`, plus every M1 test assertion, except for the type-only fixture updates in §4.4.

## 4. Domain model changes (`engine/core/types.ts`)

### 4.1 Types

```ts
export type ComponentType = "client" | "cdn" | "loadBalancer" | "server" | "cache" | "database";
export type Op = "read" | "write" | "static";
export type ErrorKind = "rejected" | "timeout" | "downstream" | "unavailable";
// Records.outcome codes: 0 ok, 1 rejected, 2 timeout, 3 downstream, 4 unavailable

export type LbAlgorithm = "roundRobin" | "random" | "leastConnections";

export type NodeConfig =
  | { type: "client" }
  | { type: "cdn" }
  | { type: "loadBalancer"; algorithm: LbAlgorithm; healthCheck: boolean }
  | { type: "server"; tier: "small" | "medium" | "large"; instances: number;
      missCoalescing: boolean; writePolicy: "invalidate" | "writeThrough" }
  | { type: "cache"; tier: "small" | "medium" | "large"; ttlSeconds: 10 | 60 | 300 }
  | { type: "database"; tier: "medium" | "large" | "xlarge" };

export interface Network {
  clientToEdgeMs: number;     // one-way, client → cdn
  clientToOriginMs: number;   // one-way, client → loadBalancer|server
  internalMs: number;         // one-way, every other edge
  connectTimeoutMs: number;   // how long a call over a dead link hangs before failing
}

export type ChaosSpec =
  | { type: "crash"; target: string }                    // instance id, e.g. "server-1#2"
  | { type: "partition"; target: string }                // edge id
  | { type: "latency"; target: string; extraMs: number } // edge id
  | { type: "loss"; target: string; probability: number }// edge id, 0..1
  | { type: "cacheFlush"; target: string }               // cache node id
  | { type: "surge"; multiplier: number };               // 1 < m <= 5
export interface ChaosEvent { atSec: number; durationSec?: number; spec: ChaosSpec }
export interface AppliedChaos { vt: number; phase: "start" | "end"; spec: ChaosSpec; source: "scenario" | "user" }
export interface UserAction { vtMs: number; spec: ChaosSpec; durationSec?: number }
```

`TraceType` gains these values: `"chaos"`, `"healthCheck"`, `"surgeArrive"` and `"linkTimeout"`.

### 4.2 `Scenario` additions (all optional)

| Field | Default | Meaning |
|---|---|---|
| `staticRatio` | 0 | Share of requests that are `static`. The rest split by `readRatio`. |
| `assetKeyspace` / `assetZipfS` | 10,000 / 0.9 | Key distribution for static assets |
| `network` | all four latencies 0.5, `connectTimeoutMs` 1000 | See `Network` |
| `chaos` | `[]` | Scheduled chaos events |
| `criteria.p50MaxMs` | none | Passes if p50 < this value |
| `criteria.cacheHitRatioMin` | none | Passes if the window hit ratio ≥ this value |

### 4.3 Defaults for M1 designs

When a design saved by M1 is loaded, missing config fields are filled in:
- load balancer: `algorithm: "roundRobin"`, `healthCheck: false`
- server: `missCoalescing: false`, `writePolicy: "invalidate"`

`engine/build.ts` exports `normalizeDesign(design): Design` to do this. Both `build` and the UI call it when loading a design.

### 4.4 Preserving M1 behavior (hard rule)

With the defaults above, the M1 scenarios produce **byte-identical traces** to M1. To guarantee that:
- **No extra random draws:** the client draws the `static` decision only when `staticRatio > 0`.
- **No extra events:**
  - health checks are scheduled only when `healthCheck: true`;
  - surges, link faults and chaos events are scheduled only when they are present.
- **Unchanged ordering:** action events use their own seq counter (§5.2), so normal event seq numbers are unchanged.
- **How this is enforced:**
  - All M1 tests stay as they are and must pass.
  - The determinism test gets one new case: the seed-7 trace of `read-heavy`, cut to 10 s, must still hash to the value recorded before any M2 code changes. Record that hash in `notes/m2_log.md` in Phase 1, step 0.

## 5. Engine changes

### 5.1 Network latencies (`engine/network.ts`)

`edgeLatency(sourceType, targetType, network): number`:

| Edge | One-way latency |
|---|---|
| client → cdn | `clientToEdgeMs` |
| client → loadBalancer or server | `clientToOriginMs` |
| cdn → loadBalancer or server | `max(0.5, clientToOriginMs − clientToEdgeMs)` |
| any other edge | `internalMs` |

`BuildOptions.linkLatencyMs`, if set, still overrides every edge, so the M1 tests keep working.

### 5.2 Ordering user actions (`engine/core/heap.ts`, `sim.ts`)

**Heap entries.** Each entry gains `tier: 0 | 1`. The heap orders entries by `(t, tier, seq)`. Normal events are tier 0. Actions (user chaos and its timed reverts) are tier 1.

**Seq counters.** `Simulation` keeps two counters: `seq` for tier 0 and `actionSeq` for tier 1. `schedule(delay, fn, meta, tier = 0)` uses the counter for that tier.

**Trace output.** In trace lines, tier-1 events print their seq as `a${actionSeq}`.

**Why this works:** an action at time t always runs after every normal event at t, whether it was injected live or replayed from the log. So a replay is identical to the live run.

### 5.3 Chaos (`engine/chaos.ts`)

`applyChaos(ctx, spec, phase)` changes engine state. `ctx` gives access to the instances, links, stores and the client. The table lists each type's start and end effects:

| Type | Start | End (after `durationSec`) |
|---|---|---|
| `crash` | `instance.crash()` (§5.4). A crashed cache instance also clears its store. | `instance.recover()` |
| `partition` | `links.setFault(edge, { partitioned: true })` | Clears `partitioned` |
| `latency` | `links.setFault(edge, { extraMs })` | `extraMs = 0` |
| `loss` | `links.setFault(edge, { lossProbability })` | `lossProbability = 0` |
| `cacheFlush` | `store.clear()` | Nothing to revert |
| `surge` | `client.startSurge(multiplier)` | `client.stopSurge(handle)` |

**Scheduled chaos.** `build` schedules each `scenario.chaos` event at `atSec × 1000` as a tier-0 event. It schedules the matching end event at `(atSec + durationSec) × 1000`, if there is a duration. Each start and end is pushed to a chaos log as an `AppliedChaos` with `source: "scenario"`.

**User chaos.** `Built.inject(spec, durationSec?)` does three things:
1. Records the `UserAction` `{ vtMs: sim.now, spec, durationSec }` in the action log.
2. Schedules the start at `sim.now` as a tier-1 event.
3. If there is a duration, schedules the end at `sim.now + durationSec × 1000`, also tier 1.

Both start and end are logged with `source: "user"`.

**Replay.** `BuildOptions.actions?: UserAction[]` schedules the same tier-1 events at build time.

**`Built` additions:**
- `inject(spec, durationSec?)`
- `actionLog(): UserAction[]`
- `drainChaos(): AppliedChaos[]`
- `allChaos(): AppliedChaos[]`

**Invalid targets.** A target id that doesn't exist throws `Error("Unknown chaos target: …")`. The runner turns this into an `error` message (§11 Phase 4).

### 5.4 Instance crash and recover (`instance.ts`)

New fields: `up = true`, `epoch = 0`, and the per-second counter `unavailable`.

**`crash()`:**
1. Flush the areas.
2. Set `up = false` and increment `epoch`.
3. Reply `{ok:false, error:"unavailable"}` to every request:
   - first everything in the queue, oldest first;
   - then everything held, in start order. To support this, track held requests in `held: Map<msgId, reply>`.
4. Set `busy = inService = 0` and clear the queue.

**Callbacks from before a crash.** Service completions and downstream replies capture `epoch` when they start. If the epoch has changed by the time they fire, they do nothing.

**`accept()` while down:** increment `unavailable` and reply `unavailable` immediately. This is "connection refused".

**`recover()`:** set `up = true`.

**Stats.** `NodeStats` gains `unavailable`. The evaluator's rejecting-node count becomes `rejected + dropped + unavailable`.

### 5.5 Link faults (`build.ts`, the Links object)

Each edge has fault state `{ partitioned, extraMs, lossProbability }`, initially `{false, 0, 0}`. `call(edgeId, target, msg, cb)` changes as follows:

1. **Latency.** One-way latency = `edgeLatency(...) + extraMs`, read when the message is sent.
2. **Dead link.** If the edge is partitioned, or `lossProbability > 0 && rng.next() < lossProbability`:
   - the request is not delivered;
   - after `min(connectTimeoutMs, max(0, msg.deadline − now))`, a tier-0 `linkTimeout` event calls `cb({ok:false, error:"timeout"})`;
   - a sampled message records a forward hop with `ok:false`.
3. **Draw order.** The loss draw happens only when `lossProbability > 0` (§4.4).

Faults apply to the request direction only. Replies always come back.

### 5.6 Load balancer (`loadBalancer.ts`)

```ts
createLbBehavior(links: Links, edgeId: string, targets: Instance[],
  cfg: { algorithm: LbAlgorithm; healthCheck: boolean }, sim: Simulation): Behavior
```

- **Eligible targets:** if `healthCheck` is true, only instances marked healthy. Otherwise, all of them. If none are eligible, reply `{ok:false, error:"unavailable"}`.
- **`roundRobin`:** a cursor over the eligible list.
- **`random`:** `eligible[floor(rng.next() × n)]`.
- **`leastConnections`:**
  - The LB counts open calls per target: +1 when it calls a target, −1 when that target replies.
  - It picks the target with the lowest count; ties go to the lowest index.
  - Without health checks, a crashed target replies instantly, so its count stays near 0 and it attracts most of the traffic. This "black hole" is intended: lesson `p1-load-balancing` teaches it.
- **Health checks:**
  - **Schedule:** every 1000 virtual ms, starting at 1000, a tier-0 `healthCheck` event reads `up` on every target.
  - **Marking down:** a target is marked unhealthy after **2 consecutive failed** checks.
  - **Marking up again:** it is marked healthy after **2 consecutive passed** checks.
  - **Result:** a crash is detected within 1–2 s.
  - Checks are free: no service time and no links.

### 5.7 Server (`server.ts`)

`createServerBehavior(links, deps, cfg: { missCoalescing: boolean; writePolicy: "invalidate" | "writeThrough" })`:

- **`static` op:** after its own service time, the server replies `{ok:true}`. It calls nothing downstream.
- **`writeThrough`:** a successful db write is followed by a fire-and-forget `store.set(key)` instead of `invalidate`.
- **`missCoalescing`, per server instance:**
  - The instance keeps `inflight: Map<key, ((res: Response) => void)[]>`.
  - On a cache miss or cache error:
    - If `inflight` already has the key, add `done` to its list and wait. The worker stays held.
    - Otherwise, create the list with `done`, then call the db.
  - When the db replies, run the cache set (if ok), then call every waiter with the same response and delete the key.
  - A crash clears `inflight`. The waiters were already answered by `crash()`.

### 5.8 CDN (`engine/components/cdn.ts`)

**Catalog entry:**
- concurrency 100,000, queue 0
- fixed service of 0.1 ms
- capacity 100,000 assets
- $0.20/h
- one instance, `cdn#0`, with an `LruTtlStore(100_000, 3_600_000)`

**Behavior:**
- **Non-static request:** forward it over the CDN's single outgoing edge (the origin) and return the reply unchanged.
- **Static request:**
  - If `store.get(key)` hits, count a hit and reply ok.
  - Otherwise, count a miss and forward to the origin. If the origin replies ok, `store.set(key)` immediately (the CDN is the cache, so no extra link), then reply.
- **Hit/miss counters:** the CDN reports `hits` and `misses` in `NodeStats`, like a cache. The evaluator's `cacheHitRatioMin` counts **cache nodes only**, not the CDN.

### 5.9 Client (`client.ts`)

- **Choosing the op:**
  - If `staticRatio > 0`: draw `u`. If `u < staticRatio`, the op is `static`, with the key drawn from the asset Zipf. Otherwise draw again for read or write using `readRatio`.
  - If `staticRatio = 0`: same as M1.
- **`startSurge(m)`:**
  - Starts an extra thinning generator with `λ_s(t) = (m − 1) × λ(t)` and `λmax_s = (m − 1) × peakRps`.
  - It uses the same op and key rules and the same `send`.
  - Its candidate events have trace type `surgeArrive`.
  - Returns a handle. `stopSurge(handle)` makes that generator stop scheduling.

### 5.10 Catalog (`catalog.ts`)

The table lists only additions and changes. The M1 entries are unchanged.

| Component | Tier | Concurrency | Queue | Service mean | Price ($/h) |
|---|---|---|---|---|---|
| Server | large | 64 | 256 | 2.0 | 0.50 (a premium over 4 × small = $0.40, so scaling vertically costs more per worker) |
| CDN | — | 100,000 | 0 | 0.1 (fixed) | 0.20 |

### 5.11 Metrics and evaluator

- **Buckets.** `Bucket.errors` gains `unavailable`. `NodeStats` gains `unavailable`. Snapshots carry `chaos: AppliedChaos[]`, filled by `drainChaos()`.
- **New criteria.** When the scenario sets them, the evaluator adds:
  - **`p50`:** nearest-rank p50 over the ok latencies in the window. Passes if it is below the limit.
  - **`cacheHitRatio`:** `Σhits / Σ(hits+misses)` over the cache nodes' window buckets. Passes if it is at least the limit. The value is `null` and the criterion fails when there are no cache nodes or no lookups.
- **Order.** Criteria appear as p99, p50, errorRate, cacheHitRatio, cost. Only the configured ones are included.
- **Downstream order** for ties: database, cache, server, cdn, loadBalancer.
- **Hint rules** can name the new criteria.

## 6. Validation changes (`validate.ts`)

**Rule 1** adds: at most one `cdn`.

**`canConnect`** allows these additional pairs:
- `client→cdn`
- `cdn→loadBalancer`
- `cdn→server`

**New rules**, placed after rule 5:

| # | Rule | Message |
|---|---|---|
| 5b | If there is a CDN, it has exactly one incoming edge (from the client) and exactly one outgoing edge (to the LB or the server) | `"The CDN must sit between the client and the load balancer or server."` |
| 4b | (extended) A direct `cdn→server` edge also requires `instances = 1` | `"Add a load balancer to spread traffic across instances."` |

**Rule 5** (the load balancer's position) now accepts either `client→lb` or `cdn→lb` as the incoming edge.

## 7. Worker protocol and runner

```ts
type UiToWorker = /* M1 messages */ | { type: "inject"; runId: number; spec: ChaosSpec; durationSec?: number };
// snapshot gains: chaos: AppliedChaos[]
// done gains: actions: UserAction[]   (the action log, for the notes and for replay)
```

**Runner rules for `inject`:**
- **Accepted** in `playing`, `paused` and `fast`.
- **Effect:** calls `built.inject(spec, durationSec)`. While paused, the action is recorded at the paused `vt` and runs on resume.
- **Ignored** in any other state.
- **Unknown target:** posts `error`. The runner then goes to `idle`, as for any other engine error.

## 8. UI changes

### 8.1 App shell and routes (`app/router.ts`, `app/App.tsx`)

**`router.ts`** exports:
- `parseHash(hash): Route`, where `Route` is one of:
  - `{ name: "home" }`
  - `{ name: "lesson"; id }`
  - `{ name: "sandbox"; scenarioId }`
  - `{ name: "drill"; id }`
- `useRoute()`, a hook that listens to `hashchange`

Unknown hashes go to `home`.

**`App.tsx`** renders the view for the route. The M1 sandbox UI moves into `SandboxView` without behavior changes. It takes these props:
- `scenario`
- `initialDesign?`
- `onEvaluation?(e)`
- `mode: "free" | "lesson"`

`state.ts` and `useSimWorker` stay per-`SandboxView`.

### 8.2 Sandbox additions

- **Palette:** adds a **+ CDN** button, at position (−150, 200) on the canvas. The client stays at (0, 200). When a CDN is added, the client moves to (−300, 200).
- **Inspector:**
  - **Load balancer:** an algorithm `<select>` and a health-check checkbox.
  - **Server:** a **large** tier option, a missCoalescing checkbox, and a writePolicy `<select>`.
  - **CDN:** "No settings".
- **ChaosPanel** (shown during `running` and `paused`):
  - **Type and target.** A type `<select>`. A target `<select>` filled with targets valid for that type:
    - instances, for crash
    - edges, for partition, latency and loss
    - cache nodes, for cacheFlush
    - none, for surge
  - **Parameters by type:** `extraMs` for latency (50, 200 or 1000), probability for loss (0.1, 0.3 or 0.5), multiplier for surge (1.5, 2 or 3).
  - **Duration:** 10, 30 or 60 s, or until the end of the run.
  - An **Inject** button.
  - Below these, a list of the chaos applied so far: time, type, target and source.
- **Dashboard:**
  - Every chart draws a dashed vertical `ReferenceLine` at each chaos start, labelled with the type. A chaos end gets a dotted line.
  - The error-rate chart includes `unavailable`.
  - A fifth chart, "Cache hit ratio (%)", appears when the design has a cache or a CDN.
- **EvaluationPanel:** shows the p50 and hit-ratio rows when the scenario defines them, plus a "Your chaos actions" list taken from `done.actions`.

### 8.3 Lesson shell

**`app/lessons/registry.ts`** holds the module list:
```ts
interface ModuleDef { id: string; phase: 0 | 1 | 2; title: string; loop: "full" | "light";
  scenarioId?: string; drillId?: string; load: () => Promise<{ default: MDXContent }> }
```
`load` uses `import("../../content/lessons/<id>.mdx")`.

**`app/lessons/components.tsx`** provides the MDX components. A lesson file imports them explicitly.

| Component | Props | Behavior |
|---|---|---|
| `<Sandbox>` | `scenarioId`, `design?: "starter" \| "reference"`, `step: "concept" \| "build" \| "break"` | `concept`: read-only, plays the reference design at 1× with a caption bar. `build`: editable starter design. `break`: editable, with the ChaosPanel open. On a passed evaluation in `build` or `break`, saves `passed` for that step to progress. |
| `<Predict>` | `id`, `question`, `choices: string[]`, `answer: number`, `explanation` | Radio buttons, Submit, then shows correct or incorrect plus the explanation. The first answer is final and is stored. |
| `<Explain>` | `id`, `prompt`, `modelAnswer` | A textarea (at least 40 characters before "Reveal model answer" is enabled). Saves the text. Reveal shows the model answer and marks the step done. |
| `<RealWorld>` | `title`, `url`, `source` | Summary text (children) plus an attribution link. Marked done when its "Read" checkbox is ticked. |
| `<DrillLink>` | `drillId` | A button to `#/drill/<id>`, showing the drill's best self-score. |

**`app/lessons/progress.ts`** contains pure functions (tested in `tests/app/progress.test.ts`):
- `moduleSteps(def): StepId[]`
  - **full loop:** `concept`, `predict`, `build`, `break`, `explain`, `realWorld`, `drill`
  - **light loop:** `concept`, `predict`, `realWorld`
- `isModuleComplete(def, progress): boolean` — true when every step is done.
  - `concept` is done once the lesson page has been opened.
  - `drill` is done when `drills[drillId]` has at least one scored attempt.
- `phaseSummary(defs, progress)` — for each phase, the count of completed modules out of the total.

**`app/views/HomeView.tsx`:**
- Lists the three phases with their modules and a completion tick for each.
- Has a "Free sandbox" link to `#/sandbox/read-heavy`.
- Shows the export reminder banner (§8.4).

**`app/views/LessonView.tsx`:**
- Loads the MDX file and renders it.
- Shows a sticky step checklist from `moduleSteps`.
- Has Previous and Next module links.

**`app/views/DrillView.tsx`** shows the drill prompt from `content/drills.ts`, then:
- **Timer:** a 45:00 countdown with start, pause and reset. When it reaches zero it shows "Time — finish your current section", and the drill continues.
- **Notes:** a textarea for my design notes.
- **Rubric:** for each of the 6 parts, a 0–4 radio group. Each option shows its descriptor from `content/rubric.ts`.
- **Save attempt:** stores `{ drillId, startedAt, durationSec, notes, scores: number[6] }`.
- **History:** a list of past attempts with each one's total out of 24.

### 8.4 Storage (`app/storage/db.ts`, `exportImport.ts`)

**Database.** IndexedDB database `sdl`, version 1, with three object stores:

| Store | Key | Contents |
|---|---|---|
| `designs` | scenarioId | `{ scenarioId, design, savedAt }` |
| `progress` | moduleId | `{ moduleId, steps: Record<StepId, { done: boolean; at: number; data?: unknown }> }` |
| `drills` | auto-increment | drill attempts |

`db.ts` exports `openDb()`, `get(store, key)`, `put(store, value)`, `getAll(store)` and `clearAll()`. On first open it calls `navigator.storage.persist()`.

**Saving designs.** The sandbox saves the design 500 ms after the last edit (debounced). When `SandboxView` mounts, it loads the saved design for that scenario if one exists. Otherwise it uses the scenario's starter design.

**Export.** Downloads `sdl-export-YYYY-MM-DD.json` containing `{ version: 1, exportedAt, designs, progress, drills }`. It also sets `localStorage["sdl:lastExport"]`, wrapped in try/catch.

**Import.**
1. Validate the file: `version === 1` and all three arrays present. Otherwise show "Not a valid export file".
2. Show a `confirm()` that says the import replaces all current data.
3. Run `clearAll()`, then write the imported data.

**Reminder.** HomeView shows "Last export N days ago — export now" when the last export was more than 7 days ago, or never happened and some progress exists.

## 9. Scenarios (`scenarios/*.ts`, registered in `scenarios/index.ts`)

**Shared rules:**
- **Canvas positions** are the same as in M1 §10, with the CDN at (−150, 200) and the client at (−300, 200) when a CDN is present.
- **Edge ids** follow `e-${source}-${target}`.
- **Defaults:** window 60 → `durationSec`, `seed` 1, `client.timeoutMs` 1000.
- **Network:** the default from §4.2, unless the scenario row says otherwise.
- **Hints:** each scenario uses the M1 hint set (§10.1 of m1_spec) plus the extra hints listed for it.
- **Every scenario must:**
  - have a **reference** design that passes all criteria for seeds 1–3;
  - have a **starter** design that fails the **expected-failure** criterion;
  - report the **expected bottleneck** for the reference design (or for the design named in that column).

**The scenarios:**

| id (module) | Traffic | Mix | Allowed | Budget | Criteria | Chaos |
|---|---|---|---|---|---|---|
| `s0-single-server` (p0-single-server) | 200 → 2000 rps over 60 s, then 2000 until 120 s | 90% read, Zipf 1.0 / 100k | client, server, database | $1.50 | p99 < 100 ms, errors < 0.1% | — |
| `s1-scale` (p1-scaling) | 1000 → 6000 over 60 s, then 6000 until 150 s | 90% read | client, LB, server, database | $3.50 | p99 < 150 ms, errors < 0.1% | — |
| `s1-lb` (p1-load-balancing) | 1000 → 4000 over 60 s, then 4000 until 180 s | 90% read | client, LB, server, database | $2.00 | p99 < 150 ms, errors < 0.5% | crash `server-1#2` at 90 s for 30 s |
| `s1-cdn` (p1-cdn) | 500 → 3000 over 60 s, then 3000 until 150 s | 70% static (assets 10k, Zipf 0.9), then 90% read of the rest | all except cache | $1.50 | p50 < 30 ms, p99 < 200 ms, errors < 0.1% | network `clientToEdgeMs 5`, `clientToOriginMs 45` |
| `s2-write-policy` (p2-cache-write) | 1000 → 6000 over 60 s, then 6000 until 150 s | 60% read, Zipf 1.0 / 100k | client, LB, server, cache, database | $2.50 | p99 < 150 ms, errors < 0.1%, cache hit ratio ≥ 0.75 | — |
| `s2-ttl` (p2-eviction-ttl) | 1000 → 8000 over 60 s, then 8000 until 150 s | 95% read, Zipf 0.9 / 200k | client, LB, server, cache, database | $1.75 | p99 < 150 ms, errors < 0.1%, cache hit ratio ≥ 0.80 | — |
| `s2-stampede` (p2-stampede) | 1000 → 10000 over 60 s, then 10000 until 180 s | 90% read, Zipf 1.0 / 100k | client, LB, server, cache, database | $2.50 | p99 < 200 ms, errors < 0.5% | `cacheFlush cache` at 100 s |

**Designs, expected failures and expected bottlenecks:**

| id | Starter design | Expected failure (starter) | Reference design | Expected bottleneck |
|---|---|---|---|---|
| `s0-single-server` | server small, db medium | errorRate | server large, db medium ($1.00) | reference: `db`, own work |
| `s1-scale` | LB, server large × 1, db xlarge | errorRate (one large server tops out at about 4,500 rps) | LB, server small × 8, db xlarge ($3.35) | reference: `db`, own work |
| `s1-lb` | LB round-robin with no health check, server small × 7, db large | errorRate | the same with `healthCheck: true` ($1.75) | — (bottleneck not asserted) |
| `s1-cdn` | LB, server small × 3, db medium | p50 | CDN, LB, server small × 3, db medium ($1.05) | — |
| `s2-write-policy` | LB, server small × 10, cache medium with invalidate, db large | cacheHitRatio | the same with `writeThrough` ($2.20) | — |
| `s2-ttl` | LB, server small × 5, cache small with TTL 10 s, db medium | cacheHitRatio | LB, server small × 5, cache **large** with TTL 300 s, db medium ($1.45) | — |
| `s2-stampede` | LB, server small × 8, cache medium, db large, no coalescing | errorRate (the db overloads after the flush) | the same with `missCoalescing: true` ($2.00) | starter: `db` (metric not asserted; the overload is brief compared with the window) |

**Capacity notes** (rough estimates; the tuning rule settles exact numbers):

| Scenario | Estimate |
|---|---|
| `s0` reference | db medium at about 69% own work; server large at about 44% of workers in use |
| `s1-scale` reference | db xlarge at about 52%; servers at about 66% held |
| `s1-lb` without health checks | about 1/7 of traffic fails for 30 s of the 120 s window, so about 3.6% errors |
| `s1-lb` with health checks | about 2 s of failures, so about 0.24% |
| `s1-cdn` | p50 is about 93 ms without the CDN and about 10 ms with it |
| `s2-write-policy` | with invalidate, hot keys lose the cache on roughly 2 of 3 reads, so the hit ratio is about 0.3 |
| `s2-ttl` | an ideal (LFU) hit ratio of about 0.64 for small, 0.82 for medium and 0.91 for large. LRU and writes lower these, so the reference uses large. |

**Extra hints:**
- `s1-lb`, `{errorRate}`: "Requests keep going to a dead server. How would the load balancer know it is down?"
- `s1-cdn`, `{p50}`: "Most requests are static files crossing the whole network. Could something closer to users serve them?"
- `s2-write-policy`, `{cacheHitRatio}`: "Every write throws away a hot key. What if writes updated the cache instead?"
- `s2-ttl`, `{cacheHitRatio}`: "Entries expire or get evicted before they are reused. Look at capacity and TTL together."
- `s2-stampede`, `{errorRate}`: "After the flush, thousands of requests miss on the same hot keys at once. Do they all need their own database read?"

**Tuning rule.** This replaces m1_spec's stop-the-line rule for M2 scenarios. If a scenario does not meet its three requirements, the allowed changes are, in order:
1. Change the **reference** design, staying within budget.
2. Change the **plateau rps** of that scenario, by at most ±30%.
3. Change the **budget**, by at most ±20%.

Never change engine semantics or catalog values to make a scenario pass. Record every change in `notes/m2_log.md` and in the table above. If all three steps fail, stop and amend this spec.

## 10. Content (Phases 0–2)

Every MDX lesson has these sections in order. A light module skips Build, Break, Explain and Drill.
1. **Concept:** a short narrative with a `<Sandbox step="concept">` walkthrough where there is a scenario.
2. **Predict**
3. **Build**
4. **Break**
5. **Explain**
6. **Real world**
7. **Drill**

**Length:** 600–1,200 words of prose per module.

**Real-world sources:** each module cites at least one public engineering blog post or paper by link. Summaries are written in my own words, under 150 words, with no quotes longer than one sentence.

| Module | Loop | Scenario | Predict (question → answer) | Explain prompt | Drill |
|---|---|---|---|---|---|
| `p0-latency`: Latency numbers and estimation | light | — | "Order these: same-datacenter round trip, SSD random read, cross-continent round trip" → SSD read (~0.1 ms) < datacenter RTT (~0.5 ms) < cross-continent RTT (~150 ms) | — | — |
| `p0-network`: DNS, TCP, HTTP and TLS | light | — | "A brand-new HTTPS request (TCP + TLS 1.3) costs how many round trips before the first byte?" → 2 (TCP handshake + TLS 1.3 handshake), plus DNS if uncached | — | — |
| `p0-single-server`: Single-server limits | full | `s0-single-server` | "16 workers, each held about 14 ms per request: roughly where does throughput top out?" → about 1,100 rps | "Why does latency explode near 100% utilization rather than growing linearly?" | `d0-estimation` |
| `p1-scaling`: Vertical vs. horizontal | full | `s1-scale` | "The largest server has 64 workers at about 14 ms each. Can it alone serve 6,000 rps?" → No, about 4,500 rps max | "When is vertical scaling the right first move, and when does it stop working?" | `d1-url-shortener` |
| `p1-load-balancing`: L4/L7, algorithms, health checks | full | `s1-lb` | "Round-robin, no health checks, 1 of 7 servers crashes. What share of requests fail while it is down?" → about 1/7 | "Why can least-connections make a crashed server *worse* without health checks?" | `d1-url-shortener` |
| `p1-cdn`: CDNs | full | `s1-cdn` | "70% of requests are static, origin RTT 90 ms, edge RTT 10 ms, 90% CDN hit ratio. Rough p50?" → about 10 ms | "What content should never be cached at a CDN, and why?" | `d1-url-shortener` |
| `p1-stateless`: Stateless services | light | — | "Sessions live in server memory and the LB uses round-robin. What happens on the next request?" → the user often lands on a server without their session | — | — |
| `p2-cache-write`: Cache-aside and write policies | full | `s2-write-policy` | "With 40% writes and invalidate-on-write, switching to write-through mainly improves…" → the cache hit ratio | "What consistency risk does write-through introduce compared with invalidate?" | `d2-catalog-cache` |
| `p2-eviction-ttl`: Eviction and TTL | full | `s2-ttl` | "Under Zipf traffic, doubling the cache size makes the hit ratio…" → rise, but less than double (diminishing returns) | "How do you choose a TTL when data changes at unpredictable times?" | `d2-catalog-cache` |
| `p2-stampede`: Invalidation and stampedes | full | `s2-stampede` | "Right after the cache is flushed at 10k rps, which component fails first?" → the database | "Compare request coalescing, stale-while-revalidate, and cache warming as stampede defenses." | `d2-catalog-cache` |
| `p2-hot-keys`: Hot keys and skew | light | — | "On one cache node, heavy key skew makes the hit ratio…" → go up. The danger shows up when data is sharded (M3) | — | — |

**`content/drills.ts`:**
- `d0-estimation`: "Estimate peak QPS, daily storage growth, and egress bandwidth for a photo-sharing app with 10M daily active users who each view 50 and upload 2 photos a day."
- `d1-url-shortener`: "Design the serving tier for a URL shortener that handles 10k redirects/s and 100 new links/s, with 99.9% availability."
- `d2-catalog-cache`: "Add caching to a product-catalog API serving 50k reads/s while prices change every minute. Prices must never be more than 60 s stale."

**`content/rubric.ts`:**
- **Structure:** the 6 parts from plan §3. Each part has 5 descriptors, for scores 0 to 4, and each descriptor is one sentence describing **observable** behavior. Example for Estimation, score 4: "States assumptions, computes QPS, storage and bandwidth with units, and sanity-checks the result against a known system."
- **Authoring:** I write all 30 descriptors in Phase 6, before any drill is self-scored.

**`content/cards/<module>.csv`:**
- Two columns, `front,back`, in UTF-8.
- 8–15 cards per module.
- Anki imports the files directly; the app does not use them.

## 11. Build phases

Each phase ends with `npm run build` and `npm test` passing. From Phase 3 on, `test:fidelity`, `test:golden` and `bench` must pass too.

### Phase 1: Engine core changes

**Steps:**
0. Record the M1 trace hash in `notes/m2_log.md`. Compute it as the SHA-256 of the seed-7 `read-heavy` trace, cut to 10 s, using `node:crypto` in a one-off test run.
1. Make the type changes (§4), add `normalizeDesign`, and implement network latencies (§5.1).
2. Add action ordering to the heap and simulation (§5.2).
3. Add instance crash and recover (§5.4) and link faults (§5.5).
4. Add chaos and the action log (§5.3), plus client static ops and surges (§5.9).

**Tests:**

`tests/engine/network.test.ts`:
- One test per row of the edge table.
- `linkLatencyMs` overrides every edge.

`tests/engine/chaos.test.ts`, all using scripted arrivals:
- **crash:**
  - Queued and held requests get `unavailable` immediately.
  - New requests get `unavailable` until recover, then succeed.
  - Callbacks from the old epoch are ignored. Checked by verifying the record count equals the arrival count.
- **partition:**
  - With `connectTimeoutMs 1000` and timeout 1000, a request over the partitioned edge resolves as `timeout` at exactly `createdAt + 1000 + link back`.
  - After the heal, requests succeed.
- **latency:** with `extraMs 200`, latency rises by 200.
- **loss:** with `probability 1`, every request times out. With 0.5 and 10,000 requests, the timeout share is 0.5 ± 0.03.
- **cacheFlush:** a hit becomes a miss.
- **surge:** with ×2 for 10 s, offered rps over that window is 2 ± 0.15 times the baseline.

`tests/engine/determinism.test.ts`, new cases:
- **M1 hash unchanged:** the M1 trace hash matches the value recorded in step 0.
- **Replay matches a live run:**
  - **Live run:** run `read-heavy`, cut to 20 s, with seed 3. Call `inject({type:"crash", target:"server-1#1"}, 5)` once `runUntil(7_300.25)` returns.
  - **Replay:** a fresh build with `actions: built.actionLog()`.
  - The two traces must be byte-identical.

### Phase 2: Components, validation and evaluator

**Steps:** implement §5.6–§5.8, §5.10, §5.11 and §6.

**Tests:**

`tests/engine/lb.test.ts`:
- **roundRobin:** exact rotation.
- **random:** over 30,000 calls to 3 instances, each gets 1/3 ± 0.02.
- **leastConnections:** the target with the fewest open calls is picked. Ties go to the lowest index.
- **Black hole:** least-connections without health checks, with `server-1#0` crashed, sends more than 60% of calls to `#0`.
- **Health check timing:** with health checks on and a crash at t = 5000, the first health check that excludes the instance happens at t = 7000. That is checks at 6000 and 7000, two failures. After that, `#0` gets 0 calls.
- **Recovery timing:** after recover at t = 10,000, the instance is eligible again from t = 12,000.
- **No eligible targets:** if every instance is down, the reply is `unavailable`.

`tests/engine/server.test.ts`:
- **static:** the db gets no calls.
- **writeThrough:** a write followed by a read is a hit.
- **missCoalescing:** 20 simultaneous reads of the same cold key cause **1** db read, and all 20 succeed.
- **Without coalescing:** the same 20 reads cause 20 db reads.
- **Crash during a coalesced read:** every waiter gets `unavailable`.

`tests/engine/cdn.test.ts`:
- **Static:** a miss goes to the origin; the second request for the same asset is a hit and the origin gets no call.
- **Non-static:** always forwarded.
- **Hit ratio:** the CDN's hits are not counted in `cacheHitRatio`.

**Updates to existing test files:**
- `validate.test.ts`: one case per new or changed rule in §6.
- `evaluator.test.ts`:
  - p50 and cacheHitRatio pass and fail cases;
  - a design with no cache gives `cacheHitRatio` = `null` and fails;
  - the criteria order is as in §5.11.
- `components.test.ts`: the M1 cases still pass after `normalizeDesign`.

### Phase 3: Scenarios, fidelity and golden tests

**Steps:**
1. Write the 7 scenario files and `scenarios/index.ts`. The index exports `SCENARIOS: Scenario[]` and `getScenario(id)`, and includes `read-heavy` and its variant.
2. Tune the scenarios with the tuning rule (§9).

**`tests/fidelity/m2Scenarios.test.ts`:**
- **Coverage:** for each M2 scenario, one `it` per seed for the reference design (seeds 1–3), one `it` for the starter design, and one for any bottleneck assertion.
- **Timeouts:** each `it` has `timeout: 300_000` and uses `runToEndYielding`.
- **Starter assertion:** the starter must fail its **expected-failure** criterion. It may fail others as well.

**`tests/golden/golden.test.ts`:**
- **Run:** for every scenario in `SCENARIOS`, run the reference design with seed 1. Collect `{ p50, p99, errorRate, cacheHitRatio, throughputOk, bottleneckNodeId, bottleneckMetric, eventsProcessed }`, with every number rounded with `toFixed(6)`.
- **Normal mode:** compare with `tests/golden/<id>.json` using `toEqual`.
- **Update mode** (`UPDATE_GOLDEN=1`): write the file instead and pass.
- **Committing goldens:** every golden update must be committed together with a `notes/m2_log.md` line that says why it changed.

**Fidelity checklist mapping** (parent plan §4):

| Checklist item | Covered by |
|---|---|
| Latency knee | M/M/1 (M1) and `s0-single-server` |
| Failure order | The expected-bottleneck assertions and the starter failures |
| Recovery after a fault | `s1-lb`: errors fall back to zero within 5 s after the crash ends. Asserted from the buckets: the error count in each of the 5 s after `recover` + 2 s is 0. |
| Metric trends | The reference passes, the starter fails, and the goldens are stable |

**Bench:** unchanged (`read-heavy`, at least 200k events/s). Also print events/s for `s1-cdn` and `s2-stampede`, without asserting on them.

### Phase 4: Runner, protocol and sandbox UI

**Steps:** implement §7 and §8.2.

**Tests in `tests/engine/runner.test.ts`:**
- **Inject during play:** a `chaos` entry appears in the next snapshot.
- **Inject while paused:** the action's `vtMs` equals the paused `vt`.
- **Unknown target:** an `error` message is posted.
- **Action log:** `done.actions` matches what was injected.

**Manual checklist** (record in `notes/m2_log.md`):
1. Crash a server mid-run. A marker appears, errors spike, and the hint and bottleneck behave as expected.
2. Least-connections without health checks shows the black hole.
3. Turning on health checks fixes it.
4. Adding a CDN lowers p50 on `s1-cdn`.
5. A partition shows requests hanging for 1 s, and upstream workers in use rising.
6. Loading a design saved before M2 works, thanks to `normalizeDesign`.

### Phase 5: Lesson shell

**Steps:**
- Implement §8.1, §8.3 and §8.4.
- Add `app/mdx.d.ts`, which declares `*.mdx` modules as `MDXContent`.
- Write one placeholder MDX file per module, containing only the section headings, so routing and progress can be tested before the content exists.

**Tests:**
- `tests/app/router.test.ts`: `parseHash` for every route, plus unknown hashes.
- `tests/app/progress.test.ts`:
  - steps for the full and light loops;
  - when a module counts as complete, including a drill counting only once it has a scored attempt;
  - `phaseSummary` counts.

**Manual checklist:**
1. Navigating home → lesson → sandbox → back keeps progress.
2. Saving, then reloading, restores the design.
3. Export, then clear site data, then import, restores everything.
4. Importing a malformed file shows the error and changes nothing.
5. The drill timer, rubric descriptors and attempt history all work.
6. The export reminder appears once the last export is more than 7 days old. Test it by setting `localStorage["sdl:lastExport"]` to an old timestamp.

### Phase 6: Content

**Steps:**
- Write the 11 MDX lessons, `content/drills.ts`, `content/rubric.ts` (all 30 descriptors) and the 11 card files, following §10.
- **Self-review** each lesson against this checklist:
  - The Predict answer agrees with what the scenario actually shows.
  - The Explain model answer names the mechanism.
  - The real-world source link works and the summary is in my own words.

### Phase 7: Done-criteria check

1. All five scripts pass. Record the results in `notes/m2_log.md`.
2. **Take every module in order, for real.** Record my Predict answers honestly; wrong answers are fine and expected. Pass each Build and Break step, write each Explain, and do all three drills with timed self-scores.
3. The home page shows 11/11 modules complete.
4. **Write the M2 retrospective** in `notes/m2_log.md`:
   - Which modules taught me something?
   - Where did the simulator mislead me?
   - What should M3 change?

## 12. Persistence and data safety

- **Browser storage only.** All learner data stays in IndexedDB and in my export files. No network calls.
- **Imports replace everything.** An import replaces all data, but only after a confirmation. There is no merge, because merge rules are out of scope.
- **Older data on load:** designs are passed through `normalizeDesign`. Progress entries whose `moduleId` is not in the registry are kept, but ignored.

## 13. Out of scope for M2

| Item | Planned for |
|---|---|
| Hot-key chaos and sharding | M3 |
| Queues, replication and async message kinds | M3 |
| Retries, circuit breakers, retry budgets and client timeouts beyond `connectTimeoutMs` | M4 |
| Multi-region | M4 |
| Weighted and consistent-hash LB algorithms, L7 routing rules | M3+ |
| The Claude review flow | M6 |

These are not planned:
- Write-back caching in the simulator. It is taught only as a concept in `p2-cache-write`, because simulating durability is out of scope.
- Autoscaling.
- A cost chart. Cost doesn't change during a run, since there is no autoscaling, so the header figure is enough. This is a deliberate change from the plan's M2 row; see §15.
- Lessons for Phases 3–9.

## 14. Alternatives considered

| Decision | Chosen | Rejected, and why |
|---|---|---|
| How a crash fails work | **In-flight and queued requests get `unavailable` immediately** (like a connection reset) | Silently dropping them would leave upstream workers held forever, because M2 has no per-call timeouts (those arrive in M4). |
| Partition behavior | **Calls hang for `connectTimeoutMs`, then fail as a timeout** | Failing immediately would hide the real lesson: a partition holds upstream workers and cascades. |
| Ordering user actions | **A separate tier, ordered after normal events at the same time, with its own seq counter** | Scheduling actions as normal events would make replay order differ from the live run, and change seq numbers in the trace. |
| Surge | **A second Poisson stream (superposition)** | Raising λmax for the base generator would change M1 traces and cost extra candidate events on every run. |
| Health checks | **Free periodic reads of `up`; 2 failures mark down, 2 passes mark up** | Real probe requests through links would add load and traffic that M2 doesn't teach. |
| Routing | **A hand-written hash router** | A router library is an extra dependency for 4 routes. |
| Storage | **Raw IndexedDB behind a small wrapper** | A wrapper library is an extra dependency. localStorage is too small and synchronous. |
| Lesson format | **MDX importing explicit components** | Plain React pages make prose awkward to write. A custom markdown dialect is more code. |
| Cost chart | **Dropped** | Cost is constant within a run in M2 (see §13). |
| Hot-key chaos | **Deferred to M3** | With a single cache node, skew *helps* the cache. The interesting failure needs sharding. |
| Vitest 5 upgrade | **Stay on 3.x in M2** | It is a breaking upgrade for a dev-only advisory. Revisit when Vite is upgraded. |

## 15. Changes to the parent plan

After this spec passes review, update `system_design_course_plan.md`:
- **M2 row:** replace "a cost chart and chaos-event markers" with "chaos-event markers (cost chart dropped; see m2_spec §13)". Add "network distance, LB algorithms and health checks, CDN, cache write policies, request coalescing".
- **Phase 2 topics:** note that hot keys at scale move to Phase 3, alongside sharding.

## 16. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Content takes longer than 1.5 weeks | High | Light modules stay light. The prose cap is 1,200 words. Rubric descriptors are one sentence each. If over time, ship Phases 0–1 first and finish Phase 2 as M2.1. |
| Scenario numbers don't produce the intended lesson | High | The tuning rule (§9) and the starter/reference/bottleneck assertions. Predict answers are checked against the actual runs in Phase 6. |
| M2 engine changes quietly change M1 behavior | Medium | The §4.4 hard rule, the M1 trace hash, and the unchanged M1 tests. |
| Chaos makes runs non-reproducible | Medium | Action log, tier-1 ordering, and the replay-equals-live determinism test. |
| IndexedDB data loss | Medium | `persist()`, weekly export reminder, and import validation. |
| The bench slows down because of the new branches | Low | The bench floor on `read-heavy` is unchanged, and M1 paths draw no extra random numbers and schedule no extra events. |
| Lesson self-scoring is lenient | Medium | Descriptors describe observable behavior. AI review arrives in M6. |
