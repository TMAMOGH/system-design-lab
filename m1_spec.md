# M1 build spec: engine core and the "Scale a read-heavy app" sandbox

> **Parent plan:** `system_design_course_plan.md`, Section 7, milestone M1.
> **Rule:** no M1 code is written until this spec passes an implementation-readiness review.
> **Size:** 2–3 weeks. **Out of scope:** see §12.

## 1. Purpose, deliverables and done criteria

**Purpose.** M1 has two jobs:
1. Prove that a browser-only engine, which simulates every request individually, is fast enough and accurate enough to teach with.
2. Prove that the build → run → evaluate → fix loop actually teaches.

The M1 gate checks both before any later milestone starts.

**Deliverables.** M1 is a local web app with these parts:
- A canvas for building an architecture from 5 component types: client, load balancer, server, cache and database.
- One scenario, **Scale a read-heavy app**.
- A simulation engine that runs in a Web Worker and tracks every request.
- A live dashboard showing offered load against throughput, p50 and p99 latency, error rate, and utilization per node.
- An evaluator that says whether the design meets the SLO within budget, and gives hints when it doesn't.

M1 already includes all of these dashboard charts. M2 only adds a cost chart and chaos-event markers.

**M1 is done when all of these hold:**
1. These commands all pass: `npm test`, `npm run test:fidelity` and `npm run bench`. Together they run the M/M/1, determinism, evaluator, runner and solvability tests, and they require an engine rate of **at least 200,000 events/s**.
2. In Chrome on my laptop, the reference design plays at 1× through the plateau at **30 fps or more**, and the lagging badge never appears.
3. Before running the variant scenario, I predict its bottleneck from the scenario's parameters. The prediction **matches the oracle** and explains the mechanism (§11 Phase 6). If it doesn't match, the retry procedure in Phase 6 must succeed.

## 2. Toolchain and dependencies (fixed)

| Item | Choice |
|---|---|
| Runtime | Node.js 22 LTS, npm |
| Language | TypeScript `^5.6.0`, `strict: true` |
| Build and dev server | `vite@^6.2.0`, `@vitejs/plugin-react@^4.3.0` |
| UI | `react@^18.3.1`, `react-dom@^18.3.1`, `@types/react@^18.3.0`, `@types/react-dom@^18.3.0` |
| Canvas | `@xyflow/react@^12.3.0` (React Flow v12) |
| Charts | `recharts@^2.15.0` |
| Tests | `vitest@^3.1.0`, Node environment only (no jsdom) |
| State | React `useReducer`; no state library |
| Random numbers | Hand-written mulberry32 (§5.2); no library |

No other dependencies are allowed in M1. Commit `package-lock.json`.

**npm scripts:**

| Script | Command | Purpose |
|---|---|---|
| `dev` | `vite` | Runs the app at `localhost:5173` |
| `build` | `tsc --noEmit && vite build` | Type-checks, then builds a static bundle into `dist/` |
| `test` | `vitest run tests/engine` | Fast unit tests (under 30 s) |
| `test:fidelity` | `vitest run tests/fidelity` | Slow fidelity, bottleneck and scenario-solvability tests |
| `bench` | `vitest run tests/bench` | Engine throughput benchmark |

## 3. File boundary

M1 creates exactly these files and no others. `node_modules/`, `dist/` and `package-lock.json` are generated.

```
.gitignore
README.md
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
index.html

engine/core/types.ts
engine/core/heap.ts
engine/core/rng.ts
engine/core/zipf.ts
engine/core/sim.ts
engine/components/instance.ts
engine/components/client.ts
engine/components/loadBalancer.ts
engine/components/server.ts
engine/components/cache.ts
engine/components/database.ts
engine/catalog.ts
engine/validate.ts
engine/build.ts
engine/metrics.ts
engine/evaluator.ts
engine/runner.ts
engine/protocol.ts
engine/worker.ts

scenarios/readHeavy.ts
scenarios/readHeavyVariant.ts

app/main.tsx
app/App.tsx
app/state.ts
app/useSimWorker.ts
app/canvas/Canvas.tsx
app/canvas/nodeTypes.tsx
app/canvas/RequestEdge.tsx
app/canvas/designMapping.ts
app/panels/Palette.tsx
app/panels/Inspector.tsx
app/panels/Controls.tsx
app/panels/Dashboard.tsx
app/panels/EvaluationPanel.tsx
app/styles.css

tests/fixtures.ts
tests/engine/heap.test.ts
tests/engine/rng.test.ts
tests/engine/zipf.test.ts
tests/engine/components.test.ts
tests/engine/validate.test.ts
tests/engine/metrics.test.ts
tests/engine/evaluator.test.ts
tests/engine/determinism.test.ts
tests/engine/runner.test.ts
tests/fidelity/mm1.test.ts
tests/fidelity/scenario.test.ts
tests/bench/bench.test.ts

notes/m1_prediction.md
```

**Configuration:**
- **`tsconfig.json`:**
  - `target`: `"ES2022"`; `lib`: `["ES2022", "DOM", "DOM.Iterable"]`
  - `module`: `"ESNext"`; `moduleResolution`: `"bundler"`
  - `jsx`: `"react-jsx"`; `strict`: `true`; `noEmit`: `true`
  - `include`: `["app", "engine", "scenarios", "tests"]`
- **`vite.config.ts`:** registers `react()` only.
- **`vitest.config.ts`:** `test.environment = "node"`, `test.include = ["tests/**/*.test.ts"]`.
- **`index.html`:** contains `<div id="root">` and loads `/app/main.tsx`.
- **`.gitignore`:** `node_modules/`, `dist/`.
- **`README.md`:** setup instructions, the five scripts, and a pointer to this spec.

### 3.1 Exported names

| Module | Exports |
|---|---|
| `core/types.ts` | All types in §4 |
| `core/heap.ts` | `class EventHeap { push(e); pop(); peek(); get size() }` |
| `core/rng.ts` | `interface Rng { next(): number; exp(mean: number): number }`, `createRng(seed: number): Rng` |
| `core/zipf.ts` | `createZipf(n, s, rng): { sample(): number }` |
| `core/sim.ts` | `class Simulation` (§5.4) |
| `components/instance.ts` | `class Instance` (§5.6), `type Behavior` |
| `components/*.ts` | The factories in §5.7, with exactly the signatures given there |
| `components/cache.ts` | Also `class LruTtlStore` (§5.7) |
| `catalog.ts` | `CATALOG`, `costPerHour(design): number` |
| `validate.ts` | `validate(design, scenario): string[]`, `canConnect(sourceType, targetType): string \| null` |
| `build.ts` | `build(design, scenario, opts?): Built` (§5.8), `createLinks(...)` and `type Links` (§5.5) |
| `metrics.ts` | `type Bucket`, `type NodeStats`, `type Records`, `percentile(sorted: Float64Array, q): number \| null` |
| `evaluator.ts` | `evaluate(records, buckets, design, scenario): Evaluation`, `type Evaluation` |
| `runner.ts` | `createRunner(post, deps?)` (§11 Phase 4) |
| `protocol.ts` | `UiToWorker`, `WorkerToUi` |

## 4. Domain model (`engine/core/types.ts`)

All times are **virtual milliseconds**, stored as `number` (float64).

