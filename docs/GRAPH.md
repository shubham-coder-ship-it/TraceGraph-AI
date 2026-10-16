# Graph model and retrieval

FalkorDB is the system of record. React stores only transient UI state; the API uses a real FalkorDB client, not a parallel in-memory dataset. Reports include a JSON snapshot for faithful retrieval, while evidence, decisions, proposed actions, provenance and memory remain traversable graph structures.

## Schema

| Label | Identity and key properties | Relationships |
| --- | --- | --- |
| Organization | id, name, synthetic | HAS_TEAM → Team |
| Environment | id, name | ← IN_ENVIRONMENT from Deployment |
| Service | id, name, status | DEPENDS_ON → Service; ← AFFECTS, OWNS, APPLIES_TO |
| Incident | id, title, summary, severity, status, createdAt | AFFECTS → Service; TRIGGERED_AFTER → Deployment; HAS_EVIDENCE → Evidence |
| Deployment | id, version, environment, createdAt | DEPLOYED_TO → Service; IN_ENVIRONMENT → Environment |
| Team / Person | id, name | Team OWNS Service; Person MEMBER_OF Team |
| Runbook | id, title, steps[] | APPLIES_TO → Service |
| Resolution | id, action, outcome | RESOLVES → Incident |
| Investigation | id, incidentId, summary, createdAt, report, feedback | INVESTIGATES → Incident; USES_EVIDENCE → Evidence |
| Evidence | stable content-derived id, kind, source, facts, path[] | ← USES_EVIDENCE, SUPPORTED_BY, DERIVED_FROM |
| Decision | per-investigation id, title, confidence, status=hypothesis | SUPPORTED_BY → Evidence; PROPOSED_DURING → Investigation |
| Action | per-investigation id, description, status=Suggested | PROPOSED_DURING → Investigation |
| Memory | stable content/evidence key, type, content, source, incidentId, createdAt, confidence, status, accessCount, lastAccessedAt, evidenceIds[] | ABOUT → Incident; DERIVED_FROM → Evidence; FROM_INVESTIGATION → Investigation |

New records use synthetic markers and stable IDs. Existing nodes are never cleared or overwritten by the seed. Original records may lack synthetic markers; the workspace visibly identifies this as a fictional demonstration. Seed labels and relationship types are internal constants, not user-supplied Cypher.

Memory keys hash the incident, memory type, sorted evidence IDs and normalized content. The seed uses MERGE; reruns match existing identities. Run the demo as a single writer: no cross-process uniqueness constraints or distributed write coordination is provisioned. Add per-label unique ID constraints and indexes after auditing an existing production graph for duplicates. The application does not mutate an existing schema automatically.

## Important exact queries

The authoritative executable queries are in `backend/src/repository.ts` and `backend/src/seed.ts`.

Health:
```cypher
MATCH (n) RETURN count(n) AS nodeCount
```
FalkorDB npm 6.8.0 `Graph.query` / `roQuery` returns named row records in `data`, without public headers. For example, `data: [{nodeCount: 34}]`. `results.ts` validates this shape; it never zips named rows with missing headers. Invalid shapes and failed queries produce errors.

