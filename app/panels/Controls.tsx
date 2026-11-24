import type { Speed } from "../../engine/protocol";
import type { State } from "../state";

const SPEEDS: Speed[] = [0.1, 0.25, 0.5, 1, 2, 5];

interface Props {
  state: State;
  play(): void;
  pause(): void;
  setSpeed(s: Speed): void;
  runToEnd(): void;
  reset(): void;
}

export function Controls({ state, play, pause, setSpeed, runToEnd, reset }: Props) {
  const s = state.status;
  const vt = state.buckets.at(-1)?.sec;
  return (
    <section className="panel controls" aria-label="Run controls">
      <div className="buttons">
        <button className="primary" disabled={!(s === "editing" || s === "paused")} onClick={play}>
          ▶ Play
        </button>
        <button disabled={s !== "running"} onClick={pause}>
          ❚❚ Pause
        </button>
        <button disabled={!(s === "editing" || s === "running" || s === "paused")} onClick={runToEnd}>
          ⏭ Run to end
        </button>
        <button disabled={s === "editing"} onClick={reset}>
          ↺ Reset
        </button>
        <label className="speed">
          Speed
          <select value={state.speed} onChange={(e) => setSpeed(Number(e.target.value) as Speed)}>
            {SPEEDS.map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="status-row">
        <span className={`status status-${s}`}>{s}</span>
        {vt !== undefined && <span className="muted">t = {vt + 1} s</span>}
        {state.engineRate !== null && s === "running" && (
          <span className="muted">engine {Math.round(state.engineRate).toLocaleString()} events/s</span>
        )}
        {state.lagging && <span className="badge-lag">Simulation slowed: engine at capacity</span>}
      </div>
      {state.errors.length > 0 && (
        <ul className="errors" role="alert">
          {state.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
