import { describe, expect, it } from "vitest";
import { build } from "../../engine/build";
import { LruTtlStore } from "../../engine/components/cache";
import type { Op, TraceMeta } from "../../engine/core/types";
import { design, testScenario } from "../fixtures";

const reads = (...ts: number[]) => ts.map((tMs) => ({ tMs, key: 1, op: "read" as Op }));
const runAll = (b: ReturnType<typeof build>) => b.runUntil(b.endMs, Infinity);
const outcomes = (b: ReturnType<typeof build>) => Array.from(b.records().outcome.slice(0, b.records().n));
const sumNode = (b: ReturnType<typeof build>, id: string, f: "hits" | "misses" | "rejected" | "dropped") =>
  b.allBuckets().reduce((s, k) => s + (k.nodes[id]?.[f] ?? 0), 0);

describe("components", () => {
  it("queue limit: 1 rejected immediately, the other 2 complete in order", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "db", type: "database" },
      ],
      [["client", "db"]],
    );
    const b = build(d, testScenario(), {
      arrivals: reads(0, 0, 0),
      override: { db: { concurrency: 1, queueLimit: 1 } },
    });
    runAll(b);
    const r = b.records();
    expect(outcomes(b)).toEqual([1, 0, 0]);
    expect(r.latency[0]).toBeCloseTo(1.0, 6); // two link hops, no service
    expect(r.latency[2]).toBeGreaterThan(r.latency[1]);
  });

  it("deadline: both time out and the queued one is dropped at start", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "db", type: "database" },
      ],
      [["client", "db"]],
    );
    const b = build(d, testScenario({ client: { timeoutMs: 500 } }), {
      arrivals: reads(0, 0),
      override: { db: { concurrency: 1, queueLimit: 10, serviceMeanMs: 600, fixedService: true } },
    });
    // Run past endMs so the queued request reaches its start and is dropped.
    b.runUntil(2000, Infinity);
    expect(outcomes(b)).toEqual([2, 2]);
    expect(b.instances("db")[0].dropped).toBe(1);
  });

  it("round robin: 300 requests split exactly 100 per instance, in rotation", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "lb", type: "loadBalancer" },
        { id: "server-1", type: "server", config: { type: "server", tier: "small", instances: 3 } },
        { id: "db", type: "database" },
      ],
      [
        ["client", "lb"],
        ["lb", "server-1"],
        ["server-1", "db"],
      ],
    );
    const accepts: string[] = [];
    const b = build(d, testScenario(), {
      arrivals: reads(...Array.from({ length: 300 }, (_, i) => i)),
      onEvent: (_t, _s, m: TraceMeta) => {
        if (m.type === "accept" && m.node.startsWith("server-1#")) accepts.push(m.node);
      },
    });
    runAll(b);
    expect(b.instances("server-1").map((i) => i.accepted)).toEqual([100, 100, 100]);
    expect(accepts.slice(0, 3)).toEqual(["server-1#0", "server-1#1", "server-1#2"]);
  });

  it("write invalidation: hit after fill, miss after write", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "server-1", type: "server" },
        { id: "cache", type: "cache" },
        { id: "db", type: "database" },
      ],
      [
        ["client", "server-1"],
        ["server-1", "cache"],
        ["server-1", "db"],
      ],
    );
    const b = build(d, testScenario(), {
      arrivals: [
        { tMs: 0, key: 5, op: "read" },
        { tMs: 100, key: 5, op: "read" },
        { tMs: 200, key: 5, op: "write" },
        { tMs: 300, key: 5, op: "read" },
      ],
      override: { db: { serviceMeanMs: 20, fixedService: true } },
    });
    runAll(b);
    expect(sumNode(b, "cache", "hits")).toBe(1);
    expect(sumNode(b, "cache", "misses")).toBe(2);
  });

  it("cache error fallback: all reads succeed through the db, no NaN", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "server-1", type: "server" },
        { id: "cache", type: "cache" },
        { id: "db", type: "database" },
      ],
      [
        ["client", "server-1"],
        ["server-1", "cache"],
        ["server-1", "db"],
      ],
    );
    const b = build(d, testScenario(), {
      arrivals: reads(0, 1, 2, 3, 4, 5, 6, 7, 8, 9),
      override: { cache: { concurrency: 0, queueLimit: 0 } },
    });
    runAll(b);
    expect(outcomes(b)).toEqual(new Array(10).fill(0));
    const cacheUtil = b.allBuckets()[0].nodes["cache"].serviceUtil;
    expect(cacheUtil).toBe(0);
  });

  it("held worker: the second request waits for the first's downstream call", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "server-1", type: "server" },
        { id: "db", type: "database" },
      ],
      [
        ["client", "server-1"],
        ["server-1", "db"],
      ],
    );
    const b = build(d, testScenario(), {
      arrivals: reads(0, 0),
      override: { "server-1": { concurrency: 1 }, db: { serviceMeanMs: 100, fixedService: true } },
    });
    runAll(b);
    const r = b.records();
    expect(r.n).toBe(2);
    expect(Math.max(r.latency[0], r.latency[1])).toBeGreaterThanOrEqual(200);
  });
});

describe("LruTtlStore", () => {
  it("evicts the least recently used key", () => {
    const s = new LruTtlStore(2, 1e9);
    s.set(1, 0);
    s.set(2, 0);
    expect(s.get(1, 0)).toBe(true);
    s.set(3, 0);
    expect(s.get(2, 0)).toBe(false);
    expect(s.get(1, 0)).toBe(true);
  });

  it("expires entries after the TTL", () => {
    const s = new LruTtlStore(10, 10_000);
    s.set(7, 0);
    expect(s.get(7, 9999)).toBe(true);
    expect(s.get(7, 10001)).toBe(false);
  });
});