Incident:
```cypher
MATCH (n:Incident {id:$id}) RETURN properties(n) AS node LIMIT 1
```
Affected services:
```cypher
MATCH (:Incident {id:$id})-[:AFFECTS]->(s:Service)
RETURN DISTINCT properties(s) AS node LIMIT 25
```
Dependencies:
```cypher
MATCH (:Incident {id:$id})-[:AFFECTS]->(s:Service)-[:DEPENDS_ON*1..2]->(d:Service)
RETURN DISTINCT s.id AS affectedService, d.id AS dependencyId,
d.name AS dependencyName, d.status AS dependencyStatus LIMIT 40
```
Historical incidents and resolutions:
```cypher
MATCH (current:Incident {id:$id})-[:AFFECTS]->(affected:Service)
MATCH (affected)-[:DEPENDS_ON*0..2]->(service:Service)<-[:AFFECTS]-(prior:Incident)
WHERE prior.id <> current.id AND toLower(coalesce(prior.status,'')) IN ['resolved','closed']
OPTIONAL MATCH (resolution:Resolution)-[:RESOLVES]->(prior)
RETURN DISTINCT current.id AS currentIncident, service.name AS sharedService, service.id AS serviceId,
prior.id AS priorIncident, prior.title AS priorTitle, prior.status AS priorStatus,
resolution.id AS resolutionId, resolution.action AS priorResolution, resolution.outcome AS priorOutcome LIMIT 40
```
Deployments:
```cypher
MATCH (i:Incident {id:$id})-[:TRIGGERED_AFTER]->(d:Deployment)
OPTIONAL MATCH (d)-[:DEPLOYED_TO]->(s:Service)
RETURN d.id AS deploymentId, d.version AS version, d.environment AS environment,
d.createdAt AS deployedAt, s.id AS serviceId LIMIT 20
```
Persistent memory retrieval:
```cypher
MATCH (i:Incident {id:$id})-[:AFFECTS]->(s:Service)
MATCH (s)-[:DEPENDS_ON*0..2]->(related:Service)<-[:AFFECTS]-(prior:Incident)<-[:ABOUT]-(m:Memory)
WHERE m.status <> 'archived'
RETURN DISTINCT properties(m) AS node ORDER BY m.createdAt DESC LIMIT 15
```
Memory source validation first loads the source report and verifies incident identity and every evidence ID. The memory write matches the incident and investigation, MERGEs Memory, ABOUT, FROM_INVESTIGATION and DERIVED_FROM edges, and returns the saved record. Status changes are explicit user operations. Feedback records an evaluation, not a verified diagnosis.

## Agent workflow and scoring

`getIncident → getAffectedServices → getDependencySubgraph → getRecentDeployments → findRelatedIncidents/getHistoricalResolutions → getRelevantRunbooks → getServiceOwners → searchPersistentMemory → analyze → saveInvestigation → saveMemory`.

These are repository methods, not tools an LLM can call with arbitrary Cypher. Each tool has predefined query text, parameterized values and bounded results. The whole workflow stops on query failure; a failed query is never evidence of absence. An investigation write is atomic, but the subsequent memory write is a separate operation: a failure can leave a saved report with no new memory. Inspect the report/history before retrying.

The deterministic engine considers deployment association (0.65), a dependency recorded as degraded/down/unhealthy (0.60), historical association (0.40), another dependency (0.25), or insufficient evidence (0.10). These are ordering heuristics, not measured probabilities. Healthy dependency status appears as counter-evidence. Prior unsuccessful actions remain visible with their outcomes. No rollback, restart or other real infrastructure action is executed.

Deployment relationships establish temporal context only. Historical solutions are comparison material, not current prescriptions. Recommended checks ask for fresh metrics and traces. Every hypothesis cites observed evidence IDs. Unknown telemetry and root cause uncertainty are explicit. Current status fields may be stale.

Episodic memory records investigation activity. Semantic memory supports sourced relationship observations. Procedural memory supports sourced runbook guidance. Retrieved memory is included in report evidence and available procedures; it does not inflate confidence or establish a diagnosis. All user-authored memories are initially unreviewed, and review means reviewed by a demo user, not verified by telemetry.

Optional provider support can only reorder existing hypothesis IDs; it cannot change descriptions, introduce claims, execute Cypher, or mutate the graph. Its JSON ranking must be a complete permutation of known IDs. Missing key, timeout, invalid output or network errors retain deterministic results. Model failures are disclosed in report limitations.

## Bounds and limitations

Graph responses contain at most 120 requested nodes and 240 induced edges. Neighborhood traversal uses three hops over an allowlist of operational relationships. Investigations inspect at most 25 affected services, 40 dependencies, 20 deployments, 40 historical paths, 30 runbook paths, 30 ownership paths and 15 memories. These are bounded result sets, not guarantees that every relationship is explored. Node limit or edge limit saturation is disclosed by the graph API. Depth is fixed, not user-generated.

There is no full-text/vector retrieval, production telemetry ingestion, distributed agent coordination, causal inference or remediation integration in this version. A local single-user demo is the intended operational scope.
