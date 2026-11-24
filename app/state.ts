import type { Design, DesignNode, Hop, NodeConfig, Scenario } from "../engine/core/types";
import type { Evaluation } from "../engine/evaluator";
import type { Bucket } from "../engine/metrics";
import type { Speed } from "../engine/protocol";
import { readHeavy } from "../scenarios/readHeavy";

export type Status = "editing" | "loading" | "running" | "paused" | "done";
export type UiHop = Hop & { receivedAt: number; startAt: number };

export interface State {
  design: Design;
  scenario: Scenario;
  status: Status;
  speed: Speed;
  buckets: Bucket[];
  hops: UiHop[];
  evaluation: Evaluation | null;
  errors: string[];
  lagging: boolean;
  eventsProcessed: number;
  engineRate: number | null; // events per wall-second, measured in the browser
  lastSnapshotWall: number | null;
}

export type Action =
  | { type: "addNode"; node: DesignNode }
  | { type: "updateConfig"; id: string; config: NodeConfig }
  | { type: "removeNode"; id: string }
  | { type: "moveNode"; id: string; x: number; y: number }
  | { type: "addEdge"; source: string; target: string }
  | { type: "removeEdge"; id: string }
  | { type: "setScenario"; scenario: Scenario }
  | { type: "setStatus"; status: Status }
  | {
      type: "appendSnapshot";
      buckets: Bucket[];
      hops: Hop[];
      lagging: boolean;
      eventsProcessed: number;
      wall: number;
    }
  | { type: "setEvaluation"; evaluation: Evaluation }
  | { type: "setErrors"; errors: string[] }
  | { type: "setSpeed"; speed: Speed }
  | { type: "reset" };

export const initialState: State = {
  design: readHeavy.starterDesign,
  scenario: readHeavy,
  status: "editing",
  speed: 1,
  buckets: [],
  hops: [],
  evaluation: null,
  errors: [],
  lagging: false,
  eventsProcessed: 0,
  engineRate: null,
  lastSnapshotWall: null,
};

const PROTECTED = new Set(["client", "server-1", "db"]);
const HOP_TTL_MS = 400;

function editDesign(state: State, design: Design): State {
  if (state.status !== "editing") return state;
  return { ...state, design, errors: [] };
}

export function reducer(state: State, a: Action): State {
  const d = state.design;
  switch (a.type) {
    case "addNode":
      if (d.nodes.some((n) => n.id === a.node.id)) return state;
      return editDesign(state, { ...d, nodes: [...d.nodes, a.node] });
    case "updateConfig":
      return editDesign(state, {
        ...d,
        nodes: d.nodes.map((n) => (n.id === a.id ? { ...n, config: a.config } : n)),
      });
    case "removeNode":
      if (PROTECTED.has(a.id)) return state;
      return editDesign(state, {
        ...d,
        nodes: d.nodes.filter((n) => n.id !== a.id),
        edges: d.edges.filter((e) => e.source !== a.id && e.target !== a.id),
      });
    case "moveNode":
      return editDesign(state, {
        ...d,
        nodes: d.nodes.map((n) => (n.id === a.id ? { ...n, x: a.x, y: a.y } : n)),
      });
    case "addEdge": {
      const id = `e-${a.source}-${a.target}`;
      if (d.edges.some((e) => e.id === id)) return state;
      return editDesign(state, { ...d, edges: [...d.edges, { id, source: a.source, target: a.target }] });
    }
    case "removeEdge":
      return editDesign(state, { ...d, edges: d.edges.filter((e) => e.id !== a.id) });
    case "setScenario":
      if (state.status !== "editing") return state;
      return { ...state, scenario: a.scenario, design: a.scenario.starterDesign, errors: [], evaluation: null, buckets: [] };
    case "setStatus":
      return a.status === "loading"
        ? { ...state, status: a.status, errors: [], evaluation: null, buckets: [], hops: [], eventsProcessed: 0, engineRate: null, lastSnapshotWall: null }
        : { ...state, status: a.status };
    case "appendSnapshot": {
      const firstVt = a.hops.length > 0 ? a.hops[0].vt : 0;
      const fresh: UiHop[] = a.hops.map((h) => ({
        ...h,
        receivedAt: a.wall,
        startAt: a.wall + Math.min(100, (h.vt - firstVt) / state.speed),
      }));
      const hops = [...state.hops.filter((h) => a.wall - h.startAt < HOP_TTL_MS), ...fresh];
      const dt = state.lastSnapshotWall === null ? null : a.wall - state.lastSnapshotWall;
      const engineRate =
        dt && dt > 0 ? ((a.eventsProcessed - state.eventsProcessed) / dt) * 1000 : state.engineRate;
      return {
        ...state,
        buckets: a.buckets.length > 0 ? [...state.buckets, ...a.buckets] : state.buckets,
        hops,
        lagging: a.lagging,
        eventsProcessed: a.eventsProcessed,
        engineRate,
        lastSnapshotWall: a.wall,
      };
    }
    case "setEvaluation":
      return { ...state, evaluation: a.evaluation };
    case "setErrors":
      return { ...state, errors: a.errors };
    case "setSpeed":
      return { ...state, speed: a.speed };
    case "reset":
      return {
        ...state,
        status: "editing",
        buckets: [],
        hops: [],
        evaluation: null,
        errors: [],
        lagging: false,
        eventsProcessed: 0,
        engineRate: null,
        lastSnapshotWall: null,
      };
  }
}
