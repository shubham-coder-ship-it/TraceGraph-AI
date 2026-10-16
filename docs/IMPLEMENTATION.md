# Implementation handoff

The deliverable contains a backend, connected React console, lockfiles, environment examples, tests, clean-environment Docker/Compose files and documentation. Original uploaded files were not overwritten. The ZIP had an empty `backend/src`, so no unuploaded Windows implementation could be preserved or inspected.

Start with README.md for exact PowerShell commands. Use your existing Docker container and graph. `npm run setup`, configure `backend/.env`, then `npm run seed` and `npm run dev`. The app opens at http://localhost:5173. No API key is needed.

Core architectural decisions:

1. Consume the installed FalkorDB client's named record objects. Query errors propagate as failures; missing database connectivity cannot produce successful zero counts.
2. Keep repository tools predefined, parameterized and bounded. Only controlled operations can write graph records.
3. Separate facts, hypotheses and unknowns. Historical fixes remain context, deployment association remains unconfirmed, healthy dependency status is counter-evidence.
4. Save reports alongside traversable evidence, decision, proposed-action and memory provenance edges. Content-derived memory IDs control duplicates in the single-writer demo.
5. Restrict optional model support to ranking existing hypotheses. Output validation and deterministic fallback prevent invented claims or generated Cypher.
6. Keep the console connected to actual API data, with explicit loading, empty, failure and saved-report states.

To verify memory: investigate INC-1001, save a procedural memory from runbook evidence, review it in Agent Memory, rerun INC-1001 and inspect retrieved memory and Memory-informed checks. Reload or restart the backend and reopen the saved report.

Read docs/VALIDATION.md for actual test scope. Remaining actions: test against your Windows graph, run Docker builds if needed, review code and human contribution, create the GitHub repository, record the demo and finish the hackathon form. External hosting requires authentication, credentials and a reachable database; no live deployment is claimed.
