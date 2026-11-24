import { expect, it } from "vitest";
import { build } from "../../engine/build";
import { readHeavy, readHeavyReference } from "../../scenarios/readHeavy";
import { runToEndYielding } from "../fixtures";

it("engine throughput ≥ 200,000 events/s on the reference run", { timeout: 600_000 }, async () => {
  const b = build(readHeavyReference, readHeavy);
  const t0 = performance.now();
  await runToEndYielding(b);
  const wallSeconds = (performance.now() - t0) / 1000;
  const rate = b.sim.eventsProcessed / wallSeconds;
  const perRequest = b.sim.eventsProcessed / b.requestsCreated();
  console.log(
    `bench: ${b.sim.eventsProcessed.toLocaleString()} events in ${wallSeconds.toFixed(2)} s → ` +
      `${Math.round(rate).toLocaleString()} events/s, ${perRequest.toFixed(2)} events/request`,
  );
  expect(rate).toBeGreaterThanOrEqual(200_000);
});
