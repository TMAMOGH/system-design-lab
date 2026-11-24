// Domain model for the M1 engine. All times are virtual milliseconds (float64).

export type ComponentType = "client" | "loadBalancer" | "server" | "cache" | "database";
export type Op = "read" | "write";
export type MessageKind = "request"; // open set; M3 adds "message" | "event" | "push"

export interface Message {
  id: number; // sequential, starts at 1, assigned by the client
  kind: MessageKind;
  key: number; // 0 .. keyspace-1
  op: Op;
  size: number; // bytes; always 1024; unused in M1, kept to match the parent plan's message shape (first used in M3)
  createdAt: number; // virtual ms
  deadline: number; // createdAt + scenario.client.timeoutMs
}

export type ErrorKind = "rejected" | "timeout" | "downstream";
export interface Response {
  ok: boolean;
  error?: ErrorKind;
  hit?: boolean;
}
export interface Hop {
  edgeId: string;
  dir: "fwd" | "back";
  ok: boolean;
  vt: number;
}
export type TraceType =
  | "arrive"
  | "accept"
  | "serviceDone"
  | "reply"
  | "cacheSet"
  | "cacheInvalidate"
  | "sample"
  | "end";
export interface TraceMeta {
  type: TraceType;
  node: string;
  msg: number;
}

export type NodeConfig =
  | { type: "client" }
  | { type: "loadBalancer" }
  | { type: "server"; tier: "small" | "medium"; instances: number } // integer 1..20
  | { type: "cache"; tier: "small" | "medium" | "large"; ttlSeconds: 10 | 60 | 300 }
  | { type: "database"; tier: "medium" | "large" | "xlarge" };

export interface DesignNode {
  id: string; // "client" | "lb" | "server-1" | "cache" | "db"
  type: ComponentType;
  x: number;
  y: number; // canvas position, ignored by the engine
  config: NodeConfig;
}
export interface DesignEdge {
  id: string; // `e-${source}-${target}`
  source: string;
  target: string;
}
export interface Design {
  version: 1;
  nodes: DesignNode[];
  edges: DesignEdge[];
}

export interface TrafficPhase {
  untilSec: number;
  fromRps: number;
  toRps: number;
} // linear within phase

export interface HintRule {
  criterion: "p99" | "errorRate" | "cost";
  bottleneck?: ComponentType; // omitted = matches any bottleneck (including none)
  text: string; // placeholders: {component} {util} {amount}
}

export interface Scenario {
  id: string;
  title: string;
  seed: number;
  durationSec: number; // traffic stops at this time
  traffic: TrafficPhase[];
  readRatio: number; // 0..1
  keyspace: number;
  zipfS: number;
  client: { timeoutMs: number }; // may be Infinity (tests only)
  allowed: ComponentType[];
  budgetPerHour: number; // USD per hour
  window: { fromSec: number; toSec: number }; // evaluation window, by createdAt
  criteria: { p99MaxMs: number; errorRateMax: number };
  hints: HintRule[];
  starterDesign: Design;
  referenceDesign: Design; // known-good solution, used by tests
}
