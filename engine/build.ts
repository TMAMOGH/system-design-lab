import { CATALOG } from "./catalog";
import { createCacheBehavior, LruTtlStore } from "./components/cache";
import { createClient } from "./components/client";
import { createDbBehavior } from "./components/database";
import { Instance, type Behavior, type InstanceParams } from "./components/instance";
import { createLbBehavior } from "./components/loadBalancer";
import { createServerBehavior, type ServerDeps } from "./components/server";
import { createRng } from "./core/rng";
import { Simulation } from "./core/sim";
import type { Design, DesignNode, Hop, Message, Op, Response, Scenario, TraceMeta } from "./core/types";
import { createZipf } from "./core/zipf";
import { evaluate, type Evaluation } from "./evaluator";
import { MetricsCollector, type Bucket, type MeteredNode, type Records } from "./metrics";

// ---------------------------------------------------------------- Links (§5.5)

export interface Links {
  readonly sim: Simulation;
  call(edgeId: string, target: Instance, msg: Message, cb: (res: Response) => void): void;
  fireAndForget(fn: () => void, meta: TraceMeta): void;
  setSampleN(n: number): void;
  drainHops(): Hop[];
}

export function createLinks(sim: Simulation, linkLatencyMs: number): Links {
  let sampleN = 0;
  let hops: Hop[] = [];
  const sampled = (id: number) => sampleN > 0 && id % sampleN === 0;
  return {
    sim,
    call(edgeId, target, msg, cb) {
      if (sampled(msg.id)) hops.push({ edgeId, dir: "fwd", ok: true, vt: sim.now });
      sim.schedule(
        linkLatencyMs,
        () =>
          target.accept(msg, (res) => {
            if (sampled(msg.id)) hops.push({ edgeId, dir: "back", ok: res.ok, vt: sim.now });
            sim.schedule(linkLatencyMs, () => cb(res), { type: "reply", node: target.id, msg: msg.id });
          }),
        { type: "accept", node: target.id, msg: msg.id },
      );
    },
    fireAndForget(fn, meta) {
      sim.schedule(linkLatencyMs, fn, meta);
    },
    setSampleN(n) {
      sampleN = n;
    },
    drainHops() {
      const out = hops;
      hops = [];
      return out;
    },
  };
}

// ---------------------------------------------------------------- build (§5.8)

export interface BuildOptions {
  seed?: number;
  linkLatencyMs?: number;
  onEvent?: Simulation["onEvent"];
  arrivals?: { tMs: number; key: number; op: Op }[];
  override?: Record<
    string,
    { concurrency?: number; queueLimit?: number; serviceMeanMs?: number; fixedService?: boolean }
  >;
}

export interface Built {
  sim: Simulation;
  endMs: number;
  isFinished(): boolean;
  runUntil(tMs: number, wallBudgetMs: number): number;
  setSampleN(n: number): void;
  drainBuckets(): Bucket[];
  drainHops(): Hop[];
  allBuckets(): Bucket[];
  records(): Records;
  requestsCreated(): number;
  instances(nodeId: string): Instance[];
  evaluate(): Evaluation;
}

const DOWNSTREAM_FIRST: DesignNode["type"][] = ["database", "cache", "server", "loadBalancer"];

