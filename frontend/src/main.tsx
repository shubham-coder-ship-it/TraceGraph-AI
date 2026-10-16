import "@xyflow/react/dist/style.css";
import {
BookOpen,
BrainCircuit,
ChevronRight,
Database,
FileSearch,
GitBranch,
LayoutDashboard,
Network,
Plus,
Settings,
ShieldCheck,
TriangleAlert
} from "lucide-react";
import React,{ Component,useEffect,type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
BrowserRouter,
Link,
NavLink,
Route,
Routes,
useLocation
} from "react-router-dom";
import { State } from "./components";
import { GraphPage } from "./Graph";
import { useData } from "./hooks";
import { InvestigationsPage } from "./Investigations";
import { MemoryPage } from "./MemoryPage";
import { OverviewPage } from "./Overview";
import { RunbooksPage } from "./RunbooksPage";
import { SettingsPage } from "./SettingsPage";
import "./style.css";
type Health = {
  database: string;
  graph: string;
  nodeCount: number;
  analysisMode: string;
  providerConfigured: boolean;
};
const navigation = [
  ["/", "Overview", LayoutDashboard],
  ["/investigations", "Investigations", FileSearch],
  ["/graph", "Graph Explorer", Network],
  ["/memory", "Agent Memory", BrainCircuit],
  ["/runbooks", "Runbooks", BookOpen],
  ["/settings", "Settings", Settings],
] as const;
function Shell() {
  const location = useLocation();
  const health = useData<Health>("/health");
  useEffect(() => {
    const id = setInterval(health.refresh, 30000);
    return () => clearInterval(id);
  }, [health.refresh]);
  const page =
    navigation.find(([path]) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(path),
    )?.[1] || "Console";
  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-icon">
            <GitBranch size={23} />
          </span>
          <span>
            TraceGraph<span className="ai"> AI</span>
          </span>
        </Link>
        <div className="workspace">
          <span className="workspace-avatar">N</span>
          <div>
            <b>Northstar Systems</b>
            <small>Investigation workspace</small>
          </div>
          <ChevronRight size={14} />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(([path, label, Icon]) => (
            <NavLink key={path} to={path} end={path === "/"}>
              <Icon size={18} />
              {label}
              {label === "Investigations" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="graph-engine">
            <Database size={17} />
            <div>
              <b>Powered by FalkorDB</b>
              <small>Connected evidence. Lasting memory.</small>
            </div>
          </div>
          <div className="profile">
            <span className="avatar">NS</span>
            <div>
              <b>Northstar Demo</b>
              <small>Local workspace</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <header>
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} /> <b>{page}</b>
          </div>
          <div className="header-right">
            <span className={"connection " + (health.data ? "connected" : "")}>
              <i />
              {health.loading
                ? "Checking database"
                : health.data
                  ? "FalkorDB connected"
                  : "Database unavailable"}
            </span>
            <span className="header-divider" />
            <Link className="button primary small" to="/investigations">
              <Plus size={15} /> New investigation
            </Link>
          </div>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/investigations" element={<InvestigationsPage />} />
            <Route path="/graph" element={<GraphPage />} />
            <Route path="/memory" element={<MemoryPage />} />
            <Route path="/runbooks" element={<RunbooksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<State error="Page not found" />} />
          </Routes>
          <footer>
            <span>
              <span className="tiny-dot" /> SYNTHETIC DEMO DATA
            </span>
            <span>Evidence-first incident investigation · TraceGraph AI</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <TriangleAlert />
        <h1>The console hit an unexpected error.</h1>
        <p>Your saved reports remain in FalkorDB.</p>
        <button onClick={() => window.location.reload()}>Reload console</button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
