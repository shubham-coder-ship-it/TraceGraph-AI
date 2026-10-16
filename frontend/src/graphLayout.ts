import type { Entity, GraphEdge, GraphNode } from "../../backend/src/types";

export const NODE_WIDTH = 224;
export const NODE_HEIGHT = 112;
export const COLUMN_GAP = 112;
export const ROW_GAP = 56;
const roleOrder = [
  "Incident",
  "Service",
  "Deployment",
  "Resolution",
  "Runbook",
  "Team",
  "Person",
  "Memory",
  "Investigation",
  "Evidence",
  "Decision",
  "Action",
];

/** Stable breadth-first layers, wrapped into short columns and packed by component.
 * Only positions are generated; the returned IDs are exactly the supplied node IDs.
 */
export function layoutGraph(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focus = "",
  compact = false,
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const adjacent = new Map(nodes.map((n) => [n.id, new Set<string>()]));
  for (const edge of edges) {
    if (
      !byId.has(edge.source) ||
      !byId.has(edge.target) ||
      edge.source === edge.target
    )
      continue;
    adjacent.get(edge.source)!.add(edge.target);
    adjacent.get(edge.target)!.add(edge.source);
  }
  const priority = (id: string) => {
    const index = roleOrder.indexOf(byId.get(id)!.label);
    return index < 0 ? roleOrder.length : index;
  };
  const compare = (a: string, b: string) =>
    priority(a) - priority(b) ||
    adjacent.get(b)!.size - adjacent.get(a)!.size ||
    (a < b ? -1 : a > b ? 1 : 0);
  const remaining = new Set([...byId.keys()].sort(compare));
  const components: {
    nodes: { id: string; x: number; y: number }[];
    width: number;
    height: number;
  }[] = [];
  while (remaining.size) {
    const root = remaining.has(focus)
      ? focus
      : remaining.values().next().value!;
    const queue = [root],
      distance = new Map([[root, 0]]);
    remaining.delete(root);
    for (let index = 0; index < queue.length; index++) {
      for (const next of [...adjacent.get(queue[index])!].sort(compare)) {
        if (!remaining.delete(next)) continue;
        distance.set(next, distance.get(queue[index])! + 1);
        queue.push(next);
      }
    }
    const rows = compact
      ? 3
      : Math.max(3, Math.min(7, Math.ceil(Math.sqrt(queue.length))));
    const columns: string[][] = [];
    const previousRow = new Map<string, number>();
    for (let depth = 0; depth <= Math.max(...distance.values()); depth++) {
      const layer = queue.filter((id) => distance.get(id) === depth);
      const barycenter = (id: string) => {
        const parents = [...adjacent.get(id)!].filter(
          (p) => distance.get(p) === depth - 1,
        );
        return parents.length
          ? parents.reduce((sum, p) => sum + (previousRow.get(p) ?? 0), 0) /
              parents.length
          : 0;
      };
      layer.sort((a, b) => barycenter(a) - barycenter(b) || compare(a, b));
      for (let start = 0; start < layer.length; start += rows) {
        const column = layer.slice(start, start + rows);
        column.forEach((id, row) => previousRow.set(id, row));
        columns.push(column);
      }
    }
    const height =
      Math.max(...columns.map((c) => c.length)) * (NODE_HEIGHT + ROW_GAP) -
      ROW_GAP;
    components.push({
      width: columns.length * (NODE_WIDTH + COLUMN_GAP) - COLUMN_GAP,
      height,
      nodes: columns.flatMap((column, col) =>
        column.map((id, row) => ({
          id,
          x: col * (NODE_WIDTH + COLUMN_GAP),
          y:
            (height - (column.length * (NODE_HEIGHT + ROW_GAP) - ROW_GAP)) / 2 +
            row * (NODE_HEIGHT + ROW_GAP),
        })),
      ),
    });
  }
  // Shelf packing prevents disconnected nodes (e.g. a label filter) forming one tall stack.
  const area = components.reduce(
    (sum, c) => sum + (c.width + COLUMN_GAP) * (c.height + ROW_GAP),
    0,
  );
  const shelfWidth = Math.max(
    0,
    ...components.map((c) => c.width),
    Math.sqrt(area * 1.8),
  );
  let x = 0,
    y = 0,
    shelfHeight = 0;
  const positions = new Map<string, { x: number; y: number }>();
  for (const component of components) {
    if (x && x + component.width > shelfWidth) {
      x = 0;
      y += shelfHeight + ROW_GAP * 2;
      shelfHeight = 0;
    }
    for (const node of component.nodes)
      positions.set(node.id, { x: x + node.x, y: y + node.y });
    x += component.width + COLUMN_GAP;
    shelfHeight = Math.max(shelfHeight, component.height);
  }
  return [...positions].map(([id, position]) => ({ id, position }));
}

