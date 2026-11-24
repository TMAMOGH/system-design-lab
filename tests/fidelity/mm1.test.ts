import { describe, expect, it } from "vitest";
import { build } from "../../engine/build";
import { percentile } from "../../engine/metrics";
import { design, runToEndYielding, testScenario } from "../fixtures";

const MU = 1; // service rate per ms (mean service 1 ms → 1000/s)
const WARMUP = 50_000;

async function runSeed(rho: number, customers: number, seed: number): Promise<{ mean: number; latencies: Float64Array }> {
  const lambdaRps = rho * 1000;
  const durationSec = (customers + WARMUP) / lambdaRps;
  const scenario = testScenario({
    durationSec,
    traffic: [{ untilSec: durationSec, fromRps: lambdaRps, toRps: lambdaRps }],
    readRatio: 1,
    client: { timeoutMs: Infinity },
    window: { fromSec: 0, toSec: durationSec },
  });
  const d = design(
    [
      { id: "client", type: "client" },
      { id: "db", type: "database" },
    ],
    [["client", "db"]],
  );
  const b = build(d, scenario, {
    seed,
    linkLatencyMs: 0,
    override: { db: { concurrency: 1, queueLimit: Infinity, serviceMeanMs: 1 } },
  });
  await runToEndYielding(b);
  const r = b.records();
  // Order by createdAt (FIFO single server already completes in arrival order).
  const idx = Array.from({ length: r.n }, (_, i) => i).sort((a, c) => r.createdAt[a] - r.createdAt[c]);
  const kept = idx.slice(WARMUP);
  const latencies = new Float64Array(kept.length);
  let sum = 0;
  kept.forEach((i, k) => {
    latencies[k] = r.latency[i];
    sum += r.latency[i];
  });
  return { mean: sum / kept.length, latencies };
}

describe("M/M/1 fidelity", () => {
  for (const [rho, customers] of [
    [0.5, 200_000],
    [0.8, 500_000],
    [0.9, 1_000_000],
  ] as const) {
    it(`ρ = ${rho}: mean within 10%, p99 within 15%`, { timeout: 300_000 }, async () => {
      const lambda = rho * MU;
      const runs = [];
      for (const s of [1, 2, 3, 4, 5]) runs.push(await runSeed(rho, customers, s));
      const mean = runs.reduce((s, r) => s + r.mean, 0) / runs.length;
      const pooled = new Float64Array(runs.reduce((s, r) => s + r.latencies.length, 0));
      let off = 0;
      for (const r of runs) {
        pooled.set(r.latencies, off);
        off += r.latencies.length;
      }
      pooled.sort();
      const p99 = percentile(pooled, 0.99)!;
      const expMean = 1 / (MU - lambda);
      const expP99 = Math.log(100) / (MU - lambda);
      console.log(`ρ=${rho}: mean ${mean.toFixed(3)} (expected ${expMean.toFixed(3)}), p99 ${p99.toFixed(3)} (expected ${expP99.toFixed(3)})`);
      expect(Math.abs(mean - expMean) / expMean).toBeLessThan(0.1);
      expect(Math.abs(p99 - expP99) / expP99).toBeLessThan(0.15);
    });
  }
});
