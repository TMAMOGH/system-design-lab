import { EventHeap } from "./heap";
import type { Rng } from "./rng";
import type { TraceMeta } from "./types";

export class Simulation {
  now = 0;
  eventsProcessed = 0;
  onEvent?: (t: number, seq: number, meta: TraceMeta) => void;
  private heap = new EventHeap();
  private seq = 0;

  constructor(public rng: Rng) {}

  schedule(delayMs: number, fn: () => void, meta: TraceMeta): void {
    this.heap.push({ t: this.now + delayMs, seq: this.seq++, fn, meta });
  }

  /** Process events with t <= tMs, stopping early if the wall-clock budget is spent. */
  runUntil(tMs: number, wallBudgetMs = Infinity): number {
    const heap = this.heap;
    const useBudget = wallBudgetMs !== Infinity;
    const wallStart = useBudget ? performance.now() : 0;
    let sinceCheck = 0;
    for (;;) {
      const next = heap.peek();
      if (next === undefined || next.t > tMs) {
        this.now = tMs;
        return this.now;
      }
      heap.pop();
      this.now = next.t;
      if (this.onEvent) this.onEvent(next.t, next.seq, next.meta);
      next.fn();
      this.eventsProcessed++;
      if (useBudget && ++sinceCheck >= 1000) {
        sinceCheck = 0;
        if (performance.now() - wallStart >= wallBudgetMs) return this.now;
      }
    }
  }
}
