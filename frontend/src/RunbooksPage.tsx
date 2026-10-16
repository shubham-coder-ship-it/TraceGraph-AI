import {
ArrowUpRight,
BookOpen,
Search
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import type {
Entity
} from "../../backend/src/types";
import { Badge,Heading,State } from "./components";
import { useData } from "./hooks";
export function RunbooksPage() {
  const state =
    useData<{ runbook: Entity; serviceId: string; serviceName: string }[]>(
      "/runbooks",
    );
  const [search, setSearch] = useState("");
  return (
    <>
      <Heading
        eyebrow="KNOWLEDGE / RUNBOOKS"
        title="A practiced path through uncertainty."
        description="Documented investigative procedures, connected to the services they support."
      />
      <div className="input-with-icon runbook-search">
        <Search size={18} />
        <input
          aria-label="Search runbooks"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search runbooks or services…"
        />
      </div>
      <State
        loading={state.loading}
        error={state.error}
        empty={
          !!state.data &&
          !state.data.filter((r) =>
            JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
          ).length
        }
        retry={state.refresh}
      />
      <div className="memory-grid">
        {state.data
          ?.filter((r) =>
            JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
          )
          .map((r, i) => (
            <section
              className="card runbook-card"
              key={r.runbook.id + r.serviceId + i}
            >
              <span className="icon-box">
                <BookOpen size={21} />
              </span>
              <small className="mono">{r.runbook.id}</small>
              <h2>{r.runbook.title}</h2>
              <Badge tone="green">{r.serviceName || "No linked service"}</Badge>
              <ol>
                {((r.runbook.steps || []) as string[]).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
              <Link to={"/graph?focus=" + r.runbook.id}>
                View service connection <ArrowUpRight size={14} />
              </Link>
            </section>
          ))}
      </div>
    </>
  );
}
