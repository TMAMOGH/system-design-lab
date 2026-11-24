import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { ComponentType } from "../../engine/core/types";
import type { ComponentNodeData } from "./designMapping";

const TITLE: Record<ComponentType, string> = {
  client: "Client",
  loadBalancer: "Load balancer",
  server: "Server",
  cache: "Cache",
  database: "Database",
};

const HAS_INPUT: ComponentType[] = ["loadBalancer", "server", "cache", "database"];
const HAS_OUTPUT: ComponentType[] = ["client", "loadBalancer", "server"];

function detail(d: ComponentNodeData["node"]): string {
  const c = d.config;
  switch (c.type) {
    case "server":
      return `${c.tier} × ${c.instances}`;
    case "cache":
      return `${c.tier} · TTL ${c.ttlSeconds}s`;
    case "database":
      return c.tier;
    case "loadBalancer":
      return "round-robin";
    case "client":
      return "traffic source";
  }
}

function Bar({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(1, value));
  const level = pct >= 0.9 ? "hot" : pct >= 0.7 ? "warm" : "ok";
  return (
    <div className="bar">
      <span className="bar-label">{label}</span>
      <span className="bar-track">
        <span className={`bar-fill ${level}`} style={{ width: `${pct * 100}%` }} />
      </span>
      <span className="bar-value">{Math.round(pct * 100)}%</span>
    </div>
  );
}

function ComponentNode({ data, selected }: NodeProps<Node<ComponentNodeData>>) {
  const { node, stats, running } = data;
  return (
    <div className={`cnode cnode-${node.type}${selected ? " selected" : ""}`}>
      {HAS_INPUT.includes(node.type) && <Handle type="target" position={Position.Left} />}
      <div className="cnode-title">{TITLE[node.type]}</div>
      <div className="cnode-detail">{detail(node)}</div>
      {running && stats && (
        <div className="cnode-bars">
          <Bar label="workers in use" value={stats.heldUtil} />
          <Bar label="own work" value={stats.serviceUtil} />
        </div>
      )}
      {HAS_OUTPUT.includes(node.type) && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const nodeTypes = { component: ComponentNode };
