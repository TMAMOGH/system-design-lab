# Decision log

The decisions that shaped the project, with the reason and where each one came from. Newest information goes in the tables below; do not rewrite history. If a decision is reversed, add a new row and mark the old one **Superseded**.

**Last updated:** 2026-11-24

**Status values:** **Decided** · **Provisional** (decided, but will be reviewed at a named point) · **Superseded** · **Open** (not decided yet).

## Decided

| # | Decision | Why | Decided by | Status |
|---|---|---|---|---|
| D1 | **This is a personal learning project.** No accounts, no backend, no hosting for others, no monetization. | Cuts a large share of scope. Building the simulator is itself part of the learning. | You, in the first plan review | Decided |
| D2 | **Stack A:** TypeScript, React (Vite), React Flow, Recharts, engine in a Web Worker. | One language, no server, works offline, best canvas library. | You ("go with A for now") | **Provisional.** Reviewed at the M1 gate. |
| D3 | **Fallback stack C1** (Python SimPy engine + FastAPI on localhost + React) is only for UI or tooling productivity problems. | C1 would not fix an engine speed problem, because SimPy on CPython is slower per event than V8. | Plan review, round 2 | Decided |
| D4 | **Everything runs locally.** Internet is needed only for Docker image pulls (labs) and the Claude chat used for design review. | Follows from D1. | Plan | Decided |
| D5 | **Build the engine yourself** instead of using a simulation library. | Building it is the learning goal. | Plan | Decided |
| D6 | **One per-request discrete-event engine.** No "rate mode" above a request-rate threshold. If the engine is too slow, playback slows down. If the benchmark fails, the fallback is **weighted requests** (one simulated request stands for k real ones). | A rate mode cannot produce p99 or per-key state, and is weakest exactly where failures cascade. | Plan review, round 2 | Decided |
| D7 | **Servers hold a worker while waiting on downstream calls.** | It is what makes a slow database back up into the servers, which is the core lesson. | M1 spec review, round 1 | Decided |
| D8 | **Two utilization numbers per node** (`heldUtil`, `serviceUtil`) and a **bottleneck rule** that picks the furthest-downstream node with `heldUtil` ≥ 0.9, else the highest `serviceUtil`. | Either number alone blames the wrong node in some case: `heldUtil` blames waiting servers; `serviceUtil` misses an exhausted worker pool. | M1 spec review, rounds 1 and 2 | Decided |
| D9 | **Scenarios are typed TypeScript files.** No JSON schema, no stored replays, no `engineVersion`. | One author. TypeScript already checks the shape at compile time. | Plan review, round 2 | Decided |
| D10 | **AI design review is a copy-paste flow:** export the design, paste it with a saved prompt into Claude. No in-app reviewer or proxy. Due in M6. | No API key to protect, no token budget, no code. | Plan review, round 2 | Decided |
| D11 | **An interview-practice track runs in parallel from week 1:** one timed 45-minute capstone every two weeks, self-scored on the rubric. | The classic interview questions need no simulator, so they should not wait for it. | Plan review, round 2 | Decided |
| D12 | **Benchmark floor: 200,000 events/s.** | A request costs about 11 events, so 1× playback at 10k requests/s needs about 147k events/s once the runner's duty cycle is included. | M1 spec review, round 2 | Decided (met: 549k) |
| D13 | **M1 is done only on a *correct* prediction** of the variant's bottleneck, made from its parameters. A wrong one means "the loop is not teaching yet": change one parameter, predict again. | Keeps the plan's requirement. A truly blind variant is impossible with one author. | M1 spec review, round 2 | Decided |
| D14 | **Vitest stays on 3.x** despite `npm audit` advisories. | The advisories affect only the local test runner. The fix is a breaking major upgrade. | Spec; noted at build | Decided. Revisit when Vite is upgraded. |
| D15 | **M1 was built on Node 26.7**, not the Node 22 LTS the spec names. | It is what is installed. Everything passes. | Build | Decided. Recorded in `m1_spec.md` §15. |
| D16 | **Repository:** private, `TMAMOGH/system-design-lab`, branch `main`. | — | You | Decided |
| D17 | **Review process:** each spec goes through the Goldfish loop with three reviewers (implementation readiness, design critic, zoom-out). The plan and the M1 spec each ran for **2 rounds** and were then accepted. | The loop's formal end is two clean rounds in a row. You chose to proceed after two rounds while findings were shrinking. | You | Decided |
| D18 | **Documentation is kept current as work proceeds** (this folder). | You asked for it on 2026-11-24. | You | Decided |

## Open

| # | Question | Where it came from | Needed before |
|---|---|---|---|
| O1 | **Does stack A stay?** | M1 gate | Starting M2 |
| O2 | **Is the learning loop working?** (prediction exercise on the variant scenario, plus the gate questions) | M1 gate | Starting M2 |
| O3 | **M2: defer `partition` and `loss` chaos to M4?** Proposed: keep only `crash`, `latency`, `cacheFlush` and `surge` in M2. | M2 review, Issue 2 | Applying M2 review fixes |
| O4 | **M2: how does the "Break" step work?** Proposed: each module names a required chaos type, and the step is done once you have injected it, whether or not your design survives. | M2 review, Issue 3 | Applying M2 review fixes |
| O5 | **M2: keep the dropped cost chart dropped?** The plan's M2 row included one, but cost is constant within a run. Dropped in the draft spec; you have not confirmed it. | `m2_spec.md` §13, §15 | Finishing the M2 spec |
| O6 | **M2: three scenarios have shaky numbers** (`s2-stampede`, `s2-ttl`, `s2-write-policy`). The review proposes a prototype step and adjusted thresholds. | M2 review, Issues 4–6 | Writing M2 content |

## How to add an entry

1. Add a row to **Decided** with the next `D` number, or to **Open** with the next `O` number.
2. When an open question is settled, move it to Decided and say who decided.
3. If a decision is reversed, keep the old row, mark it **Superseded**, and link the new one.
4. Link the review issue or document the decision came from.
