import { test } from "node:test";
import assert from "node:assert/strict";
import {
  layoutGraph,
  NODE_WIDTH,
  NODE_HEIGHT,
  ROW_GAP,
} from "../src/graphLayout.ts";
const node = (id, label = "Evidence") => ({
  id,
  label,
  properties: { id, title: "A long incident title ".repeat(12) },
});
const edge = (source, target) => ({
  id: source + "-" + target,
  source,
  target,
  type: "RELATED_TO",
});
function noOverlap(positions) {
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++) {
      const a = positions[i].position,
        b = positions[j].position;
      assert.ok(
        Math.abs(a.x - b.x) >= NODE_WIDTH ||
          Math.abs(a.y - b.y) >= NODE_HEIGHT + ROW_GAP,
        `${positions[i].id} overlaps ${positions[j].id}`,
      );
    }
}
test("80 nodes of one type wrap into a balanced layout instead of a tall column", () => {
  const nodes = Array.from({ length: 80 }, (_, i) => node("EV-" + i));
  const positions = layoutGraph(nodes, []);
  assert.equal(positions.length, 80);
  assert.ok(new Set(positions.map((n) => n.position.x)).size > 1);
  noOverlap(positions);
  const width = Math.max(...positions.map((n) => n.position.x)) + NODE_WIDTH,
    height = Math.max(...positions.map((n) => n.position.y)) + NODE_HEIGHT;
  assert.ok(width / height > 0.8 && width / height < 4);
});
test("a large connected fan-out is wrapped with no overlapping fixed-size nodes", () => {
  const nodes = [
    node("INV", "Investigation"),
    ...Array.from({ length: 70 }, (_, i) => node("EV-" + i)),
  ];
  const edges = nodes.slice(1).map((n) => edge("INV", n.id));
  const positions = layoutGraph(nodes, edges, "INV");
  noOverlap(positions);
  assert.ok(new Set(positions.map((n) => n.position.x)).size > 3);
});
test("positions are deterministic under API row and edge reordering", () => {
  const nodes = [
    node("I", "Incident"),
    node("S", "Service"),
    node("D", "Deployment"),
    node("M", "Memory"),
    node("R", "Resolution"),
    node("P", "Incident"),
  ];
  const edges = [
    edge("I", "S"),
    edge("I", "D"),
    edge("M", "I"),
    edge("P", "S"),
    edge("R", "P"),
  ];
  assert.deepEqual(
    layoutGraph(nodes, edges, "I"),
    layoutGraph([...nodes].reverse(), [...edges].reverse(), "I"),
  );
  noOverlap(layoutGraph(nodes, edges, "I"));
});
test("cycles, disconnected nodes, self loops and dangling edges preserve supplied identities", () => {
  const nodes = ["A", "B", "C", "D"].map((id) => node(id, "Service"));
  const edges = [
    edge("A", "B"),
    edge("B", "C"),
    edge("C", "A"),
    edge("A", "A"),
    edge("missing", "D"),
  ];
  const positions = layoutGraph(nodes, edges);
  assert.deepEqual(positions.map((n) => n.id).sort(), ["A", "B", "C", "D"]);
  noOverlap(positions);
  assert.deepEqual(layoutGraph([], []), []);
});
test("single-type filters and compact graphs have valid non-overlapping positions", () => {
  const nodes = Array.from({ length: 8 }, (_, i) => node("S-" + i, "Service"));
  for (const compact of [false, true]) {
    const positions = layoutGraph(nodes, [], "", compact);
    noOverlap(positions);
    assert.ok(
      positions.every(
        (n) => Number.isFinite(n.position.x) && Number.isFinite(n.position.y),
      ),
    );
  }
});

// Presentation-only role and grouping regressions.
const { incidentContext, contextLayout, edgeRole, chooseIncident } =
  await import("../src/graphLayout.ts");
