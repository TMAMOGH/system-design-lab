import type { Design } from "./core/types";

/** Component parameters and prices (§6). Service means are in virtual ms. */
export const CATALOG = {
  loadBalancer: { concurrency: 20000, queueLimit: 0, serviceMean: 0.05, fixedService: true, price: 0.05 },
  server: {
    serviceMean: 2.0,
    tiers: {
      small: { concurrency: 16, queueLimit: 64, price: 0.1 },
      medium: { concurrency: 32, queueLimit: 128, price: 0.2 },
    },
  },
  cache: {
    concurrency: 64,
    queueLimit: 256,
    serviceMean: 0.2,
    tiers: {
      small: { capacity: 10_000, price: 0.05 },
      medium: { capacity: 50_000, price: 0.15 },
      large: { capacity: 100_000, price: 0.4 },
    },
  },
  database: {
    queueLimit: 256,
    readMean: 10,
    writeMean: 20,
    tiers: {
      medium: { concurrency: 32, price: 0.5 },
      large: { concurrency: 64, price: 1.0 },
      xlarge: { concurrency: 128, price: 2.5 },
    },
  },
} as const;

/** Sum of price × instances over all nodes, in USD per hour. */
export function costPerHour(design: Design): number {
  let total = 0;
  for (const n of design.nodes) {
    const c = n.config;
    switch (c.type) {
      case "loadBalancer":
        total += CATALOG.loadBalancer.price;
        break;
      case "server":
        total += CATALOG.server.tiers[c.tier].price * c.instances;
        break;
      case "cache":
        total += CATALOG.cache.tiers[c.tier].price;
        break;
      case "database":
        total += CATALOG.database.tiers[c.tier].price;
        break;
    }
  }
  return Math.round(total * 100) / 100;
}
