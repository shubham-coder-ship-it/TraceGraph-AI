import { useMemo } from "react";
import type { Entity, GraphNode, GraphEdge } from "../../backend/src/types";
import { useData } from "./hooks";
import { chooseIncident } from "./graphLayout";
export type GraphData = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
};
/** Preserve the bounded all-graph response and enrich its initial incident context
 * via existing read-only endpoints. No backend contracts or records are changed. */
export function useGraphData(path: string, overview: boolean) {
  const raw = useData<GraphData>(path);
  const incidents = useData<Entity[]>(overview ? "/incidents?limit=50" : null);
  const anchor =
    overview && incidents.data ? chooseIncident(incidents.data) : "";
  const neighborhood = useData<GraphData>(
    anchor
      ? "/graph/neighborhood/" + encodeURIComponent(anchor) + "?limit=70"
      : null,
  );
  const loading =
    raw.loading ||
    (overview && (incidents.loading || (!!anchor && neighborhood.loading)));
  const data = useMemo(() => {
    if (!raw.data || loading) return undefined;
    const nodes = new Map(raw.data.nodes.map((n) => [n.id, n]));
    const edges = new Map(raw.data.edges.map((e) => [e.id, e]));
    neighborhood.data?.nodes.forEach((n) => nodes.set(n.id, n));
    neighborhood.data?.edges.forEach((e) => edges.set(e.id, e));
    return {
      ...raw.data,
      nodes: [...nodes.values()],
      edges: [...edges.values()],
      truncated: raw.data.truncated || !!neighborhood.data?.truncated,
    };
  }, [raw.data, neighborhood.data, loading]);
  return {
    data,
    loading,
    error: raw.error,
    contextError: incidents.error || neighborhood.error,
    anchor,
    refresh: () => {
      raw.refresh();
      if (overview) {
        incidents.refresh();
        neighborhood.refresh();
      }
    },
  };
}