```ts
export type ComponentType = "client" | "loadBalancer" | "server" | "cache" | "database";
export type Op = "read" | "write";
export type MessageKind = "request"; // open set; M3 adds "message" | "event" | "push"

export interface Message {
  id: number;          // sequential, starts at 1, assigned by the client
  kind: MessageKind;
  key: number;         // 0 .. keyspace-1
  op: Op;
  size: number;        // bytes; always 1024; unused in M1, kept to match the parent plan's message shape (first used in M3)
  createdAt: number;   // virtual ms
  deadline: number;    // createdAt + scenario.client.timeoutMs
}

export type ErrorKind = "rejected" | "timeout" | "downstream";
export interface Response { ok: boolean; error?: ErrorKind; hit?: boolean }
export interface Hop { edgeId: string; dir: "fwd" | "back"; ok: boolean; vt: number }
export interface TraceMeta { type: TraceType; node: string; msg: number }
export type TraceType =
  | "arrive" | "accept" | "serviceDone" | "reply"
  | "cacheSet" | "cacheInvalidate" | "sample" | "end";

export interface DesignNode {
  id: string;                      // "client" | "lb" | "server-1" | "cache" | "db"
  type: ComponentType;
  x: number; y: number;            // canvas position, ignored by the engine
  config: NodeConfig;
}
export type NodeConfig =
  | { type: "client" }
  | { type: "loadBalancer" }
  | { type: "server"; tier: "small" | "medium"; instances: number }  // integer 1..20
  | { type: "cache"; tier: "small" | "medium" | "large"; ttlSeconds: 10 | 60 | 300 }
  | { type: "database"; tier: "medium" | "large" | "xlarge" };
export interface DesignEdge { id: string; source: string; target: string } // id = `e-${source}-${target}`
export interface Design { version: 1; nodes: DesignNode[]; edges: DesignEdge[] }

export interface TrafficPhase { untilSec: number; fromRps: number; toRps: number } // linear within phase
export interface HintRule {
  criterion: "p99" | "errorRate" | "cost";
  bottleneck?: ComponentType;      // omitted = matches any bottleneck (including none)
  text: string;                    // placeholders: {component} {util} {amount}
}
export interface Scenario {
  id: string;
  title: string;
  seed: number;
  durationSec: number;             // traffic stops at this time
  traffic: TrafficPhase[];
  readRatio: number;               // 0..1
  keyspace: number;
  zipfS: number;
  client: { timeoutMs: number };   // may be Infinity (tests only)
  allowed: ComponentType[];
  budgetPerHour: number;           // USD per hour
  window: { fromSec: number; toSec: number };   // evaluation window, by createdAt
  criteria: { p99MaxMs: number; errorRateMax: number };
  hints: HintRule[];
  starterDesign: Design;
  referenceDesign: Design;         // known-good solution, used by tests
}
```

## 5. Engine core

### 5.1 Event heap (`engine/core/heap.ts`)
- The heap is a binary min-heap of entries `{ t: number; seq: number; fn: () => void; meta: TraceMeta }`.
- Entries are ordered by `t`, then by `seq`.
- `Simulation` assigns `seq` from a global counter when it schedules an event.
- `pop()` and `peek()` return `undefined` when the heap is empty.

### 5.2 RNG (`engine/core/rng.ts`)
- `createRng(seed)` returns a mulberry32 generator with a 32-bit seed.
- `next()` returns a value in [0, 1).
- `exp(mean)` returns `-mean * Math.log(1 - next())`.
- Each simulation has one RNG, seeded from `opts.seed ?? scenario.seed`.

### 5.3 Zipf sampler (`engine/core/zipf.ts`)
- `createZipf(n, s, rng)` precomputes a normalized CDF as a `Float64Array` of length n.
- The weight of rank `i` (0-based) is `1/(i+1)^s`.
- `sample()` binary-searches for the first `i` where `cdf[i] >= rng.next()`.
- When `s = 0`, sampling is uniform.

### 5.4 Simulation (`engine/core/sim.ts`)
```ts
class Simulation {
  now = 0; eventsProcessed = 0;
  constructor(public rng: Rng) {}
  schedule(delayMs: number, fn: () => void, meta: TraceMeta): void;  // delayMs >= 0
  runUntil(tMs: number, wallBudgetMs = Infinity): number;             // returns new now
  onEvent?: (t: number, seq: number, meta: TraceMeta) => void;        // trace hook
}
```

`runUntil(tMs, wallBudgetMs)` processes events like this:
- While `heap.peek()?.t <= tMs`, pop the next event and, in order:
  1. Set `now = t`.
  2. Call `onEvent`.
  3. Run `fn`.
  4. Increment `eventsProcessed`.
- Every 1,000 events, compare `performance.now()` with the wall-clock budget. If the budget is exceeded, stop and return the current `now`.
- If the next event is past `tMs`, or the heap is empty, set `now = tMs` and return it.

### 5.5 Links (`engine/build.ts`)

`build` creates a single `Links` object and passes it to every component:

```ts
interface Links {
  call(edgeId: string, target: Instance, msg: Message, cb: (res: Response) => void): void;
  fireAndForget(fn: () => void, meta: TraceMeta): void;   // schedules fn after one link latency
  setSampleN(n: number): void;                            // 0 = sample nothing
  drainHops(): Hop[];
}
function createLinks(sim: Simulation, linkLatencyMs: number): Links;
```

**Link properties:**
- Every link has a **constant one-way latency of 0.5 ms** in each direction.
- Tests can override the latency with `opts.linkLatencyMs`.
- M1 links have no faults.

**`call`.** It sends one message across an edge and returns the response:
1. If `msg` is sampled (§8.3), record the forward hop `{edgeId, dir: "fwd", ok: true, vt: now}`.
2. After one link latency, run `target.accept(msg, reply)`.
3. When `reply(res)` is called:
   1. If the message is sampled, record the back hop `{edgeId, dir: "back", ok: res.ok, vt: now}`.
   2. After one more link latency, run `cb(res)`.

**What each event writes to the trace:**

| Scheduled event | `type` | `node` | `msg` |
|---|---|---|---|
| Client candidate arrival (generated or scripted) | `arrive` | `"client"` | the message id, or 0 for a rejected thinning candidate |
| Forward delivery (`target.accept`) | `accept` | target instance id, e.g. `server-1#2` | message id |
| Service completion | `serviceDone` | instance id | message id |
| Back delivery (`cb(res)`) | `reply` | id of the instance that replied | message id |
| Fire-and-forget cache set / invalidate | `cacheSet` / `cacheInvalidate` | cache instance id | message id |
| Metrics sampler | `sample` | `""` | 0 |
| Finalize at `endMs` | `end` | `""` | 0 |

### 5.6 Processing instance (`engine/components/instance.ts`)

Every component except the client runs this logic.

