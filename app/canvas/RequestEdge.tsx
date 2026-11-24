import { BaseEdge, getBezierPath, type Edge, type EdgeProps } from "@xyflow/react";
import { useEffect, useState } from "react";
import type { UiHop } from "../state";
import type { RequestEdgeData } from "./designMapping";

const DOT_MS = 300;

function Dot({ hop, path }: { hop: UiHop; path: string }) {
  return (
    <circle r={4} className={hop.ok ? "dot ok" : "dot err"}>
      <animateMotion
        ref={(el) => {
          if (el) (el as unknown as { beginElement(): void }).beginElement();
        }}
        begin="indefinite"
        dur="0.3s"
        fill="freeze"
        path={path}
        {...(hop.dir === "back" ? { keyPoints: "1;0", keyTimes: "0;1", calcMode: "linear" } : {})}
      />
    </circle>
  );
}

export function RequestEdge(props: EdgeProps<Edge<RequestEdgeData>>) {
  const [path] = getBezierPath(props);
  const [now, setNow] = useState(() => performance.now());
  const hops = props.data?.hops ?? [];

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 50);
    return () => clearInterval(id);
  }, []);

  return (
    <>
      <BaseEdge id={props.id} path={path} className={props.selected ? "edge selected" : "edge"} />
      {hops.map((h, i) =>
        h.startAt <= now && now < h.startAt + DOT_MS ? (
          <Dot key={`${h.receivedAt}-${i}`} hop={h} path={path} />
        ) : null,
      )}
    </>
  );
}

export const edgeTypes = { request: RequestEdge };
