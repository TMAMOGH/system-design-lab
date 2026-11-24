import type { Evaluation } from "../../engine/evaluator";

const LABEL = { p99: "p99 latency", errorRate: "Error rate", cost: "Cost" } as const;

function fmt(name: keyof typeof LABEL, v: number | null): string {
  if (v === null) return "—";
  if (name === "p99") return `${v.toFixed(1)} ms`;
  if (name === "errorRate") return `${(v * 100).toFixed(2)}%`;
  return `$${v.toFixed(2)}/h`;
}

export function EvaluationPanel({ evaluation: e }: { evaluation: Evaluation | null }) {
  if (!e) return null;
  return (
    <section className={`panel evaluation ${e.passed ? "pass" : "fail"}`} aria-label="Evaluation">
      <h2>{e.passed ? "✓ Passed" : "✗ Not yet"}</h2>
      <table>
        <thead>
          <tr>
            <th>Criterion</th>
            <th>Value</th>
            <th>Limit</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {e.criteria.map((c) => (
            <tr key={c.name}>
              <td>{LABEL[c.name]}</td>
              <td>{fmt(c.name, c.value)}</td>
              <td>
                {c.name === "cost" ? "≤ " : "< "}
                {fmt(c.name, c.limit)}
              </td>
              <td className={c.passed ? "ok" : "bad"}>{c.passed ? "pass" : "fail"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {e.bottleneck && (
        <p>
          <strong>Bottleneck:</strong> {e.bottleneck.nodeId} — chosen by{" "}
          {e.bottleneck.metric === "held" ? "workers in use" : "own work"} (workers in use{" "}
          {Math.round(e.bottleneck.heldUtil * 100)}%, own work {Math.round(e.bottleneck.serviceUtil * 100)}%)
        </p>
      )}
      {e.rejectingNode && (
        <p>
          <strong>Rejecting work:</strong> {e.rejectingNode}
        </p>
      )}
      {e.hints.length > 0 && (
        <ul className="hints">
          {e.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
