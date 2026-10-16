# Graph Explorer layout repair

## Diagnosis

The previous frontend assigned one column per node label and stacked all nodes of that label 100 pixels apart. A graph or filter containing mostly Evidence, Memory, or Service nodes therefore became a long vertical stack. Fitting that extent shrank the labels severely. Default nodes had a width but no fixed height; long labels could exceed the assumed row spacing. Initial fit was requested while graph nodes were still being populated asynchronously.

The backend focused neighborhood also stopped at two operational hops. The path from INC-1001 to a historical resolution requires three: incident → affected service ← historical incident ← resolution.

## Changes

- `frontend/src/graphLayout.ts`: deterministic breadth-first connected components, neighbor ordering, wrapped short columns and component shelf packing. Uses actual edges for adjacency. It returns exactly the input node IDs with computed positions; no graph records are synthesized.
- `frontend/src/Graph.tsx`: applies layout positions, 224×112 node boxes, 112-pixel column gaps and 56-pixel row gaps, smooth-step edges with backed labels, and larger label text. Long titles are limited to two lines, with full titles available on hover and in the existing inspector. Styling changes preserve dragged positions.
- `frontend/src/GraphViewport.tsx`: waits for node measurement and the current layout generation before fitting once. Inspection, highlighting and ordinary rerenders do not reset the viewport. Changing focus/filter or explicitly pressing Focus/Reset fits the resulting layout. Manual fit/zoom/pan controls remain available.
- `frontend/src/style.css`: bounded title/ID rendering and larger text inside nodes.
- `backend/src/repository.ts`: focused query expands to three allowlisted operational hops and prioritizes the focus node, operational context and memory before investigation records. Existing response fields, parameter validation, node limits and 240-edge bound are unchanged. The all-graph and label-filter API contracts remain unchanged. Investigation dependency traversal is still limited to two outgoing dependency hops.

The API can still truncate large neighborhoods. The existing bounded-view notice remains visible. Dense graphs still require zooming or focusing to read every detail; this is not an edge-crossing-free layout algorithm.

## Verification commands

```powershell
npm run typecheck
npm run build
npm test
npm run test:layout --prefix frontend
```

For real graph integration, use a disposable graph whose name begins with `tracegraph_test` and a reachable FalkorDB server:

```powershell
$env:FALKORDB_GRAPH = "tracegraph_test_graph_layout"
npm run test:integration
```

With the API and frontend running against a disposable seeded test graph:

```powershell
npm run test:ui
npm run test:graph-ui --prefix frontend
```

The general UI suite creates a synthetic incident. Its six-incident baseline assumes an isolated dataset. Do not run setup/seed or this suite against the production graph just to verify a layout change. The graph-specific UI suite requires seeded incident/resolution paths and at least one saved investigation memory, created by the general UI suite or test setup.

Graph layout tests cover same-type nodes, fan-out, deterministic row ordering, non-overlap, cycles, disconnected components, dangling edges and compact/filter layouts. Graph UI checks cover delayed API loading and automatic fit, API-to-rendered node identity, third-hop historical resolution and memory context, node/edge inspection, stable manual zoom/pan, filters/reset, and an explicitly intercepted 80-node same-type regression fixture. The fixture exists only in the UI test; production graph data remains FalkorDB-backed.

Verification was performed in the supplied Linux workspace with Node 24, real isolated FalkorDB 4.18.3 and the existing alternate Chromium/Playwright runtime. The Windows project path and Windows database were not directly accessible. No production graph was cleared, modified or reseeded. Docker execution was not part of this patch.

## Actual results

- Root backend/frontend typecheck: passed.
- Backend and frontend production builds: passed. Vite retains the existing ignored `use client` warnings from React Router/React Flow.
- Backend unit/API/provider tests: 9 passed, 0 failed, 0 skipped.
- Real FalkorDB integration scenario: passed, including historical resolution, memory and focus-priority assertions.
- Layout unit tests: 5 passed.
- Existing full UI workflow: 15 checks passed.
- Additional graph UI workflow: 8 checks passed, including preserved zoom/pan and non-overlapping 80-node layout.
- Browser runtime errors: none. Desktop focus and stress captures were visually inspected.

The first graph UI run stopped at edge inspection because the test targeted SVG text beneath React Flow's label background. The test now clicks the actual visible label background with ordinary Playwright actionability checks. No forced clicks or application behavior changes were used to bypass that test failure.