```ts
type Behavior = (msg: Message, done: (res: Response) => void) => void;
class Instance {
  constructor(
    public id: string,               // `${nodeId}#${index}`
    sim: Simulation,
    params: { concurrency: number; queueLimit: number;
              serviceMean: (m: Message) => number; fixedService: boolean },
    behavior: Behavior,
  );
  accept(msg: Message, reply: (res: Response) => void): void;
  // cumulative: accepted
  // per-second (reset by the sampler, §8.1): heldArea, serviceArea, rejected, dropped
  // live: busy, inService, lastChange, queue.length
}
```

**`accept(msg, reply)`:**
1. Increment `accepted`.
2. If `busy < concurrency`, call `start`.
3. Otherwise, if `queue.length < queueLimit`, add the message to the end of the queue.
4. Otherwise, increment `rejected` and immediately call `reply({ok:false, error:"rejected"})`.

**`start`:**
1. Flush the areas, then increment `busy`.
2. If `sim.now >= msg.deadline`, increment `dropped` and call `finish` with `{ok:false, error:"timeout"}`. No service time is spent.
3. Otherwise, draw the service time `s`. It is `serviceMean(msg)` if `fixedService` is true, and `rng.exp(serviceMean(msg))` if not. The load balancer always uses `fixedService = true`.
4. Increment `inService`. At `+s`, flush the areas, decrement `inService`, and run `behavior(msg, res => finish(reply, res))`.

**`finish`:**
1. Flush the areas, then decrement `busy`.
2. Call `reply(res)`.
3. If the queue is not empty, take the first entry and call `start` on it.

**Flushing the areas:**
- Add `busy × (now − lastChange)` to `heldArea`.
- Add `inService × (now − lastChange)` to `serviceArea`.
- Set `lastChange = now`.

**Why there are two areas:**
- `heldArea` counts every held worker, including workers waiting on downstream calls. It measures how full the worker pool is.
- `serviceArea` counts only the instance's own service time.
- §9 uses both to find the bottleneck.

Workers stay held while `behavior` waits on downstream calls, like a thread-per-request server. That is how slow downstreams cascade upstream.

### 5.7 Component behaviors and factories

| Component | Factory signature | Behavior after service |
|---|---|---|
| **Load balancer** | `createLbBehavior(links: Links, edgeId: string, targets: Instance[]): Behavior` | `targets` are the instances of the node that the LB's single outgoing edge points to. A round-robin cursor calls `links.call(edgeId, targets[cursor++ % n], msg, done)`, which forwards the response unchanged. |
| **Server** | `createServerBehavior(links: Links, deps: { db: { edgeId: string; instance: Instance }; cache?: { edgeId: string; instance: Instance; store: LruTtlStore } }): Behavior` | **Read, with a cache:** call the cache. If `res.ok && res.hit`, return `{ok:true}`. On a miss, or on any cache error, call the db. If the db returns ok, run `links.fireAndForget(() => store.set(msg.key, sim.now), {type:"cacheSet", …})` and return `{ok:true}`. If the db errors, return `{ok:false, error:"downstream"}`. **Read, no cache:** call the db directly. **Write:** call the db. If it returns ok and a cache exists, fire-and-forget `store.invalidate(msg.key)` with type `cacheInvalidate`, then return `{ok:true}`. If the db errors, return `downstream`. |
| **Cache** | `createCacheBehavior(store: LruTtlStore, counters: { hits: number; misses: number }, sim: Simulation): Behavior` | Computes `hit = store.get(msg.key, sim.now)`, increments `hits` or `misses`, and returns `{ok:true, hit}`. |
| **Database** | `createDbBehavior(): Behavior` | Returns `{ok:true}`. Reads and writes differ only in service mean (§6). |
| **Client** | `createClient(sim: Simulation, links: Links, cfg: { scenario: Scenario; edgeId: string; target: Instance; zipf: { sample(): number }; arrivals?: BuildOptions["arrivals"]; onRecord: (createdAt: number, latency: number, outcome: 0 \| 1 \| 2 \| 3, completedAt: number) => void }): { requestsCreated(): number; finalize(endMs: number): void }` | See "Client arrivals and responses" below. |

**Client arrivals and responses:**
- **Generated arrivals:** a non-homogeneous Poisson process, produced by thinning.
  - `λmax` is the highest `fromRps` or `toRps` across all phases.
  - Each candidate arrives at `t += rng.exp(1000/λmax)`.
  - A candidate is accepted with probability `λ(t)/λmax`, where λ is linear within each phase.
  - Generation stops at `durationSec`.
- **Scripted arrivals:** if `cfg.arrivals` is set, the client sends exactly those messages and generates nothing else.
- **Building each message:**
  - It is a read with probability `readRatio`. Scripted arrivals set `op` themselves.
  - Its key comes from Zipf, or from the script.
  - `deadline = t + timeoutMs`.
  - The client tracks it in an outstanding map and sends it with `links.call`.
- **When a response arrives:**
  - Remove the message from the outstanding map.
  - If `now > msg.deadline`, record it as a timeout (code 2).
  - Otherwise, record the response's outcome, with latency `now − createdAt`.
- **`finalize(endMs)`:** records every message still outstanding as a timeout, with latency `endMs − createdAt`.

**`LruTtlStore`:**
- Its constructor takes `(capacity: number, ttlMs: number)`.
- It is a JS `Map` from key to `expiresAt`. The map's insertion order is the LRU order.
- **`get(key, now): boolean`:**
  - If the key is present and `now < expiresAt`, delete it, re-insert it (making it most recently used), and return `true`.
  - If it is present but expired, delete it and return `false`.
  - If it is absent, return `false`.
- **`set(key, now)`:** delete the key if present, insert it with `now + ttlMs`, and delete the oldest entry if the size is over capacity.
- **`invalidate(key)`:** delete the key.
- The store starts empty.

### 5.8 `build` (`engine/build.ts`)
```ts
interface BuildOptions {
  seed?: number;                                   // default scenario.seed
  linkLatencyMs?: number;                          // default 0.5
  onEvent?: Simulation["onEvent"];
  arrivals?: { tMs: number; key: number; op: Op }[];   // scripted client (tests)
  override?: Record<string, {                      // keyed by design node id; tests only
    concurrency?: number; queueLimit?: number;
    serviceMeanMs?: number;                        // db: replaces both read and write means; others: replaces the mean
    fixedService?: boolean;
  }>;
}
interface Built {
  sim: Simulation;
  endMs: number;
  isFinished(): boolean;                 // sim.now >= endMs
  runUntil(tMs: number, wallBudgetMs: number): number;
  setSampleN(n: number): void;           // delegates to Links
  drainBuckets(): Bucket[];              // buckets completed since last drain
  drainHops(): Hop[];                    // delegates to Links
  allBuckets(): Bucket[];
  records(): Records;
  requestsCreated(): number;             // all client messages created, in or out of window
  instances(nodeId: string): Instance[]; // tests only
  evaluate(): Evaluation;                // evaluate(records(), allBuckets(), design, scenario)
}
```

**What `build` does:**
- It assumes the design has already been validated. Tests may build topologies the UI would reject, such as `client→db`.
- It creates `instances` copies of `Instance` for the server, and one each for the LB, cache and db.
- **The first thing it schedules** is the finalize event at `endMs`, with trace type `end`, which calls `client.finalize(endMs)`. Because this event gets the lowest `seq`, it pops before any other event at the same instant.
- After that it wires the components through `createLinks` and the factories in §5.7, then schedules the client and the metrics sampler (first run at t = 1000).

**How `endMs` is set:**
- Normally, `endMs = durationSec × 1000 + timeoutMs`.
- If `timeoutMs` is `Infinity`, it is `durationSec × 1000 + 60,000` instead.
- With scripted arrivals, `durationSec × 1000` is replaced by the last arrival's `tMs`.

**Why stopping at `endMs` is exact:** any reply that arrives after its deadline counts as a timeout anyway, and every deadline is at or before `endMs`.

## 6. Catalog (`engine/catalog.ts`)

Service means are in milliseconds. Service times are exponential, except the load balancer's, which is fixed.

| Component | Tier | Concurrency | Queue limit | Service mean | Capacity | Price ($/h per instance) |
|---|---|---|---|---|---|---|
| Load balancer | — | 20000 | 0 | 0.05 (fixed) | — | 0.05 |
| Server | small | 16 | 64 | 2.0 | — | 0.10 |
| Server | medium | 32 | 128 | 2.0 | — | 0.20 |
| Cache | small | 64 | 256 | 0.2 | 10,000 keys | 0.05 |
| Cache | medium | 64 | 256 | 0.2 | 50,000 keys | 0.15 |
| Cache | large | 64 | 256 | 0.2 | 100,000 keys | 0.40 |
| Database | medium | 32 | 256 | read 10, write 20 | — | 0.50 |
| Database | large | 64 | 256 | read 10, write 20 | — | 1.00 |
| Database | xlarge | 128 | 256 | read 10, write 20 | — | 2.50 |

The client is free and has no processing.

`costPerHour(design)` is the sum of `price × instances` over all nodes. `instances` is 1 for every type except the server.

## 7. Design validation (`engine/validate.ts`)

`validate(design, scenario)` collects **all** errors and returns their messages in rule order. An empty list means the design is valid.

**Dependent rules.** If a node type fails rule 1, rules 4–7 are **skipped** for that type.

**Broken edges.** An edge that fails rule 3a is ignored by every later rule.

| # | Rule | Message |
|---|---|---|
| 1 | Exactly 1 `client`, 1 `server` and 1 `database`; at most 1 `loadBalancer` and at most 1 `cache` | `"The design needs exactly one {type}."` / `"Only one {type} is allowed."` |
| 2 | Every node type is in `scenario.allowed` | `"{type} is not available in this scenario."` |
| 3a | Both ends of every edge exist | `"Edge {id} points to a missing node."` |
| 3 | Every edge is an allowed pair | The reason returned by `canConnect` for that pair |
| 3b | No duplicate edges | `"{source} is already connected to {target}."` |
| 4 | The client has exactly 1 outgoing edge | `"Connect the client to a load balancer or the server."` |
| 4b | If the client connects directly to the server, the server has `instances = 1` | `"Add a load balancer to spread traffic across instances."` |
| 5 | If there is a load balancer, it has an edge from the client and an edge to the server | `"The load balancer must sit between the client and the server."` |
| 6a | The server has an edge to the database | `"Connect the server to the database."` |
| 6b | If there is a cache, the server has an edge to the cache | `"Connect the server to the cache, or remove the cache."` |
| 7 | Server `instances` is an integer from 1 to 20 | `"Server instances must be between 1 and 20."` |

**`canConnect(sourceType, targetType)`:**
- It allows exactly these pairs: `client→loadBalancer`, `client→server`, `loadBalancer→server`, `server→cache` and `server→database`.
- It returns `null` for an allowed pair.
- For any other pair it returns `"A {sourceType} cannot send requests to a {targetType}."`.
- `Canvas.tsx` imports this same function, so the rule lives in one place only.

## 8. Metrics, snapshots and sampling (`engine/metrics.ts`)

### 8.1 Collection

**The sampler.** It runs every 1,000 virtual ms, starting at t = 1000. Each run builds **one `Bucket`** for the second that just ended. For each design node except the client, it:
1. Flushes the areas of all the node's instances.
2. Computes `heldUtil = Σ heldArea / (concurrency × instances × 1000)` and `serviceUtil = Σ serviceArea / (concurrency × instances × 1000)`. Both are 0 when concurrency × instances is 0.
3. Reads `queueLength`, which is the total queue length at that instant.
4. Reads the per-second counters: `rejected` and `dropped`, plus `hits` and `misses` for the cache.
5. **Resets** the areas and the per-second counters to 0.

A final partial second does not get a bucket.

**Request records.** The client's `onRecord` callback receives each record.
- Records whose `createdAt` falls in the window go into `Records`.
- Every record also counts toward bucket `min(floor(completedAt/1000), floor(endMs/1000) − 1)`, the last whole second. Because finalize runs before any sampler at the same instant (§5.8), the timeouts recorded at `endMs` land in the last bucket.

```ts
interface Records {                 // initial capacity 65,536; all arrays double when full
  n: number;
  createdAt: Float64Array;
  latency: Float64Array;
  outcome: Uint8Array;              // 0 ok, 1 rejected, 2 timeout, 3 downstream
}
interface NodeStats {
  heldUtil: number; serviceUtil: number; queueLength: number;
  rejected: number; dropped: number; hits?: number; misses?: number;   // hits/misses: cache only
}
interface Bucket {
  sec: number;                     // covers [sec, sec+1) of virtual time
  offeredRps: number;              // requests created in the second
  completedOk: number;
  errors: { rejected: number; timeout: number; downstream: number };
  p50Ms: number | null; p99Ms: number | null;   // over ok latencies completed in the second
  nodes: Record<string, NodeStats>;
}
```

`percentile(sorted, q)` uses the nearest-rank method: it returns `sorted[ceil(q × n) − 1]`, or `null` when `n = 0`.

### 8.2 Derived in the UI
- **Error rate** per bucket is `Σerrors / (completedOk + Σerrors)`, or 0 if that sum is 0.
- **Cache hit ratio** is `hits / (hits + misses)`, shown as "—" when the sum is 0.
- The dashboard and the node bars update once per completed virtual second, which is 1 Hz at 1× speed.
- **Known limitation:** a timeout is recorded when its late reply arrives, or at finalize. So on the dashboard it shows in a slightly later second than the one in which it expired. The evaluator is not affected, because it groups records by `createdAt`.

### 8.3 Animation sampling
- A message is sampled when `N > 0 && msg.id % N === 0`.
- The runner sets N through `setSampleN`:
  - **On play, resume or speed change:** `N = max(1, ceil(peakRps × speed / 50))`, where `peakRps` is λmax (§5.7). This caps the display at about 50 animated requests per wall-clock second.
  - **On run-to-end:** `N = 0`, so nothing is sampled.
- If N changes while a message is in flight, its forward and back hops may disagree about sampling. The only effect is a missing dot, which is accepted.
- Sampling never touches the RNG or the event schedule.

## 9. Evaluator (`engine/evaluator.ts`)

The evaluator only considers:
- records with `createdAt ∈ [window.fromSec, window.toSec)`;
- buckets with `sec ∈ [window.fromSec, window.toSec)`.

| Criterion | Value | Pass |
|---|---|---|
| `p99` | Nearest-rank p99 over latencies with outcome 0 | `value < criteria.p99MaxMs`. Fails, with value `null`, if there are no ok requests. |
| `errorRate` | (records with outcome ≠ 0) / n | `value < criteria.errorRateMax`. Fails, with value `null`, if n = 0. |
| `cost` | `costPerHour(design)` | `value <= budgetPerHour` |

**Downstream order.** Database, then cache, then server, then load balancer. "Furthest downstream" means earliest in this list.

**Bottleneck.** The bottleneck is chosen from the window-mean `heldUtil` and `serviceUtil` of each non-client node:
1. **Saturated nodes:** take the nodes whose mean `heldUtil` ≥ 0.9. If there are any, the bottleneck is the one furthest downstream, and its reported `metric` is `"held"`.
   - This finds the saturated node whose own downstream is *not* saturated.
   - It works whether the node is short on its own capacity (like the db in the guard test) or its worker pool is full (like the server in the starter design).
2. **Otherwise:** the bottleneck is the node with the highest mean `serviceUtil`, and its `metric` is `"service"`. Ties go to the node furthest downstream.
3. **No buckets in the window:** the bottleneck is `null`.

**Rejecting node.** The non-client node with the most `rejected + dropped` across the window buckets. Ties go to the node furthest downstream. It is `null` if every node's count is 0.

**Hints.** For each criterion that fails, use the first `HintRule` whose `criterion` matches and whose `bottleneck` is either omitted or equal to the bottleneck's type. A rule with a `bottleneck` value never matches a `null` bottleneck. Fill in the placeholders:

| Placeholder | Filled with |
|---|---|
| `{component}` | For `errorRate` hints, the rejecting node. Otherwise, or if no node rejected anything, the bottleneck node id. If neither exists, `"the system"`. |
| `{util}` | `Math.round(x × 100) + "%"`, where `x` is the bottleneck's mean `heldUtil` if its metric is `"held"`, and its mean `serviceUtil` otherwise. `"n/a"` if there is no bottleneck. |
| `{amount}` | `(value − budget).toFixed(2)` |

Hint texts must be plain `"…"` string literals, never template literals.

```ts
interface Evaluation {
  passed: boolean;
  criteria: { name: "p99" | "errorRate" | "cost"; value: number | null; limit: number; passed: boolean }[];
  bottleneck: { nodeId: string; type: ComponentType; metric: "held" | "service";
                serviceUtil: number; heldUtil: number } | null;
  rejectingNode: string | null;
  hints: string[];
}
```

## 10. Scenarios

**Canvas positions**, used by every design in this section and by the Palette:

| Node | Position |
|---|---|
| client | (0, 200) |
| lb | (200, 200) |
| server-1 | (400, 200) |
| cache | (650, 100) |
| db | (650, 300) |

Edge ids follow the pattern `e-${source}-${target}`.

### 10.1 `scenarios/readHeavy.ts`

| Field | Value |
|---|---|
| id / title | `read-heavy` / "Scale a read-heavy app" |
| seed | 1 |
| traffic | `[{untilSec: 60, fromRps: 1000, toRps: 10000}, {untilSec: 180, fromRps: 10000, toRps: 10000}]` |
| durationSec | 180 |
| readRatio | 0.9 |
| keyspace / zipfS | 100,000 / 1.0 |
| client.timeoutMs | 1000 |
| allowed | all 5 types |
| budgetPerHour | 2.50 |
| window | 60 → 180 s |
| criteria | p99MaxMs 200, errorRateMax 0.001 |

**Starter design.** This design is meant to fail.
- Nodes: `client`, `server-1` (small, 1 instance) and `db` (medium).
- Edges: `client→server-1` and `server-1→db`.
- The server's worker pool saturates, so the expected bottleneck is `server-1`.

**Reference design.** This design is meant to pass. It costs $2.00/h.
- Nodes: `client`, `lb`, `server-1` (small, 8 instances), `cache` (medium, TTL 60) and `db` (large).
- Edges: `client→lb`, `lb→server-1`, `server-1→cache` and `server-1→db`.

**Hints**, checked in order:
1. `{p99, database}` → "The database is the bottleneck ({util} of its workers busy). Reduce the reads that reach it, or give it more capacity — which is cheaper?"
2. `{p99, server}` → "The server is out of workers ({util} in use). Add instances behind a load balancer, or move to a bigger tier."
3. `{p99}` → "Latency is too high. Look for the component whose workers are closest to 100% in use."
4. `{errorRate}` → "Requests are failing at {component}: its queue is full or work waits past its deadline. Add capacity there, or reduce the load reaching it."
5. `{cost}` → "Over budget by ${amount}/h. Which component costs the most, and could a cheaper one take load off it?"

### 10.2 `scenarios/readHeavyVariant.ts` (written in Phase 6)

This is `read-heavy` with these changes:

| Field | Value |
|---|---|
| id | `read-heavy-variant` |
| title | "Scale a write-heavier app" |
| readRatio | 0.7 |
| zipfS | 0.7 |
| keyspace | 1,000,000 |
| budgetPerHour | 3.00 |

The starter design, reference design and hints are unchanged. The variant has no solvability requirement, because it is only used for the prediction exercise.

## 11. Build phases

Each phase ends with `npm run build` and `npm test` passing. From Phase 3 on, `npm run test:fidelity` and `npm run bench` must pass too.

**Shared fixture (`tests/fixtures.ts`)**, created in Phase 2:

- **`testScenario(partial?: Partial<Scenario>): Scenario`** returns this scenario, with `partial` merged over it:

  | Field | Default |
  |---|---|
  | `id` / `title` | `"test"` / `"test"` |
  | `seed` | 1 |
  | `durationSec` | 1 |
  | `traffic` | `[{untilSec: 1, fromRps: 0, toRps: 0}]` |
  | `readRatio` | 1 |
  | `keyspace` | 1000 |
  | `zipfS` | 0 |
  | `client` | `{timeoutMs: 1000}` |
  | `allowed` | all 5 types |
  | `budgetPerHour` | 100 |
  | `window` | `{fromSec: 0, toSec: 1e9}` |
  | `criteria` | `{p99MaxMs: 200, errorRateMax: 0.001}` |
  | `hints` | `[]` |
  | `starterDesign` and `referenceDesign` | `design([], [])` |

- **`design(nodes, edges)`** builds a `Design`:
  - **`nodes`:** `{id, type, config}` entries. Each node gets `x = 0`, `y = 0`. Configs default as follows: server small × 1, cache small with TTL 60, db medium.
  - **`edges`:** `[source, target]` pairs, with ids generated by the rule in §10.

### Phase 1: Scaffold and core primitives

**Files:**
- `.gitignore`, `README.md`, `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`
- `app/main.tsx`, `app/App.tsx`
- `engine/core/types.ts`, `engine/core/heap.ts`, `engine/core/rng.ts`, `engine/core/zipf.ts`, `engine/core/sim.ts`
- `tests/engine/heap.test.ts`, `tests/engine/rng.test.ts`, `tests/engine/zipf.test.ts`

**Steps:**
- Implement the core rows of §3.1, plus §4 and §5.1–5.4.
- `main.tsx` renders `<App/>` into `#root`.
- `App.tsx` returns `<h1>M1 sandbox</h1>` until Phase 5.

