import type { Dispatch } from "react";
import { POSITIONS } from "../../scenarios/readHeavy";
import type { Action, State } from "../state";

export function Palette({ state, dispatch }: { state: State; dispatch: Dispatch<Action> }) {
  const editing = state.status === "editing";
  const has = (id: string) => state.design.nodes.some((n) => n.id === id);

  return (
    <section className="panel palette" aria-label="Components">
      <h2>Add</h2>
      <button
        disabled={!editing || has("lb")}
        onClick={() =>
          dispatch({
            type: "addNode",
            node: { id: "lb", type: "loadBalancer", ...POSITIONS.lb, config: { type: "loadBalancer" } },
          })
        }
      >
        + Load balancer
      </button>
      <button
        disabled={!editing || has("cache")}
        onClick={() =>
          dispatch({
            type: "addNode",
            node: { id: "cache", type: "cache", ...POSITIONS.cache, config: { type: "cache", tier: "small", ttlSeconds: 60 } },
          })
        }
      >
        + Cache
      </button>
      <p className="hint">
        Drag from a node's right handle to another node's left handle to connect them. Select a load balancer, cache or
        edge and press Delete to remove it.
      </p>
    </section>
  );
}
