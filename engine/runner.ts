import { build, type Built } from "./build";
import { peakRps } from "./components/client";
import type { Scenario } from "./core/types";
import type { Speed, UiToWorker, WorkerToUi } from "./protocol";
import { validate } from "./validate";

export interface RunnerDeps {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (h: unknown) => void;
}

export type RunnerState = "idle" | "loaded" | "playing" | "paused" | "fast" | "done";

const TICK_MS = 16;
const TICK_BUDGET_MS = 12;
const FAST_CHUNK_MS = 50;
const SNAPSHOT_EVERY_MS = 100;
const LAG_WINDOW = 60;
const LAG_THRESHOLD = 30;

/** Drives a Built simulation in wall-clock time (§11 Phase 4). */
export function createRunner(
  post: (m: WorkerToUi) => void,
  deps: RunnerDeps = {
    now: () => performance.now(),
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
): { handle(m: UiToWorker): void; readonly state: RunnerState } {
  let state: RunnerState = "idle";
  let built: Built | null = null;
  let scenario: Scenario | null = null;
  let runId = 0;
  let speed: Speed = 1;
  let timer: unknown = null;
  let lastTickWall = 0;
  let lastPostWall = 0;
  let shortfalls: boolean[] = [];
  let lagging = false;

  const stopTimer = () => {
    if (timer !== null) deps.clearTimeout(timer);
    timer = null;
  };

  const sampleN = () => (scenario ? Math.max(1, Math.ceil((peakRps(scenario) * speed) / 50)) : 0);

  const fail = (e: unknown) => {
    stopTimer();
    built = null;
    state = "idle";
    post({ type: "error", runId, messages: [String(e)] });
  };

  const snapshot = () => {
    if (!built) return;
    post({
      type: "snapshot",
      runId,
      vt: built.sim.now,
      lagging,
      eventsProcessed: built.sim.eventsProcessed,
      buckets: built.drainBuckets(),
      hops: built.drainHops(),
    });
  };

  const finishIfDone = (): boolean => {
    if (!built || !built.isFinished()) return false;
    stopTimer();
    snapshot();
    post({ type: "done", runId, evaluation: built.evaluate() });
    state = "done";
    return true;
  };

  const maybeSnapshot = (now: number) => {
    if (now - lastPostWall >= SNAPSHOT_EVERY_MS) {
      lastPostWall = now;
      snapshot();
    }
  };

  const tick = () => {
    timer = null;
    try {
      if (!built) return;
      const now = deps.now();
      const elapsed = now - lastTickWall;
      lastTickWall = now;
      const target = Math.min(built.endMs, built.sim.now + speed * elapsed);
      const reached = built.runUntil(target, TICK_BUDGET_MS);
      shortfalls.push(reached < target);
      if (shortfalls.length > LAG_WINDOW) shortfalls.shift();
      lagging = shortfalls.filter(Boolean).length >= LAG_THRESHOLD;
      if (finishIfDone()) return;
      maybeSnapshot(now);
      timer = deps.setTimeout(tick, TICK_MS);
    } catch (e) {
      fail(e);
    }
  };

  const chunk = () => {
    timer = null;
    try {
      if (!built) return;
      built.runUntil(built.endMs, FAST_CHUNK_MS);
      if (finishIfDone()) return;
      maybeSnapshot(deps.now());
      timer = deps.setTimeout(chunk, 0);
    } catch (e) {
      fail(e);
    }
  };

  const handle = (m: UiToWorker) => {
    switch (m.type) {
      case "load": {
        stopTimer();
        built = null;
        runId = m.runId;
        const errors = validate(m.design, m.scenario);
        if (errors.length > 0) {
          state = "idle";
          post({ type: "error", runId, messages: errors });
          return;
        }
        try {
          built = build(m.design, m.scenario);
          scenario = m.scenario;
          state = "loaded";
          post({ type: "loaded", runId });
        } catch (e) {
          fail(e);
        }
        return;
      }
      case "play":
        if ((state === "loaded" || state === "paused") && built) {
          built.setSampleN(sampleN());
          lastTickWall = deps.now();
          lastPostWall = lastTickWall;
          shortfalls = [];
          lagging = false;
          state = "playing";
          timer = deps.setTimeout(tick, TICK_MS);
        }
        return;
      case "pause":
        if (state === "playing" || state === "fast") {
          stopTimer();
          state = "paused";
          snapshot();
        }
        return;
      case "setSpeed":
        speed = m.speed;
        if (state === "playing" && built) built.setSampleN(sampleN());
        return;
      case "runToEnd":
        if ((state === "loaded" || state === "paused" || state === "playing") && built) {
          stopTimer();
          built.setSampleN(0);
          state = "fast";
          lastPostWall = deps.now();
          timer = deps.setTimeout(chunk, 0);
        }
        return;
      case "reset":
        stopTimer();
        built = null;
        state = "idle";
        return;
    }
  };

  return {
    handle,
    get state() {
      return state;
    },
  };
}
