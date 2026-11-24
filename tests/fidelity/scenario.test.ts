import { describe, expect, it } from "vitest";
import { build } from "../../engine/build";
import type { Design, NodeConfig, Scenario } from "../../engine/core/types";
import type { Evaluation } from "../../engine/evaluator";
import { readHeavy, readHeavyReference, readHeavyStarter } from "../../scenarios/readHeavy";
import { runToEndYielding } from "../fixtures";

async function run(d: Design, s: Scenario, seed?: number): Promise<Evaluation> {
  const b = build(d, s, seed === undefined ? {} : { seed });
  await runToEndYielding(b);
  return b.evaluate();
}

const short: Scenario = { ...readHeavy, durationSec: 70, window: { fromSec: 60, toSec: 70 } };

const withConfig = (d: Design, id: string, config: NodeConfig): Design => ({
  ...d,
  nodes: d.nodes.map((n) => (n.id === id ? { ...n, config } : n)),
});

const crit = (e: Evaluation, name: string) => e.criteria.find((c) => c.name === name)!;

describe("read-heavy scenario", () => {
  for (const seed of [1, 2, 3]) {
    it(`reference design passes (seed ${seed})`, { timeout: 300_000 }, async () => {
      const e = await run(readHeavyReference, readHeavy, seed);
      console.log(`seed ${seed}:`, JSON.stringify(e.criteria), JSON.stringify(e.bottleneck));
      expect(e.passed).toBe(true);
    });
  }

  it("starter design fails errorRate and blames server-1 (held)", { timeout: 300_000 }, async () => {
    const e = await run(readHeavyStarter, short);
    console.log("starter:", JSON.stringify(e.criteria), JSON.stringify(e.bottleneck), e.hints);
    expect(crit(e, "errorRate").passed).toBe(false);
    expect(e.bottleneck).toMatchObject({ nodeId: "server-1", metric: "held" });
  });

  it("misattribution guard: a saturated db behind plenty of servers is blamed", { timeout: 300_000 }, async () => {
    let d = withConfig(readHeavyReference, "db", { type: "database", tier: "medium" });
    d = withConfig(d, "server-1", { type: "server", tier: "small", instances: 16 });
    const e = await run(d, short);
    console.log("guard:", JSON.stringify(e.bottleneck));
    expect(e.bottleneck?.nodeId).toBe("db");
  });

  it("no-cache design fails cost", { timeout: 300_000 }, async () => {
    const d: Design = {
      version: 1,
      nodes: readHeavyReference.nodes
        .filter((n) => n.id !== "cache")
        .map((n) =>
          n.id === "server-1"
            ? { ...n, config: { type: "server", tier: "small", instances: 12 } }
            : n.id === "db"
              ? { ...n, config: { type: "database", tier: "xlarge" } }
              : n,
        ),
      edges: readHeavyReference.edges.filter((e) => e.target !== "cache"),
    };
    const e = await run(d, short);
    expect(crit(e, "cost").value).toBe(3.75);
    expect(crit(e, "cost").passed).toBe(false);
  });
});