**Tests:**
- **heap:**
  - 10,000 random `(t, seq)` entries pop out sorted by `(t, seq)`.
  - Entries with equal `t` pop in `seq` order.
  - `pop` and `peek` on an empty heap return `undefined`.
- **rng:**
  - Seed 42 produces the same first 1,000 values on two runs.
  - Seeds 42 and 43 produce different first values.
  - Over 10⁶ calls, the mean of `next()` is 0.5 ± 0.005, and every value lies in [0, 1).
  - Over 10⁶ calls, the mean of `exp(5)` is 5, within 1% relative.
- **zipf:**
  - The CDF never decreases, and its last value is 1 ± 1e-12.
  - With n = 1000, s = 1 and 10⁶ samples, the frequency of rank 0 is within 2% relative of `1/H(1000)`.
  - With n = 1000, s = 0 and 10⁶ samples, each of the 10 buckets of 100 ranks has a frequency of 0.1 ± 0.005 absolute.

### Phase 2: Components and simulation

**Files:**
- `engine/components/instance.ts`, `client.ts`, `loadBalancer.ts`, `server.ts`, `cache.ts`, `database.ts`
- `engine/catalog.ts`, `engine/build.ts`, `engine/metrics.ts`
- `engine/evaluator.ts` (stub)
- `tests/fixtures.ts`
- `tests/engine/components.test.ts`, `tests/engine/metrics.test.ts`

