# Validation record — 15 October 2026

## Environment and scope

- Node.js 24.19.0 and npm 11.9.0 in the provided Linux workspace.
- Existing uploaded npm client: FalkorDB 6.8.0; inspected both public TypeScript declarations and installed result parser source.
- Real isolated FalkorDB 4.18.3, provided by the `falkordblite` 0.10.0 Linux wheel, on loopback port 16379.
- Separate `tracegraph_test_verify` and `tracegraph_test_ui` graphs. No connection to the user's Windows database or Docker container was available.
- Browser: Chromium 153.0.8010.0 via a local test runtime; Playwright 1.62.1. The standard Playwright browser CDN download failed, so a packaged Chromium binary was used for the browser run.

## Results

| Check | Result |
| --- | --- |
| Backend TypeScript build | Passed |
| Frontend TypeScript + Vite production build | Passed |
| Root typecheck for backend and frontend | Passed |
| Unit/API/provider tests | 9 passed, 0 failed, 0 skipped |
| Real FalkorDB integration suite | 1 scenario passed, 0 failed, 0 skipped; multiple graph/API assertions |
| Browser smoke workflow | 15 checks passed; no browser runtime errors |
| Fresh seed | 34 nodes and 44 relationships created |
| Repeated seed | 0 nodes and 0 relationships created; existing records matched |
| INC-1001 history | Populated Checkout API, INC-0932, recorded rollback/cache resolution and outcome |
| Persistence | Saved reports survive a fresh database-client connection; memory review and report URLs survive browser reload |
| Memory reuse | Later investigation retrieves prior episodic and procedural records; reviewed procedural memory contributes sourced review checks |
| UI failure/empty states | Explicitly simulated API failures/empty memory; no fabricated counts |
| Responsive layout | Mobile viewport 390×844; no document horizontal overflow; desktop and mobile captures visually inspected |

The integration scenario also checks preservation of a pre-existing incident property, duplicate-memory IDs, invalid provenance rejection, memory-type evidence constraints, archive exclusion, graph-node/edge limits, neighborhood traversal, API shapes, feedback persistence, route ordering, invalid input and missing-incident errors.

The 15 browser checks cover: live dashboard counts; real investigation creation and saving; populated historical evidence; sourced memory and feedback; review after reload; later memory retrieval; saved-report URL restore; graph focus/inspection/zoom; runbook search and no-results state; system health; controlled synthetic intake; explicit failure UI; empty memory UI; mobile overflow; absence of runtime exceptions. Normal workflows use the real API. Failure/empty responses are intercepted only for those two UI cases; they are not presented as database integration evidence.

## Warnings, failures investigated, and limits

- The uploaded archive lacked source files and Git metadata. No original server could be run. A replacement implementation was created around the supplied dependency setup.
- The driver accepts `TIMEOUT`, not `timeout`; the type error was corrected.
- The archived Windows CLI shims lacked Linux execute permission; development scripts now use `node --import tsx`, avoiding an unsupported CLI IPC path in this environment.
- A read-only count on a graph that did not exist failed. The seed's first existence query now uses the write-capable client to initialize a fresh graph key; it never clears an existing graph.
- Browser validation found ambiguous implicit labels on nested selects; explicit accessible names were added.
- Vite prints ignored `use client` directive warnings from React Router/React Flow. The production build succeeds.
- Docker is absent, so Docker images, Nginx container behavior and Compose startup have not been executed. Docker configuration received source review only.
- No live external LLM request was made. Provider failure/output validation uses stubbed fetch responses; the complete real database/browser workflow runs keylessly.
- No hosted deployment, public repository, demo video or Windows-machine verification was performed.
- The app is a single-user local demo. Authentication, production authorization, distributed uniqueness constraints and production telemetry integration are future work.

## Reproduce

Use the README's Windows setup, test graph and browser instructions. A fresh isolated test graph is important because the browser suite assumes the six-incident baseline and deliberately adds a synthetic report. No test deletes a graph or clears database contents.
