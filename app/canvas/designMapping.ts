import type { Edge, Node } from "@xyflow/react";
import type { Design, DesignNode } from "../../engine/core/types";
import type { NodeStats } from "../../engine/metrics";
import type { UiHop } from "../state";

export interface ComponentNodeData extends Record<string, unknown> {
  node: DesignNode;
  stats?: NodeStats;
  running: boolean;
}
export interface RequestEdgeData extends Record<string, unknown> {
  hops: UiHop[];
}

const PROTECTED = new Set(["client", "server-1", "db"]);

export function toFlowNodes(
  design: Design,
  stats: Record<string, NodeStats> | undefined,
  selectedId: string | null,
  running: boolean,
): Node<ComponentNodeData>[] {
  return design.nodes.map((n) => ({
    id: n.id,
    type: "component",
    position: { x: n.x, y: n.y },
    selected: n.id === selectedId,
    deletable: !PROTECTED.has(n.id),
    data: { node: n, stats: stats?.[n.id], running },
  }));
}

export function toFlowEdges(design: Design, hops: UiHop[], selectedEdgeId: string | null): Edge<RequestEdgeData>[] {
  const byEdge = new Map<string, UiHop[]>();
  for (const h of hops) {
    const list = byEdge.get(h.edgeId);
    if (list) list.push(h);
    else byEdge.set(h.edgeId, [h]);
  }
  return design.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "request",
    selected: e.id === selectedEdgeId,
    data: { hops: byEdge.get(e.id) ?? [] },
  }));
}

/** Design edge id rule (§10). */
export const edgeId = (source: string, target: string) => `e-${source}-${target}`;
