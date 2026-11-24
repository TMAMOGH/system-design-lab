import { describe, expect, it } from "vitest";
import type { Design } from "../../engine/core/types";
import { canConnect, validate } from "../../engine/validate";
import { readHeavy, readHeavyReference, readHeavyStarter } from "../../scenarios/readHeavy";
import { design } from "../fixtures";

const S = readHeavy;
const server = (instances: number) => ({ type: "server" as const, tier: "small" as const, instances });

/** client → lb → server-1 → {cache, db}: valid baseline. */
const base = () =>
  design(
    [
      { id: "client", type: "client" },
      { id: "lb", type: "loadBalancer" },
      { id: "server-1", type: "server", config: server(2) },
      { id: "cache", type: "cache" },
      { id: "db", type: "database" },
    ],
    [
      ["client", "lb"],
      ["lb", "server-1"],
      ["server-1", "cache"],
      ["server-1", "db"],
    ],
  );

describe("validate", () => {
  it("accepts the starter and reference designs", () => {
    expect(validate(readHeavyStarter, S)).toEqual([]);
    expect(validate(readHeavyReference, S)).toEqual([]);
    expect(validate(base(), S)).toEqual([]);
  });

  it("rule 1: only one cache", () => {
    const d = base();
    d.nodes.push({ id: "cache-2", type: "cache", x: 0, y: 0, config: { type: "cache", tier: "small", ttlSeconds: 60 } });
    expect(validate(d, S)).toEqual(["Only one cache is allowed."]);
  });

  it("rule 1: missing server skips the server rules", () => {
    const d = design(
      [
        { id: "client", type: "client" },
        { id: "db", type: "database" },
      ],
      [],
    );
    expect(validate(d, S)).toEqual([
      "The design needs exactly one server.",
      "Connect the client to a load balancer or the server.",
    ]);
  });

  it("rule 2: type not allowed in the scenario", () => {
    expect(validate(base(), { ...S, allowed: ["client", "loadBalancer", "server", "database"] })).toEqual([
      "cache is not available in this scenario.",
    ]);
  });

  it("rule 3a: edge to a missing node", () => {
    const d = base();
    d.edges.push({ id: "e-x", source: "server-1", target: "ghost" });
    expect(validate(d, S)).toEqual(["Edge e-x points to a missing node."]);
  });

  it("rule 3: disallowed pair", () => {
    const d = base();
    d.edges.push({ id: "e-cache-db", source: "cache", target: "db" });
    expect(validate(d, S)).toEqual(["A cache cannot send requests to a database."]);
  });

  it("rule 3b: duplicate edge", () => {
    const d = base();
    d.edges.push({ id: "e-dup", source: "server-1", target: "db" });
    expect(validate(d, S)).toEqual(["server-1 is already connected to db."]);
  });

  it("rule 4: client must have exactly one outgoing edge", () => {
    const d = base();
    d.edges = d.edges.filter((e) => e.source !== "client");
    expect(validate(d, S)).toContain("Connect the client to a load balancer or the server.");
  });

  it("rule 4b: direct client → server needs instances = 1", () => {
    const d: Design = design(
      [
        { id: "client", type: "client" },
        { id: "server-1", type: "server", config: server(3) },
        { id: "db", type: "database" },
      ],
      [
        ["client", "server-1"],
        ["server-1", "db"],
      ],
    );
    expect(validate(d, S)).toEqual(["Add a load balancer to spread traffic across instances."]);
  });

  it("rule 5: load balancer must sit between client and server", () => {
    const d = base();
    d.edges = d.edges.filter((e) => e.id !== "e-lb-server-1");
    expect(validate(d, S)).toEqual(["The load balancer must sit between the client and the server."]);
  });

  it("rule 6a: server must reach the database", () => {
    const d = base();
    d.edges = d.edges.filter((e) => e.id !== "e-server-1-db");
    expect(validate(d, S)).toEqual(["Connect the server to the database."]);
  });

  it("rule 6b: server must reach the cache when one exists", () => {
    const d = base();
    d.edges = d.edges.filter((e) => e.id !== "e-server-1-cache");
    expect(validate(d, S)).toEqual(["Connect the server to the cache, or remove the cache."]);
  });

  it("rule 7: instance count in range", () => {
    const d = base();
    d.nodes = d.nodes.map((n) => (n.id === "server-1" ? { ...n, config: server(25) } : n));
    expect(validate(d, S)).toEqual(["Server instances must be between 1 and 20."]);
  });

  it("collects several errors in rule order", () => {
    const d = base();
    d.edges = d.edges.filter((e) => e.source !== "client" && e.id !== "e-server-1-db");
    expect(validate(d, S)).toEqual([
      "Connect the client to a load balancer or the server.",
      "The load balancer must sit between the client and the server.",
      "Connect the server to the database.",
    ]);
  });

  it("canConnect", () => {
    expect(canConnect("cache", "database")).toBe("A cache cannot send requests to a database.");
    expect(canConnect("server", "cache")).toBeNull();
  });
});
