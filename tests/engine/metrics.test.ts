import { describe, expect, it } from "vitest";
import { build } from "../../engine/build";
import { percentile } from "../../engine/metrics";
import { design, testScenario } from "../fixtures";

describe("metrics", () => {
  it("flushes held time across a bucket boundary", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "db", type: "database" },
      ],
      [["client", "db"]],
    );
    const b = build(d, testScenario({ client: { timeoutMs: 3000 } }), {
      arrivals: [{ tMs: 500, key: 1, op: "read" }],
      override: { db: { concurrency: 2, serviceMeanMs: 1500, fixedService: true } },
    });
    b.runUntil(b.endMs, Infinity);
    const sec1 = b.allBuckets().find((k) => k.sec === 1)!;
    expect(sec1.nodes["db"].heldUtil).toBeCloseTo(0.5, 9);
  });

  it("a server waiting on a slow db shows held time well above its own work", () => {
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
      arrivals: [0, 200, 400, 600, 800].map((tMs) => ({ tMs, key: 1, op: "read" as const })),
      override: { db: { serviceMeanMs: 100, fixedService: true } },
    });
    b.runUntil(b.endMs, Infinity);
    const s = b.allBuckets()[0].nodes["server-1"];
    expect(s.heldUtil).toBeGreaterThan(2 * s.serviceUtil);
  });

  it("nearest-rank percentile", () => {
    const a = Float64Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(a, 0.99)).toBe(99);
    expect(percentile(Float64Array.of(5), 0.99)).toBe(5);
    expect(percentile(new Float64Array(0), 0.99)).toBeNull();
  });
});
