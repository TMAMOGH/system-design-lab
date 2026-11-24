import { describe, expect, it } from "vitest";
import { createRng } from "../../engine/core/rng";

describe("rng", () => {
  it("is reproducible for the same seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it("differs between seeds", () => {
    expect(createRng(42).next()).not.toBe(createRng(43).next());
  });

  it("next() is uniform on [0, 1)", () => {
    const r = createRng(7);
    let sum = 0;
    for (let i = 0; i < 1_000_000; i++) {
      const v = r.next();
      if (v < 0 || v >= 1) throw new Error(`out of range: ${v}`);
      sum += v;
    }
    expect(Math.abs(sum / 1_000_000 - 0.5)).toBeLessThan(0.005);
  });

  it("exp(5) has mean 5 within 1%", () => {
    const r = createRng(9);
    let sum = 0;
    for (let i = 0; i < 1_000_000; i++) sum += r.exp(5);
    expect(Math.abs(sum / 1_000_000 - 5) / 5).toBeLessThan(0.01);
  });
});