**Steps:**
- Implement §5.5–§6 and §8.
- `evaluator.ts` exports the `Evaluation` type and an `evaluate` function that throws `new Error("not implemented")`, so that `Built.evaluate()` compiles. Phase 3 replaces it.

**Tests in `components.test.ts`.** Each test uses `build` with `testScenario` and scripted `arrivals`.

| Test | Setup | Expected |
|---|---|---|
| **Queue limit** | `client→db`; db `{concurrency 1, queueLimit 1}`; 3 reads at t = 0 | 1 `rejected` record immediately; the other 2 complete in order |
| **Deadline** | `client→db`; db `{concurrency 1, queueLimit 10, serviceMeanMs 600, fixedService true}`; `timeoutMs 500`; 2 reads at t = 0 | Both records are `timeout`. The first reply arrives after its deadline; the second request is dropped when it starts. db `dropped` summed over the buckets is 1. |
| **Round robin** | `client→lb→server-1→db`; server `instances 3`; 300 reads at t = 0, 1, 2 … 299 ms | `instances("server-1")` all have `accepted` = 100. The first three `accept` trace events whose `node` starts with `server-1#` are `#0`, `#1`, `#2`. |
| **Write invalidation** | `client→server-1→{cache, db}`; db `{serviceMeanMs 20, fixedService true}`. Read key 5 at 0 ms (miss, then fill), read 5 at 100 ms (hit), write 5 at 200 ms, read 5 at 300 ms (miss). | Across all buckets, cache `hits` = 1 and `misses` = 2 |
| **Cache error fallback** | Same topology; cache `{concurrency 0, queueLimit 0}`; 10 reads | All succeed through the db; cache `serviceUtil` = 0, not NaN |
| **Held worker** | `client→server-1→db`; server `{concurrency 1}`; db `{serviceMeanMs 100, fixedService true}`; 2 reads at t = 0 | The second completes at ≥ 200 ms |

**`LruTtlStore` tests**, also in `components.test.ts`, calling the class directly:
- With capacity 2: set 1, set 2, get 1, set 3. Key 2 is evicted and key 1 is kept.
- With TTL 10,000 ms and `set(k, 0)`: `get(k, 9999)` is `true` and `get(k, 10001)` is `false`.

**Tests in `metrics.test.ts`:**
- **Flush across a boundary:**
  - Setup: `client→db`; db `{concurrency 2, serviceMeanMs 1500, fixedService true}`; `timeoutMs 3000`; one read at t = 500.
  - Expected: in bucket `sec = 1`, db `heldUtil` = 0.5. The worker is held from 500.5 to 2000.5.
- **Held vs. own work:**
  - Setup: `client→server-1→db`; db `{serviceMeanMs 100, fixedService true}`; reads at 0, 200, 400, 600 and 800 ms.
  - Expected: in bucket 0, server `heldUtil > 2 × serviceUtil`.
- **Percentile:** nearest-rank p99 of 1..100 is 99, of `[5]` is 5, and of an empty array is `null`.

### Phase 3: Validation, evaluator, scenario

**Files:**
- `engine/validate.ts`, `engine/evaluator.ts` (replaces the stub)
- `scenarios/readHeavy.ts`
- `tests/engine/validate.test.ts`, `tests/engine/evaluator.test.ts`, `tests/engine/determinism.test.ts`
- `tests/fidelity/mm1.test.ts`, `tests/fidelity/scenario.test.ts`
- `tests/bench/bench.test.ts`

