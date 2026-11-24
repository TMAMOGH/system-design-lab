import { useEffect, useRef, type Dispatch } from "react";
import type { Speed, UiToWorker, WorkerToUi } from "../engine/protocol";
import type { Action, State } from "./state";

/** Owns the simulation worker, the current runId and the pending Play/Run-to-end intent. */
export function useSimWorker(state: State, dispatch: Dispatch<Action>) {
  const workerRef = useRef<Worker | null>(null);
  const runIdRef = useRef(1);
  const pendingRef = useRef<"play" | "runToEnd" | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const worker = new Worker(new URL("../engine/worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<WorkerToUi>) => {
      const m = e.data;
      if (m.runId !== runIdRef.current) return; // stale run
      switch (m.type) {
        case "loaded": {
          send({ type: "setSpeed", runId: runIdRef.current, speed: stateRef.current.speed });
          const intent = pendingRef.current;
          pendingRef.current = null;
          if (intent) send({ type: intent, runId: runIdRef.current });
          dispatch({ type: "setStatus", status: "running" });
          break;
        }
        case "snapshot":
          dispatch({
            type: "appendSnapshot",
            buckets: m.buckets,
            hops: m.hops,
            lagging: m.lagging,
            eventsProcessed: m.eventsProcessed,
            wall: performance.now(),
          });
          break;
        case "done":
          dispatch({ type: "setEvaluation", evaluation: m.evaluation });
          dispatch({ type: "setStatus", status: "done" });
          break;
        case "error":
          dispatch({ type: "setErrors", errors: m.messages });
          dispatch({ type: "setStatus", status: "editing" });
          break;
      }
    };
    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [dispatch]);

  function send(m: UiToWorker) {
    workerRef.current?.postMessage(m);
  }

  const load = (intent: "play" | "runToEnd") => {
    pendingRef.current = intent;
    dispatch({ type: "setStatus", status: "loading" });
    const s = stateRef.current;
    send({ type: "load", runId: runIdRef.current, design: s.design, scenario: s.scenario });
  };

  return {
    play() {
      const s = stateRef.current.status;
      if (s === "editing") load("play");
      else if (s === "paused") {
        send({ type: "play", runId: runIdRef.current });
        dispatch({ type: "setStatus", status: "running" });
      }
    },
    pause() {
      if (stateRef.current.status !== "running") return;
      send({ type: "pause", runId: runIdRef.current });
      dispatch({ type: "setStatus", status: "paused" });
    },
    setSpeed(speed: Speed) {
      dispatch({ type: "setSpeed", speed });
      send({ type: "setSpeed", runId: runIdRef.current, speed });
    },
    runToEnd() {
      const s = stateRef.current.status;
      if (s === "editing") load("runToEnd");
      else if (s === "running" || s === "paused") {
        send({ type: "runToEnd", runId: runIdRef.current });
        dispatch({ type: "setStatus", status: "running" });
      }
    },
    reset() {
      if (stateRef.current.status === "editing") return;
      send({ type: "reset", runId: runIdRef.current });
      runIdRef.current++;
      pendingRef.current = null;
      dispatch({ type: "reset" });
    },
  };
}
