# TraceGraph AI

**Evidence-first incident investigation for connected systems.**

TraceGraph AI is a local operations console for investigating fictional software incidents through connected evidence. It traces affected services, dependencies, deployments, historical incidents, recorded resolutions, runbooks and owners in **FalkorDB**, then saves an explainable report and persistent agent memory.

Target tracks: **01 — Agents That Act on Connected Data** and **02 — Agent Memory and Coordination**. Company Brain is a future extension.

## Why a graph?

Incident context is scattered across service catalogs, change records, runbooks and historical investigations. A text answer alone can hide where an explanation came from. TraceGraph retrieves paths such as:

`INC-1001 → AFFECTS → Checkout API ← AFFECTS ← INC-0932 ← RESOLVES ← RES-0932`

The same affected-service path expands through up to two dependency hops to find related historical resolutions, owners and runbooks. Persistent memory is retrieved through shared or downstream services. Removing these relationships removes investigation context: FalkorDB is the primary storage and retrieval layer, not a dashboard add-on.

## Features

- Live incident and memory counts; truthful database health with a real count query.
- Existing incident selection, incident-ID input and controlled unverified synthetic-report intake.
- Deterministic keyless investigation with evidence IDs, provenance paths, ranked hypotheses, counter-evidence, missing information and recommended checks.
- Historical successes **and failed remediations**, with explicit uncertainty about applying them to the current incident.
- Saved reports, JSON export, usefulness feedback and repeat investigation.
- Interactive graph with pan, zoom, node details, relationship inspection, label filtering and incident focus.
- Episodic memory created from completed investigations; user-authored sourced semantic and procedural memory, review/archive controls and pagination.
- Reviewed procedural memories contribute explicit review checks to later reports; retrieved context never proves root cause or inflates confidence.
- Database-backed runbooks and service owners.
- Optional model-assisted ranking constrained to existing hypothesis IDs, with safe deterministic fallback.
- Synthetic seeder that uses stable IDs and MERGE and preserves existing node properties.

## Audit of the supplied project

The supplied `backend.zip` included `package.json`, a lockfile and Windows dependencies, including `falkordb` **6.8.0**. Its `src/` directory was empty. No `server.ts`, `.env`, tests, frontend, Git metadata or working project checkout was available in this workspace. Consequently this implementation could not reproduce the exact missing original server code or inspect unuploaded Windows changes.

The existing backend manifest and dependencies were the starting point. The driver source at `falkordb/dist/src/graph.js` and `graph.d.ts` confirms that `Graph.query` already produces named row objects in `data` and removes the headers from the public result. `backend/src/results.ts` now consumes those records directly. Regression coverage includes first-row reading, a nonzero count, valid zero, malformed results and populated historical evidence. Query failures are propagated, never converted to empty evidence or zero counts.

Your Windows Docker instance is not accessible from this environment. The original `tracegraph` graph was not queried, seeded, cleared or otherwise changed here. Integration verification used a separate local FalkorDB instance and isolated test graphs. See `docs/VALIDATION.md` for actual results and remaining verification.

Before copying these files over an existing Windows project, back up or commit your current work and compare any local source absent from the upload. The archive contains `backend/`, `frontend/` and root scripts; extract its contents into your project root, avoiding another nested TraceGraph-AI folder.

## Architecture

```mermaid
flowchart TD
  Console["React / Vite console"] --> API["Express / TypeScript API"]
  API --> Agent["Bounded investigation engine"]
  Agent --> Graph["FalkorDB knowledge and memory graph"]
  API --> Graph
  Agent --> Ranking["Optional hypothesis ranking provider"]
```