**Tests — validate:**
- For each rule in §7, one design that breaks only that rule produces exactly the expected message. Rule 1 uses two cache nodes.
- A design that breaks rules 4 and 6a returns both messages, in that order.
- A design with zero servers returns only the rule-1 message for `server`. Rules 4b, 6a and 7 are skipped.
- The starter and reference designs are valid.
- `canConnect("cache", "database")` returns the refusal text.

**Tests — evaluator** (`tests/engine/evaluator.test.ts`):
- **Fixture:** the `read-heavy` scenario and its reference design.
  - Records: 100 ok latencies of 1..100 ms with `createdAt = 60000 + i`, plus 1 rejected at `createdAt = 60100`.
  - Buckets: `sec` 60..179, every node stat at 0, except db `rejected = 1` in bucket 60.
- **With this fixture:**
  - p99 is 99 and passes.
  - errorRate is 1/101 and fails.
  - `rejectingNode` is `db`, and the errorRate hint names `db`.
- **Window:** records outside the window are ignored.
- **Cost:** a cost of 2.75 against a budget of 2.50 fails, and `{amount}` is `"0.25"`.
- **Edge cases:**
  - Empty records: errorRate is `null` and fails.
  - No buckets in the window: bottleneck is `null`, and `{util}` is `"n/a"`.
- **Bottleneck rule on synthetic buckets:**
  - With `heldUtil` 0.95 for server-1, 0.4 for db and 0 for the rest, the bottleneck is `server-1` with metric `"held"`.
  - With `heldUtil` 0.95 for both server-1 and db, it is `db`.
  - With every `heldUtil` < 0.9, it is the node with the highest `serviceUtil`, with metric `"service"`.
  - Ties go to the node furthest downstream.

**Tests — determinism.** Each `it` has `timeout: 60_000`.
- Run the reference design on `read-heavy`, cut to `durationSec: 10`, with seed 7, twice.
- Each run uses `onEvent` to write trace lines in the form `${t.toFixed(6)} ${seq} ${type} ${node} ${msg}`.
- The two traces must be byte-identical.
- Seed 8 must produce a different trace.

**Tests — `fidelity/mm1`.** Each `it` has `timeout: 300_000`.
- **Setup:**
  - Topology `client→db`, with `override { db: { concurrency: 1, queueLimit: Infinity, serviceMeanMs: 1 } }`, so μ = 1000/s.
  - `readRatio 1`, and one traffic phase at a constant rate λ.
  - `durationSec = (customers + 50,000) / λ`; window `[0, durationSec)`; `linkLatencyMs 0`; timeout `Infinity`.
  - Statistics are read from `records()` in `createdAt` order.
- **Cases:**

  | ρ | Customers | Warm-up discarded |
  |---|---|---|
  | 0.5 | 200,000 | first 50,000 |
  | 0.8 | 500,000 | first 50,000 |
  | 0.9 | 1,000,000 | first 50,000 |

- Each case runs with seeds 1 to 5.
- **Pass:**
  - The mean of the five per-seed mean latencies is within 10% of `1/(μ−λ)`.
  - The pooled nearest-rank p99 is within 15% of `ln(100)/(μ−λ)`.

**Tests — `fidelity/scenario`** (`read-heavy`). Each `it` has `timeout: 300_000` and covers **one run**.
- **Reference design:** passes all 3 criteria. There are 3 separate `it`s, one each for seeds 1, 2 and 3.
- **Starter design:**
  - It fails `errorRate`.
  - It is cut to `durationSec 70`, with window 60–70 s.
  - Its bottleneck is `server-1`, with metric `"held"`.
- **Misattribution guard:**
  - Run the reference design with db tier **medium** and **16** server instances, cut to `durationSec 70`, with window 60–70 s.
  - The bottleneck must be `db`.
- **No-cache design:**
  - LB, server small × 12 and db xlarge, at $3.75/h.
  - It must fail `cost`.
- **If the reference design fails:**
  - Change only the reference design: more server instances, or a larger cache tier, staying within $2.50/h.
  - Never change engine semantics or catalog values to make it pass.
  - Record the new design in §10.1.
  - If no design within budget passes, stop and amend the scenario here first.
- **How these tests cover the parent plan's fidelity checklist:**

  | Checklist item | Covered by |
  |---|---|
  | Latency knee | The M/M/1 test |
  | Failure order | The starter, guard and evaluator bottleneck tests |
  | Recovery after a fault | Not applicable until M2 adds faults |
  | Metric trends | The starter and reference outcomes |

**Bench** (`timeout: 600_000`):
- Run the reference design on `read-heavy` with `runUntil(endMs, Infinity)` and no sampling. Measure wall time with `performance.now()` around the call.
- Print `eventsProcessed / wallSeconds` and `eventsProcessed / requestsCreated()` (events per request).
- Assert at least **200,000 events/s**.
- **Why 200,000:** each request costs about 11 events, so 10k rps at 1× needs about 110k events/s. The runner's 12/16 ms duty cycle raises that to about 147k, and 200k leaves about 35% headroom.

### Phase 4: Worker and protocol

**Files:** `engine/protocol.ts`, `engine/runner.ts`, `engine/worker.ts`, `tests/engine/runner.test.ts`.

**Protocol.** Every message carries the `runId` of the run it belongs to. The UI ignores any message whose `runId` is stale.

```ts
type UiToWorker =
  | { type: "load"; runId: number; design: Design; scenario: Scenario }
  | { type: "play"; runId: number } | { type: "pause"; runId: number }
  | { type: "reset"; runId: number }
  | { type: "setSpeed"; runId: number; speed: 0.1 | 0.25 | 0.5 | 1 | 2 | 5 }
  | { type: "runToEnd"; runId: number };
type WorkerToUi =
  | { type: "loaded"; runId: number }
  | { type: "snapshot"; runId: number; vt: number; lagging: boolean;
      eventsProcessed: number; buckets: Bucket[]; hops: Hop[] }
  | { type: "done"; runId: number; evaluation: Evaluation }
  | { type: "error"; runId: number; messages: string[] };
```

**Runner.**
```ts
createRunner(
  post: (m: WorkerToUi) => void,
  deps: { now: () => number; setTimeout: (fn: () => void, ms: number) => unknown;
          clearTimeout: (h: unknown) => void } = { now: () => performance.now(), setTimeout, clearTimeout },
): { handle(m: UiToWorker): void }
```

**States:** `idle`, `loaded`, `playing`, `paused`, `fast` and `done`.

| Message | Accepted in | Action |
|---|---|---|
| `load` | any | Discard any existing simulation and run `validate`. If there are errors, post `error` and go to `idle`. Otherwise `build`, post `loaded`, and go to `loaded`. |
| `play` | `loaded`, `paused` | Call `setSampleN` for the current speed. Set the wall-clock baseline to `deps.now()`. Clear the lagging history. Start ticking and go to `playing`. |
| `pause` | `playing`, `fast` | Stop ticking or chunking, and go to `paused`. |
| `setSpeed` | any | Store the speed. If `playing`, call `setSampleN` again. |
| `runToEnd` | `loaded`, `paused`, `playing` | Stop ticking, call `setSampleN(0)`, and go to `fast`. |
| `reset` | any | Discard the simulation and go to `idle`. |
| anything else | any other state | Ignored. |

**Ticking in `playing`.** Every 16 ms, run one tick:
1. `wallElapsed = deps.now() − lastTickWall`, then `lastTickWall = deps.now()`.
2. `target = min(endMs, vt + speed × wallElapsed)`.
3. Call `runUntil(target, 12)` and set `vt` to the value it returns.
4. Record whether that tick **fell short**, meaning the returned value was less than `target`.
5. Set `lagging = true` when 30 or more of the last 60 ticks (about 1 s) fell short.
6. Every 100 ms of wall time, post a `snapshot` containing:
   - `drainBuckets()` and `drainHops()`;
   - the cumulative `eventsProcessed`;
   - `lagging`.

**Running in `fast`.**
- Loop `runUntil(endMs, 50)`, and yield with `deps.setTimeout(…, 0)` between chunks so that `pause` and `reset` are still handled.
- Post a snapshot every 100 ms of wall time.

**Finishing.** In either mode, once `isFinished()` is true:
1. Post a final snapshot.
2. Post `done` with `built.evaluate()`.
3. Go to `done`.

