import { costPerHour } from "./catalog";
import type { ComponentType, Design, Scenario } from "./core/types";
import { percentile, type Bucket, type Records } from "./metrics";

export interface Evaluation {
  passed: boolean;
  criteria: { name: "p99" | "errorRate" | "cost"; value: number | null; limit: number; passed: boolean }[];
  bottleneck: {
    nodeId: string;
    type: ComponentType;
    metric: "held" | "service";
    serviceUtil: number;
    heldUtil: number;
  } | null;
  rejectingNode: string | null;
  hints: string[];
}

/** Lower index = further downstream. */
const DOWNSTREAM: ComponentType[] = ["database", "cache", "server", "loadBalancer"];
const SATURATED = 0.9;

/** Scores a finished run against the scenario (§9). */
export function evaluate(records: Records, buckets: Bucket[], design: Design, scenario: Scenario): Evaluation {
  const fromMs = scenario.window.fromSec * 1000;
  const toMs = scenario.window.toSec * 1000;

  // Criteria from records in the window.
  let n = 0;
  let errors = 0;
  const ok: number[] = [];
  for (let i = 0; i < records.n; i++) {
    const c = records.createdAt[i];
    if (c < fromMs || c >= toMs) continue;
    n++;
    if (records.outcome[i] === 0) ok.push(records.latency[i]);
    else errors++;
  }
  const p99 = percentile(Float64Array.from(ok).sort(), 0.99);
  const errorRate = n > 0 ? errors / n : null;
  const cost = costPerHour(design);
  const criteria: Evaluation["criteria"] = [
    { name: "p99", value: p99, limit: scenario.criteria.p99MaxMs, passed: p99 !== null && p99 < scenario.criteria.p99MaxMs },
    {
      name: "errorRate",
      value: errorRate,
      limit: scenario.criteria.errorRateMax,
      passed: errorRate !== null && errorRate < scenario.criteria.errorRateMax,
    },
    { name: "cost", value: cost, limit: scenario.budgetPerHour, passed: cost <= scenario.budgetPerHour },
  ];

  // Per-node window means.
  const inWindow = buckets.filter((b) => b.sec >= scenario.window.fromSec && b.sec < scenario.window.toSec);
  const nodes = design.nodes
    .filter((d) => d.type !== "client")
    .map((d) => {
      let held = 0;
      let service = 0;
      let failed = 0;
      for (const b of inWindow) {
        const s = b.nodes[d.id];
        if (!s) continue;
        held += s.heldUtil;
        service += s.serviceUtil;
        failed += s.rejected + s.dropped;
      }
      const k = inWindow.length || 1;
      return { id: d.id, type: d.type, heldUtil: held / k, serviceUtil: service / k, failed };
    })
    .sort((a, b) => DOWNSTREAM.indexOf(a.type) - DOWNSTREAM.indexOf(b.type));

  // Bottleneck: furthest-downstream saturated node, else highest own work.
  let bottleneck: Evaluation["bottleneck"] = null;
  if (inWindow.length > 0 && nodes.length > 0) {
    const saturated = nodes.find((x) => x.heldUtil >= SATURATED);
    if (saturated) {
      bottleneck = { nodeId: saturated.id, type: saturated.type, metric: "held", serviceUtil: saturated.serviceUtil, heldUtil: saturated.heldUtil };
    } else {
      let best = nodes[0];
      for (const x of nodes) if (x.serviceUtil > best.serviceUtil) best = x; // strict > keeps the downstream tie-break
      bottleneck = { nodeId: best.id, type: best.type, metric: "service", serviceUtil: best.serviceUtil, heldUtil: best.heldUtil };
    }
  }

  // Rejecting node: most rejected + dropped, ties downstream.
  let rejectingNode: string | null = null;
  let most = 0;
  for (const x of nodes) {
    if (x.failed > most) {
      most = x.failed;
      rejectingNode = x.id;
    }
  }

  // Hints.
  const util = bottleneck
    ? Math.round((bottleneck.metric === "held" ? bottleneck.heldUtil : bottleneck.serviceUtil) * 100) + "%"
    : "n/a";
  const hints: string[] = [];
  for (const c of criteria) {
    if (c.passed) continue;
    const rule = scenario.hints.find(
      (h) => h.criterion === c.name && (h.bottleneck === undefined || h.bottleneck === bottleneck?.type),
    );
    if (!rule) continue;
    const component =
      (c.name === "errorRate" ? rejectingNode : null) ?? bottleneck?.nodeId ?? "the system";
    const amount = c.name === "cost" ? (cost - scenario.budgetPerHour).toFixed(2) : "";
    hints.push(rule.text.split("{component}").join(component).split("{util}").join(util).split("{amount}").join(amount));
  }

  return { passed: criteria.every((c) => c.passed), criteria, bottleneck, rejectingNode, hints };
}
