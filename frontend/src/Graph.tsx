import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ArrowRight, Search, X } from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { GraphEdge, GraphNode } from "../../backend/src/types";
import { Heading, State, display } from "./components";
import { useGraphData } from "./useGraphData";
import {
  contextLayout,
  incidentContext,
  edgeRole,
  NODE_WIDTH,
  NODE_HEIGHT,
} from "./graphLayout";
import { GraphViewport, GRAPH_FIT_OPTIONS } from "./GraphViewport";
const colors: Record<string, string> = {
  Incident: "#c66a42",
  Service: "#48897c",
  Deployment: "#b79043",
  Team: "#7964a3",
  Person: "#7964a3",
  Runbook: "#4e7ca4",
  Resolution: "#648c57",
  Memory: "#966fba",
  Evidence: "#71808e",
  Investigation: "#427b83",
  Decision: "#9c795a",
  Action: "#7d8466",
  Organization: "#5d7082",
  Environment: "#768977",
};
export function GraphView({
  focus = "",
  label = "",
  compact = false,
  highlight = [],
  resetKey = 0,
}: {
  focus?: string;
  label?: string;
  compact?: boolean;
  highlight?: string[];
  resetKey?: number;
}) {
  const path = focus
    ? "/graph/neighborhood/" + encodeURIComponent(focus) + "?limit=70"
    : "/graph?limit=80&label=" + encodeURIComponent(label);
  const state = useGraphData(path, !focus && !label && !compact);
  const context = useMemo(
    () =>
      incidentContext(
        state.data?.nodes || [],
        state.data?.edges || [],
        focus || state.anchor,
      ),
    [state.data, focus, state.anchor],
  );
  const [initialIds, setInitialIds] = useState<string[]>([]);
  const [hoveredEdge, setHoveredEdge] = useState("");
  const [activeEdge, setActiveEdge] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selected, setSelected] = useState<GraphNode>();
  const [relation, setRelation] = useState("");
  const layoutKey = useMemo(
    () =>
      JSON.stringify([
        path,
        compact,
        resetKey,
        context.root,
        state.data?.nodes.map((n) => n.id).sort(),
        state.data?.edges.map((e) => [e.id, e.source, e.target]).sort(),
      ]),
    [path, compact, resetKey, state.data, context.root],
  );
  const highlightKey = highlight.join("|");
  useEffect(() => {
    setSelected(undefined);
    setRelation("");
    setActiveEdge("");
    setHoveredEdge("");
    if (!state.data) return;
    const visibleIds = new Set([focus]);
    const direct = state.data.edges.filter(
      (e) =>
        e.source === focus && ["AFFECTS", "TRIGGERED_AFTER"].includes(e.type),
    );
    direct.forEach((e) => visibleIds.add(e.target));
    const affectedIds = direct
      .filter((e) => e.type === "AFFECTS")
      .map((e) => e.target);
    state.data.edges
      .filter((e) => affectedIds.includes(e.source) && e.type === "DEPENDS_ON")
      .slice(0, 3)
      .forEach((e) => visibleIds.add(e.target));
    const visibleNodes = compact
      ? state.data.nodes.filter((n) => visibleIds.has(n.id))
      : state.data.nodes;
    const visibleEdges = compact
      ? state.data.edges.filter(
          (e) => visibleIds.has(e.source) && visibleIds.has(e.target),
        )
      : state.data.edges;
    const positions = new Map(
      contextLayout(visibleNodes, visibleEdges, context, compact).map((n) => [
        n.id,
        n.position,
      ]),
    );
    setInitialIds(
      context.previewIds.length
        ? context.previewIds
        : context.anchor
          ? [
              context.anchor,
              ...[...positions.keys()]
                .filter((id) => id !== context.anchor)
                .slice(0, 2),
            ]
          : [...positions.keys()].slice(0, 3),
    );
    setNodes(
      visibleNodes.map((n) => {
        const title = String(
          n.properties.name ||
            n.properties.title ||
            (n.label === "Memory"
              ? n.properties.content
              : n.label === "Investigation"
                ? n.properties.summary
                : n.label === "Evidence"
                  ? n.properties.content
                  : undefined) ||
            n.id,
        );
        return {
          id: n.id,
          position: positions.get(n.id)!,
          className: context.primaryIds.has(n.id)
            ? "graph-primary"
            : context.historicalIds.has(n.id)
              ? "graph-historical"
              : [
                    "Memory",
                    "Investigation",
                    "Evidence",
                    "Decision",
                    "Action",
                  ].includes(n.label)
                ? "graph-supporting"
                : "",

          data: {
            layoutKey,
            label: (
              <>
                <small>{n.label.toUpperCase()}</small>
                <b title={title}>{title}</b>
                <em>{n.id}</em>
              </>
            ),
          },
          style: {
            borderColor: highlight.includes(n.id)
              ? "#e09b35"
              : colors[n.label] || "#71808e",
            borderWidth: highlight.includes(n.id) ? 3 : 1.5,
            background: highlight.includes(n.id) ? "#fff5df" : "#fff",
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
          },
          sourcePosition: "right",
          targetPosition: "left",
        } as Node;
      }),
    );
    setEdges(
      visibleEdges.map((e) => ({
        ...e,
        data: { relationType: e.type },
        label: compact ? undefined : e.type,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          stroke:
            highlight.includes(e.source) && highlight.includes(e.target)
              ? "#d0942d"
              : "#9da9a5",
          strokeWidth:
            highlight.includes(e.source) && highlight.includes(e.target)
              ? 3
              : 1,
        },
        labelStyle: { fontSize: 11, fill: "#45594e" },
        labelBgStyle: { fill: "#fff", fillOpacity: 0.96 },
        labelBgPadding: [6, 4] as [number, number],
        labelBgBorderRadius: 4,
        interactionWidth: 18,
        type: "smoothstep",
      })),
    );
  }, [
    state.data,
    compact,
    focus,
    resetKey,
    layoutKey,
    context,
    setNodes,
    setEdges,
  ]);
  // Visual emphasis changes never move nodes or reset the viewport.
  useEffect(() => {
    const ids = new Set(highlightKey.split("|"));
    setNodes((current) =>
      current.map((n) => {
        const raw = state.data?.nodes.find((raw) => raw.id === n.id);
        const primary = context.primaryIds.has(n.id),
          marked = ids.has(n.id);
        return {
          ...n,
          style: {
            ...n.style,
            borderColor: marked
              ? "#c88720"
              : primary
                ? raw?.label === "Deployment"
                  ? "#ba852f"
                  : "#2b7660"
                : colors[raw?.label || ""] || "#71808e",
            borderWidth: primary || marked ? 3 : 1.5,
            background: primary
              ? raw?.label === "Deployment"
                ? "#fff8e9"
                : "#edf7ef"
              : context.historicalIds.has(n.id)
                ? "#f1f7f4"
                : "#fff",
            boxShadow: primary ? "0 0 0 3px #396d4c18" : undefined,
            opacity:
              n.className === "graph-supporting" &&
              !context.previewIds.includes(n.id)
                ? 0.82
                : 1,
          },
        };
      }),
    );
    setEdges((current) =>
      current.map((e) => {
        const type = String(e.data?.relationType || "");
        const raw = { id: e.id, source: e.source, target: e.target, type };
        const role = edgeRole(raw, context, state.data?.nodes || []);
        const active = e.id === hoveredEdge || e.id === activeEdge;
        const marked = ids.has(e.source) && ids.has(e.target);
        const stroke = marked
          ? "#c88720"
          : role === "primary"
            ? "#28765e"
            : role === "temporal"
              ? "#b17e25"
              : role === "historical"
                ? "#537f75"
                : role === "memory"
                  ? "#9984af"
                  : "#83958c";
        return {
          ...e,
          className: "graph-edge-" + role,
          ariaLabel:
            type === "TRIGGERED_AFTER"
              ? "TRIGGERED_AFTER: temporal association; causation unconfirmed"
              : type,
          zIndex:
            e.id === activeEdge
              ? 6
              : role === "primary" || role === "temporal"
                ? 3
                : role === "historical"
                  ? 2
                  : active
                    ? 1
                    : 0,
          label: compact
            ? undefined
            : active ||
                marked ||
                ["primary", "temporal", "historical"].includes(role)
              ? type
              : undefined,
          style: {
            ...e.style,
            stroke,
            strokeWidth:
              active || marked
                ? 3
                : role === "primary"
                  ? 2.8
                  : role === "temporal"
                    ? 2.4
                    : role === "historical"
                      ? 1.8
                      : 1.2,
            strokeDasharray:
              role === "temporal"
                ? "7 4"
                : role === "memory"
                  ? "4 5"
                  : undefined,
            opacity:
              active || marked
                ? 1
                : role === "memory"
                  ? 0.4
                  : role === "context"
                    ? 0.6
                    : 1,
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
          pathOptions: {
            offset: 28,
            stepPosition:
              role === "memory" ? 0.85 : role === "context" ? 0.15 : 0.5,
          },
        };
      }),
    );
  }, [
    highlightKey,
    context,
    state.data,
    hoveredEdge,
    activeEdge,
    compact,
    setNodes,
    setEdges,
  ]);
  return (
    <div className={"graph-container " + (compact ? "compact" : "")}>
      <State
        loading={state.loading}
        error={state.error}
        empty={!!state.data && !state.data.nodes.length}
        retry={state.refresh}
      />
      {state.data && state.data.nodes.length > 0 && (
        <>
          <ReactFlow
            key={path}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            minZoom={0.08}
            maxZoom={2}
            onNodeClick={(_, n) => {
              setSelected(state.data!.nodes.find((x) => x.id === n.id));
              setRelation("");
              setActiveEdge("");
            }}
            onEdgeMouseEnter={(_, e) => setHoveredEdge(e.id)}
            onEdgeMouseLeave={() => setHoveredEdge("")}
            onEdgeClick={(_, e) => {
              setActiveEdge(e.id);
              setRelation(
                String(
                  e.label || state.data!.edges.find((x) => x.id === e.id)?.type,
                ),
              );
              setSelected(undefined);
            }}
          >
            <GraphViewport
              layoutKey={layoutKey}
              initialIds={initialIds}
              compact={compact}
            />
            <Background color="#d2d9d4" gap={20} />
            {!compact && (
              <>
                <Controls fitViewOptions={GRAPH_FIT_OPTIONS} />
                <MiniMap
                  nodeColor={(n) =>
                    colors[
                      state.data!.nodes.find((x) => x.id === n.id)?.label || ""
                    ] || "#888"
                  }
                  zoomable
                  pannable
                />
              </>
            )}
          </ReactFlow>
          {!compact && (
            <div className="graph-legend">
              {[...new Set(state.data.nodes.map((n) => n.label))].map((l) => (
                <span key={l}>
                  <i style={{ background: colors[l] }} />
                  {l}
                </span>
              ))}
            </div>
          )}
          {!compact && context.root && (
            <div className="graph-context-note">
              <b>{context.root}</b> · Highlighted: affected service and
              deployment timing. Historical and memory links are supporting
              context; timing does not establish cause.
            </div>
          )}
          {!compact && state.contextError && (
            <div className="graph-context-note">
              Additional incident context could not be loaded:{" "}
              {state.contextError}. The returned graph remains available.
            </div>
          )}
          {!compact && (selected || relation) && (
            <div className="node-details">
              <button
                className="icon-button"
                onClick={() => {
                  setSelected(undefined);
                  setRelation("");
                  setActiveEdge("");
                }}
                aria-label="Close details"
              >
                <X size={16} />
              </button>
              <h3>{selected?.label || "Relationship"}</h3>
              {selected ? (
                <>
                  <p className="mono">{selected.id}</p>
                  <dl>
                    {Object.entries(selected.properties)
                      .filter(([k]) => k !== "report")
                      .map(([k, v]) => (
                        <React.Fragment key={k}>
                          <dt>{k}</dt>
                          <dd>{display(v)}</dd>
                        </React.Fragment>
                      ))}
                  </dl>
                  {selected.label === "Incident" && (
                    <Link to={"/investigations?incident=" + selected.id}>
                      Investigate this incident <ArrowRight size={14} />
                    </Link>
                  )}
                </>
              ) : (
                <p>{relation}</p>
              )}
            </div>
          )}
          {!compact && state.data.truncated && (
            <span className="graph-limit">
              Bounded view · more nodes or edges may exist
            </span>
          )}
        </>
      )}
    </div>
  );
}
export function GraphPage() {
  const [params, setParams] = useSearchParams();
  const [focus, setFocus] = useState(params.get("focus") || "");
  const [label, setLabel] = useState("");
  const [resetKey, setResetKey] = useState(0);
  return (
    <>
      <Heading
        eyebrow="KNOWLEDGE / GRAPH EXPLORER"
        title="Every connection tells a story."
        description="Inspect the real graph. Select a node or relationship to see its source properties."
      />
      <section className="card">
        <div className="toolbar">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setParams(focus ? { focus } : {});
              setResetKey((key) => key + 1);
            }}
          >
            <Search size={17} />
            <input
              aria-label="Focus node ID"
              value={focus}
              onChange={(e) => setFocus(e.target.value)}
              placeholder="Focus a node, e.g. INC-1001"
            />
            <button>Focus graph</button>
          </form>
          <select
            aria-label="Node label filter"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setParams({});
              setFocus("");
            }}
          >
            {[
              "",
              "Incident",
              "Service",
              "Deployment",
              "Team",
              "Person",
              "Runbook",
              "Resolution",
              "Memory",
              "Investigation",
              "Evidence",
              "Decision",
              "Action",
            ].map((l) => (
              <option key={l} value={l}>
                {l || "All node types"}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setParams({});
              setFocus("");
              setLabel("");
              setResetKey((key) => key + 1);
            }}
          >
            Reset
          </button>
        </div>
        <GraphView
          focus={params.get("focus") || ""}
          label={label}
          highlight={(params.get("path") || "").split(",")}
          resetKey={resetKey}
        />
      </section>
    </>
  );
}
