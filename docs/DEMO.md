# 2–3 minute demonstration

All records are synthetic Northstar Systems examples. Rehearse with the actual graph, not slides posing as live results.

0:00–0:20 — Show FalkorDB Browser and run `MATCH (n) RETURN count(n) AS nodeCount`. Explain that incidents, dependencies, deployments, runbooks and memory live in this graph. Show the original INC-1001 and INC-0932 path.

0:20–0:40 — Open Overview. Compare the graph node count with Settings. Point out real API-backed counts and Synthetic Demo Data labeling.

0:40–1:15 — Open Investigations, select INC-1001 and run it. Show the tool trace. Explain that the agent reads affected services, two dependency hops, associated deployments, historical incidents, runbooks and owners. Open deployment and historical evidence records; show their path and exact source fields.

1:15–1:40 — Show the ranked hypotheses. Distinguish temporal association from causation and explain heuristic confidence. Open Connected context. Show Checkout API, Identity, Payment and the adapter. Highlight the healthy Identity counter-evidence and the unsuccessful historical payment restart. No remediation is performed.

1:40–2:05 — Open Memory & feedback, save a procedural memory from a runbook source, then mark it reviewed in Agent Memory. Show its evidence IDs and source report. Submit usefulness feedback.

2:05–2:35 — Rerun INC-1001, then reload the browser and reopen the report from saved investigations. Open retrieved memory evidence and the source report. Explain that memory persists in FalkorDB, not localStorage, and cannot turn unverified diagnoses into verified causes.

2:35–2:50 — Close with setup and limitations: keyless deterministic engine, optional ranking provider, no production telemetry connectors, no auth beyond localhost, and a documented local demo. State Track 01 and Track 02.

Suggested Browser query:
```cypher
MATCH (i:Incident {id:'INC-1001'})-[:AFFECTS]->(s:Service)<-[:AFFECTS]-(p:Incident)
MATCH (r:Resolution)-[:RESOLVES]->(p)
WHERE p.id <> i.id
RETURN i,s,p,r
```
