import type { Links } from "../build";
import type { Behavior, Instance } from "./instance";

/** Round-robin across the instances of the LB's single downstream node. */
export function createLbBehavior(links: Links, edgeId: string, targets: Instance[]): Behavior {
  let cursor = 0;
  return (msg, done) => {
    const target = targets[cursor++ % targets.length];
    links.call(edgeId, target, msg, done);
  };
}
