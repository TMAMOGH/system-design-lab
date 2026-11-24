import type { UiToWorker, WorkerToUi } from "./protocol";
import { createRunner } from "./runner";

const runner = createRunner((m) => (self as unknown as { postMessage(m: WorkerToUi): void }).postMessage(m));

self.onmessage = (e: MessageEvent<UiToWorker>) => runner.handle(e.data);
