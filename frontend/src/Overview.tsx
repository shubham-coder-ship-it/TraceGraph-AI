import {
Activity,
ArrowRight,
ArrowUpRight,
BrainCircuit,
ChevronRight,
FileSearch,
GitBranch,
Network,
RefreshCw,
Search
} from "lucide-react";
import { Link } from "react-router-dom";
import type {
Entity
} from "../../backend/src/types";
import { Badge,Heading,State,date } from "./components";
import { GraphView } from "./Graph";
import { useData } from "./hooks";
type Overview = {
  counts: Record<string, number>;
  recentIncidents: Entity[];
  recentInvestigations: Entity[];
};
function IncidentTable({ incidents }: { incidents: Entity[] }) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>INCIDENT</th>
            <th>SEVERITY</th>
            <th>STATUS</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => (
            <tr key={i.id}>
              <td>
                <Link
                  className="incident-title"
                  to={"/investigations?incident=" + encodeURIComponent(i.id)}
                >
                  {i.title || i.id}
                </Link>
                <small className="mono muted">{i.id}</small>
              </td>
              <td>
                <Badge tone={i.severity === "SEV-1" ? "red" : "amber"}>
                  {i.severity || "Untriaged"}
                </Badge>
              </td>
              <td>
                <span
                  className={
                    "status " + (i.status === "Resolved" ? "resolved" : "")
                  }
                >
                  {i.status}
                </span>
              </td>
              <td>
                <Link
                  aria-label={"Investigate " + i.id}
                  to={"/investigations?incident=" + encodeURIComponent(i.id)}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function OverviewPage() {
  const state = useData<Overview>("/overview");
  return (
    <>
      <Heading
        eyebrow="OPERATIONS / OVERVIEW"
        title="Connect the dots. Find the cause."
        description="Follow the evidence across your services, incidents and team knowledge."
        action={
          <button onClick={state.refresh}>
            <RefreshCw size={15} /> Refresh
          </button>
        }
      />
      <div className="demo-banner">
        <span className="icon-box">
          <GitBranch size={20} />
        </span>
        <div>
          <b>Your next investigation starts with a connection.</b>
          <p>
            Trace dependencies, compare past incidents and carry knowledge
            forward.
          </p>
        </div>
        <Link to="/investigations" className="button">
          Start investigating <ArrowRight size={16} />
        </Link>
      </div>
      <State
        loading={state.loading}
        error={state.error}
        retry={state.refresh}
      />
      {state.data && (
        <>
          <div className="metrics">
            {[
              ["Incident", "Total incidents", FileSearch],
              ["openIncidents", "Active incidents", Activity],
              ["Service", "Connected services", Network],
              ["Memory", "Persistent memories", BrainCircuit],
            ].map(([key, title, Icon]) => {
              const I = Icon as typeof Activity;
              return (
                <div className="metric" key={String(key)}>
                  <div>
                    <span>{String(title)}</span>
                    <I size={18} />
                  </div>
                  <strong>{state.data!.counts[String(key)]}</strong>
                  <small>
                    {key === "openIncidents"
                      ? "Open, untriaged or investigating"
                      : key === "Memory"
                        ? "Knowledge stored in the graph"
                        : "Live from your knowledge graph"}
                  </small>
                </div>
              );
            })}
          </div>
          <div className="overview-grid">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>
                    Incident queue{" "}
                    <Badge>{state.data.recentIncidents.length}</Badge>
                  </h2>
                  <p>Investigate what matters, with context.</p>
                </div>
                <Link to="/investigations">
                  View all <ArrowRight size={14} />
                </Link>
              </div>
              {state.data.recentIncidents.length ? (
                <IncidentTable incidents={state.data.recentIncidents} />
              ) : (
                <State empty />
              )}
            </section>
            <section className="card graph-overview">
              <div className="card-header">
                <div>
                  <h2>Connected system</h2>
                  <p>Explore the relationships behind the symptoms.</p>
                </div>
                <Network size={19} />
              </div>
              <GraphView compact focus="INC-1001" />
              <Link className="graph-link" to="/graph?focus=INC-1001">
                Open graph explorer <ArrowUpRight size={16} />
              </Link>
            </section>
          </div>
          <div className="overview-grid bottom-grid">
            <section className="card">
              <div className="card-header">
                <div>
                  <h2>Recent investigations</h2>
                  <p>Saved evidence, ready to revisit.</p>
                </div>
                <Badge>{state.data.counts.Investigation} saved</Badge>
              </div>
              {state.data.recentInvestigations.length ? (
                state.data.recentInvestigations.slice(0, 4).map((i) => (
                  <Link
                    key={i.id}
                    className="saved-row"
                    to={"/investigations?report=" + i.id}
                  >
                    <span className="icon-box muted-icon">
                      <FileSearch size={18} />
                    </span>
                    <div>
                      <b>{i.incidentId as string}</b>
                      <p>{i.summary as string}</p>
                      <small>{date(i.createdAt)}</small>
                    </div>
                    <ChevronRight size={16} />
                  </Link>
                ))
              ) : (
                <div className="empty-inline">
                  <FileSearch size={22} />
                  <b>A clear trail starts here</b>
                  <p>
                    Run an investigation to save its evidence and build
                    persistent memory.
                  </p>
                  <Link to="/investigations">
                    Investigate an incident <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </section>
            <section className="card workflow">
              <div className="card-header">
                <div>
                  <h2>From signal to understanding</h2>
                  <p>A bounded, evidence-first workflow.</p>
                </div>
              </div>
              {[
                [
                  Network,
                  "01",
                  "Follow connected evidence",
                  "Services, deployments, dependencies and owners.",
                ],
                [
                  Search,
                  "02",
                  "Compare possible explanations",
                  "Rank hypotheses while keeping uncertainty visible.",
                ],
                [
                  BrainCircuit,
                  "03",
                  "Remember what you learned",
                  "Reuse sourced knowledge in the next investigation.",
                ],
              ].map(([Icon, num, title, desc]) => {
                const I = Icon as typeof Activity;
                return (
                  <div className="workflow-step" key={String(num)}>
                    <span>
                      <I size={19} />
                    </span>
                    <div>
                      <small>{String(num)}</small>
                      <h3>{String(title)}</h3>
                      <p>{String(desc)}</p>
                    </div>
                  </div>
                );
              })}
            </section>
          </div>
        </>
      )}
    </>
  );
}
