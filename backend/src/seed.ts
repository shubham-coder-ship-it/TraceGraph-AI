import { fileURLToPath } from "node:url";
import { query, closeDb, type Query } from "./db.js";
import { seedNodes, seedEdges } from "./dataset.js";
export async function seed(q: Query = query) {
  let nodesCreated = 0,
    edgesCreated = 0;
  for (const node of seedNodes) {
    const [before] = await q<{ count: number }>(
      `MATCH (n:${node.label} {id:$id}) RETURN count(n) AS count`,
      { id: node.id },
      true,
    );
    await q(
      `MERGE (n:${node.label} {id:$id}) ON CREATE SET n += $props, n.synthetic=true, n.source='Northstar synthetic demo' RETURN n.id AS id`,
      { id: node.id, props: node.props },
      true,
    );
    if (!before.count) nodesCreated++;
  }
  for (const [source, type, target] of seedEdges) {
    const [before] = await q<{ count: number }>(
      `MATCH (a {id:$source})-[r:${type}]->(b {id:$target}) RETURN count(r) AS count`,
      { source, target },
    );
    await q(
      `MATCH (a {id:$source}), (b {id:$target}) MERGE (a)-[:${type}]->(b) RETURN a.id AS id`,
      { source, target },
      true,
    );
    if (!before.count) edgesCreated++;
  }
  return {
    nodesCreated,
    nodesMatched: seedNodes.length - nodesCreated,
    edgesCreated,
    edgesMatched: seedEdges.length - edgesCreated,
  };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed()
    .then((r) => console.log(JSON.stringify(r)))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    })
    .finally(closeDb);
}