| Location | Responsibility |
| --- | --- |
| `backend/src/results.ts`, `db.ts` | Named-record normalization, lazy connection, bounded query timeout, observable failures and reconnect |
| `backend/src/repository.ts` | Predefined parameterized retrieval and controlled graph writes |
| `backend/src/engine.ts` | Evidence construction, cautious hypothesis rules, provider ranking and persistent investigation workflow |
| `backend/src/app.ts` | Express API, Zod validation, error handling and structured request logs |
| `backend/src/dataset.ts`, `seed.ts` | Fictional Northstar graph and non-destructive idempotent seed |
| `backend/src/types.ts` | Report and graph DTO contracts, also imported as types by React |
| `frontend/src/Overview.tsx`, `Investigations.tsx`, `Graph.tsx` | Main operational workflows |
| `frontend/src/MemoryPage.tsx`, `RunbooksPage.tsx`, `SettingsPage.tsx` | Knowledge and health screens |
| `frontend/src/components.tsx`, `hooks.ts`, `api.ts` | Reusable states, data fetching and API client |
| `docs/GRAPH.md` | Schema, exact important Cypher, reasoning rules, memory design and limitations |

Frontend uses React, TypeScript, Vite, Tailwind CSS, React Router, Lucide and React Flow. Backend uses Express, TypeScript, the official FalkorDB npm client, Dotenv and Zod. Tests use Node's test runner and Playwright. No second persistence database or browser-localStorage store is used.

## Windows quick start — use your existing database

Prerequisites: Node.js 22+ (Node 24 recommended), npm, and your already-running FalkorDB Docker container at `127.0.0.1:6379`. FalkorDB Browser can remain on port 3000. The frontend uses 5173 and backend uses 5000.

In **PowerShell**, from `C:\Users\hp\TraceGraph-AI`:

```powershell
npm run setup
Copy-Item backend/.env.example backend/.env
```

Only copy the example if you do not already have an `.env`. Keep your existing configuration otherwise. Defaults connect to your existing `tracegraph` graph on port 6379. Secrets belong only in `backend/.env`, which is ignored by Git.

Inspect/verify the existing container if necessary:

```powershell
& "$env:LOCALAPPDATA\Programs\DockerDesktop\resources\bin\docker.exe" exec tracegraph-falkordb redis-cli ping
```

Expected: `PONG`. This is a diagnostic command; do not remove or replace your current container. If `docker` is already on PATH, use `docker exec tracegraph-falkordb redis-cli ping`.

Expand the existing fictional dataset, preserving current properties:

```powershell
npm run seed
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). API health: [http://localhost:5000/api/health](http://localhost:5000/api/health). The health result must report a real numeric count. Start with `INC-1001`. Run `npm run seed` again to confirm zero newly created seed records; investigations add their own evidence, actions and memory nodes, so total graph size can legitimately grow after investigating.

`npm run setup` uses lockfiles to install the existing package choices. It does not remove the graph. ZIP files containing Windows `node_modules` are not portable across operating systems; the deliverable excludes dependencies and installs them for the target OS. No Docker, Node, Git or WSL reinstall is required.

Separate commands:

```powershell
npm run dev:backend
npm run dev:frontend
```

Run each in a separate terminal. Stop development with Ctrl+C. For backend compiled mode: `npm run build --prefix backend`, then `npm start --prefix backend`. A production frontend requires a reverse proxy for `/api`; Vite's development proxy does not ship inside static assets.

## Configuration

| Variable | Default / purpose |
| --- | --- |
| `FALKORDB_HOST` | `127.0.0.1`; Compose uses `falkordb` |
| `FALKORDB_PORT` | `6379` |
| `FALKORDB_GRAPH` | `tracegraph`; test graphs must start `tracegraph_test` |
| `FALKORDB_URL` | Optional `falkors://username:password@host:port` for a TLS endpoint |
| `FALKORDB_PASSWORD` | Optional backend-only database password |
| `HOST`, `PORT` | `127.0.0.1`, `5000`; backend listener |
| `CORS_ORIGIN` | `http://localhost:5173`; exact permitted browser origin |
| `VITE_API_URL` | `/api`; backend API base, never a credential |
| `API_PROXY_TARGET` | `http://127.0.0.1:5000`; development Vite proxy target |
| `OPENAI_API_KEY` | Optional server-only key; absent means deterministic mode |
| `OPENAI_MODEL` | `gpt-4.1-mini`; choose a model available to your provider |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1`; OpenAI-compatible endpoint |

Changing a backend environment value requires restarting the backend. Optional ranking sends graph evidence to the configured provider. Only enable it when that data transfer is appropriate. No external provider is required, and provider output cannot introduce factual claims or executable actions. A 12-second provider timeout, HTTP failure or invalid permutation falls back to deterministic ranking with a report limitation.

## API reference

All successful responses are direct JSON objects/arrays. Errors use `{ "error": "..." }`, with validation details for bad inputs and `database: "disconnected"` for database errors. Relevant status codes: 400 invalid request, 404 missing record/route, 503 graph query/connectivity failure, 500 unexpected server failure. POST creates return 201.

| Method / endpoint | Behavior |
| --- | --- |
| GET `/api/health` | Graph name, verified node count, connectivity and provider configuration; no secrets |
| GET `/api/overview` | Counts, open incidents, recent incidents/investigations |
| GET `/api/incidents?status=Investigating&limit=50&offset=0` | Exact status filter and bounded page |
| GET `/api/incidents/:incidentId` | Incident, affected services, dependencies and historical evidence |
| GET `/api/services` | Bounded service list for controlled intake |
| POST `/api/incidents` | `{title,summary,serviceId,syntheticAcknowledged:true}`; creates an Unverified report |
| GET `/api/graph?label=Service&limit=80` | Bounded nodes, induced edges, limits and saturation flag |
| GET `/api/graph/neighborhood/:nodeId?limit=70` | Three-hop operational neighborhood |
| POST `/api/investigations` | `{ "incidentId": "INC-1001" }`; analyzes and persists report plus episodic memory |
| GET `/api/investigations` | Latest 50 report metadata records |
| GET `/api/investigations/by-incident/:incidentId` | Latest saved reports for incident |
| GET `/api/investigations/:investigationId` | Complete saved report |
| PATCH `/api/investigations/:investigationId` | `{feedback:"useful"}` or `needs-review` |
| GET `/api/memory?type=procedural&limit=12&offset=0` | Memory with type filter and pagination |
| POST `/api/memory` | Sourced `{type,content,source,incidentId,evidenceIds,confidence}`; source is a saved investigation ID |
| PATCH `/api/memory/:memoryId` | `{status:"reviewed"}`, `archived` or `unreviewed` |
| GET `/api/runbooks` | Runbooks and associated services |
| GET `/api/investigate/:incidentId` | Historical-evidence diagnostic endpoint for parser verification |

There is no public seed endpoint. Use the CLI. Incident IDs are bounded and validated; query values are parameterized. Graph labels are allowlisted. No arbitrary Cypher endpoint exists. All proposed actions remain Suggested; real infrastructure changes and approval/execution integrations are outside this demo.

## Verify investigation and persistence

1. Seed, then inspect `/api/health` and `/api/investigate/INC-1001`. Confirm the Checkout API / INC-0932 / RES-0932 fields are populated.
2. Run INC-1001 from Investigations. Inspect the tool trace and Evidence tab; open a historical resolution's source and graph path.
3. Inspect Connected context for dependencies, teams, runbooks and historical outcomes. Healthy Identity status should weaken the dependency hypothesis; the deployment hypothesis must not claim causation.
4. In Memory & feedback, save a procedural memory from a runbook evidence source. Open Agent Memory, filter procedural and mark it reviewed.
5. Run INC-1001 again. Check retrieved memories and Memory-informed checks. Archived memories should not be retrieved.
6. Reload the browser or restart the backend, then open a saved investigation. The report and memory should still be present in FalkorDB.

Graph check:
```cypher
MATCH (m:Memory)-[:ABOUT]->(i:Incident {id:'INC-1001'})
OPTIONAL MATCH (m)-[:DERIVED_FROM]->(e:Evidence)
RETURN m, i, e LIMIT 60
```

## Tests and build

```powershell
npm run typecheck
npm test
npm run build
```

Integration tests require a reachable **separate test graph** and never delete it:

```powershell
$env:FALKORDB_GRAPH = "tracegraph_test_local"
npm run test:integration
Remove-Item Env:FALKORDB_GRAPH
```

The test graph guard skips the integration suite unless the graph name starts with `tracegraph_test`. A skipped suite does not prove database integration. Use a fresh test graph: API assertions expect the seeded six-incident baseline. The suite writes demo reports and memory, validates a fresh client reconnect, repeat seeding, historical fields, bounded graphs, forged provenance rejection, request validation and 404 behavior.

Browser checks require the backend and frontend already running with a freshly seeded disposable graph. They create reports, memories and a synthetic report. Never run them against your main graph if you want to keep it free of test intake data.

```powershell
# Once, to install the browser:
npm exec --prefix frontend -- playwright install chromium
# With the test API and Vite running:
npm run test:ui
```

`UI_BASE_URL` can override the default `http://127.0.0.1:5173`. Browser checks use real API responses for normal workflows and intercept only the explicit failure/empty-state cases. Optional `CHROMIUM_EXECUTABLE_PATH` selects an existing browser binary. See the validation report for actual runs.

