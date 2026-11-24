import { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { State } from "../state";

const COLORS = ["#2a6fdb", "#d9822b", "#1f9d74", "#a24bd8", "#d64545"];

function Chart({
  title,
  data,
  lines,
  unit,
  refY,
  domain,
}: {
  title: string;
  data: Record<string, number | null>[];
  lines: { key: string; name: string }[];
  unit?: string;
  refY?: number;
  domain?: [number, number];
}) {
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <ResponsiveContainer width="100%" height={150}>
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--grid)" />
          <XAxis dataKey="sec" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={46} unit={unit} domain={domain} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {refY !== undefined && <ReferenceLine y={refY} stroke="#d64545" strokeDasharray="4 4" />}
          {lines.map((l, i) => (
            <Line
              key={l.key}
              dataKey={l.key}
              name={l.name}
              dot={false}
              isAnimationActive={false}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.6}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </figure>
  );
}

export function Dashboard({ state }: { state: State }) {
  const nodeIds = state.design.nodes.filter((n) => n.type !== "client").map((n) => n.id);
  const data = useMemo(
    () =>
      state.buckets.map((b) => {
        const errs = b.errors.rejected + b.errors.timeout + b.errors.downstream;
        const total = b.completedOk + errs;
        const row: Record<string, number | null> = {
          sec: b.sec,
          offered: b.offeredRps,
          ok: b.completedOk,
          p50: b.p50Ms,
          p99: b.p99Ms,
          errorRate: total > 0 ? (errs / total) * 100 : 0,
        };
        for (const id of nodeIds) row[`u_${id}`] = b.nodes[id] ? Math.round(b.nodes[id].heldUtil * 100) : null;
        return row;
      }),
    [state.buckets, nodeIds.join(",")],
  );

  if (data.length === 0) {
    return (
      <section className="panel dashboard empty" aria-label="Dashboard">
        <p className="muted">Press Play to send traffic. Charts update once per simulated second.</p>
      </section>
    );
  }

  return (
    <section className="panel dashboard" aria-label="Dashboard">
      <Chart
        title="Load (requests/s)"
        data={data}
        lines={[
          { key: "offered", name: "offered" },
          { key: "ok", name: "ok throughput" },
        ]}
      />
      <Chart
        title="Latency (ms)"
        data={data}
        unit=""
        refY={state.scenario.criteria.p99MaxMs}
        lines={[
          { key: "p50", name: "p50" },
          { key: "p99", name: "p99" },
        ]}
      />
      <Chart title="Error rate (%)" data={data} lines={[{ key: "errorRate", name: "errors" }]} />
      <Chart
        title="Workers in use (%)"
        data={data}
        domain={[0, 100]}
        lines={nodeIds.map((id) => ({ key: `u_${id}`, name: id }))}
      />
    </section>
  );
}
