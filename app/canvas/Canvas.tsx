import {
  applyNodeChanges,
  Background,
  ReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo, useRef, useState, type Dispatch } from "react";
import { canConnect } from "../../engine/validate";
import type { Action, State } from "../state";
import { toFlowEdges, toFlowNodes, type ComponentNodeData, type RequestEdgeData } from "./designMapping";
import { nodeTypes } from "./nodeTypes";
import { edgeTypes } from "./RequestEdge";

interface Props {
  state: State;
  dispatch: Dispatch<Action>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export function Canvas({ state, dispatch, selectedId, onSelect }: Props) {
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const refusalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editing = state.status === "editing";
  const running = state.status !== "editing";
  const latest = state.buckets.at(-1)?.nodes;

  // React Flow nodes live in local state so React Flow can keep its own
  // measurements (`measured`, `dragging`); we merge design + stats into them.
  const [nodes, setNodes] = useState<Node<ComponentNodeData>[]>(() =>
    toFlowNodes(state.design, latest, selectedId, running),
  );
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return toFlowNodes(state.design, latest, selectedId, running).map((n) => {
        const p = byId.get(n.id);
        if (!p) return n;
        return {
          ...p,
          position: p.dragging ? p.position : n.position,
          data: n.data,
          selected: n.selected,
          deletable: n.deletable,
        };
      });
    });
  }, [state.design, latest, selectedId, running]);

  const edges = useMemo(
    () => toFlowEdges(state.design, state.hops, selectedEdge),
    [state.design, state.hops, selectedEdge],
  );

  // Fit the view once every node has been measured, and again when the node set changes.
  const [rf, setRf] = useState<ReactFlowInstance<Node<ComponentNodeData>, Edge<RequestEdgeData>> | null>(null);
  const allMeasured = nodes.length > 0 && nodes.every((n) => n.measured?.width);
  const nodeSet = nodes.map((n) => n.id).join(",");
  useEffect(() => {
    if (!rf || !allMeasured) return;
    const id = requestAnimationFrame(() => rf.fitView({ padding: 0.25 }));
    return () => cancelAnimationFrame(id);
  }, [rf, allMeasured, nodeSet]);

  const onNodesChange = (changes: NodeChange<Node<ComponentNodeData>>[]) => {
    const next = applyNodeChanges(changes, nodes);
    setNodes(next);
    for (const c of changes) {
      if (c.type === "position" && !c.dragging) {
        // Drag finished: commit the final position to the design.
        const pos = c.position ?? next.find((n) => n.id === c.id)?.position;
        if (pos) dispatch({ type: "moveNode", id: c.id, x: pos.x, y: pos.y });
      } else if (c.type === "remove") {
        dispatch({ type: "removeNode", id: c.id });
        if (c.id === selectedId) onSelect(null);
      }
    }
    // A batch may contain "deselect A" and "select B" in any order: newly selected wins.
    const picked = changes.flatMap((c) => (c.type === "select" && c.selected ? [c.id] : [])).at(-1);
    if (picked) {
      onSelect(picked);
      setSelectedEdge(null);
    } else if (changes.some((c) => c.type === "select" && !c.selected && c.id === selectedId)) {
      onSelect(null);
    }
  };

  const onEdgesChange = (changes: EdgeChange[]) => {
    for (const c of changes) {
      if (c.type === "remove") {
        dispatch({ type: "removeEdge", id: c.id });
        if (c.id === selectedEdge) setSelectedEdge(null);
      }
    }
    const picked = changes.flatMap((c) => (c.type === "select" && c.selected ? [c.id] : [])).at(-1);
    if (picked) {
      setSelectedEdge(picked);
      onSelect(null);
    } else if (changes.some((c) => c.type === "select" && !c.selected && c.id === selectedEdge)) {
      setSelectedEdge(null);
    }
  };

  const onConnect = (conn: Connection) => {
    const s = state.design.nodes.find((n) => n.id === conn.source);
    const t = state.design.nodes.find((n) => n.id === conn.target);
    if (!s || !t) return;
    const reason = canConnect(s.type, t.type);
    if (reason) {
      setRefusal(reason);
      if (refusalTimer.current) clearTimeout(refusalTimer.current);
      refusalTimer.current = setTimeout(() => setRefusal(null), 3000);
      return;
    }
    dispatch({ type: "addEdge", source: s.id, target: t.id });
  };

  return (
    <div className="canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={editing}
        nodesConnectable={editing}
        deleteKeyCode={editing ? ["Delete", "Backspace"] : null}
        onInit={setRf}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={24} />
      </ReactFlow>
      {refusal && <div className="refusal" role="alert">{refusal}</div>}
    </div>
  );
}
