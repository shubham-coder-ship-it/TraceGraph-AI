import {
Database,
RefreshCw,
ShieldCheck
} from "lucide-react";
import { Badge,Heading,State } from "./components";
import { useData } from "./hooks";
type Health = {
  database: string;
  graph: string;
  nodeCount: number;
  analysisMode: string;
  providerConfigured: boolean;
};
export function SettingsPage() {
  const state = useData<Health>("/health");
  return (
    <>
      <Heading
        eyebrow="WORKSPACE / SETTINGS"
        title="Know what’s connected."
        description="Live system health and the boundaries of your investigation workspace."
        action={
          <button onClick={state.refresh}>
            <RefreshCw size={15} /> Check connection
          </button>
        }
      />
      <State
        loading={state.loading}
        error={state.error}
        retry={state.refresh}
      />
      <div className="two-column">
        <section className="card padded">
          <h3>
            <Database size={18} /> FalkorDB knowledge graph
          </h3>
          {state.data ? (
            <dl>
              <dt>Connection</dt>
              <dd>
                <Badge tone="green">Connected · verified by query</Badge>
              </dd>
              <dt>Graph</dt>
              <dd className="mono">{state.data.graph}</dd>
              <dt>Nodes</dt>
              <dd>{state.data.nodeCount}</dd>
              <dt>Provider configured</dt>
              <dd>{state.data.providerConfigured ? "Yes" : "No"}</dd>
              <dt>Analysis</dt>
              <dd>{state.data.analysisMode}</dd>
            </dl>
          ) : (
            <p>
              Health query unavailable. No counts are displayed until a query
              succeeds.
            </p>
          )}
        </section>
        <section className="card padded">
          <h3>
            <ShieldCheck size={18} /> Reasoning & privacy
          </h3>
          <p>
            Deterministic investigation works without an LLM key. Optional model
            configuration on the server can rank predefined hypotheses; it
            cannot generate Cypher or execute actions.
          </p>
          <p>
            Reports, evidence and memory are persisted in FalkorDB. A configured
            model receives report evidence for ranking.
          </p>
          <p>
            This local demo has no authentication. Keep it on localhost, or add
            an authenticated gateway before hosting it.
          </p>
          <Badge>Synthetic Demo Data</Badge>
        </section>
      </div>
    </>
  );
}
