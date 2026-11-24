import type { Built } from "../engine/build";
import type { ComponentType, Design, DesignNode, NodeConfig, Scenario } from "../engine/core/types";

/**
 * Runs a long simulation to its end in ~1 s wall-clock slices, yielding between
 * slices so Vitest's worker RPC is not starved during multi-second runs.
 */
export async function runToEndYielding(b: Built): Promise<void> {
  while (!b.isFinished()) {
    b.runUntil(b.endMs, 1000);
    await new Promise((r) => setTimeout(r, 0));
  }
}

const ALL: ComponentType[] = ["client", "loadBalancer", "server", "cache", "database"];

function defaultConfig(type: ComponentType): NodeConfig {
  switch (type) {
    case "client":
      return { type: "client" };
    case "loadBalancer":
      return { type: "loadBalancer" };
    case "server":
      return { type: "server", tier: "small", instances: 1 };
    case "cache":
      return { type: "cache", tier: "small", ttlSeconds: 60 };
    case "database":
      return { type: "database", tier: "medium" };
  }
}

/** Builds a Design from `{id, type, config?}` nodes and `[source, target]` edge pairs. */
export function design(
  nodes: { id: string; type: ComponentType; config?: NodeConfig }[],
  edges: [string, string][],
): Design {
  return {
    version: 1,
    nodes: nodes.map(
      (n): DesignNode => ({ id: n.id, type: n.type, x: 0, y: 0, config: n.config ?? defaultConfig(n.type) }),
    ),
    edges: edges.map(([s, t]) => ({ id: `e-${s}-${t}`, source: s, target: t })),
  };
}

export function testScenario(partial: Partial<Scenario> = {}): Scenario {
  return {
    id: "test",
    title: "test",
    seed: 1,
    durationSec: 1,
    traffic: [{ untilSec: 1, fromRps: 0, toRps: 0 }],
    readRatio: 1,
    keyspace: 1000,
    zipfS: 0,
    client: { timeoutMs: 1000 },
    allowed: ALL,
    budgetPerHour: 100,
    window: { fromSec: 0, toSec: 1e9 },
    criteria: { p99MaxMs: 200, errorRateMax: 0.001 },
    hints: [],
    starterDesign: design([], []),
    referenceDesign: design([], []),
    ...partial,
  };
}
