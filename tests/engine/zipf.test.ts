import { describe, expect, it } from "vitest";
import { createRng } from "../../engine/core/rng";
import { createZipf, zipfCdf } from "../../engine/core/zipf";

describe("zipf", () => {
  it("CDF is non-decreasing and ends at 1", () => {
    const cdf = zipfCdf(1000, 1);
    for (let i = 1; i < cdf.length; i++) expect(cdf[i]).toBeGreaterThanOrEqual(cdf[i - 1]);
    expect(Math.abs(cdf[cdf.length - 1] - 1)).toBeLessThan(1e-12);
  });

  it("rank-0 frequency matches 1/H(1000) within 2% relative (s = 1)", () => {
    const z = createZipf(1000, 1, createRng(3));
    let zero = 0;
    const N = 1_000_000;
    for (let i = 0; i < N; i++) if (z.sample() === 0) zero++;
    let h = 0;
    for (let i = 1; i <= 1000; i++) h += 1 / i;
    expect(Math.abs(zero / N - 1 / h) / (1 / h)).toBeLessThan(0.02);
  });

  it("s = 0 is uniform: each 100-rank bucket ≈ 0.1 ± 0.005", () => {
    const z = createZipf(1000, 0, createRng(4));
    const buckets = new Array(10).fill(0);
    const N = 1_000_000;
    for (let i = 0; i < N; i++) buckets[Math.floor(z.sample() / 100)]++;
    for (const b of buckets) expect(Math.abs(b / N - 0.1)).toBeLessThan(0.005);
  });
});
