import type { Links } from "../build";
import type { Simulation } from "../core/sim";
import type { Message, Op, Response, Scenario } from "../core/types";
import type { Instance } from "./instance";

export type Outcome = 0 | 1 | 2 | 3; // ok, rejected, timeout, downstream

export interface ClientConfig {
  scenario: Scenario;
  edgeId: string;
  target: Instance;
  zipf: { sample(): number };
  arrivals?: { tMs: number; key: number; op: Op }[];
  onRecord: (createdAt: number, latency: number, outcome: Outcome, completedAt: number) => void;
  /** Called when a message is created (used for offered load per second). */
  onCreate?: (t: number) => void;
}

/** Traffic rate λ(t) in requests/s: linear within each phase, 0 after the last. */
export function rateAt(scenario: Scenario, tMs: number): number {
  const sec = tMs / 1000;
  let from = 0;
  for (const p of scenario.traffic) {
    if (sec < p.untilSec) {
      const span = p.untilSec - from;
      const f = span > 0 ? (sec - from) / span : 0;
      return p.fromRps + (p.toRps - p.fromRps) * f;
    }
    from = p.untilSec;
  }
  return 0;
}

export function peakRps(scenario: Scenario): number {
  let m = 0;
  for (const p of scenario.traffic) m = Math.max(m, p.fromRps, p.toRps);
  return m;
}

function outcomeOf(res: Response): Outcome {
  if (res.ok) return 0;
  if (res.error === "rejected") return 1;
  if (res.error === "timeout") return 2;
  return 3;
}

export function createClient(
  sim: Simulation,
  links: Links,
  cfg: ClientConfig,
): { requestsCreated(): number; finalize(endMs: number): void } {
  const { scenario, edgeId, target, zipf, onRecord } = cfg;
  const outstanding = new Map<number, Message>();
  let nextId = 1;

  const send = (op: Op, key: number) => {
    const t = sim.now;
    const msg: Message = {
      id: nextId++,
      kind: "request",
      key,
      op,
      size: 1024,
      createdAt: t,
      deadline: t + scenario.client.timeoutMs,
    };
    outstanding.set(msg.id, msg);
    cfg.onCreate?.(t);
    links.call(edgeId, target, msg, (res) => {
      if (!outstanding.delete(msg.id)) return; // already finalized
      const outcome: Outcome = sim.now > msg.deadline ? 2 : outcomeOf(res);
      onRecord(msg.createdAt, sim.now - msg.createdAt, outcome, sim.now);
    });
    return msg.id;
  };

  if (cfg.arrivals) {
    for (const a of cfg.arrivals) {
      // Scheduled at absolute time a.tMs (sim.now is 0 at build time).
      sim.schedule(
        a.tMs,
        () => {
          send(a.op, a.key);
        },
        { type: "arrive", node: "client", msg: 0 },
      );
    }
  } else {
    const lambdaMax = peakRps(scenario);
    const endGen = scenario.durationSec * 1000;
    const scheduleNext = () => {
      if (lambdaMax <= 0) return;
      const gap = sim.rng.exp(1000 / lambdaMax);
      if (sim.now + gap >= endGen) return;
      sim.schedule(
        gap,
        () => {
          if (sim.rng.next() < rateAt(scenario, sim.now) / lambdaMax) {
            const op: Op = sim.rng.next() < scenario.readRatio ? "read" : "write";
            send(op, zipf.sample());
          }
          scheduleNext();
        },
        { type: "arrive", node: "client", msg: 0 },
      );
    };
    scheduleNext();
  }

  return {
    requestsCreated: () => nextId - 1,
    finalize(endMs: number) {
      for (const msg of outstanding.values()) onRecord(msg.createdAt, endMs - msg.createdAt, 2, endMs);
      outstanding.clear();
    },
  };
}