**Errors.** Any exception thrown by the engine is caught. The runner posts `error` with `[String(e)]` and goes to `idle`.

**`worker.ts`:**
- Creates the runner with `createRunner(m => (self as unknown as { postMessage(m: WorkerToUi): void }).postMessage(m))`.
- Wires incoming messages with `self.onmessage = (e: MessageEvent<UiToWorker>) => runner.handle(e.data)`.

**Tests (`runner.test.ts`).** They use a fake `deps` clock and scheduler, and a small `testScenario` design with scripted arrivals.

| Case | Expected |
|---|---|
| `load` an invalid design | `error` with the validation messages; state `idle` |
| `load` → `play` → advance time → `pause` → `play` | Snapshots arrive. No `vt` progress while paused. Progress resumes with no jump at resume. |
| `load` → `runToEnd` → flush the timers | `done` is posted with an evaluation |
| `runToEnd`, then `pause` before it finishes | State `paused`. A later `play` continues to `done`. |
| `reset` during `playing` | No further snapshots |
| `play` while `idle` | Ignored, nothing posted |

### Phase 5: UI

**Files:** `app/main.tsx`, `app/App.tsx`, `app/state.ts`, `app/useSimWorker.ts`, `app/canvas/Canvas.tsx`, `app/canvas/nodeTypes.tsx`, `app/canvas/RequestEdge.tsx`, `app/canvas/designMapping.ts`, `app/panels/Palette.tsx`, `app/panels/Inspector.tsx`, `app/panels/Controls.tsx`, `app/panels/Dashboard.tsx`, `app/panels/EvaluationPanel.tsx`, `app/styles.css`.

**State (`state.ts`, `useReducer`):**

**Shape:**
```ts
{
  design: Design;
  scenario: Scenario;
  status: "editing" | "loading" | "running" | "paused" | "done";
  speed: 0.1 | 0.25 | 0.5 | 1 | 2 | 5;
  buckets: Bucket[];
  hops: (Hop & { receivedAt: number; startAt: number })[];
  evaluation: Evaluation | null;
  errors: string[];
  lagging: boolean;
  eventsProcessed: number;
}
```

**Initial state:**
- `scenario` is `readHeavy`, and `design` is its `starterDesign`.
- Status `editing`, speed 1.
- Everything else is empty, `null` or 0.

**Actions:**

| Action | Effect |
|---|---|
| `addNode` | Adds a node |
| `updateConfig` | Changes a node's config |
| `removeNode` | Removes the node and its edges |
| `moveNode` | Moves a node |
| `addEdge` / `removeEdge` | Adds or removes an edge |
| `setScenario` | Sets the scenario and replaces the design with its starter |
| `setStatus` | Sets the status. Moving to `loading` clears `errors`. |
| `appendSnapshot` | Appends the snapshot's buckets and hops. For each hop, sets `startAt = receivedAt + min(100, (hop.vt − firstHopVtOfThisSnapshot) / speed)`, then prunes hops whose `startAt` is more than 400 ms old. |
| `setEvaluation` | Stores the evaluation |
| `setErrors` | Stores the errors |
| `setSpeed` | Sets the speed |
| `reset` | Clears buckets, hops, evaluation and errors; sets status to `editing` |

**Rules:**
- Design edits are ignored unless `status === "editing"`, and every design edit clears `errors`.
- Cost is computed in the UI as `costPerHour(state.design)`.

**`useSimWorker`.**

```ts
useSimWorker(state: State, dispatch: Dispatch<Action>): {
  play(): void; pause(): void; setSpeed(s: State["speed"]): void; runToEnd(): void; reset(): void;
}
```

**Setup and state:**
- It creates the worker once, with `new Worker(new URL("../engine/worker.ts", import.meta.url), { type: "module" })`.
- It keeps `runIdRef` and `pendingRef: "play" | "runToEnd" | null`.
- It reads `design`, `scenario` and `speed` from `state`.

**Incoming messages** whose `runId` matches `runIdRef` are handled like this. All others are dropped.

| Message | Actions |
|---|---|
| `loaded` | Send `setSpeed`, then the pending intent. Dispatch `setStatus("running")`. Clear `pendingRef`. |
| `snapshot` | `appendSnapshot` |
| `done` | `setEvaluation`, then `setStatus("done")` |
| `error` | `setErrors`, then `setStatus("editing")` |

**UI actions:**

| UI action | Status | Messages sent | New status |
|---|---|---|---|
| Play | editing | `pendingRef = "play"`, then `load` | loading, then running on `loaded` |
| Play | paused | `play` | running |
| Pause | running | `pause` | paused |
| Run to end | editing | `pendingRef = "runToEnd"`, then `load` | loading, then running on `loaded` |
| Run to end | running or paused | `runToEnd` | running |
| Speed change | any | `setSpeed` | unchanged |
| Reset | any status except editing | `reset`, then `runIdRef++` | editing |

**Layout:**
- **Header:**
  - the scenario title;
  - a scenario `<select>`, added in Phase 6 and enabled only while editing;
  - the live cost in $/h (red when over budget) and the budget.
- **Middle row:** Palette on the left, Canvas in the center, Inspector on the right.
- **Below:** Controls and Dashboard, then EvaluationPanel.

**Palette:**
- It has two buttons, **Add Load Balancer** and **Add Cache**. Each is disabled once that node exists.
- New nodes use the ids `lb` and `cache`, the positions in §10, and default configs. The cache defaults to small with TTL 60.
- The `client`, `server-1` and `db` nodes come from the scenario and cannot be deleted.

**Canvas:**
- It is React Flow with custom nodes from `nodeTypes.tsx`. Each node shows its type, tier and instance count.
- During a run, each node also shows two bars from the latest bucket: "workers in use" (`heldUtil`) and "own work" (`serviceUtil`).
- `onConnect` calls `canConnect`. If a reason comes back, it is shown inline for 3 seconds and the edge is not added.
- The Delete key removes the selected `lb` or `cache` node, or the selected edge.

**Inspector:**
- **Server:** a tier `<select>` and an instances `<input type="number">`. On blur, the value is rounded and clamped to the range 1–20.
- **Cache:** a tier `<select>` and a TTL `<select>` with options 10, 60 and 300.
- **Database:** a tier `<select>`.
- **Client and load balancer:** the text "No settings".

**Controls:**
- Buttons: Play, Pause, Run to end and Reset.
- A speed `<select>` with options 0.1×, 0.25×, 0.5×, 1×, 2× and 5×.
- A lagging badge, "Simulation slowed: engine at capacity", shown while `lagging` is true.
- The engine rate measured in the browser: the change in `eventsProcessed` divided by the change in wall time between snapshots.

**Dashboard.** Four Recharts charts, all plotted against `sec`:
1. offered rps vs. ok throughput;
2. p50 and p99 latency, with a reference line at 200 ms;
3. error rate (§8.2);
4. `heldUtil` per node.

**EvaluationPanel.** Shown after `done`. It contains:
- the criteria table (value, limit, pass/fail);
- the bottleneck, with the metric that chose it and both utilizations;
- the rejecting node;
- the hints.

**RequestEdge:**
- The edge path comes from `getBezierPath`, and `BaseEdge` renders it.
- A 50 ms `setInterval` re-renders the edge.
- On each render, the edge draws a 4 px circle for every hop on it where `startAt ≤ now < startAt + 300`. Each circle is keyed by the hop's index in the state array.
- Each circle contains `<animateMotion begin="indefinite" dur="0.3s" fill="freeze" path={edgePath}>`. A ref callback calls `beginElement()` on it when it mounts.
- `back` hops add `keyPoints="1;0" keyTimes="0;1" calcMode="linear"`.
- The circle is green when `ok` and red otherwise.

**`designMapping.ts`.** Converts both ways between `Design` and React Flow nodes and edges, using the edge-id rule in §10.

**Manual checklist.** Record the results in `notes/m1_prediction.md`, under "M1 UI check".
1. The starter design runs, and errors rise during the ramp. The evaluation fails on errorRate, names `server-1` as the bottleneck, and the hint names `server-1`.
2. The reference design runs to the end and passes.
3. An invalid connection is refused, with the `canConnect` reason shown.
4. At 1×, the lagging badge does **not** appear during the plateau. At 5× it may.
5. Pausing during Run to end shows paused, and Play resumes it to done.
6. Reset brings back editing, and nothing from the old run appears afterwards.

