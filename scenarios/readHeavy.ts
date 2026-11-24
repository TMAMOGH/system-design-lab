import type { ComponentType, Design, Scenario } from "../engine/core/types";

export const POSITIONS: Record<string, { x: number; y: number }> = {
  client: { x: 0, y: 200 },
  lb: { x: 200, y: 200 },
  "server-1": { x: 400, y: 200 },
  cache: { x: 650, y: 100 },
  db: { x: 650, y: 300 },
};

const ALL: ComponentType[] = ["client", "loadBalancer", "server", "cache", "database"];
const edge = (source: string, target: string) => ({ id: `e-${source}-${target}`, source, target });

export const readHeavyStarter: Design = {
  version: 1,
  nodes: [
    { id: "client", type: "client", ...POSITIONS.client, config: { type: "client" } },
    { id: "server-1", type: "server", ...POSITIONS["server-1"], config: { type: "server", tier: "small", instances: 1 } },
    { id: "db", type: "database", ...POSITIONS.db, config: { type: "database", tier: "medium" } },
  ],
  edges: [edge("client", "server-1"), edge("server-1", "db")],
};

export const readHeavyReference: Design = {
  version: 1,
  nodes: [
    { id: "client", type: "client", ...POSITIONS.client, config: { type: "client" } },
    { id: "lb", type: "loadBalancer", ...POSITIONS.lb, config: { type: "loadBalancer" } },
    { id: "server-1", type: "server", ...POSITIONS["server-1"], config: { type: "server", tier: "small", instances: 8 } },
    { id: "cache", type: "cache", ...POSITIONS.cache, config: { type: "cache", tier: "medium", ttlSeconds: 60 } },
    { id: "db", type: "database", ...POSITIONS.db, config: { type: "database", tier: "large" } },
  ],
  edges: [edge("client", "lb"), edge("lb", "server-1"), edge("server-1", "cache"), edge("server-1", "db")],
};

export const readHeavy: Scenario = {
  id: "read-heavy",
  title: "Scale a read-heavy app",
  seed: 1,
  durationSec: 180,
  traffic: [
    { untilSec: 60, fromRps: 1000, toRps: 10000 },
    { untilSec: 180, fromRps: 10000, toRps: 10000 },
  ],
  readRatio: 0.9,
  keyspace: 100_000,
  zipfS: 1.0,
  client: { timeoutMs: 1000 },
  allowed: ALL,
  budgetPerHour: 2.5,
  window: { fromSec: 60, toSec: 180 },
  criteria: { p99MaxMs: 200, errorRateMax: 0.001 },
  hints: [
    {
      criterion: "p99",
      bottleneck: "database",
      text: "The database is the bottleneck ({util} of its workers busy). Reduce the reads that reach it, or give it more capacity — which is cheaper?",
    },
    {
      criterion: "p99",
      bottleneck: "server",
      text: "The server is out of workers ({util} in use). Add instances behind a load balancer, or move to a bigger tier.",
    },
    {
      criterion: "p99",
      text: "Latency is too high. Look for the component whose workers are closest to 100% in use.",
    },
    {
      criterion: "errorRate",
      text: "Requests are failing at {component}: its queue is full or work waits past its deadline. Add capacity there, or reduce the load reaching it.",
    },
    {
      criterion: "cost",
      text: "Over budget by ${amount}/h. Which component costs the most, and could a cheaper one take load off it?",
    },
  ],
  starterDesign: readHeavyStarter,
  referenceDesign: readHeavyReference,
};
