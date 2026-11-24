import type { Links } from "../build";
import type { LruTtlStore } from "./cache";
import type { Behavior, Instance } from "./instance";

export interface ServerDeps {
  db: { edgeId: string; instance: Instance };
  cache?: { edgeId: string; instance: Instance; store: LruTtlStore };
}

/** Cache-aside reads; writes go to the DB and invalidate the cache (§5.7). */
export function createServerBehavior(links: Links, deps: ServerDeps): Behavior {
  const { db, cache } = deps;

  const readDb: Behavior = (msg, done) => {
    links.call(db.edgeId, db.instance, msg, (res) => {
      if (!res.ok) return done({ ok: false, error: "downstream" });
      if (cache) {
        links.fireAndForget(() => cache.store.set(msg.key, links.sim.now), {
          type: "cacheSet",
          node: cache.instance.id,
          msg: msg.id,
        });
      }
      done({ ok: true });
    });
  };

  return (msg, done) => {
    if (msg.op === "write") {
      links.call(db.edgeId, db.instance, msg, (res) => {
        if (!res.ok) return done({ ok: false, error: "downstream" });
        if (cache) {
          links.fireAndForget(() => cache.store.invalidate(msg.key), {
            type: "cacheInvalidate",
            node: cache.instance.id,
            msg: msg.id,
          });
        }
        done({ ok: true });
      });
      return;
    }
    if (!cache) return readDb(msg, done);
    links.call(cache.edgeId, cache.instance, msg, (res) => {
      if (res.ok && res.hit) return done({ ok: true });
      readDb(msg, done);
    });
  };
}