export function build(design: Design, scenario: Scenario, opts: BuildOptions = {}): Built {
  const sim = new Simulation(createRng(opts.seed ?? scenario.seed));
  sim.onEvent = opts.onEvent;
  const links = createLinks(sim, opts.linkLatencyMs ?? 0.5);

  const timeoutMs = scenario.client.timeoutMs;
  const trafficEnd = opts.arrivals
    ? Math.max(0, ...opts.arrivals.map((a) => a.tMs))
    : scenario.durationSec * 1000;
  const endMs = trafficEnd + (Number.isFinite(timeoutMs) ? timeoutMs : 60_000);

  // Finalize is scheduled first so it pops before anything else at endMs.
  let client: ReturnType<typeof createClient> | undefined;
  sim.schedule(endMs, () => client?.finalize(endMs), { type: "end", node: "", msg: 0 });

  const byId = new Map(design.nodes.map((n) => [n.id, n]));
  const outEdges = (id: string) => design.edges.filter((e) => e.source === id);
  const instancesById = new Map<string, Instance[]>();
  const metered: MeteredNode[] = [];
  const ov = (id: string) => opts.override?.[id] ?? {};

  const makeInstances = (
    node: DesignNode,
    count: number,
    base: InstanceParams,
    behavior: (i: number) => Behavior,
  ): Instance[] => {
    const o = ov(node.id);
    const params: InstanceParams = {
      concurrency: o.concurrency ?? base.concurrency,
      queueLimit: o.queueLimit ?? base.queueLimit,
      serviceMean: o.serviceMeanMs !== undefined ? () => o.serviceMeanMs! : base.serviceMean,
      fixedService: o.fixedService ?? base.fixedService,
    };
    const list: Instance[] = [];
    for (let i = 0; i < count; i++) list.push(new Instance(`${node.id}#${i}`, sim, params, behavior(i)));
    instancesById.set(node.id, list);
    return list;
  };

  const ordered = [...design.nodes]
    .filter((n) => n.type !== "client")
    .sort((a, b) => DOWNSTREAM_FIRST.indexOf(a.type) - DOWNSTREAM_FIRST.indexOf(b.type));
  const stores = new Map<string, LruTtlStore>();

  for (const node of ordered) {
    const c = node.config;
    if (c.type === "database") {
      const t = CATALOG.database.tiers[c.tier];
      const list = makeInstances(
        node,
        1,
        {
          concurrency: t.concurrency,
          queueLimit: CATALOG.database.queueLimit,
          serviceMean: (m) => (m.op === "read" ? CATALOG.database.readMean : CATALOG.database.writeMean),
          fixedService: false,
        },
        () => createDbBehavior(),
      );
      metered.push({ id: node.id, instances: list, concurrency: list[0].params.concurrency });
    } else if (c.type === "cache") {
      const store = new LruTtlStore(CATALOG.cache.tiers[c.tier].capacity, c.ttlSeconds * 1000);
      stores.set(node.id, store);
      const counters = { hits: 0, misses: 0 };
      const list = makeInstances(
        node,
        1,
        {
          concurrency: CATALOG.cache.concurrency,
          queueLimit: CATALOG.cache.queueLimit,
          serviceMean: () => CATALOG.cache.serviceMean,
          fixedService: false,
        },
        () => createCacheBehavior(store, counters, sim),
      );
      metered.push({ id: node.id, instances: list, concurrency: list[0].params.concurrency, cacheCounters: counters });
    } else if (c.type === "server") {
      const deps: Partial<ServerDeps> = {};
      for (const e of outEdges(node.id)) {
        const target = byId.get(e.target);
        if (!target) continue;
        const inst = instancesById.get(target.id)?.[0];
        if (!inst) continue;
        if (target.type === "database") deps.db = { edgeId: e.id, instance: inst };
        if (target.type === "cache") deps.cache = { edgeId: e.id, instance: inst, store: stores.get(target.id)! };
      }
      if (!deps.db) throw new Error(`Server ${node.id} has no database edge.`);
      const t = CATALOG.server.tiers[c.tier];
      const list = makeInstances(
        node,
        c.instances,
        {
          concurrency: t.concurrency,
          queueLimit: t.queueLimit,
          serviceMean: () => CATALOG.server.serviceMean,
          fixedService: false,
        },
        () => createServerBehavior(links, deps as ServerDeps),
      );
      metered.push({ id: node.id, instances: list, concurrency: list[0].params.concurrency });
    } else if (c.type === "loadBalancer") {
      const edge = outEdges(node.id)[0];
      const targets = edge ? instancesById.get(edge.target) ?? [] : [];
      if (!edge || targets.length === 0) throw new Error("The load balancer has no downstream server.");
      const lb = CATALOG.loadBalancer;
      const list = makeInstances(
        node,
        1,
        {
          concurrency: lb.concurrency,
          queueLimit: lb.queueLimit,
          serviceMean: () => lb.serviceMean,
          fixedService: lb.fixedService,
        },
        () => createLbBehavior(links, edge.id, targets),
      );
      metered.push({ id: node.id, instances: list, concurrency: list[0].params.concurrency });
    }
  }

  const metrics = new MetricsCollector(metered, scenario, endMs);

  const clientNode = design.nodes.find((n) => n.type === "client");
  const clientEdge = clientNode ? outEdges(clientNode.id)[0] : undefined;
  const clientTarget = clientEdge ? instancesById.get(clientEdge.target)?.[0] : undefined;
  if (!clientEdge || !clientTarget) throw new Error("The client is not connected.");

  client = createClient(sim, links, {
    scenario,
    edgeId: clientEdge.id,
    target: clientTarget,
    zipf: createZipf(scenario.keyspace, scenario.zipfS, sim.rng),
    arrivals: opts.arrivals,
    onRecord: (c, l, o, at) => metrics.onRecord(c, l, o, at),
    onCreate: (t) => metrics.onCreate(t),
  });

  // Sampler: closes one bucket per virtual second, starting at t = 1000.
  const scheduleSample = (at: number) => {
    if (at > endMs) return;
    sim.schedule(
      at - sim.now,
      () => {
        metrics.sample(at / 1000 - 1);
        scheduleSample(at + 1000);
      },
      { type: "sample", node: "", msg: 0 },
    );
  };
  scheduleSample(1000);

  return {
    sim,
    endMs,
    isFinished: () => sim.now >= endMs,
    runUntil: (tMs, wallBudgetMs) => sim.runUntil(tMs, wallBudgetMs),
    setSampleN: (n) => links.setSampleN(n),
    drainBuckets: () => metrics.drainBuckets(),
    drainHops: () => links.drainHops(),
    allBuckets: () => metrics.allBuckets(),
    records: () => metrics.records,
    requestsCreated: () => client!.requestsCreated(),
    instances: (id) => instancesById.get(id) ?? [],
    evaluate: () => evaluate(metrics.records, metrics.allBuckets(), design, scenario),
  };
}
