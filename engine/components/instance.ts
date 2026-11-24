import type { Simulation } from "../core/sim";
import type { Message, Response } from "../core/types";

export type Behavior = (msg: Message, done: (res: Response) => void) => void;

export interface InstanceParams {
  concurrency: number;
  queueLimit: number;
  serviceMean: (m: Message) => number;
  fixedService: boolean;
}

/**
 * One worker pool with a FIFO queue (§5.6). Workers stay held while the
 * behavior waits on downstream calls, which is how slowness cascades upstream.
 */
export class Instance {
  // cumulative
  accepted = 0;
  // per-second, reset by the metrics sampler
  heldArea = 0;
  serviceArea = 0;
  rejected = 0;
  dropped = 0;
  // live
  busy = 0;
  inService = 0;
  lastChange = 0;
  queue: { msg: Message; reply: (res: Response) => void }[] = [];

  constructor(
    public id: string,
    private sim: Simulation,
    public params: InstanceParams,
    private behavior: Behavior,
  ) {}

  flush(): void {
    const dt = this.sim.now - this.lastChange;
    if (dt > 0) {
      this.heldArea += this.busy * dt;
      this.serviceArea += this.inService * dt;
    }
    this.lastChange = this.sim.now;
  }

  accept(msg: Message, reply: (res: Response) => void): void {
    this.accepted++;
    if (this.busy < this.params.concurrency) {
      this.start(msg, reply);
    } else if (this.queue.length < this.params.queueLimit) {
      this.queue.push({ msg, reply });
    } else {
      this.rejected++;
      reply({ ok: false, error: "rejected" });
    }
  }

  private start(msg: Message, reply: (res: Response) => void): void {
    this.flush();
    this.busy++;
    if (this.sim.now >= msg.deadline) {
      this.dropped++;
      this.finish(reply, { ok: false, error: "timeout" });
      return;
    }
    const mean = this.params.serviceMean(msg);
    const s = this.params.fixedService ? mean : this.sim.rng.exp(mean);
    this.inService++;
    this.sim.schedule(
      s,
      () => {
        this.flush();
        this.inService--;
        this.behavior(msg, (res) => this.finish(reply, res));
      },
      { type: "serviceDone", node: this.id, msg: msg.id },
    );
  }

  private finish(reply: (res: Response) => void, res: Response): void {
    this.flush();
    this.busy--;
    reply(res);
    const next = this.queue.shift();
    if (next) this.start(next.msg, next.reply);
  }
}
