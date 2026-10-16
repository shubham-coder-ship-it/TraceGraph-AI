import {
ArrowUpRight,
BrainCircuit,
Check,
RefreshCw
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type {
Memory
} from "../../backend/src/types";
import { patch } from "./api";
import { Badge,Heading,State,date } from "./components";
import { useData } from "./hooks";
export function MemoryPage() {
  const [type, setType] = useState("");
  const [offset, setOffset] = useState(0);
  const state = useData<Memory[]>(
    "/memory?limit=12&offset=" + offset + "&type=" + type,
  );
  const [error, setError] = useState("");
  const update = async (m: Memory, status: string) => {
    try {
      await patch("/memory/" + m.id, { status });
      state.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <>
      <Heading
        eyebrow="KNOWLEDGE / AGENT MEMORY"
        title="An investigation ends. Knowledge stays."
        description="Inspect sourced, graph-backed memory that carries context across sessions."
        action={
          <button onClick={state.refresh}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      <div className="filter-tabs">
        {["", "episodic", "semantic", "procedural"].map((t) => (
          <button
            key={t}
            className={type === t ? "active" : ""}
            onClick={() => {
              setType(t);
              setOffset(0);
            }}
          >
            {t || "All memory"}
          </button>
        ))}
      </div>
      <State
        loading={state.loading}
        error={state.error || error}
        empty={!!state.data && !state.data.length}
        retry={state.refresh}
      />
      <div className="memory-grid">
        {state.data?.map((m) => (
          <section key={m.id} className="card memory-card">
            <div className="memory-card-top">
              <span className="icon-box">
                <BrainCircuit size={19} />
              </span>
              <Badge>{m.type}</Badge>
              <Badge tone={m.status === "reviewed" ? "green" : ""}>
                {m.status}
              </Badge>
            </div>
            <p>{m.content}</p>
            <small className="mono">{m.id}</small>
            <div className="memory-meta">
              <span>
                Incident <b>{m.incidentId}</b>
              </span>
              <span>
                Created <b>{date(m.createdAt)}</b>
              </span>
              <span>
                Retrieved <b>{m.accessCount || 0} times</b>
              </span>
              <span>
                Confidence <b>{m.confidence} · heuristic</b>
              </span>
            </div>
            <details>
              <summary>Evidence provenance</summary>
              <p>{(m.evidenceIds || []).join(", ")}</p>
              <p>Last retrieved: {date(m.lastAccessedAt)}</p>
              <Link to={"/investigations?report=" + m.source}>
                Open source investigation <ArrowUpRight size={14} />
              </Link>
            </details>
            <div className="memory-actions">
              <button
                disabled={m.status === "reviewed"}
                onClick={() => update(m, "reviewed")}
              >
                <Check size={14} /> Mark reviewed
              </button>
              <button
                onClick={() =>
                  update(m, m.status === "archived" ? "unreviewed" : "archived")
                }
              >
                {m.status === "archived" ? "Restore" : "Archive"}
              </button>
            </div>
          </section>
        ))}
      </div>
      <div className="pagination">
        <button
          disabled={offset === 0}
          onClick={() => setOffset((o) => Math.max(0, o - 12))}
        >
          Previous
        </button>
        <span>Page {offset / 12 + 1}</span>
        <button
          disabled={!state.data || state.data.length < 12}
          onClick={() => setOffset((o) => o + 12)}
        >
          Next
        </button>
      </div>
    </>
  );
}
