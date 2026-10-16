import {
  Panel,
  useNodes,
  useNodesInitialized,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { useEffect, useRef } from "react";
export const GRAPH_FIT_OPTIONS = { padding: 0.18, minZoom: 0.08, maxZoom: 1 };
const READABLE_FIT = {
  padding: { top: "105px", bottom: "75px", left: "35px", right: "210px" },
  minZoom: 0.75,
  maxZoom: 1.1,
} as const;
export function GraphViewport({
  layoutKey,
  initialIds,
  compact = false,
}: {
  layoutKey: string;
  initialIds: string[];
  compact?: boolean;
}) {
  const initialized = useNodesInitialized(),
    nodes = useNodes(),
    width = useStore((s) => s.width);
  const { fitView } = useReactFlow();
  const fitted = useRef<string | undefined>(undefined);
  const initialKey = initialIds.join("|");
  const center = () => {
    const ids = initialKey.split("|").filter(Boolean);
    const chosen = nodes.filter((n) => ids.includes(n.id));
    return fitView(
      compact
        ? GRAPH_FIT_OPTIONS
        : {
            ...READABLE_FIT,
            ...(width < 650
              ? {
                  padding: {
                    top: "110px" as const,
                    bottom: "70px" as const,
                    left: "20px" as const,
                    right: "20px" as const,
                  },
                }
              : {}),
            nodes: width < 650 ? chosen.slice(0, 1) : chosen,
          },
    );
  };
  useEffect(() => {
    if (
      !initialized ||
      !nodes.length ||
      nodes.some((n) => n.data.layoutKey !== layoutKey) ||
      fitted.current === layoutKey
    )
      return;
    const frame = requestAnimationFrame(() => {
      fitted.current = layoutKey;
      void center();
    });
    return () => cancelAnimationFrame(frame);
  }, [initialized, nodes, layoutKey, initialKey, width, fitView]);
  return compact ? null : (
    <Panel position="bottom-center" className="graph-view-actions">
      <button onClick={() => void center()}>Center investigation</button>
      <button onClick={() => void fitView(GRAPH_FIT_OPTIONS)}>
        Show full graph
      </button>
    </Panel>
  );
}
