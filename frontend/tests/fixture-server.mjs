/** UI fixture only. No FalkorDB client or database connection is created. */
import http from "node:http";
import { createHash } from "node:crypto";
import { seedNodes, seedEdges } from "../../backend/src/dataset.ts";
const nodes = new Map(
  seedNodes.map((n) => [
    n.id,
    {
      id: n.id,
      label: n.label,
      properties: { ...n.props, id: n.id, synthetic: true },
    },
  ]),
);
const edges = seedEdges.map(([source, type, target], i) => ({
  id: "fixture-edge-" + i,
  source,
  type,
  target,
}));
const reports = new Map(),
  memories = new Map();
let sequence = 0;
for (let i = 0; i < 80; i++) {
  const id = "EV-FIXTURE-" + i;
  nodes.set(id, {
    id,
    label: "Evidence",
    properties: {
      id,
      title: "Fixture supporting observation " + i,
      source: "UI fixture; not production evidence",
    },
  });
}
function putMemory(input) {
  const id =
    "MEM-FIXTURE-" +
    createHash("sha256")
      .update(
        input.incidentId +
          input.type +
          input.content +
          input.evidenceIds.join("|"),
      )
      .digest("hex")
      .slice(0, 12);
  const previous = memories.get(id);
  const m = {
    ...input,
    id,
    status: previous?.status || "unreviewed",
    createdAt: previous?.createdAt || new Date().toISOString(),
    accessCount: previous?.accessCount || 0,
  };
  memories.set(id, m);
  nodes.set(id, { id, label: "Memory", properties: m });
  if (!edges.some((e) => e.source === id && e.type === "ABOUT"))
    edges.push({
      id: "fixture-about-" + id,
      source: id,
      target: input.incidentId,
      type: "ABOUT",
    });
  return m;
}
for (const type of ["episodic", "semantic"])
  putMemory({
    type,
    content:
      "Existing " + type + " context from an explicitly synthetic UI fixture.",
    incidentId: "INC-1001",
    source: "INV-FIXTURE-EXISTING",
    evidenceIds: ["SEED-EV-1"],
    confidence: 0.5,
  });
function graph(label = "", focus = "", limit = 80) {
  let selected = [...nodes.values()];
  if (focus) {
    const ids = new Set([focus]);
    for (let depth = 0; depth < 3; depth++) {
      const old = new Set(ids);
      for (const e of edges)
        if (old.has(e.source) || old.has(e.target)) {
          ids.add(e.source);
          ids.add(e.target);
        }
    }
    selected = selected.filter((n) => ids.has(n.id));
  } else if (label) selected = selected.filter((n) => n.label === label);
  else
    selected = [
      ...selected.filter((n) => n.id.startsWith("EV-FIXTURE-")),
      ...selected.filter((n) => !n.id.startsWith("EV-FIXTURE-")),
    ];
  const truncated = selected.length > limit;
  selected = selected.slice(0, limit);
  const ids = new Set(selected.map((n) => n.id));
  return {
    nodes: selected,
    edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
    truncated,
    limits: { nodes: limit, edges: 240 },
  };
}
const list = (label) =>
  [...nodes.values()].filter((n) => n.label === label).map((n) => n.properties);
