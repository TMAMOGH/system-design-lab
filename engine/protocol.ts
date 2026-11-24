import type { Design, Hop, Scenario } from "./core/types";
import type { Evaluation } from "./evaluator";
import type { Bucket } from "./metrics";

export type Speed = 0.1 | 0.25 | 0.5 | 1 | 2 | 5;

export type UiToWorker =
  | { type: "load"; runId: number; design: Design; scenario: Scenario }
  | { type: "play"; runId: number }
  | { type: "pause"; runId: number }
  | { type: "reset"; runId: number }
  | { type: "setSpeed"; runId: number; speed: Speed }
  | { type: "runToEnd"; runId: number };

export type WorkerToUi =
  | { type: "loaded"; runId: number }
  | {
      type: "snapshot";
      runId: number;
      vt: number;
      lagging: boolean;
      eventsProcessed: number;
      buckets: Bucket[];
      hops: Hop[];
    }
  | { type: "done"; runId: number; evaluation: Evaluation }
  | { type: "error"; runId: number; messages: string[] };