## Clean-environment Docker setup

**Skip this section when using your existing Windows container.** This Compose stack creates its own database volume and does not publish database ports, so it does not bind ports 6379 or 3000 on your host. Do not run it accidentally expecting to access your existing Windows graph.

```powershell
docker compose up --build -d
# Seed inside the backend container using compiled code:
docker compose exec backend node dist/seed.js
```

Open [http://localhost:8080](http://localhost:8080). Nginx serves the built console and proxies `/api` to `backend:5000`; the backend connects to **`falkordb:6379`**. The database is stored in the named `graph-data` volume. Do not remove the volume if you want to retain saved memory. No database reset command is part of this workflow.

The base Compose config uses the vendor's `latest` FalkorDB image for convenience; set `FALKORDB_IMAGE` to a tested immutable release/digest before deployment. Docker builds and Compose could not be executed here because Docker is absent.

## Deployment and security

Local development listeners bind to localhost. Compose only publishes the console on `127.0.0.1:8080`. This version is a local single-user demo without account authentication, authorization or rate limiting. Before hosting it for other users, add authentication at a gateway, TLS, per-user access control, request throttling and a restricted FalkorDB network/ACL configuration. Do not expose this API or an unauthenticated database directly to the internet.

For hosted FalkorDB, configure a backend-reachable TLS endpoint using `FALKORDB_URL`, appropriate credentials and restricted network access. A cloud backend cannot reach your laptop's localhost database. Serve frontend and API on the same origin via a reverse proxy or set `VITE_API_URL` and `CORS_ORIGIN` appropriately. Credentials stay on the backend. The seed command must run in that environment with its backend configuration.

There is no deployed URL or demo recording from this task. Hosting credentials and a reachable managed database would be required for an external deployment. [docs/DEMO.md](docs/DEMO.md) contains a 2–3 minute recording script; [SUBMISSION.md](SUBMISSION.md) lists remaining submission work.

## Limitations and next improvements

All operational records are fictional Northstar Systems data. No production telemetry, ticket, chat or infrastructure integration is present. Confidence is heuristic, not calibrated. Model-provider behavior is covered by stubbed failure/shape tests, not a live paid API call. Investigation/memory writes span multiple operations; a failure after report saving can leave a report without its new memory. The single-writer demo uses MERGE/deterministic memory IDs but does not provision distributed uniqueness constraints. Large production graphs need identity constraints, indexed IDs, richer pagination, narrower deployment time windows, query-plan evaluation and retention policies. Memory review is a user label, not a factual verification mechanism.

Future work: authenticated workspaces, telemetry timestamps and freshness checks, richer service-scoped memory retrieval, contradiction reconciliation, agent coordination, evaluation datasets and monitored production query budgets.
## Live Demo

- **Live Application:** https://tracegraphai.up.railway.app/
- **Demo Video:** https://youtu.be/1-G7alMillY
- **Source Code:** https://github.com/shubham-coder-ship-it/TraceGraph-AI

TraceGraph AI is deployed on Railway and uses FalkorDB to investigate synthetic software incidents through connected evidence, service dependencies, historical incidents, runbooks, and persistent investigation memory.

The demo uses synthetic data. Investigation results identify potential causes from available evidence; graph relationships alone do not prove causation.
