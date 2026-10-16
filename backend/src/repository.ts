import { createHash } from "node:crypto";
import type { Query } from "./db.js";
import type { Entity, GraphEdge, GraphNode, Memory, Report } from "./types.js";
import { HttpError } from "./types.js";
export const historicalQuery = `MATCH (current:Incident {id:$id})-[:AFFECTS]->(affected:Service)
MATCH (affected)-[:DEPENDS_ON*0..2]->(service:Service)<-[:AFFECTS]-(prior:Incident)
WHERE prior.id <> current.id AND toLower(coalesce(prior.status,'')) IN ['resolved','closed']
OPTIONAL MATCH (resolution:Resolution)-[:RESOLVES]->(prior)
RETURN DISTINCT current.id AS currentIncident, service.name AS sharedService, service.id AS serviceId,
prior.id AS priorIncident, prior.title AS priorTitle, prior.status AS priorStatus,
resolution.id AS resolutionId, resolution.action AS priorResolution, resolution.outcome AS priorOutcome LIMIT 40`;
export class Repository {
  constructor(public q: Query) {}
  async health() {
    const [row] = await this.q<{ nodeCount: number }>(
      "MATCH (n) RETURN count(n) AS nodeCount",
    );
    if (!row || typeof row.nodeCount !== "number")
      throw new Error("Missing nodeCount from graph");
    return row.nodeCount;
  }
  async list(label: string, limit = 50, offset = 0) {
    // Labels come only from internal route definitions, never arbitrary input.
    if (
      !["Incident", "Service", "Investigation", "Memory", "Runbook"].includes(
        label,
      )
    )
      throw new Error("Unsupported label");
    const rows = await this.q<{ node: Entity }>(
      `MATCH (n:${label}) RETURN properties(n) AS node ORDER BY n.createdAt DESC, n.id DESC SKIP $offset LIMIT $limit`,
      { limit, offset },
    );
    return rows.map((r) => r.node);
  }
  async getIncident(id: string) {
    const [row] = await this.q<{ node: Entity }>(
      "MATCH (n:Incident {id:$id}) RETURN properties(n) AS node LIMIT 1",
      { id },
    );
    if (!row) throw new HttpError(404, "Incident not found");
    return row.node;
  }
  async affected(id: string) {
    return (
      await this.q<{ node: Entity }>(
        "MATCH (:Incident {id:$id})-[:AFFECTS]->(s:Service) RETURN DISTINCT properties(s) AS node LIMIT 25",
        { id },
      )
    ).map((r) => r.node);
  }
  dependencies(id: string) {
    return this.q(
      "MATCH (:Incident {id:$id})-[:AFFECTS]->(s:Service)-[:DEPENDS_ON*1..2]->(d:Service) RETURN DISTINCT s.id AS affectedService, d.id AS dependencyId, d.name AS dependencyName, d.status AS dependencyStatus LIMIT 40",
      { id },
    );
  }
  deployments(id: string) {
    return this.q(
      "MATCH (i:Incident {id:$id})-[:TRIGGERED_AFTER]->(d:Deployment) OPTIONAL MATCH (d)-[:DEPLOYED_TO]->(s:Service) RETURN d.id AS deploymentId, d.version AS version, d.environment AS environment, d.createdAt AS deployedAt, s.id AS serviceId LIMIT 20",
      { id },
    );
  }
  history(id: string) {
    return this.q(historicalQuery, { id });
  }
  runbooks(id?: string) {
    return this.q(
      id
        ? "MATCH (:Incident {id:$id})-[:AFFECTS]->(:Service)-[:DEPENDS_ON*0..2]->(s:Service)<-[:APPLIES_TO]-(r:Runbook) RETURN DISTINCT properties(r) AS runbook, s.id AS serviceId, s.name AS serviceName LIMIT 30"
        : "MATCH (r:Runbook) OPTIONAL MATCH (r)-[:APPLIES_TO]->(s:Service) RETURN properties(r) AS runbook, s.id AS serviceId, s.name AS serviceName LIMIT 50",
      id ? { id } : {},
    );
  }
  owners(id: string) {
    return this.q(
      "MATCH (:Incident {id:$id})-[:AFFECTS]->(:Service)-[:DEPENDS_ON*0..2]->(s:Service)<-[:OWNS]-(t:Team) OPTIONAL MATCH (p:Person)-[:MEMBER_OF]->(t) RETURN DISTINCT s.id AS serviceId, t.id AS teamId, t.name AS teamName, p.id AS personId, p.name AS personName LIMIT 30",
      { id },
    );
  }
  async memory(type = "", offset = 0, limit = 50) {
    return (
      await this.q<{ node: Memory }>(
        "MATCH (n:Memory) WHERE ($type = '' OR n.type = $type) RETURN properties(n) AS node ORDER BY n.createdAt DESC, n.id DESC SKIP $offset LIMIT $limit",
        { type, offset, limit },
      )
    ).map((r) => r.node);
  }
  async relevantMemory(id: string) {
    return (
      await this.q<{ node: Memory }>(
        `MATCH (i:Incident {id:$id})-[:AFFECTS]->(s:Service)
MATCH (s)-[:DEPENDS_ON*0..2]->(related:Service)<-[:AFFECTS]-(prior:Incident)<-[:ABOUT]-(m:Memory)
WHERE m.status <> 'archived' RETURN DISTINCT properties(m) AS node ORDER BY m.createdAt DESC LIMIT 15`,
        { id },
      )
    ).map((r) => r.node);
  }
  async touchMemory(ids: string[]) {
    if (ids.length)
      await this.q(
        "MATCH (m:Memory) WHERE m.id IN $ids SET m.accessCount = coalesce(m.accessCount,0)+1, m.lastAccessedAt=$now RETURN count(m) AS count",
        { ids, now: new Date().toISOString() },
        true,
      );
  }
  async patchMemory(id: string, status: string) {
    const [r] = await this.q<{ node: Memory }>(
      "MATCH (m:Memory {id:$id}) SET m.status=$status RETURN properties(m) AS node",
      { id, status },
      true,
    );
    if (!r) throw new HttpError(404, "Memory not found");
    return r.node;
  }
  async saveReport(report: Report) {
    // One atomic graph query stores report, evidence, hypothesis decisions and safe proposed actions.
    const rows = await this.q(
      `MATCH (incident:Incident {id:$incidentId})
MERGE (inv:Investigation {id:$id}) SET inv.createdAt=$now, inv.incidentId=$incidentId, inv.summary=$summary, inv.report=$report
MERGE (inv)-[:INVESTIGATES]->(incident)
WITH inv UNWIND $evidence AS item
MERGE (e:Evidence {id:item.id}) SET e.kind=item.kind, e.source=item.source, e.facts=item.facts, e.path=item.path
MERGE (inv)-[:USES_EVIDENCE]->(e)
WITH DISTINCT inv UNWIND $decisions AS decision
MERGE (d:Decision {id:decision.id}) SET d.title=decision.title, d.confidence=decision.confidence, d.status='hypothesis'
MERGE (d)-[:PROPOSED_DURING]->(inv)
WITH inv,d,decision UNWIND decision.evidenceIds AS eid
MATCH (e:Evidence {id:eid}) MERGE (d)-[:SUPPORTED_BY]->(e)
WITH DISTINCT inv UNWIND $actions AS action
MERGE (a:Action {id:action.id}) SET a.description=action.description, a.status='Suggested'
MERGE (a)-[:PROPOSED_DURING]->(inv) RETURN DISTINCT inv.id AS id`,
      {
        incidentId: report.incidentId,
        id: report.id,
        now: report.createdAt,
        summary: report.summary,
        report: JSON.stringify(report),
        evidence: report.evidence.map((e) => ({
          ...e,
          facts: JSON.stringify(e.facts),
        })),
        decisions: report.hypotheses.map((h, i) => ({
          id: `${report.id}:H${i}`,
          title: h.title,
          confidence: h.confidence,
          evidenceIds: h.supportingEvidenceIds,
        })),
        actions: report.recommendedChecks.map((description, i) => ({
          id: `${report.id}:A${i}`,
          description,
        })),
      },
      true,
    );
    if (!rows.length)
      throw new Error("Investigation persistence did not complete");
  }
  async report(id: string) {
    const [r] = await this.q<{ report: string }>(
      "MATCH (i:Investigation {id:$id}) RETURN i.report AS report LIMIT 1",
      { id },
    );
    if (!r) throw new HttpError(404, "Investigation not found");
    return JSON.parse(r.report) as Report;
  }
  async investigations(incidentId = "") {
    const rows = await this.q<{ node: Entity }>(
      "MATCH (n:Investigation) WHERE ($incidentId='' OR n.incidentId=$incidentId) RETURN {id:n.id, incidentId:n.incidentId, createdAt:n.createdAt, summary:n.summary, feedback:n.feedback} AS node ORDER BY n.createdAt DESC LIMIT 50",
      { incidentId },
    );
    return rows.map((r) => r.node);
  }
  async feedback(id: string, feedback: string) {
    const [r] = await this.q(
      "MATCH (n:Investigation {id:$id}) SET n.feedback=$feedback WITH n OPTIONAL MATCH (m:Memory {source:$id}) SET m.feedback=$feedback RETURN n.id AS id",
      { id, feedback },
      true,
    );
    if (!r) throw new HttpError(404, "Investigation not found");
    return r;
  }
  async saveMemory(input: {
    type: string;
    content: string;
    source: string;
    incidentId: string;
    evidenceIds: string[];
    confidence: number;
  }) {
    const report = await this.report(input.source);
    if (
      report.incidentId !== input.incidentId ||
      input.evidenceIds.some((e) => !report.evidence.some((x) => x.id === e))
    )
      throw new HttpError(
        400,
        "Memory evidence must belong to its source investigation",
      );
    const sources = input.evidenceIds.map((eid) =>
      report.evidence.find((e) => e.id === eid)!,
    );
    if (
      input.type === "procedural" &&
      sources.some((e) => e.kind !== "runbook")
    )
      throw new HttpError(400, "Procedural memory must cite a runbook");
    if (
      input.type === "semantic" &&
      sources.some(
        (e) =>
          !["dependency", "ownership", "affected-service"].includes(e.kind),
      )
    )
      throw new HttpError(
        400,
        "Semantic memory must cite relationship evidence",
      );
    const id =
      "MEM-" +
      createHash("sha256")
        .update(
          [
            input.incidentId,
            input.type,
            ...[...input.evidenceIds].sort(),
            input.content.trim(),
          ].join("|"),
        )
        .digest("hex")
        .slice(0, 20);
    const [r] = await this.q<{ node: Memory }>(
      `MATCH (i:Incident {id:$incidentId}), (inv:Investigation {id:$source})
MERGE (m:Memory {id:$id}) ON CREATE SET m.createdAt=$now, m.status='unreviewed', m.accessCount=0
SET m.type=$type,m.content=$content,m.source=$source,m.incidentId=$incidentId,m.confidence=$confidence,m.evidenceIds=$evidenceIds
MERGE (m)-[:ABOUT]->(i) MERGE (m)-[:FROM_INVESTIGATION]->(inv)
WITH m UNWIND $evidenceIds AS eid MATCH (e:Evidence {id:eid}) MERGE (m)-[:DERIVED_FROM]->(e)
RETURN DISTINCT properties(m) AS node`,
      { ...input, id, now: new Date().toISOString() },
      true,
    );
    if (!r) throw new Error("Memory was not saved");
    return r.node;
  }
  async graph(limit = 80, label = "", focus = "") {
    const rows = await this.q<{ properties: Entity; labels: string[] }>(
      focus
        ? "MATCH (root {id:$focus})-[:AFFECTS|DEPENDS_ON|TRIGGERED_AFTER|DEPLOYED_TO|RESOLVES|OWNS|APPLIES_TO|ABOUT|INVESTIGATES|MEMBER_OF*0..3]-(n) WHERE n.id IS NOT NULL WITH DISTINCT n ORDER BY CASE WHEN n.id=$focus THEN 0 WHEN n:Service THEN 1 WHEN n:Deployment THEN 2 WHEN n:Incident THEN 3 WHEN n:Resolution THEN 4 WHEN n:Runbook THEN 5 WHEN n:Team THEN 6 WHEN n:Person THEN 7 WHEN n:Memory THEN 8 ELSE 9 END, n.createdAt DESC, n.id LIMIT $limit RETURN properties(n) AS properties, labels(n) AS labels"
        : "MATCH (n) WHERE n.id IS NOT NULL AND ($label='' OR $label IN labels(n)) RETURN properties(n) AS properties, labels(n) AS labels ORDER BY n.id LIMIT $limit",
      { limit, label, focus },
    );
    const nodes: GraphNode[] = rows.map((r) => ({
      id: r.properties.id,
      label: r.labels[0] || "Node",
      properties: r.properties,
    }));
    const edges = nodes.length
      ? await this.q<GraphEdge>(
          "MATCH (a)-[r]->(b) WHERE a.id IN $ids AND b.id IN $ids RETURN toString(id(r)) AS id, a.id AS source, b.id AS target, type(r) AS type LIMIT 240",
          { ids: nodes.map((n) => n.id) },
        )
      : [];
    return {
      nodes,
      edges,
      limits: { nodes: limit, edges: 240 },
      truncated: nodes.length === limit || edges.length === 240,
    };
  }
  async intake(title: string, summary: string, serviceId: string) {
    const id = "INC-USER-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const [r] = await this.q<{ node: Entity }>(
      `MATCH (s:Service {id:$serviceId}) CREATE (i:Incident {id:$id,title:$title,summary:$summary,status:'Unverified report',severity:'Untriaged',synthetic:true,source:'user-reported synthetic demo',createdAt:$now}) CREATE (i)-[:AFFECTS]->(s) RETURN properties(i) AS node`,
      { id, title, summary, serviceId, now: new Date().toISOString() },
      true,
    );
    if (!r) throw new HttpError(404, "Service not found");
    return r.node;
  }
}