const stable = (a: GraphNode, b: GraphNode) =>
  a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
export function chooseIncident(incidents: Entity[]) {
  return (
    [...incidents].sort((a, b) => {
      const inactive = (n: Entity) =>
        ["resolved", "closed"].includes(String(n.status).toLowerCase()) ? 1 : 0;
      return (
        inactive(a) - inactive(b) ||
        String(b.createdAt || "").localeCompare(String(a.createdAt || "")) ||
        a.id.localeCompare(b.id)
      );
    })[0]?.id || ""
  );
}
/** Visual roles are derived only from relationships actually present in the response. */
export function incidentContext(
  nodes: GraphNode[],
  edges: GraphEdge[],
  focus: string,
) {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const root = byId.get(focus)?.label === "Incident" ? focus : "";
  const targets = (type: string) =>
    edges
      .filter((e) => e.source === root && e.type === type && byId.has(e.target))
      .map((e) => byId.get(e.target)!)
      .sort(stable);
  const services = root
    ? targets("AFFECTS").filter((n) => n.label === "Service")
    : [];
  const deployments = root
    ? targets("TRIGGERED_AFTER").filter((n) => n.label === "Deployment")
    : [];
  const serviceIds = new Set(services.map((n) => n.id));
  const priorIds = new Set(
    edges
      .filter(
        (e) =>
          e.type === "AFFECTS" &&
          serviceIds.has(e.target) &&
          e.source !== root &&
          byId.get(e.source)?.label === "Incident",
      )
      .map((e) => e.source),
  );
  const historical = nodes.filter((n) => priorIds.has(n.id)).sort(stable);
  const resolutionIds = new Set(
    edges
      .filter((e) => e.type === "RESOLVES" && priorIds.has(e.target))
      .map((e) => e.source),
  );
  const historicalIds = new Set([...priorIds, ...resolutionIds]);
  const memoryIds = new Set(
    edges
      .filter(
        (e) =>
          e.type === "ABOUT" &&
          (e.target === root || priorIds.has(e.target)) &&
          byId.get(e.source)?.label === "Memory",
      )
      .map((e) => e.source),
  );
  const memories = nodes
    .filter((n) => memoryIds.has(n.id))
    .sort(
      (a, b) =>
        Number(b.properties.status === "reviewed") -
          Number(a.properties.status === "reviewed") ||
        Number(b.properties.type === "procedural") -
          Number(a.properties.type === "procedural") ||
        stable(a, b),
    );
  const primaryIds = new Set(
    root
      ? [root, ...services.map((n) => n.id), ...deployments.map((n) => n.id)]
      : [],
  );
  const primaryEdges = new Set(
    edges
      .filter(
        (e) =>
          root &&
          ((e.source === root &&
            ["AFFECTS", "TRIGGERED_AFTER"].includes(e.type) &&
            primaryIds.has(e.target)) ||
            (deployments.some((n) => n.id === e.source) &&
              serviceIds.has(e.target) &&
              e.type === "DEPLOYED_TO")),
      )
      .map((e) => e.id),
  );
  const history = historical[0];
  const resolution = history
    ? nodes
        .filter((n) =>
          edges.some(
            (e) =>
              e.type === "RESOLVES" &&
              e.source === n.id &&
              e.target === history.id,
          ),
        )
        .sort(stable)[0]
    : undefined;
  const evidence = nodes
    .filter(
      (n) =>
        n.label === "Evidence" &&
        edges.some(
          (e) =>
            e.source === root && e.target === n.id && e.type === "HAS_EVIDENCE",
        ),
    )
    .sort(stable)[0];
  const previewIds = [
    root,
    services[0]?.id,
    deployments[0]?.id,
    history?.id,
    resolution?.id,
    memories[0]?.id || evidence?.id,
  ].filter((id): id is string => !!id);
  return {
    root,
    anchor: byId.has(focus) ? focus : "",
    services,
    deployments,
    historicalIds,
    memoryIds,
    primaryIds,
    primaryEdges,
    previewIds,
    history,
    resolution,
    reference: memories[0] || evidence,
  };
}
export function contextLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  context: ReturnType<typeof incidentContext>,
  compact = false,
) {
  if (!context.root || compact)
    return layoutGraph(nodes, edges, context.anchor, compact);
  const placed = new Map<string, { x: number; y: number }>();
  const pitch = NODE_WIDTH + COLUMN_GAP;
  placed.set(context.root, { x: 0, y: 0 });
  context.services.forEach((n, i) =>
    placed.set(n.id, { x: pitch, y: i * (NODE_HEIGHT + ROW_GAP) }),
  );
  context.deployments.forEach((n, i) =>
    placed.set(n.id, { x: pitch, y: -(i + 1) * (NODE_HEIGHT + ROW_GAP) }),
  );
  const comparisonY =
    Math.max(1, context.services.length) * (NODE_HEIGHT + ROW_GAP);
  if (context.history)
    placed.set(context.history.id, { x: pitch, y: comparisonY });
  if (context.resolution)
    placed.set(context.resolution.id, { x: 0, y: comparisonY });
  if (context.reference)
    placed.set(context.reference.id, { x: pitch * 2, y: comparisonY });
  const rest = nodes.filter((n) => !placed.has(n.id));
  const supporting = new Set([
    "Memory",
    "Investigation",
    "Evidence",
    "Decision",
    "Action",
  ]);
  const operational = rest.filter((n) => !supporting.has(n.label));
  const metadata = rest.filter((n) => supporting.has(n.label));
  const operationalIds = new Set(operational.map((n) => n.id));
  const operationalLayout = layoutGraph(
    operational,
    edges.filter(
      (e) => operationalIds.has(e.source) && operationalIds.has(e.target),
    ),
  );
  for (const n of operationalLayout)
    placed.set(n.id, {
      x: n.position.x,
      y: n.position.y + comparisonY + NODE_HEIGHT + ROW_GAP * 2,
    });
  const metadataX =
    Math.max(
      pitch * 3,
      ...operationalLayout.map((n) => n.position.x + NODE_WIDTH),
    ) + COLUMN_GAP;
  const metadataIds = new Set(metadata.map((n) => n.id));
  for (const n of layoutGraph(
    metadata,
    edges.filter((e) => metadataIds.has(e.source) && metadataIds.has(e.target)),
  ))
    placed.set(n.id, {
      x: n.position.x + metadataX,
      y: n.position.y - (NODE_HEIGHT + ROW_GAP),
    });
  return [...placed].map(([id, position]) => ({ id, position }));
}
export function edgeRole(
  edge: GraphEdge,
  context: ReturnType<typeof incidentContext>,
  nodes: GraphNode[],
) {
  if (context.primaryEdges.has(edge.id))
    return edge.type === "TRIGGERED_AFTER" ? "temporal" : "primary";
  if (
    edge.type === "RESOLVES" ||
    (edge.type === "AFFECTS" && context.historicalIds.has(edge.source))
  )
    return "historical";
  const metadata = new Set([
    "Memory",
    "Investigation",
    "Evidence",
    "Decision",
    "Action",
  ]);
  if (
    nodes.some(
      (n) =>
        (n.id === edge.source || n.id === edge.target) && metadata.has(n.label),
    )
  )
    return "memory";
  return "context";
}
