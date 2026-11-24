import { describe, expect, it } from "vitest";
import type { Design } from "../../engine/core/types";
import { evaluate } from "../../engine/evaluator";
import type { Bucket, NodeStats, Records } from "../../engine/metrics";
import { readHeavy, readHeavyReference } from "../../scenarios/readHeavy";

const zero = (): NodeStats => ({ heldUtil: 0, serviceUtil: 0, queueLength: 0, rejected: 0, dropped: 0 });

function records(rows: [number, number, number][]): Records {
  return {
    n: rows.length,
    createdAt: Float64Array.from(rows.map((r) => r[0])),
    latency: Float64Array.from(rows.map((r) => r[1])),
    outcome: Uint8Array.from(rows.map((r) => r[2])),
  };
}

function buckets(edit: (b: Bucket) => void = () => {}): Bucket[] {
  const out: Bucket[] = [];
  for (let sec = 60; sec < 180; sec++) {
    const b: Bucket = {
      sec,
      offeredRps: 0,
      completedOk: 0,
      errors: { rejected: 0, timeout: 0, downstream: 0 },
      p50Ms: null,
      p99Ms: null,
      nodes: { lb: zero(), "server-1": zero(), cache: zero(), db: zero() },
    };
    edit(b);
    out.push(b);
  }
  return out;
}

const fixtureRecords = () =>
  records([
    ...Array.from({ length: 100 }, (_, i): [number, number, number] => [60_000 + i, i + 1, 0]),
    [60_100, 1, 1],
  ]);

describe("evaluate", () => {
  it("scores the hand-built fixture", () => {
    const e = evaluate(
      fixtureRecords(),
      buckets((b) => {
        if (b.sec === 60) b.nodes.db.rejected = 1;
      }),
      readHeavyReference,
      readHeavy,
    );
    const by = Object.fromEntries(e.criteria.map((c) => [c.name, c]));
    expect(by.p99.value).toBe(99);
    expect(by.p99.passed).toBe(true);
    expect(by.errorRate.value).toBeCloseTo(1 / 101, 12);
    expect(by.errorRate.passed).toBe(false);
    expect(e.rejectingNode).toBe("db");
    expect(e.hints.some((h) => h.startsWith("Requests are failing at db"))).toBe(true);
  });

  it("ignores records outside the window", () => {
    const r = records([
      [59_999, 5000, 1],
      [60_000, 10, 0],
      [180_000, 5000, 1],
    ]);
    const e = evaluate(r, buckets(), readHeavyReference, readHeavy);
    expect(e.criteria.find((c) => c.name === "errorRate")!.value).toBe(0);
  });

  it("fails cost and fills {amount}", () => {
    const pricey: Design = {
      ...readHeavyReference,
      nodes: readHeavyReference.nodes.map((n) =>
        n.id === "server-1"
          ? { ...n, config: { type: "server", tier: "small", instances: 13 } }
          : n.id === "cache"
            ? { ...n, config: { type: "cache", tier: "large", ttlSeconds: 60 } }
            : n,
      ),
    };
    const e = evaluate(fixtureRecords(), buckets(), pricey, readHeavy);
    const cost = e.criteria.find((c) => c.name === "cost")!;
    expect(cost.value).toBe(2.75);
    expect(cost.passed).toBe(false);
    expect(e.hints).toContain(
      "Over budget by $0.25/h. Which component costs the most, and could a cheaper one take load off it?",
    );
  });

  it("handles empty records and no buckets", () => {
    const e = evaluate(records([]), [], readHeavyReference, readHeavy);
    const er = e.criteria.find((c) => c.name === "errorRate")!;
    expect(er.value).toBeNull();
    expect(er.passed).toBe(false);
    expect(e.bottleneck).toBeNull();
  });

  it("renders {util} with a % sign", () => {
    const e = evaluate(
      records([[60_000, 500, 0]]),
      buckets((b) => (b.nodes["server-1"].heldUtil = 0.95)),
      readHeavyReference,
      readHeavy,
    );
    expect(e.hints[0]).toContain("(95% in use)");
  });

  describe("bottleneck rule", () => {
    it("saturated worker pool in front of a healthy db → server, metric held", () => {
      const e = evaluate(
        fixtureRecords(),
        buckets((b) => {
          b.nodes["server-1"].heldUtil = 0.95;
          b.nodes.db.heldUtil = 0.4;
          b.nodes.db.serviceUtil = 0.4;
        }),
        readHeavyReference,
        readHeavy,
      );
      expect(e.bottleneck).toMatchObject({ nodeId: "server-1", metric: "held" });
    });

    it("both saturated → the furthest downstream (db)", () => {
      const e = evaluate(
        fixtureRecords(),
        buckets((b) => {
          b.nodes["server-1"].heldUtil = 0.95;
          b.nodes.db.heldUtil = 0.95;
        }),
        readHeavyReference,
        readHeavy,
      );
      expect(e.bottleneck?.nodeId).toBe("db");
    });

    it("nothing saturated → highest own work, metric service", () => {
      const e = evaluate(
        fixtureRecords(),
        buckets((b) => {
          b.nodes["server-1"].serviceUtil = 0.3;
          b.nodes.db.serviceUtil = 0.5;
          b.nodes.cache.serviceUtil = 0.1;
        }),
        readHeavyReference,
        readHeavy,
      );
      expect(e.bottleneck).toMatchObject({ nodeId: "db", metric: "service" });
    });

    it("ties go downstream", () => {
      const e = evaluate(
        fixtureRecords(),
        buckets((b) => {
          b.nodes["server-1"].serviceUtil = 0.5;
          b.nodes.cache.serviceUtil = 0.5;
        }),
        readHeavyReference,
        readHeavy,
      );
      expect(e.bottleneck?.nodeId).toBe("cache");
    });
  });
});
