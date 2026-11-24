import type { Behavior } from "./instance";

/** The database always succeeds; reads and writes differ only in service mean. */
export function createDbBehavior(): Behavior {
  return (_msg, done) => done({ ok: true });
}
