import type { ComponentType, Design, DesignEdge, Scenario } from "./core/types";

const LABEL: Record<ComponentType, string> = {
  client: "client",
  loadBalancer: "load balancer",
  server: "server",
  cache: "cache",
  database: "database",
};

const ALLOWED_PAIRS = new Set([
  "client>loadBalancer",
  "client>server",
  "loadBalancer>server",
  "server>cache",
  "server>database",
]);

/** Returns null if a sourceType → targetType edge is allowed, else the refusal reason. */
export function canConnect(sourceType: ComponentType, targetType: ComponentType): string | null {
  if (ALLOWED_PAIRS.has(`${sourceType}>${targetType}`)) return null;
  return `A ${LABEL[sourceType]} cannot send requests to a ${LABEL[targetType]}.`;
}

const ORDER: ComponentType[] = ["client", "loadBalancer", "server", "cache", "database"];
const EXACTLY_ONE: ComponentType[] = ["client", "server", "database"];

/** Collects all design errors in rule order (§7). Empty list = valid. */
export function validate(design: Design, scenario: Scenario): string[] {
  const errors: string[] = [];
  const byId = new Map(design.nodes.map((n) => [n.id, n]));
  const ofType = (t: ComponentType) => design.nodes.filter((n) => n.type === t);

  // Rule 1: node counts.
  const bad = new Set<ComponentType>();
  for (const t of ORDER) {
    const count = ofType(t).length;
    if (EXACTLY_ONE.includes(t) && count === 0) {
      errors.push(`The design needs exactly one ${LABEL[t]}.`);
      bad.add(t);
    } else if (count > 1) {
      errors.push(`Only one ${LABEL[t]} is allowed.`);
      bad.add(t);
    }
  }

  // Rule 2: allowed types.
  for (const t of ORDER) {
    if (ofType(t).length > 0 && !scenario.allowed.includes(t)) {
      errors.push(`${LABEL[t]} is not available in this scenario.`);
    }
  }

  // Rule 3a: edges point to existing nodes. Broken edges are ignored afterwards.
  const edges: DesignEdge[] = [];
  for (const e of design.edges) {
    if (!byId.has(e.source) || !byId.has(e.target)) errors.push(`Edge ${e.id} points to a missing node.`);
    else edges.push(e);
  }

  // Rule 3: allowed pairs.
  for (const e of edges) {
    const reason = canConnect(byId.get(e.source)!.type, byId.get(e.target)!.type);
    if (reason) errors.push(reason);
  }

  // Rule 3b: no duplicate edges.
  const seen = new Set<string>();
  for (const e of edges) {
    const k = `${e.source}>${e.target}`;
    if (seen.has(k)) errors.push(`${e.source} is already connected to ${e.target}.`);
    seen.add(k);
  }

  const one = (t: ComponentType) => (bad.has(t) ? undefined : ofType(t)[0]);
  const client = one("client");
  const server = one("server");
  const db = one("database");
  const lb = one("loadBalancer");
  const cache = one("cache");
  const has = (s: string, t: string) => edges.some((e) => e.source === s && e.target === t);

  // Rule 4 / 4b: client wiring.
  if (client) {
    const out = edges.filter((e) => e.source === client.id);
    if (out.length !== 1) errors.push("Connect the client to a load balancer or the server.");
    else if (server && out[0].target === server.id && server.config.type === "server" && server.config.instances !== 1) {
      errors.push("Add a load balancer to spread traffic across instances.");
    }
  }

  // Rule 5: the load balancer sits between client and server.
  if (lb && client && server && !(has(client.id, lb.id) && has(lb.id, server.id))) {
    errors.push("The load balancer must sit between the client and the server.");
  }

  // Rule 6a / 6b: server wiring.
  if (server && db && !has(server.id, db.id)) errors.push("Connect the server to the database.");
  if (server && cache && !has(server.id, cache.id)) errors.push("Connect the server to the cache, or remove the cache.");

  // Rule 7: instance count.
  if (server && server.config.type === "server") {
    const n = server.config.instances;
    if (!Number.isInteger(n) || n < 1 || n > 20) errors.push("Server instances must be between 1 and 20.");
  }

  return errors;
}