function contextFixture() {
  const nodes = [
    node("I", "Incident"),
    node("S", "Service"),
    node("D", "Deployment"),
    node("P", "Incident"),
    node("R", "Resolution"),
    node("M", "Memory"),
    ...Array.from({ length: 30 }, (_, i) => node("INV-" + i, "Investigation")),
  ];
  const relation = (source, target, type) => ({
    id: source + "-" + type + "-" + target,
    source,
    target,
    type,
  });
  const edges = [
    relation("I", "S", "AFFECTS"),
    relation("I", "D", "TRIGGERED_AFTER"),
    relation("D", "S", "DEPLOYED_TO"),
    relation("P", "S", "AFFECTS"),
    relation("R", "P", "RESOLVES"),
    relation("M", "I", "ABOUT"),
    ...nodes
      .filter((n) => n.label === "Investigation")
      .map((n) => relation(n.id, "I", "INVESTIGATES")),
  ];
  return { nodes, edges };
}
test("primary highlights and comparison context derive only from supplied relationships", () => {
  const { nodes, edges } = contextFixture();
  const context = incidentContext(nodes, edges, "I");
  assert.deepEqual([...context.primaryIds].sort(), ["D", "I", "S"]);
  assert.deepEqual([...context.previewIds].sort(), [
    "D",
    "I",
    "M",
    "P",
    "R",
    "S",
  ]);
  assert.equal(
    edgeRole(
      edges.find((e) => e.type === "TRIGGERED_AFTER"),
      context,
      nodes,
    ),
    "temporal",
  );
  assert.equal(
    edgeRole(
      edges.find((e) => e.type === "ABOUT"),
      context,
      nodes,
    ),
    "memory",
  );
  assert.equal(
    edgeRole(
      edges.find((e) => e.type === "RESOLVES"),
      context,
      nodes,
    ),
    "historical",
  );
  const noDeployment = incidentContext(
    nodes,
    edges.filter((e) => e.type !== "TRIGGERED_AFTER"),
    "I",
  );
  assert.ok(!noDeployment.primaryIds.has("D"));
});
test("grouping keeps metadata away from the readable path without removing any nodes", () => {
  const { nodes, edges } = contextFixture();
  const context = incidentContext(nodes, edges, "I");
  const positions = contextLayout(nodes, edges, context);
  assert.deepEqual(
    positions.map((n) => n.id).sort(),
    nodes.map((n) => n.id).sort(),
  );
  noOverlap(positions);
  const byId = new Map(positions.map((n) => [n.id, n.position]));
  assert.ok(
    nodes
      .filter((n) => n.label === "Investigation")
      .every((n) => byId.get(n.id).x > byId.get("M").x + NODE_WIDTH),
  );
  assert.deepEqual(
    positions,
    contextLayout(
      [...nodes].reverse(),
      [...edges].reverse(),
      incidentContext([...nodes].reverse(), [...edges].reverse(), "I"),
    ),
  );
});
test("wide operational and metadata groups never overlap", () => {
  const { nodes, edges } = contextFixture();
  nodes.push(
    ...Array.from({ length: 40 }, (_, i) => node("S-" + i, "Service")),
  );
  const positions = contextLayout(
    nodes,
    edges,
    incidentContext(nodes, edges, "I"),
  );
  noOverlap(positions);
});
test("default incident selection prefers active records without hardcoding an incident ID", () => {
  assert.equal(
    chooseIncident([
      { id: "OLD", status: "Resolved" },
      { id: "ACTIVE", status: "Investigating" },
    ]),
    "ACTIVE",
  );
  assert.equal(chooseIncident([]), "");
  const { nodes, edges } = contextFixture();
  const context = incidentContext(nodes, edges, "missing");
  assert.equal(context.primaryIds.size, 0);
  assert.equal(context.previewIds.length, 0);
});

test("non-incident focus keeps its requested anchor without implying an incident path", () => {
  const { nodes, edges } = contextFixture();
  const context = incidentContext(nodes, edges, "S");
  assert.equal(context.anchor, "S");
  assert.equal(context.primaryIds.size, 0);
  assert.equal(contextLayout(nodes, edges, context)[0].id, "S");
});
