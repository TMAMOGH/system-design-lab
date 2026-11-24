import { describe, expect, it } from "vitest";
import type { WorkerToUi } from "../../engine/protocol";
import { createRunner, type RunnerDeps } from "../../engine/runner";
import { design, testScenario } from "../fixtures";

/** Deterministic fake clock + timer queue. */
function fakeClock() {
  let now = 0;
  let id = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  const deps: RunnerDeps = {
    now: () => now,
    setTimeout: (fn, ms) => {
      timers.set(++id, { at: now + ms, fn });
      return id;
    },
    clearTimeout: (h) => {
      timers.delete(h as number);
    },
  };
  const advance = (ms: number) => {
    const end = now + ms;
    for (;;) {
      let next: [number, { at: number; fn: () => void }] | undefined;
      for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at)) next = e;
      if (!next) break;
      timers.delete(next[0]);
      now = Math.max(now, next[1].at);
      next[1].fn();
    }
    now = end;
  };
  return { deps, advance };
}

const scenario = testScenario({ durationSec: 2, traffic: [{ untilSec: 2, fromRps: 100, toRps: 100 }] });
const valid = design(
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

function setup() {
  const posted: WorkerToUi[] = [];
  const clock = fakeClock();
  const runner = createRunner((m) => posted.push(m), clock.deps);
  const snapshots = () => posted.filter((m) => m.type === "snapshot") as Extract<WorkerToUi, { type: "snapshot" }>[];
  return { posted, runner, snapshots, ...clock };
}

describe("runner", () => {
  it("rejects an invalid design with the validation messages", () => {
    const { posted, runner } = setup();
    const bad = design([{ id: "client", type: "client" }], []);
    runner.handle({ type: "load", runId: 1, design: bad, scenario });
    expect(posted[0]).toMatchObject({ type: "error", runId: 1 });
    expect((posted[0] as { messages: string[] }).messages).toContain("The design needs exactly one server.");
    expect(runner.state).toBe("idle");
  });

  it("play → pause holds virtual time → play resumes without a jump", () => {
    const { runner, advance, snapshots } = setup();
    runner.handle({ type: "load", runId: 1, design: valid, scenario });
    runner.handle({ type: "play", runId: 1 });
    advance(500);
    expect(snapshots().length).toBeGreaterThan(0);
    runner.handle({ type: "pause", runId: 1 });
    const pausedVt = snapshots().at(-1)!.vt;
    const count = snapshots().length;
    advance(1000);
    expect(snapshots().length).toBe(count);
    runner.handle({ type: "play", runId: 1 });
    advance(200);
    const resumedVt = snapshots().at(-1)!.vt;
    expect(resumedVt).toBeGreaterThan(pausedVt);
    expect(resumedVt - pausedVt).toBeLessThanOrEqual(200 + 1e-9);
  });

  it("runToEnd posts done with an evaluation", () => {
    const { runner, advance, posted } = setup();
    runner.handle({ type: "load", runId: 1, design: valid, scenario });
    runner.handle({ type: "runToEnd", runId: 1 });
    advance(100);
    const done = posted.find((m) => m.type === "done");
    expect(done).toBeDefined();
    expect(runner.state).toBe("done");
  });

  it("pause during runToEnd → paused, then play continues to done", () => {
    const { runner, advance, posted } = setup();
    runner.handle({ type: "load", runId: 1, design: valid, scenario });
    runner.handle({ type: "runToEnd", runId: 1 });
    runner.handle({ type: "pause", runId: 1 });
    expect(runner.state).toBe("paused");
    advance(100);
    expect(posted.some((m) => m.type === "done")).toBe(false);
    runner.handle({ type: "play", runId: 1 });
    advance(5000);
    expect(posted.some((m) => m.type === "done")).toBe(true);
  });

  it("reset during play stops snapshots", () => {
    const { runner, advance, snapshots } = setup();
    runner.handle({ type: "load", runId: 1, design: valid, scenario });
    runner.handle({ type: "play", runId: 1 });
    advance(300);
    runner.handle({ type: "reset", runId: 1 });
    const count = snapshots().length;
    advance(1000);
    expect(snapshots().length).toBe(count);
    expect(runner.state).toBe("idle");
  });

  it("play while idle is ignored", () => {
    const { runner, advance, posted } = setup();
    runner.handle({ type: "play", runId: 1 });
    advance(500);
    expect(posted).toEqual([]);
  });
});
