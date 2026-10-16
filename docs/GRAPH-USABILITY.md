# Investigation-first Graph Explorer

## Diagnosis from the Windows screenshots and current source

The previous balanced layout fixed the single-column problem, but its initial viewport still fit every loaded node. The default bounded response in the screenshot was dominated by Evidence records and omitted services. The focused view mixed primary incident neighbors with many equally prominent investigation/memory records. That combination shrank labels and created long crossing context edges.

## Frontend-only changes

- Keep the balanced layout for supporting context. Place the selected incident, its directly affected service(s), and deployments linked by `TRIGGERED_AFTER` in a primary area. Keep a historical incident/resolution pair and one relevant memory or directly linked evidence record nearby, when these relationships exist in returned data. Group remaining operational nodes below and supporting records to the side. No nodes or edges are fabricated or removed.
- Highlight primary incident/service nodes in green and temporal deployment context in amber. Distinguish historical context and use lighter dashed memory/investigation edges. Secondary edge labels appear on hover or selection; all edges remain interactive. Primary and historical edges render above background hit areas so labels can be clicked normally.
- `TRIGGERED_AFTER` stays a temporal association, not a causal claim. The graph includes a visible uncertainty note and an accessible temporal-edge label.
- Initially frame the useful incident comparison area at readable scale, after node measurement, reserving room for controls. On narrow canvases center the first anchor rather than shrink the whole graph. Preserve manual zoom/pan and dragged positions through inspection, hover and ordinary rerenders.
- Add **Show full graph** to fit all loaded records and **Center investigation** to return to the readable area. The existing zoom/pan, minimap, label filters and Reset remain available.
- For default `/graph`, use the existing incident-list endpoint to choose an active incident deterministically, then read its neighborhood through the existing endpoint. Merge those actual returned records with the initial graph response by ID. This is needed because the first bounded graph response can contain no services. Focused and filtered requests retain their existing endpoints. No backend or API-contract change is part of this update.
- "Full graph" means all loaded records from the existing bounded API responses. The existing truncation notice remains; this is not an unrestricted export of the database.

## Files

- `frontend/src/Graph.tsx`: visual roles, grouping, edge emphasis and interaction priority.
- `frontend/src/graphLayout.ts`: existing balanced layout plus relationship-derived context selection and grouping.
- `frontend/src/GraphViewport.tsx`: readable one-time initial framing and explicit overview/center controls.
- `frontend/src/useGraphData.ts`: read-only enrichment and preservation of all returned graph records.
- `frontend/src/hooks.ts`: allow an inactive request path for optional reads; existing callers retain the same behavior.
- `frontend/src/style.css`: primary text emphasis and viewport controls/notes.
- `frontend/tests/graph-layout.test.mjs`, `graph-ui.mjs`: focused-role, geometry, viewport, full-data preservation and historical-evidence regressions.
- `frontend/tests/fixture-server.mjs`: explicitly synthetic UI-only HTTP fixture; it imports sample definitions but never imports a FalkorDB client, connects to a database or invokes the seed command.

The ZIP also carries the current `smoke.mjs`, retaining the separately requested metric and persistent-memory assertion fixes. No backend source, database configuration, data model, package dependency or lockfile changes are required.

## Verification without touching FalkorDB

Use Node 24 and the existing installed dependencies:

```powershell
npm run typecheck
npm run build
npm test
npm run test:layout --prefix frontend
```

For UI-only verification, use three terminals. These ports separate fixtures from the regular backend and frontend.

Terminal 1:
```powershell
$env:FIXTURE_PORT = "5050"
node frontend/tests/fixture-server.mjs
```

Terminal 2:
```powershell
$env:API_PROXY_TARGET = "http://127.0.0.1:5050"
npm run dev --prefix frontend -- --port 5180
```

Terminal 3:
```powershell
$env:UI_BASE_URL = "http://127.0.0.1:5180"
npm run test:ui
npm run test:graph-ui --prefix frontend
```

Stop the fixture terminals after testing. For normal application use, start the existing backend/frontend in terminals without those fixture environment overrides. Do not configure production to use the fixture API.

## Validation scope and limitations

Verification uses the provided Linux workspace, Node 24, Chromium/Playwright and the explicit fixture API. Browser fixture results prove UI behavior, not new FalkorDB integration. The fixture graph name in Settings is `UI-FIXTURE-NO-DATABASE`. No database was started, reset, reseeded or modified for this work, and the Windows path/database was not directly accessible.

Dense context can still contain crossings. Its lower emphasis, grouping, edge inspection, zoom/pan and explicit full overview keep it accessible. The initial view intentionally does not show every loaded node. Only one historical pair and memory/evidence reference are initially framed; all other actual returned records remain on the canvas. Default incident selection is limited to the existing bounded incident list. Failed supplemental reads are disclosed and the original returned graph remains available.

## Exact results for this patch

| Check | Result |
| --- | --- |
| Backend/frontend typechecks | Passed |
| Backend/frontend production builds | Passed |
| Existing backend unit/API/provider tests | 9 passed, 0 failed, 0 skipped |
| Layout/role/grouping unit tests | 10 passed, 0 failed |
| Existing UI smoke workflow against fixture API | 15 passed, exit code 0 |
| Updated graph UI checks against fixture API | 11 passed, exit code 0 |
| Browser runtime errors | None |
| New real FalkorDB integration run | Not run; no database was started or seeded |

The standard pre-existing Vite `use client` warnings from React Router/React Flow remain non-fatal. A first graph test used `innerText` on an SVG edge group; it was corrected to `textContent`. A subsequent ordinary-click test exposed a real background-edge hit-area interception; edge interaction priority and background routing were fixed, retaining the ordinary click assertion. Default and focused viewport captures were visually inspected.
