import {
  ArrowRight,
  ArrowUpRight,
  BrainCircuit,
  Check,
  ChevronRight,
  Download,
  FileSearch,
  GitBranch,
  LoaderCircle,
  Network,
  Plus,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import type { Entity, Evidence, Report } from "../../backend/src/types";
import { api, patch, post } from "./api";
import { Badge, Heading, State, date, display } from "./components";
import { GraphView } from "./Graph";
import { useData } from "./hooks";
function EvidenceCard({ e }: { e: Evidence }) {
  return (
    <details className="evidence-card" id={e.id}>
      <summary>
        <Badge>{e.kind}</Badge>
        <b className="mono">{e.id}</b>
        <ChevronRight size={16} />
      </summary>
      <div className="evidence-body">
        <p className="source">Source: {e.source}</p>
        <div className="path">{e.path.join(" → ")}</div>
        <dl>
          {Object.entries(e.facts).map(([k, v]) => (
            <React.Fragment key={k}>
              <dt>{k}</dt>
              <dd>{display(v)}</dd>
            </React.Fragment>
          ))}
        </dl>
        <Link
          to={
            "/graph?focus=" +
            encodeURIComponent(e.path[0]) +
            "&path=" +
            encodeURIComponent(
              e.path.filter((x) => /^(INC-|SVC-|DEP-|RES-)/.test(x)).join(","),
            )
          }
        >
          Explore evidence path <ArrowUpRight size={14} />
        </Link>
      </div>
    </details>
  );
}
export function InvestigationsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const incidents = useData<Entity[]>("/incidents");
  const services = useData<Entity[]>("/services");
  const history = useData<Entity[]>("/investigations");
  const [id, setId] = useState(params.get("incident") || "INC-1001");
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState("Analysis");
  const [intake, setIntake] = useState(false);
  const [memType, setMemType] = useState("semantic");
  const [content, setContent] = useState("");
  const [memEvidence, setMemEvidence] = useState("");
  useEffect(() => {
    if (params.get("incident")) setId(params.get("incident")!);
    if (params.get("report")) {
      setBusy(true);
      setError("");
      api<Report>(
        "/investigations/" + encodeURIComponent(params.get("report")!),
      )
        .then((r) => {
          setReport(r);
          setId(r.incidentId);
          setNotice("Saved report loaded.");
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
    }
  }, [params.toString()]);
  const run = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    setReport(undefined);
    try {
      const r = await post<Report>("/investigations", { incidentId: id });
      setReport(r);
      setTab("Analysis");
      history.refresh();
      setParams({});
      setNotice("Investigation and episodic memory saved to FalkorDB.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const feedback = async (value: string) => {
    if (!report) return;
    try {
      await patch("/investigations/" + report.id, { feedback: value });
      setNotice("Feedback saved: " + value);
      history.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const saveMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!report || !memEvidence) return;
    setBusy(true);
    try {
      const ev = report.evidence.find((x) => x.id === memEvidence)!;
      if (
        memType === "semantic" &&
        !["dependency", "ownership", "affected-service"].includes(ev.kind)
      )
        throw new Error(
          "Semantic memory requires a dependency, ownership or affected-service source.",
        );
      if (memType === "procedural" && ev.kind !== "runbook")
        throw new Error("Procedural memory requires a runbook source.");
      await post("/memory", {
        type: memType,
        content,
        source: report.id,
        incidentId: report.incidentId,
        evidenceIds: [memEvidence],
        confidence: 0.5,
      });
      setNotice("Sourced memory saved for review.");
      setContent("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Heading
        eyebrow="INVESTIGATE / EVIDENCE-FIRST AGENT"
        title="Turn an incident into understanding."
        description="Follow bounded graph paths, test hypotheses and preserve what you learn."
      />
      <section className="card investigation-input">
        <div className="toolbar">
          <div className="input-with-icon">
            <Search size={18} />
            <input
              aria-label="Incident ID"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Enter incident ID"
            />
          </div>
          <select
            aria-label="Select incident"
            value={incidents.data?.some((i) => i.id === id) ? id : ""}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="" disabled>
              Select an incident
            </option>
            {incidents.data?.map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} · {i.title}
              </option>
            ))}
          </select>
          <button
            className="primary"
            onClick={run}
            disabled={busy || !id.trim()}
          >
            {busy ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <FileSearch size={17} />
            )}{" "}
            {busy ? "Investigating…" : "Run investigation"}
          </button>
        </div>
        <div className="input-caption">
          <span>
            <ShieldCheck size={14} /> Evidence-backed hypotheses · No
            infrastructure actions
          </span>
          <button className="text-button" onClick={() => setIntake(!intake)}>
            {intake ? "Close report form" : "Report a new synthetic incident"}{" "}
            <Plus size={13} />
          </button>
        </div>
        {intake && (
          <form
            className="intake-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              setError("");
              try {
                const r = await post<Entity>("/incidents", {
                  title: form.get("title"),
                  summary: form.get("summary"),
                  serviceId: form.get("serviceId"),
                  syntheticAcknowledged: form.get("ack") === "on",
                });
                setId(r.id);
                incidents.refresh();
                setIntake(false);
                setNotice(
                  "Unverified synthetic report created. Run an investigation to gather evidence.",
                );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <label>
              Title
              <input name="title" required minLength={5} maxLength={150} />
            </label>
            <label>
              Description
              <textarea
                name="summary"
                required
                minLength={10}
                maxLength={3000}
              />
            </label>
            <label>
              Affected service
              <select aria-label="Affected service" name="serviceId" required>
                <option value="">Choose a service</option>
                {services.data?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input name="ack" type="checkbox" required /> This is an
              unverified synthetic demonstration report.
            </label>
            <button>Create unverified report</button>
          </form>
        )}
      </section>
      {notice && (
        <div className="notice" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}
      {error && <State error={error} />}
      <State error={incidents.error} retry={incidents.refresh} />
      {busy && !report && (
        <div className="card running">
          <LoaderCircle className="spin" />
          <h2>Following the evidence</h2>
          <p>
            Retrieving affected services, dependencies, history, runbooks and
            memory. The completed report is saved after graph queries succeed.
          </p>
        </div>
      )}
      {report && (
        <>
          <section className="report-heading">
            <div>
              <div className="eyebrow mono">
                {report.incidentId} · {date(report.createdAt)}
              </div>
              <h2>{report.incident.title || report.incidentId}</h2>
              <p>{report.summary}</p>
              <div className="badge-row">
                <Badge tone="amber">
                  {report.incident.severity || "Untriaged"}
                </Badge>
                <Badge>{report.incident.status}</Badge>
                <Badge tone="green">{report.analysisMode}</Badge>
                <Badge>
                  <Check size={11} /> Saved to graph
                </Badge>
              </div>
            </div>
            <button
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob([JSON.stringify(report, null, 2)], {
                    type: "application/json",
                  }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = report.id + ".json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={15} /> Export report
            </button>
          </section>
          <div className="tabs">
            {[
              "Analysis",
              "Evidence",
              "Connected context",
              "Memory & feedback",
            ].map((t) => (
              <button
                className={tab === t ? "selected" : ""}
                onClick={() => setTab(t)}
                key={t}
              >
                {t}
                {t === "Evidence" && <Badge>{report.evidence.length}</Badge>}
              </button>
            ))}
          </div>
          {tab === "Analysis" && (
            <div className="report-grid">
              <div>
                <div className="section-label">
                  LEADING HYPOTHESES{" "}
                  <span>Heuristic scores · root cause unconfirmed</span>
                </div>
                {report.hypotheses.map((h, i) => (
                  <section className="card hypothesis" key={h.id}>
                    <div className="hypothesis-title">
                      <span className="rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <h3>{h.title}</h3>
                      <Badge tone="amber">
                        {Math.round(h.confidence * 100)} / 100
                      </Badge>
                    </div>
                    <p>{h.description}</p>
                    <p className="reasoning">{h.reasoning}</p>
                    <div className="evidence-links">
                      {h.supportingEvidenceIds.map((eid) => (
                        <button
                          key={eid}
                          onClick={() => {
                            setTab("Evidence");
                            setTimeout(() => {
                              const el = document.getElementById(eid);
                              el?.setAttribute("open", "");
                              el?.scrollIntoView({ behavior: "smooth" });
                            }, 50);
                          }}
                        >
                          Supporting source {eid.slice(-6)}{" "}
                          <ArrowUpRight size={12} />
                        </button>
                      ))}
                    </div>
                    {h.contradictingEvidenceIds.length > 0 && (
                      <p className="counterevidence">
                        Counter-evidence: recorded healthy status weakens this
                        lead.
                      </p>
                    )}
                    <b className="check-label">Recommended check</b>
                    <ul>
                      {h.recommendedChecks.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              <div>
                <section className="card padded">
                  <h3>
                    <TriangleAlert size={17} /> What we don’t know
                  </h3>
                  <ul className="unknowns">
                    {report.unknowns.map((u) => (
                      <li key={u}>{u}</li>
                    ))}
                  </ul>
                </section>
                <section className="card padded">
                  <h3>
                    <GitBranch size={17} /> Investigation trace
                  </h3>
                  {report.toolTrace.map((t) => (
                    <div className="trace-row" key={t.tool}>
                      <Check size={13} />
                      <span>{t.tool}</span>
                      <Badge>{t.count}</Badge>
                    </div>
                  ))}
                </section>
                {report.recommendedChecks.some((c) =>
                  c.startsWith("Review documented procedure"),
                ) && (
                  <section className="card padded">
                    <h3>
                      <BrainCircuit size={17} /> Memory-informed checks
                    </h3>
                    <ul>
                      {report.recommendedChecks
                        .filter((c) =>
                          c.startsWith("Review documented procedure"),
                        )
                        .map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                    </ul>
                  </section>
                )}
                <section className="card padded limitations">
                  <h3>Reasoning boundaries</h3>
                  {report.limitations.map((l) => (
                    <p key={l}>{l}</p>
                  ))}
                </section>
              </div>
            </div>
          )}
          {tab === "Evidence" && (
            <div>
              <p className="muted">
                Observed graph records. Expand a source to inspect its
                properties and path.
              </p>
              {report.evidence.map((e) => (
                <EvidenceCard key={e.id} e={e} />
              ))}
            </div>
          )}
          {tab === "Connected context" && (
            <>
              <section className="card">
                <div className="card-header">
                  <div>
                    <h2>Incident neighborhood</h2>
                    <p>
                      Highlighted incident and affected services; inspect source
                      records below.
                    </p>
                  </div>
                  <Link to={"/graph?focus=" + report.incidentId}>
                    Full explorer <ArrowUpRight size={15} />
                  </Link>
                </div>
                <GraphView
                  focus={report.incidentId}
                  highlight={[
                    report.incidentId,
                    ...report.affectedServices.map((s) => s.id),
                  ]}
                />
              </section>
              <div className="two-column">
                <section className="card padded">
                  <h3>Teams & owners</h3>
                  {report.owners.length ? (
                    report.owners.map((o, i) => (
                      <p key={i}>
                        <b>{display(o.teamName)}</b> · {display(o.personName)}
                        <br />
                        <small>{display(o.serviceId)}</small>
                      </p>
                    ))
                  ) : (
                    <p>No ownership path recorded.</p>
                  )}
                </section>
                <section className="card padded">
                  <h3>Applicable runbooks</h3>
                  {report.runbooks.length ? (
                    report.runbooks.map((r, i) => (
                      <div key={i}>
                        <b>{display((r.runbook as Entity).title)}</b>
                        <small className="block">
                          {display(r.serviceName)}
                        </small>
                        <ol>
                          {(
                            ((r.runbook as Entity).steps as string[]) || []
                          ).map((s) => (
                            <li key={s}>{s}</li>
                          ))}
                        </ol>
                      </div>
                    ))
                  ) : (
                    <p>No runbooks recorded.</p>
                  )}
                </section>
              </div>
              <section className="card padded">
                <h3>Historical incidents & recorded resolutions</h3>
                {report.historicalIncidents.map((h, i) => (
                  <div className="history-item" key={i}>
                    <Badge>{display(h.priorIncident)}</Badge>
                    <b>{display(h.sharedService)}</b>
                    <p>{display(h.priorResolution)}</p>
                    <p className="muted">
                      Recorded outcome: {display(h.priorOutcome)}
                    </p>
                  </div>
                ))}
              </section>
            </>
          )}
          {tab === "Memory & feedback" && (
            <div className="two-column">
              <section className="card padded">
                <h3>
                  <BrainCircuit size={18} /> Memory activity
                </h3>
                <p>
                  {report.memoriesRetrieved.length} prior memories retrieved ·{" "}
                  {report.memoriesCreated.length} episodic memory saved
                </p>
                {report.memoriesRetrieved.map((m) => (
                  <div className="history-item" key={m.id}>
                    <Badge>{m.type}</Badge>
                    <p>{m.content}</p>
                    <small>
                      Source: {m.source} · {m.status}
                    </small>
                  </div>
                ))}
                <p className="muted">
                  Prior memory is shown as context and contributes sourced
                  procedures for review. It never verifies a diagnosis or raises
                  a confidence score.
                </p>
                <Link to="/memory">
                  Inspect persistent memory <ArrowRight size={15} />
                </Link>
                <hr />
                <h3>Was this investigation useful?</h3>
                <div className="badge-row">
                  <button onClick={() => feedback("useful")}>Useful</button>
                  <button onClick={() => feedback("needs-review")}>
                    Needs review
                  </button>
                </div>
              </section>
              <section className="card padded">
                <h3>Save a sourced memory</h3>
                <p className="muted">
                  Choose evidence and record a supported observation or
                  documented procedure. New memories remain unreviewed.
                </p>
                <form className="memory-form" onSubmit={saveMemory}>
                  <label>
                    Type
                    <select
                      aria-label="Memory type"
                      value={memType}
                      onChange={(e) => {
                        setMemType(e.target.value);
                        setMemEvidence("");
                      }}
                    >
                      <option value="semantic">
                        Semantic · relationship knowledge
                      </option>
                      <option value="procedural">
                        Procedural · runbook guidance
                      </option>
                      <option value="episodic">
                        Episodic · investigation observation
                      </option>
                    </select>
                  </label>
                  <label>
                    Evidence source
                    <select
                      aria-label="Evidence source"
                      required
                      value={memEvidence}
                      onChange={(e) => setMemEvidence(e.target.value)}
                    >
                      <option value="">Select supporting evidence</option>
                      {report.evidence
                        .filter((e) =>
                          memType === "semantic"
                            ? [
                                "dependency",
                                "ownership",
                                "affected-service",
                              ].includes(e.kind)
                            : memType === "procedural"
                              ? e.kind === "runbook"
                              : true,
                        )
                        .map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.kind} · {e.path.join(" → ")}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label>
                    Memory content
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      required
                      minLength={10}
                      maxLength={3000}
                    />
                  </label>
                  <button className="primary" disabled={busy}>
                    Save memory
                  </button>
                </form>
              </section>
            </div>
          )}
        </>
      )}
      {!report && !busy && (
        <div className="two-column">
          <section className="card">
            <div className="card-header">
              <div>
                <h2>Saved investigations</h2>
                <p>Reports persist across browser sessions.</p>
              </div>
            </div>
            <State
              loading={history.loading}
              error={history.error}
              empty={!!history.data && !history.data.length}
              retry={history.refresh}
            />
            {history.data?.map((i) => (
              <button
                className="saved-row saved-button"
                key={i.id}
                onClick={() => navigate("/investigations?report=" + i.id)}
              >
                <span className="icon-box">
                  <FileSearch size={18} />
                </span>
                <div>
                  <b>{display(i.incidentId)}</b>
                  <p>{display(i.summary)}</p>
                  <small>{date(i.createdAt)}</small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </section>
          <section className="card padded investigation-intro">
            <span className="large-icon">
              <Network size={38} />
            </span>
            <h2>Evidence before explanation.</h2>
            <p>
              Your agent follows affected services, up to two dependency hops,
              deployment associations and historical resolutions.
            </p>
            <p>
              Each report keeps facts, hypotheses and missing evidence separate.
              An episodic memory is saved so the next investigation can retrieve
              prior context.
            </p>
            <Badge tone="green">No API key required</Badge>
          </section>
        </div>
      )}
    </>
  );
}
