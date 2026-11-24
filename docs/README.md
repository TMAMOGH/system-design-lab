# Documentation index

This project is a **visual, simulation-based system design course** built for one learner (a personal project). You build an architecture on a canvas, send simulated traffic through it, watch it break, and fix it. The simulator runs entirely in the browser.

**Last updated:** 2026-11-24

## Start here

| If you want to… | Read |
|---|---|
| Understand the whole plan and the milestones | [`system_design_course_plan.md`](../system_design_course_plan.md) |
| Understand how the simulator works | [`architecture.md`](architecture.md) |
| Find out why something was built a certain way | [`decisions.md`](decisions.md) |
| See what each review found and changed | [`review-history.md`](review-history.md) |
| Run the app or the tests | the [root README](../README.md) |

## Current status

| Area | Status |
|---|---|
| **M1** (engine, canvas, one scenario) | **Built**, committed (`8282b0d`, `c0787c5`) and pushed to GitHub. |
| **M1 gate** | **Open.** Three things remain, all yours: the FPS reading in real Chrome, your prediction for the variant scenario, and the three gate questions. Worksheet: [`notes/m1_prediction.md`](../notes/m1_prediction.md). |
| **M2** (chaos, more components, lessons for Phases 0–2) | Spec **drafted**. Review round 1 is done with 29 findings, **none applied yet**. No M2 code exists. |
| **M3–M6** | Not started. Scope is in the roadmap. |

## Document map

Status values: **Draft** (being written) · **In review** · **Accepted** (review finished, safe to build from) · **Built** (implemented) · **Archived** (kept for history).

| Document | What it is | Status | Audience |
|---|---|---|---|
| [`system_design_course_plan.md`](../system_design_course_plan.md) | The roadmap: goals, curriculum (Phases 0–9), tech design, risks, milestones M1–M6 | **Accepted**, living. Reviewed for 2 rounds. | Everyone |
| [`m1_spec.md`](../m1_spec.md) | Build spec for M1: file list, engine semantics, catalog, tests, phases. §15 records where the build deviated. | **Built** | Whoever builds or changes the engine |
| [`m2_spec.md`](../m2_spec.md) | Build spec for M2 | **In review.** Do not build from it yet. | Whoever builds M2 |
| [`architecture.md`](architecture.md) | How the M1 engine and UI fit together | Current for M1 | Anyone changing the code |
| [`decisions.md`](decisions.md) | Decision log, plus open decisions | Living | Everyone |
| [`review-history.md`](review-history.md) | Every review round: results and what changed | Living | Everyone |
| [`notes/m1_prediction.md`](../notes/m1_prediction.md) | M1 results, UI checklist, prediction exercise and gate worksheet | **In progress** | You |

### Review report files

The reports sit in the repo root. Their names are not self-explanatory, so here is the key:

| File | Reviews | Round | Outcome |
|---|---|---|---|
| `goldfish_review_report_round1.md` | Course plan | 1 | 20 issues, all fixed |
| `goldfish_review_report_round2.md` | Course plan | 2 | 21 issues: 20 fixed, 1 declined |
| `m1_review_report_round1.md` | M1 spec | 1 | 25 issues: 24 fixed, 1 declined |
| `m1_review_report_round2.md` | M1 spec | 2 | 20 distinct issues: 19 fixed, 1 declined |
| `goldfish_review_report.md` | **M2 spec** | 1 (open) | 29 issues proposed, **unresolved** |

The tooling writes the active report as `goldfish_review_report.md`, which is why older ones were renamed. When the M2 round is resolved, rename it `m2_review_report_round1.md`.

## Maintaining these docs

These documents only help if they stay current. Update them as work happens:

| When this happens | Update |
|---|---|
| A review round finishes | Add a row and the headline findings to [`review-history.md`](review-history.md). Update the report table above and the status table. |
| A decision is made, or an open one is settled | Add or edit it in [`decisions.md`](decisions.md). |
| Code changes how the engine or UI behaves | Update [`architecture.md`](architecture.md). If a spec and the code now disagree, add a note at the end of that spec, as `m1_spec.md` §15 does. |
| A milestone starts or ends | Update the status tables here and the milestone table in the plan. |
| A new document is added | Add it to the document map above. |

**Conventions:**
- Dates are ISO (`YYYY-MM-DD`).
- Link to a document instead of copying from it.
- When a document is superseded, mark it Archived. Don't delete it.

## Quick reference

```bash
npm install            # set up
npm run dev            # app at http://localhost:5173
npm test               # fast unit tests
npm run test:fidelity  # slow accuracy and scenario tests (a few minutes)
npm run bench          # engine speed (floor: 200,000 events/s)
npm run build          # type-check and build
```

GitHub: https://github.com/TMAMOGH/system-design-lab (private, branch `main`).
