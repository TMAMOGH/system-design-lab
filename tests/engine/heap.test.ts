import { describe, expect, it } from "vitest";
import { EventHeap } from "../../engine/core/heap";
import { createRng } from "../../engine/core/rng";

const meta = { type: "sample" as const, node: "", msg: 0 };

describe("EventHeap", () => {
  it("pops 10,000 random entries sorted by (t, seq)", () => {
    const rng = createRng(1);
    const h = new EventHeap();
    for (let seq = 0; seq < 10_000; seq++) {
      h.push({ t: Math.floor(rng.next() * 500), seq, fn: () => {}, meta });
    }
    let prev = h.pop()!;
    for (let i = 1; i < 10_000; i++) {
      const cur = h.pop()!;
      expect(cur.t > prev.t || (cur.t === prev.t && cur.seq > prev.seq)).toBe(true);
      prev = cur;
    }
    expect(h.size).toBe(0);
  });

  it("pops equal t in seq order", () => {
    const h = new EventHeap();
    for (const seq of [5, 1, 4, 2, 3]) h.push({ t: 7, seq, fn: () => {}, meta });
    expect([1, 2, 3, 4, 5].map(() => h.pop()!.seq)).toEqual([1, 2, 3, 4, 5]);
  });

  it("returns undefined from pop and peek when empty", () => {
    const h = new EventHeap();
    expect(h.pop()).toBeUndefined();
    expect(h.peek()).toBeUndefined();
  });
});
