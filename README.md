# System Design Sandbox (M1)

A local, browser-only sandbox for learning system design by building architectures, sending traffic through them, and watching them break.

- **Documentation index:** [`docs/README.md`](docs/README.md) — start here for status, architecture, decisions and review history
- Roadmap: [`system_design_course_plan.md`](system_design_course_plan.md)
- M1 build spec: [`m1_spec.md`](m1_spec.md)
- M2 build spec (in review): [`m2_spec.md`](m2_spec.md)

## Setup

```bash
npm install
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Run the app at http://localhost:5173 |
| `npm run build` | Type-check and build a static bundle into `dist/` |
| `npm test` | Fast engine unit tests |
| `npm run test:fidelity` | Slow fidelity and scenario-solvability tests |
| `npm run bench` | Engine throughput benchmark (≥ 200k events/s) |
