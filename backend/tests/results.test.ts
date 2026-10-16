import { test } from "node:test";
import assert from "node:assert/strict";
import { first, records, scalar } from "../src/results.js";
import { buildHypotheses } from "../src/engine.js";
import { Repository } from "../src/repository.js";
test("reads first named record without reconstructing headers", () =>
  assert.deepEqual(first({ data: [{ nodeCount: 6 }] }), { nodeCount: 6 }));
test("extracts aliased scalar including a legitimate zero", () => {
  assert.equal(scalar({ data: [{ nodeCount: 6 }] }, "nodeCount"), 6);
  assert.equal(scalar({ data: [{ nodeCount: 0 }] }, "nodeCount"), 0);
});
test("missing counts and malformed rows fail explicitly", () => {
  assert.throws(() => scalar({ data: [{}] }, "nodeCount"));
  assert.throws(() => records({ data: [[1]] }));
  assert.throws(() => records({}));
});
test("populated historical evidence survives normalization", () => {
  const row = {
    currentIncident: "INC-1001",
    sharedService: "Checkout API",
    priorIncident: "INC-0932",
    priorStatus: "Resolved",
    priorResolution: "Rollback and clear stale cache",
    priorOutcome: "Latency normalized",
  };
  assert.deepEqual(records({ data: [row] })[0], row);
});
test("missing incident returns 404 and query failures propagate", async () => {
  await assert.rejects(new Repository(async () => []).getIncident("missing"), {
    status: 404,
  });
  await assert.rejects(
    new Repository(async () => {
      throw new Error("database down");
    }).health(),
    /database down/,
  );
});
test("confidence differentiates healthy dependencies and deployment association", () => {
  const h = buildHypotheses([
    { id: "E1", kind: "deployment", source: "graph", path: [], facts: {} },
    {
      id: "E2",
      kind: "dependency",
      source: "graph",
      path: [],
      facts: { dependencyName: "Identity", dependencyStatus: "Healthy" },
    },
  ]);
  assert.equal(h[0].confidence, 0.65);
  assert.match(h[0].description, /Causation is unconfirmed/);
  assert.deepEqual(h[1].contradictingEvidenceIds, ["E2"]);
});
test("empty evidence produces cautious hypothesis", () => {
  const h = buildHypotheses([]);
  assert.equal(h.length, 1);
  assert.equal(h[0].confidence, 0.1);
});
