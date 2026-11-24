import { useReducer, useState } from "react";
import { costPerHour } from "../engine/catalog";
import { readHeavy } from "../scenarios/readHeavy";
import { readHeavyVariant } from "../scenarios/readHeavyVariant";
import { Canvas } from "./canvas/Canvas";
import { Controls } from "./panels/Controls";
import { Dashboard } from "./panels/Dashboard";
import { EvaluationPanel } from "./panels/EvaluationPanel";
import { Inspector } from "./panels/Inspector";
import { Palette } from "./panels/Palette";
import { initialState, reducer } from "./state";
import "./styles.css";
import { useSimWorker } from "./useSimWorker";

const SCENARIOS = [readHeavy, readHeavyVariant];

export function App() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const sim = useSimWorker(state, dispatch);
  const cost = costPerHour(state.design);
  const over = cost > state.scenario.budgetPerHour;
  const editing = state.status === "editing";

  return (
    <div className="app">
      <header className="header">
        <div className="title">
          <h1>{state.scenario.title}</h1>
          <span className="goal">
            Goal: p99 &lt; {state.scenario.criteria.p99MaxMs} ms, errors &lt;{" "}
            {(state.scenario.criteria.errorRateMax * 100).toFixed(1)}%, within budget — measured from{" "}
            {state.scenario.window.fromSec} s to {state.scenario.window.toSec} s
          </span>
        </div>
        <label className="scenario-select">
          Scenario
          <select
            disabled={!editing}
            value={state.scenario.id}
            onChange={(e) => {
              const s = SCENARIOS.find((x) => x.id === e.target.value);
              if (s) {
                setSelectedId(null);
                dispatch({ type: "setScenario", scenario: s });
              }
            }}
          >
            {SCENARIOS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <div className={`cost${over ? " over" : ""}`}>
          <span className="cost-value">${cost.toFixed(2)}/h</span>
          <span className="cost-budget">budget ${state.scenario.budgetPerHour.toFixed(2)}/h</span>
        </div>
      </header>

      <main className="workspace">
        <Palette state={state} dispatch={dispatch} />
        <Canvas state={state} dispatch={dispatch} selectedId={selectedId} onSelect={setSelectedId} />
        <Inspector state={state} dispatch={dispatch} selectedId={selectedId} />
      </main>

      <Controls state={state} {...sim} />
      <Dashboard state={state} />
      <EvaluationPanel evaluation={state.evaluation} />
    </div>
  );
}
