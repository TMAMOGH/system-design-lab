import type { Simulation } from "../core/sim";
import type { Behavior } from "./instance";

/** LRU map of key → expiresAt with TTL. Map insertion order is the LRU order. */
export class LruTtlStore {
  private map = new Map<number, number>();

  constructor(
    private capacity: number,
    private ttlMs: number,
  ) {}

  get size(): number {
    return this.map.size;
  }

  get(key: number, now: number): boolean {
    const exp = this.map.get(key);
    if (exp === undefined) return false;
    this.map.delete(key);
    if (now < exp) {
      this.map.set(key, exp);
      return true;
    }
    return false;
  }

  set(key: number, now: number): void {
    this.map.delete(key);
    this.map.set(key, now + this.ttlMs);
    if (this.map.size > this.capacity) {
      const oldest = this.map.keys().next().value as number;
      this.map.delete(oldest);
    }
  }

  invalidate(key: number): void {
    this.map.delete(key);
  }
}

export function createCacheBehavior(
  store: LruTtlStore,
  counters: { hits: number; misses: number },
  sim: Simulation,
): Behavior {
  return (msg, done) => {
    const hit = store.get(msg.key, sim.now);
    if (hit) counters.hits++;
    else counters.misses++;
    done({ ok: true, hit });
  };
}
