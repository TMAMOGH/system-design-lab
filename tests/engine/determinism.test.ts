import { describe, expect, it } from "vitest";
import { build } from "../../engine/build";
import { readHeavy, readHeavyReference } from "../../scenarios/readHeavy";

function trace(seed: number): string {
  const lines: string[] = [];
  const b = build(readHeavyReference, { ...readHeavy, durationSec: 10 }, {
    seed,
    onEvent: (t, seq, m) => lines.push(`${t.toFixed(6)} ${seq} ${m.type} ${m.node} ${m.msg}`),
  });
  b.runUntil(b.endMs, Infinity);
  return lines.join("\n");
}

describe("determinism", () => {
  it("same seed → byte-identical trace", { timeout: 60_000 }, () => {
    const a = trace(7);
    expect(a.length).toBeGreaterThan(0);
    expect(trace(7) === a).toBe(true);
  });

  it("different seed → different trace", { timeout: 60_000 }, () => {
    expect(trace(8) === trace(7)).toBe(false);
  });
});
