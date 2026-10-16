import { test, after } from "node:test";
import assert from "node:assert/strict";
import { query, closeDb } from "../../src/db.js";
import { Repository } from "../../src/repository.js";
import { seed } from "../../src/seed.js";
import { investigate } from "../../src/engine.js";
import { createApp } from "../../src/app.js";
// Integration suite never clears a graph. Require an explicit isolated graph name.
const allowed = process.env.FALKORDB_GRAPH?.startsWith("tracegraph_test");
after(closeDb);
test(
  "real FalkorDB: seed, evidence, memory, API and bounded graph",
  { skip: !allowed },
  async () => {
    const repo = new Repository(query);
    await query(
      "MERGE (n:Incident {id:$id}) ON CREATE SET n.title='Checkout API elevated latency',n.summary='Original synthetic record',n.status='Investigating',n.severity='SEV-2',n.preservationSentinel='keep-me' RETURN n.id AS id",
      { id: "INC-1001" },
      true,
    );
    await seed();
    assert.equal(
      (await repo.getIncident("INC-1001")).preservationSentinel,
      "keep-me",
    );
    const count = await repo.health();
    assert.ok(count >= 30);
    const second = await seed();
    assert.equal(second.nodesCreated, 0);
    assert.equal(second.edgesCreated, 0);
    assert.equal(await repo.health(), count);
    const history = await repo.history("INC-1001");
    const prior = history.find((h) => h.priorIncident === "INC-0932");
    assert.ok(prior?.priorResolution);
    assert.equal(prior?.sharedService, "Checkout API");
    const report = await investigate(repo, "INC-1001");
    assert.ok(report.dependencies.length);
    assert.ok(report.deployments.length);
    assert.ok(report.owners.length);
    assert.ok(report.runbooks.length);
    assert.ok(report.memoriesCreated.length);
    assert.ok(report.evidence.every((e) => Object.keys(e.facts).length > 0));
    await closeDb(); // Reconnect a fresh client; persistence is on the server, not process memory.
    assert.equal((await repo.report(report.id)).id, report.id);
    const later = await investigate(repo, "INC-1001");
    assert.ok(
      later.memoriesRetrieved.some((m) => m.id === report.memoriesCreated[0]),
    );
    assert.ok(later.evidence.some((e) => e.kind === "memory"));
    const memory = {
      type: "semantic",
      content:
        "Checkout depends on the recorded dependency path; verify fresh telemetry.",
      source: report.id,
      incidentId: "INC-1001",
      evidenceIds: [report.evidence.find((e) => e.kind === "dependency")!.id],
      confidence: 0.5,
    };
    const saved = await repo.saveMemory(memory);
    assert.equal((await repo.saveMemory(memory)).id, saved.id);
    assert.equal(
      (await repo.patchMemory(saved.id, "reviewed")).status,
      "reviewed",
    );
    await assert.rejects(
      repo.saveMemory({ ...memory, evidenceIds: ["FORGED"] }),
      { status: 400 },
    );
    const procedure = await repo.saveMemory({
      ...memory,
      type: "procedural",
      content: "Compare latency metrics and inspect the documented runbook.",
      evidenceIds: [report.evidence.find((e) => e.kind === "runbook")!.id],
    });
    await repo.patchMemory(procedure.id, "reviewed");
    const reused = await investigate(repo, "INC-1001");
    assert.ok(
      reused.recommendedChecks.some((check) => check.includes(procedure.id)),
    );
    await assert.rejects(repo.saveMemory({ ...memory, type: "procedural" }), {
      status: 400,
    });
    await repo.patchMemory(procedure.id, "archived");
    assert.ok(
      !(await repo.relevantMemory("INC-1001")).some(
        (m) => m.id === procedure.id,
      ),
    );
    const graph = await repo.graph(10);
    assert.ok(graph.nodes.length <= 10);
    assert.ok(
      graph.edges.every(
        (e) =>
          graph.nodes.some((n) => n.id === e.source) &&
          graph.nodes.some((n) => n.id === e.target),
      ),
    );
    const focused = await repo.graph(60, "", "INC-1001");
    assert.ok(focused.nodes.some((n) => n.id === "SVC-CHECKOUT"));
    assert.ok(focused.nodes.some((n) => n.id === "INC-0932"));
    assert.ok(focused.nodes.some((n) => n.id === "RES-0932"));
    assert.ok(focused.nodes.some((n) => n.id === report.memoriesCreated[0]));
    assert.ok(
      focused.edges.some(
        (e) => e.type === "RESOLVES" && e.source === "RES-0932",
      ),
    );
    const tinyFocus = await repo.graph(1, "", "INC-1001");
    assert.equal(tinyFocus.nodes[0].id, "INC-1001");
    const server = createApp(repo).listen(0, "127.0.0.1");
    await new Promise<void>((r) => server.once("listening", r));
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}/api`;
    try {
      const request = async (path: string, options?: RequestInit) =>
        fetch(base + path, options);
      assert.equal((await request("/health")).status, 200);
      const overview = await (await request("/overview")).json();
      assert.equal(overview.counts.Incident, 6);
      assert.equal(
        (
          await request("/investigations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          })
        ).status,
        400,
      );
      assert.equal((await request("/incidents/DOES-NOT-EXIST")).status, 404);
      assert.equal((await request("/graph?limit=10000")).status, 400);
      assert.equal(
        (await request("/investigations/by-incident/INC-1001")).status,
        200,
      );
      assert.equal(
        (await request("/incidents/INC-1001%27%20RETURN%201")).status,
        400,
      );
      assert.equal((await request("/memory?type=unknown")).status, 400);
      assert.equal(
        (
          await request("/investigations/" + report.id, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: "useful" }),
          })
        ).status,
        200,
      );
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  },
);