### Phase 6: Done-criteria check

1. **Automated suites:** run `npm test`, `npm run test:fidelity` and `npm run bench`. All must pass. In `notes/m1_prediction.md`, record the bench's events/s and events per request.

2. **FPS check:**
   - Run the reference design at 1× in Chrome.
   - During the plateau, record 10 s with DevTools → Performance.
   - The average must be **30 fps or more**, with no lagging badge.
   - Record the fps and the in-browser engine rate shown in Controls.
   - If either target is missed, the plan's fallback applies (a Canvas animation layer, pooled event objects, or weighted requests). This spec must be amended before using it.

3. **Prediction exercise:**
   - Create `scenarios/readHeavyVariant.ts` and add the scenario `<select>`.
   - **Before running it,** write in `notes/m1_prediction.md`, working from the variant's parameters:
     - which node the evaluator will report as the bottleneck when the reference design runs on the variant;
     - which metric will select it (`held` or `service`);
     - the mechanism that causes it.
   - Run it and compare against the **oracle**: the evaluator's `bottleneck.nodeId` and `bottleneck.metric`.
   - **Pass:** the node and the metric match, and the stated mechanism is consistent with the per-node `heldUtil` and `serviceUtil` the run shows.
   - **If it doesn't pass:**
     - The gate answer to "Is the loop teaching me?" is **"not yet"**.
     - Write down the mechanism you missed.
     - Change one variant parameter, recording the old and new values in the notes, and predict again.
     - Run again. M2 does not start until a prediction passes.

4. **Gate review:** in `notes/m1_prediction.md`, answer the plan's three M1 gate questions:
   - Is the loop teaching me?
   - Did the benchmark pass?
   - Has any tooling problem blocked me for more than a week?

## 12. Out of scope for M1

| Item | Comes in |
|---|---|
| Chaos injection and link faults | M2 |
| LB algorithms other than round-robin | M2 |
| CDN | M2 |
| Lessons and MDX | M2 |
| The Predict step | M2 |
| IndexedDB and JSON export | M2 |
| The drill screen | M2 |
| Golden-metric tests | M2 |
| Cost chart and chaos markers on the dashboard | M2 |
| Async message kinds, queues, replication and sharding | M3 |
| Retries, circuit breakers and retry budgets | M4 |

Also not in M1, with no milestone assigned yet:
- more than one server, cache or database node;
- cache or db instances above 1;
- editing the design during a run.

**No user action log.** During a run you can only play, pause, change speed or run to the end. None of these changes the simulation's state, so M1 has no action log, and determinism depends on the seed alone.

## 13. Alternatives considered

The parent plan's §5 covers stack and engine choices. This table covers M1-level choices.

| Decision | Chosen | Rejected and why |
|---|---|---|
| Server waiting model | **Worker held while it waits on downstreams** | An async server that frees the worker while it waits produces no upstream cascades, and cascades are the core lesson. The cost of holding workers is misleading utilization, which the two-metric bottleneck rule (§9) handles. |
| Cache fill and invalidate | **Fire-and-forget state change, using no cache worker** | A cache set that uses a worker adds a second load path into the cache, and M1 doesn't teach that. |
| Arrival process | **Thinning of a non-homogeneous Poisson process** | Drawing exponential gaps at the current rate is biased while the rate ramps. |
| Bottleneck metric | **The furthest-downstream node with `heldUtil` ≥ 0.9; otherwise the highest `serviceUtil`** | `heldUtil` alone blames upstream nodes that are only waiting. `serviceUtil` alone misses an exhausted worker pool in front of a healthy downstream, as in the starter design. Queue length alone misses saturated nodes that have short queues. |
| Runner loop | **`setTimeout` every 16 ms, with a 12 ms engine budget; injectable clock** | `requestAnimationFrame` is not available in workers. A busy loop starves incoming messages. A non-injectable clock would make the state machine untestable. |
| Lagging signal | **Short of target on at least 30 of the last 60 ticks** | A per-tick flag would flip on a single garbage-collection pause and fail the done criterion at random. |
| Request animation | **SVG `animateMotion` started with `beginElement()` when the circle mounts** | `begin` offsets are relative to the document timeline, so they can't schedule an element added later. A Canvas layer would have to stay in sync with pan and zoom, so it is added only if the fps check fails. |
| Animation sampling | **`msg.id % N`** | Random sampling would consume the RNG and break determinism. |
| Metrics aggregation | **1-second virtual buckets** | A sliding window costs more and refreshes no faster than people can read. |
| Percentiles | **Exact sort, nearest rank** | t-digest or HDR histograms add approximation and code. Sorting about 1.2 million values once per run is affordable. |
| Run end | **Fixed at `durationSec + timeout`, with finalize first at that instant** | Tracking outstanding requests gives the same results with more bookkeeping, because any reply after its deadline already counts as a timeout. |
| Prediction exercise | **Predict from the parameters, with a retry procedure** | A blind variant is impossible when there is only one author. Randomized parameters would make the expected answer impossible to check. The pass condition is still a correct prediction, as the parent plan requires. |

## 14. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The engine is too slow for 1× playback at 10k rps | High | A bench floor of 200k events/s (about 35% headroom) plus the in-browser fps check. Fallbacks: pooled event objects, then weighted requests. Either needs a spec amendment. |
| Hints blame the wrong component | High | The two-metric bottleneck rule, plus the starter, guard and synthetic bottleneck tests. |
| The reference design fails the scenario | Medium | The Phase 3 stop-the-line rule: change only the reference design, never the engine. |
| Memory | Low | Record arrays double from 65,536 up to 2²¹ capacity: about 36 MB, and about 53 MB at peak while copying. The ρ=0.9 M/M/1 test pools about 5M latencies × 8 B ≈ 40 MB. Both are acceptable. |
| Garbage-collection pressure from per-event closures | Medium | The bench measures it, and the lagging smoothing absorbs single pauses. Pooled event objects are the first fallback. |
| Timeouts show up a second late on the dashboard | Low | Accepted (§8.2). The evaluator groups by `createdAt` and is unaffected. |
| Design size | Low | Bounded: 5 nodes and at most 20 server instances. |
| Security | Low | Everything runs locally. There are no network calls and no persistence, and the only input is my own design, entered through the UI. |

## 15. Implementation notes (deviations found while building, 2026-11-24)

These are small changes made during the build. None of them changes the design.

**Toolchain:**
- **Node:** the build ran on Node 26.7 (the installed version), not Node 22 LTS.
- **`tsconfig.json`:** adds `skipLibCheck`, `isolatedModules` and `types: ["vite/client"]`. The last one is needed to type the `new URL(..., import.meta.url)` worker import.

**Interface additions:**
- `Links` exposes a `sim` property, so the server's fire-and-forget cache set can read `sim.now`.
- `createClient` takes an `onCreate` callback, which feeds offered rps per second.
- `zipf.ts` exports `zipfCdf` for the CDF test.
- The runner exposes a `state` getter for tests, and posts a snapshot on `pause` so the UI shows the paused virtual time.

**Behavior and text choices:**
- Validation messages fill `{type}` with readable names, for example "load balancer" rather than "loadBalancer".
- Scripted arrivals record `msg = 0` in their `arrive` trace line, because the message id doesn't exist yet when the event is scheduled.

**Test changes:**
- **Deadline test:** it reads the db instance's `dropped` counter directly. With `timeoutMs 500`, `endMs` is 500, so finalize runs before the queued request reaches its start and no bucket exists. The test runs to 2000 ms and checks the counter instead.
- **Yielding:** long runs (fidelity, bench) go through `runToEndYielding`, which yields every ~1 s of wall time. Without it, Vitest's worker RPC times out with an "unhandled error" during runs longer than about 50 s.

**Canvas (React Flow v12):** nodes are kept in local state and updated with `applyNodeChanges`. If React Flow's own measurements are dropped, nodes stay hidden. The view is fitted explicitly once every node is measured.
