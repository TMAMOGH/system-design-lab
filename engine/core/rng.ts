export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Exponential with the given mean. */
  exp(mean: number): number;
}

/** mulberry32: small, fast, seedable 32-bit generator. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    exp: (mean: number) => -mean * Math.log(1 - next()),
  };
}
