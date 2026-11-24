import type { Instance } from "./components/instance";
import type { Scenario } from "./core/types";

export interface Records {
  n: number;
  createdAt: Float64Array;
  latency: Float64Array;
  outcome: Uint8Array; // 0 ok, 1 rejected, 2 timeout, 3 downstream
}

export interface NodeStats {
  heldUtil: number;
  serviceUtil: number;
  queueLength: number;
  rejected: number;
  dropped: number;
  hits?: number;
  misses?: number;
}

export interface Bucket {
  sec: number; // covers [sec, sec+1) of virtual time
  offeredRps: number;
  completedOk: number;
  errors: { rejected: number; timeout: number; downstream: number };
  p50Ms: number | null;
  p99Ms: number | null;
  nodes: Record<string, NodeStats>;
}

/** Nearest-rank percentile of an ascending-sorted array. */
export function percentile(sorted: Float64Array, q: number): number | null {
  const n = sorted.length;
  if (n === 0) return null;
  return sorted[Math.ceil(q * n) - 1];
}

export interface MeteredNode {
  id: string;
  instances: Instance[];
  concurrency: number;
  cacheCounters?: { hits: number; misses: number };
}

interface SecondAcc {
  offered: number;
  completedOk: number;
  rejected: number;
  timeout: number;
  downstream: number;
  okLatencies: number[];
}

const newAcc = (): SecondAcc => ({
  offered: 0,
  completedOk: 0,
  rejected: 0,
  timeout: 0,
  downstream: 0,
  okLatencies: [],
});

/** Collects request records and per-second buckets (§8.1). */
export class MetricsCollector {
  readonly records: Records = {
    n: 0,
    createdAt: new Float64Array(65_536),
    latency: new Float64Array(65_536),
    outcome: new Uint8Array(65_536),
  };
  private accs = new Map<number, SecondAcc>();
  private buckets: Bucket[] = [];
  private drained = 0;
  private lastSec: number;

  constructor(
    private nodes: MeteredNode[],
    private scenario: Scenario,
    endMs: number,
  ) {
    this.lastSec = Number.isFinite(endMs) ? Math.floor(endMs / 1000) - 1 : Infinity;
  }

  private acc(sec: number): SecondAcc {
    let a = this.accs.get(sec);
    if (!a) {
      a = newAcc();
      this.accs.set(sec, a);
    }
    return a;
  }

  onCreate(t: number): void {
    this.acc(Math.floor(t / 1000)).offered++;
  }

  onRecord(createdAt: number, latency: number, outcome: 0 | 1 | 2 | 3, completedAt: number): void {
    const w = this.scenario.window;
    if (createdAt >= w.fromSec * 1000 && createdAt < w.toSec * 1000) this.append(createdAt, latency, outcome);
    const a = this.acc(Math.min(Math.floor(completedAt / 1000), this.lastSec));
    if (outcome === 0) {
      a.completedOk++;
      a.okLatencies.push(latency);
    } else if (outcome === 1) a.rejected++;
    else if (outcome === 2) a.timeout++;
    else a.downstream++;
  }

  private append(createdAt: number, latency: number, outcome: number): void {
    const r = this.records;
    if (r.n === r.createdAt.length) {
      const cap = r.n * 2;
      const c = new Float64Array(cap);
      c.set(r.createdAt);
      const l = new Float64Array(cap);
      l.set(r.latency);
      const o = new Uint8Array(cap);
      o.set(r.outcome);
      r.createdAt = c;
      r.latency = l;
      r.outcome = o;
    }
    r.createdAt[r.n] = createdAt;
    r.latency[r.n] = latency;
    r.outcome[r.n] = outcome;
    r.n++;
  }

  /** Called by the sampler at t = (sec+1) × 1000: closes bucket `sec`. */
  sample(sec: number): void {
    const a = this.accs.get(sec) ?? newAcc();
    this.accs.delete(sec);
    const sorted = Float64Array.from(a.okLatencies).sort();
    const nodes: Record<string, NodeStats> = {};
    for (const node of this.nodes) {
      let held = 0;
      let service = 0;
      let queueLength = 0;
      let rejected = 0;
      let dropped = 0;
      for (const inst of node.instances) {
        inst.flush();
        held += inst.heldArea;
        service += inst.serviceArea;
        queueLength += inst.queue.length;
        rejected += inst.rejected;
        dropped += inst.dropped;
        inst.heldArea = 0;
        inst.serviceArea = 0;
        inst.rejected = 0;
        inst.dropped = 0;
      }
      const cap = node.concurrency * node.instances.length * 1000;
      const stats: NodeStats = {
        heldUtil: cap > 0 ? held / cap : 0,
        serviceUtil: cap > 0 ? service / cap : 0,
        queueLength,
        rejected,
        dropped,
      };
      if (node.cacheCounters) {
        stats.hits = node.cacheCounters.hits;
        stats.misses = node.cacheCounters.misses;
        node.cacheCounters.hits = 0;
        node.cacheCounters.misses = 0;
      }
      nodes[node.id] = stats;
    }
    this.buckets.push({
      sec,
      offeredRps: a.offered,
      completedOk: a.completedOk,
      errors: { rejected: a.rejected, timeout: a.timeout, downstream: a.downstream },
      p50Ms: percentile(sorted, 0.5),
      p99Ms: percentile(sorted, 0.99),
      nodes,
    });
  }

  drainBuckets(): Bucket[] {
    const out = this.buckets.slice(this.drained);
    this.drained = this.buckets.length;
    return out;
  }

  allBuckets(): Bucket[] {
    return this.buckets;
  }
}
