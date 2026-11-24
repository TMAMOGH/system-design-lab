import { useEffect, useState, type Dispatch } from "react";
import { CATALOG } from "../../engine/catalog";
import type { NodeConfig } from "../../engine/core/types";
import type { Action, State } from "../state";

export function Inspector({
  state,
  dispatch,
  selectedId,
}: {
  state: State;
  dispatch: Dispatch<Action>;
  selectedId: string | null;
}) {
  const node = state.design.nodes.find((n) => n.id === selectedId);
  const editing = state.status === "editing";
  const set = (config: NodeConfig) => node && dispatch({ type: "updateConfig", id: node.id, config });

  return (
    <section className="panel inspector" aria-label="Inspector">
      <h2>Inspector</h2>
      {!node ? (
        <p className="muted">Select a component to configure it.</p>
      ) : (
        <>
          <div className="inspector-id">{node.id}</div>
          <ConfigForm config={node.config} disabled={!editing} onChange={set} />
        </>
      )}
    </section>
  );
}

function ConfigForm({
  config: c,
  disabled,
  onChange,
}: {
  config: NodeConfig;
  disabled: boolean;
  onChange: (c: NodeConfig) => void;
}) {
  switch (c.type) {
    case "server":
      return (
        <>
          <label>
            Tier
            <select disabled={disabled} value={c.tier} onChange={(e) => onChange({ ...c, tier: e.target.value as "small" | "medium" })}>
              {(["small", "medium"] as const).map((t) => (
                <option key={t} value={t}>
                  {t} — {CATALOG.server.tiers[t].concurrency} workers, ${CATALOG.server.tiers[t].price}/h each
                </option>
              ))}
            </select>
          </label>
          <InstancesInput value={c.instances} disabled={disabled} onCommit={(instances) => onChange({ ...c, instances })} />
        </>
      );
    case "cache":
      return (
        <>
          <label>
            Tier
            <select
              disabled={disabled}
              value={c.tier}
              onChange={(e) => onChange({ ...c, tier: e.target.value as "small" | "medium" | "large" })}
            >
              {(["small", "medium", "large"] as const).map((t) => (
                <option key={t} value={t}>
                  {t} — {CATALOG.cache.tiers[t].capacity.toLocaleString()} keys, ${CATALOG.cache.tiers[t].price}/h
                </option>
              ))}
            </select>
          </label>
          <label>
            TTL
            <select
              disabled={disabled}
              value={c.ttlSeconds}
              onChange={(e) => onChange({ ...c, ttlSeconds: Number(e.target.value) as 10 | 60 | 300 })}
            >
              {[10, 60, 300].map((s) => (
                <option key={s} value={s}>
                  {s} s
                </option>
              ))}
            </select>
          </label>
        </>
      );
    case "database":
      return (
        <label>
          Tier
          <select
            disabled={disabled}
            value={c.tier}
            onChange={(e) => onChange({ ...c, tier: e.target.value as "medium" | "large" | "xlarge" })}
          >
            {(["medium", "large", "xlarge"] as const).map((t) => (
              <option key={t} value={t}>
                {t} — {CATALOG.database.tiers[t].concurrency} workers, ${CATALOG.database.tiers[t].price}/h
              </option>
            ))}
          </select>
        </label>
      );
    default:
      return <p className="muted">No settings</p>;
  }
}

function InstancesInput({
  value,
  disabled,
  onCommit,
}: {
  value: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Math.min(20, Math.max(1, Math.round(Number(text) || 1)));
    setText(String(n));
    if (n !== value) onCommit(n);
  };
  return (
    <label>
      Instances
      <input
        type="number"
        min={1}
        max={20}
        disabled={disabled}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
      />
    </label>
  );
}