function runbooks() {
  return edges
    .filter((e) => e.type === "APPLIES_TO")
    .map((e) => ({
      runbook: nodes.get(e.source).properties,
      serviceId: e.target,
      serviceName: nodes.get(e.target).properties.name,
    }));
}
function investigate(id) {
  const incident = nodes.get(id)?.properties;
  if (!incident) return null;
  const affected = edges
    .filter((e) => e.source === id && e.type === "AFFECTS")
    .map((e) => nodes.get(e.target).properties);
  const evidence = [
    {
      id: "FIXTURE-EV-INC",
      kind: "incident",
      facts: incident,
      path: [id],
      source: "UI fixture",
    },
    ...affected.map((s) => ({
      id: "FIXTURE-EV-SERVICE-" + s.id,
      kind: "affected-service",
      facts: s,
      path: [id, "AFFECTS", s.id],
      source: "UI fixture",
    })),
    {
      id: "FIXTURE-EV-DEPLOYMENT",
      kind: "deployment",
      facts: { deploymentId: "DEP-104", version: "2026.10.14-3" },
      path: [id, "TRIGGERED_AFTER", "DEP-104"],
      source: "UI fixture",
    },
    {
      id: "FIXTURE-EV-HISTORY",
      kind: "historical",
      facts: {
        currentIncident: id,
        sharedService: "Checkout API",
        serviceId: "SVC-CHECKOUT",
        priorIncident: "INC-0932",
        priorResolution:
          "Rollback the checkout deployment and clear the stale cache.",
        priorOutcome: "Latency returned to normal in this synthetic example.",
      },
      path: [
        id,
        "AFFECTS",
        "SVC-CHECKOUT",
        "AFFECTS (reverse)",
        "INC-0932",
        "RESOLVES (reverse)",
        "RES-0932",
      ],
      source: "UI fixture",
    },
    {
      id: "FIXTURE-EV-DEPENDENCY",
      kind: "dependency",
      facts: {
        dependencyName: "Identity Service",
        dependencyId: "SVC-IDENTITY",
        dependencyStatus: "Healthy",
      },
      path: [id, "AFFECTS", "SVC-CHECKOUT", "DEPENDS_ON", "SVC-IDENTITY"],
      source: "UI fixture",
    },
    ...runbooks().map((r, i) => ({
      id: "FIXTURE-EV-RUNBOOK-" + i,
      kind: "runbook",
      facts: r,
      path: [r.runbook.id, "APPLIES_TO", r.serviceId],
      source: "UI fixture",
    })),
  ];
  const reportId = "INV-FIXTURE-" + ++sequence,
    retrieved = [...memories.values()].filter((m) => m.status !== "archived");
  const report = {
    id: reportId,
    incidentId: id,
    incident,
    createdAt: new Date().toISOString(),
    analysisMode: "deterministic",
    summary: "Synthetic UI fixture report; not a database integration result.",
    hypotheses: [
      {
        id: "H1",
        title: "Deployment-associated regression",
        description: "Temporal association only; causation is unconfirmed.",
        confidence: 0.65,
        supportingEvidenceIds: ["FIXTURE-EV-DEPLOYMENT"],
        contradictingEvidenceIds: [],
        reasoning: "Fresh telemetry is missing.",
        recommendedChecks: ["Compare latency before and after deployment."],
      },
    ],
    evidence,
    affectedServices: affected,
    dependencies: [evidence.find((e) => e.kind === "dependency").facts],
    deployments: [evidence.find((e) => e.kind === "deployment").facts],
    historicalIncidents: [evidence.find((e) => e.kind === "historical").facts],
    runbooks: runbooks(),
    owners: [
      {
        teamName: "Payments Platform",
        personName: "Mira Chen",
        serviceId: "SVC-CHECKOUT",
      },
    ],
    memoriesRetrieved: JSON.parse(JSON.stringify(retrieved)),
    memoriesCreated: [],
    recommendedChecks: ["Inspect telemetry"],
    unknowns: ["Root cause unconfirmed."],
    limitations: ["UI fixture only."],
    toolTrace: [{ tool: "fixtureEvidence", count: evidence.length }],
  };
  const m = putMemory({
    type: "episodic",
    content: "Investigated " + id + " in the isolated UI fixture.",
    source: reportId,
    incidentId: id,
    evidenceIds: evidence.map((e) => e.id),
    confidence: 0.5,
  });
  report.memoriesCreated = [m.id];
  reports.set(reportId, report);
  nodes.set(reportId, {
    id: reportId,
    label: "Investigation",
    properties: {
      id: reportId,
      incidentId: id,
      createdAt: report.createdAt,
      summary: report.summary,
    },
  });
  edges.push({
    id: "fixture-investigates-" + reportId,
    source: reportId,
    target: id,
    type: "INVESTIGATES",
  });
  return report;
}
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://localhost");
  const p = u.pathname;
  let body = {};
  try {
    if (["POST", "PATCH"].includes(req.method)) {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      body = JSON.parse(raw || "{}");
    }
    let result,
      status = 200;
    if (p === "/api/health")
      result = {
        status: "ok",
        database: "connected",
        graph: "UI-FIXTURE-NO-DATABASE",
        nodeCount: nodes.size,
        analysisMode: "deterministic",
        providerConfigured: false,
        synthetic: true,
      };
    else if (p === "/api/overview")
      result = {
        counts: {
          Incident: list("Incident").length,
          openIncidents: list("Incident").filter((i) => i.status !== "Resolved")
            .length,
          Service: list("Service").length,
          Memory: memories.size,
          Investigation: reports.size,
        },
        recentIncidents: list("Incident"),
        recentInvestigations: [...reports.values()].reverse(),
      };
    else if (p === "/api/services") result = list("Service");
    else if (p === "/api/incidents" && req.method === "GET")
      result = list("Incident");
    else if (p === "/api/incidents" && req.method === "POST") {
      const id = "INC-USER-FIXTURE-" + ++sequence;
      const properties = {
        id,
        title: body.title,
        summary: body.summary,
        severity: "Untriaged",
        status: "Unverified report",
        synthetic: true,
      };
      nodes.set(id, { id, label: "Incident", properties });
      edges.push({
        id: "fixture-intake-" + id,
        source: id,
        target: body.serviceId,
        type: "AFFECTS",
      });
      result = properties;
      status = 201;
    } else if (p === "/api/graph")
      result = graph(
        u.searchParams.get("label") || "",
        "",
        Number(u.searchParams.get("limit") || 80),
      );
    else if (p.startsWith("/api/graph/neighborhood/"))
      result = graph(
        "",
        decodeURIComponent(p.split("/").at(-1)),
        Number(u.searchParams.get("limit") || 70),
      );
    else if (p === "/api/runbooks") result = runbooks();
    else if (p === "/api/investigations" && req.method === "POST") {
      result = investigate(body.incidentId);
      status = result ? 201 : 404;
    } else if (p === "/api/investigations")
      result = [...reports.values()].reverse();
    else if (p.startsWith("/api/investigations/by-incident/"))
      result = [...reports.values()]
        .filter((r) => r.incidentId === p.split("/").at(-1))
        .reverse();
    else if (p.startsWith("/api/investigations/")) {
      result = reports.get(p.split("/").at(-1));
      if (req.method === "PATCH" && result) result.feedback = body.feedback;
    } else if (p === "/api/memory" && req.method === "POST") {
      result = putMemory(body);
      status = 201;
    } else if (p === "/api/memory") {
      const type = u.searchParams.get("type");
      result = [...memories.values()]
        .filter((m) => !type || m.type === type)
        .reverse()
        .slice(
          Number(u.searchParams.get("offset") || 0),
          Number(u.searchParams.get("offset") || 0) +
            Number(u.searchParams.get("limit") || 50),
        );
    } else if (p.startsWith("/api/memory/") && req.method === "PATCH") {
      result = memories.get(p.split("/").at(-1));
      if (result) result.status = body.status;
    }
    if (result === undefined) {
      status = 404;
      result = { error: "Fixture route not found" };
    }
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(result));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: error.message }));
  }
});
server.listen(Number(process.env.FIXTURE_PORT || 5000), "127.0.0.1", () =>
  console.log(
    "UI fixture API; NO DATABASE CONNECTION on " +
      (process.env.FIXTURE_PORT || 5000),
  ),
);
