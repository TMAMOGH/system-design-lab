import type { Rng } from "./rng";

/** Normalized Zipf CDF over ranks 0..n-1; rank i has weight 1/(i+1)^s. */
export function zipfCdf(n: number, s: number): Float64Array {
  const cdf = new Float64Array(n);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    sum += 1 / Math.pow(i + 1, s);
    cdf[i] = sum;
  }
  for (let i = 0; i < n; i++) cdf[i] /= sum;
  return cdf;
}

/** Zipf sampler: binary-searches the first rank whose CDF >= u. */
export function createZipf(n: number, s: number, rng: Rng): { sample(): number } {
  const cdf = zipfCdf(n, s);
  cdf[n - 1] = 1;
  return {
    sample(): number {
      const u = rng.next();
      let lo = 0;
      let hi = n - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cdf[mid] >= u) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    },
  };
}
