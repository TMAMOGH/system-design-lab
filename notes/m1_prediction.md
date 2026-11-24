# M1 notes: results, prediction and gate

## Automated suites

| Suite | Result | Notes |
|---|---|---|
| `npm test` | 53/53 pass (2026-11-24) | |
| `npm run test:fidelity` | 9/9 pass | M/M/1 ρ=0.9: mean 9.76 ms (exp. 10.00), p99 45.4 ms (exp. 46.05). Reference p99 ≈ 54 ms, 0 errors, $2.00/h. |
| `npm run bench` | pass | 549,289 events/s, 11.09 events/request (Node 26) |

## FPS check (Chrome, reference design at 1×, plateau, 10 s recording)

- Average fps: **still to measure in real Chrome.** The Claude browser pane was hidden during the run, which throttles `requestAnimationFrame` to about 1 fps, so the reading taken there is not valid.
- In-browser engine rate (Controls): 96k–133k events/s on the plateau (Claude browser pane, 2026-11-24)
- Lagging badge appeared at 1×? **No.** Plateau playback held 1.000× virtual time per wall-clock second (t = 60 → 86 s).

## Prediction exercise: "Scale a write-heavier app"

**Write this section BEFORE running the variant.** Predict from its parameters (70% reads, Zipf s = 0.7 over 1,000,000 keys, $3.00/h budget), running the *reference design* unchanged.

- Bottleneck node the evaluator will report:
- Metric that will select it (`held` or `service`):
- First second in which some node's own work exceeds 95%, and which node:
- Mechanism (why):

**After running:**

- Evaluator's `bottleneck.nodeId` / `metric`:
- Pass? (node and metric match, and the mechanism agrees with the per-node utilization)
- If not: mechanism I missed, the one parameter I changed (old → new), and the retry result:

## M1 UI check

Checked by Claude in the browser pane on 2026-11-24.

1. Starter design fails on errorRate, names `server-1` as bottleneck and in the hint: **pass.** Error rate 88.6%, p99 116 ms. Bottleneck `server-1`, chosen by workers in use (100% in use, 14% own work). The hint names `server-1`.
2. Reference design runs to the end and passes: **pass.** p99 54.3 ms, 0.00% errors, $2.00/h. Bottleneck `db`, chosen by own work (61%).
3. Invalid connections refused with a reason: **pass.** Client → database shows "A client cannot send requests to a database."
4. No lagging badge at 1× on the plateau (may appear at 5×): **pass** (see the FPS section). The fps figure is still pending.
5. Pause during Run to end → paused; Play resumes to done: **pass.** Time stayed frozen at t = 104 s while paused, then the run resumed and finished.
6. Reset restores editing; nothing from the old run appears: **pass.** Reset both after `done` and mid-run; the dashboard stayed empty and the design was kept.

Also checked:
- Validation errors are listed on Play when the design is incomplete.
- Edges can be deleted.
- An instances value of 25 is clamped to 20.
- Cost updates live as the design changes.

## Gate review

- Is the loop teaching me?
- Did the benchmark pass?
- Has any tooling problem blocked me for more than a week?
- Decision: go to M2 / weighted requests / switch to C1
