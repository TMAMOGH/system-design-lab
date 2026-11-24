# M1 notes: results, prediction and gate

## Automated suites

| Suite | Result | Notes |
|---|---|---|
| `npm test` | 53/53 pass (2026-11-24) | |
| `npm run test:fidelity` | 9/9 pass | M/M/1 ρ=0.9: mean 9.76 ms (exp. 10.00), p99 45.4 ms (exp. 46.05). Reference p99 ≈ 54 ms, 0 errors, $2.00/h. |
| `npm run bench` | pass | 549,289 events/s, 11.09 events/request (Node 26) |

## FPS check (Chrome, reference design at 1×, plateau, 10 s recording)

- Average fps:
- In-browser engine rate (Controls):
- Lagging badge appeared at 1×? (must be no)

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

1. Starter design fails on errorRate, names `server-1` as bottleneck and in the hint:
2. Reference design runs to the end and passes:
3. Invalid connections refused with a reason:
4. No lagging badge at 1× on the plateau (may appear at 5×):
5. Pause during Run to end → paused; Play resumes to done:
6. Reset restores editing; nothing from the old run appears:

## Gate review

- Is the loop teaching me?
- Did the benchmark pass?
- Has any tooling problem blocked me for more than a week?
- Decision: go to M2 / weighted requests / switch to C1
