export type SeedNode = {
  label: string;
  id: string;
  props: Record<string, string | boolean | string[]>;
};
const n = (label: string, id: string, props: SeedNode["props"]): SeedNode => ({
  label,
  id,
  props,
});
export const seedNodes: SeedNode[] = [
  n("Organization", "ORG-NORTHSTAR", {
    name: "Northstar Systems",
    source: "synthetic demo",
  }),
  n("Environment", "ENV-PROD", { name: "production" }),
  n("Environment", "ENV-STAGING", { name: "staging" }),
  ...[
    ["SVC-CHECKOUT", "Checkout API", "Degraded"],
    ["SVC-IDENTITY", "Identity Service", "Healthy"],
    ["SVC-GATEWAY", "API Gateway", "Degraded"],
    ["SVC-PAYMENT", "Payment Processor", "Degraded"],
    ["SVC-ORDER", "Order Service", "Healthy"],
    ["SVC-NOTIFY", "Notification Service", "Healthy"],
    ["SVC-INVENTORY", "Inventory Service", "Healthy"],
    ["SVC-DB", "PostgreSQL Adapter Service", "Degraded"],
  ].map(([id, name, status]) => n("Service", id, { name, status })),
  n("Incident", "INC-1001", {
    title: "Checkout API elevated latency",
    severity: "SEV-2",
    status: "Investigating",
    summary: "Checkout latency increased shortly after a deployment.",
  }),
  n("Incident", "INC-0932", {
    title: "Previous checkout latency incident",
    severity: "SEV-2",
    status: "Resolved",
    summary: "A previous synthetic incident involving checkout latency.",
  }),
  n("Incident", "INC-1002", {
    title: "Payment dependency timeouts",
    severity: "SEV-1",
    status: "Investigating",
    summary:
      "Intermittent timeouts while processing synthetic payment requests.",
  }),
  n("Incident", "INC-1003", {
    title: "Gateway intermittent failures",
    severity: "SEV-3",
    status: "Open",
    summary:
      "Incomplete evidence: gateway errors with multiple downstream paths.",
  }),
  n("Incident", "INC-0900", {
    title: "Previous adapter saturation",
    severity: "SEV-2",
    status: "Resolved",
    summary: "A synthetic connection saturation incident.",
  }),
  n("Incident", "INC-0911", {
    title: "Payment timeout: restart unsuccessful",
    severity: "SEV-2",
    status: "Resolved",
    summary: "Restart failed; later pool configuration corrected.",
  }),
  n("Deployment", "DEP-104", {
    version: "2026.10.14-3",
    environment: "production",
    createdAt: "2026-10-14T12:00:00Z",
  }),
  n("Deployment", "DEP-105", {
    version: "2026.10.14-4",
    environment: "production",
    createdAt: "2026-10-14T13:00:00Z",
  }),
  n("Deployment", "DEP-103", {
    version: "2026.10.13-1",
    environment: "staging",
    createdAt: "2026-10-13T10:00:00Z",
  }),
  n("Resolution", "RES-0932", {
    action: "Rollback the checkout deployment and clear the stale cache.",
    outcome: "Latency returned to normal in this synthetic example.",
  }),
  n("Resolution", "RES-0900", {
    action: "Inspect connection pool limits and align adapter concurrency.",
    outcome: "Synthetic timeouts stopped after pool tuning.",
  }),
  n("Resolution", "RES-0911-FAIL", {
    action: "Restart Payment Processor.",
    outcome: "Unsuccessful: synthetic timeouts continued.",
  }),
  n("Resolution", "RES-0911", {
    action: "Correct client pool limits after measuring saturation.",
    outcome: "Successful in the prior synthetic scenario.",
  }),
  n("Team", "TEAM-PAYMENTS", { name: "Payments Platform" }),
  n("Team", "TEAM-SRE", { name: "Reliability Engineering" }),
  n("Team", "TEAM-COMMERCE", { name: "Commerce Engineering" }),
  n("Person", "PERSON-MIRA", { name: "Mira Chen" }),
  n("Person", "PERSON-ARUN", { name: "Arun Rao" }),
  n("Runbook", "RUN-CHECKOUT", {
    title: "Investigate checkout latency",
    steps: [
      "Confirm incident timeline and compare latency percentiles.",
      "Inspect deployment diff and cache hit ratio.",
      "Validate rollback criteria with the service owner; do not execute automatically.",
    ],
  }),
  n("Runbook", "RUN-POOL", {
    title: "Diagnose dependency pool saturation",
    steps: [
      "Measure pool utilization and queue duration.",
      "Trace timeouts from caller to adapter.",
      "Compare configured concurrency with observed capacity.",
    ],
  }),
  n("Runbook", "RUN-GATEWAY", {
    title: "Triage gateway errors",
    steps: [
      "Group errors by downstream service.",
      "Check traces across dependency boundaries.",
      "Identify the earliest failing hop before proposing changes.",
    ],
  }),
  n("Evidence", "SEED-EV-1", {
    kind: "synthetic observation",
    source: "fictional incident note",
    content: "Checkout latency increased after DEP-104; causation unverified.",
  }),
  n("Evidence", "SEED-EV-2", {
    kind: "synthetic observation",
    source: "fictional adapter note",
    content: "Adapter status recorded as Degraded; fresh telemetry is missing.",
  }),
];
export const seedEdges: [string, string, string][] = [
  ["INC-1001", "AFFECTS", "SVC-CHECKOUT"],
  ["SVC-CHECKOUT", "DEPENDS_ON", "SVC-IDENTITY"],
  ["INC-1001", "TRIGGERED_AFTER", "DEP-104"],
  ["DEP-104", "DEPLOYED_TO", "SVC-CHECKOUT"],
  ["INC-0932", "AFFECTS", "SVC-CHECKOUT"],
  ["RES-0932", "RESOLVES", "INC-0932"],
  ["SVC-CHECKOUT", "DEPENDS_ON", "SVC-PAYMENT"],
  ["SVC-CHECKOUT", "DEPENDS_ON", "SVC-ORDER"],
  ["SVC-PAYMENT", "DEPENDS_ON", "SVC-DB"],
  ["SVC-ORDER", "DEPENDS_ON", "SVC-INVENTORY"],
  ["SVC-ORDER", "DEPENDS_ON", "SVC-NOTIFY"],
  ["SVC-GATEWAY", "DEPENDS_ON", "SVC-CHECKOUT"],
  ["SVC-GATEWAY", "DEPENDS_ON", "SVC-IDENTITY"],
  ["SVC-INVENTORY", "DEPENDS_ON", "SVC-DB"],
  ["INC-1002", "AFFECTS", "SVC-PAYMENT"],
  ["INC-1003", "AFFECTS", "SVC-GATEWAY"],
  ["INC-1003", "TRIGGERED_AFTER", "DEP-105"],
  ["DEP-105", "DEPLOYED_TO", "SVC-GATEWAY"],
  ["DEP-103", "DEPLOYED_TO", "SVC-NOTIFY"],
  ["INC-0900", "AFFECTS", "SVC-DB"],
  ["INC-0911", "AFFECTS", "SVC-PAYMENT"],
  ["RES-0900", "RESOLVES", "INC-0900"],
  ["RES-0911-FAIL", "RESOLVES", "INC-0911"],
  ["RES-0911", "RESOLVES", "INC-0911"],
  ["TEAM-PAYMENTS", "OWNS", "SVC-CHECKOUT"],
  ["TEAM-PAYMENTS", "OWNS", "SVC-PAYMENT"],
  ["TEAM-SRE", "OWNS", "SVC-GATEWAY"],
  ["TEAM-SRE", "OWNS", "SVC-DB"],
  ["TEAM-COMMERCE", "OWNS", "SVC-ORDER"],
  ["TEAM-COMMERCE", "OWNS", "SVC-INVENTORY"],
  ["PERSON-MIRA", "MEMBER_OF", "TEAM-PAYMENTS"],
  ["PERSON-ARUN", "MEMBER_OF", "TEAM-SRE"],
  ["RUN-CHECKOUT", "APPLIES_TO", "SVC-CHECKOUT"],
  ["RUN-POOL", "APPLIES_TO", "SVC-PAYMENT"],
  ["RUN-POOL", "APPLIES_TO", "SVC-DB"],
  ["RUN-GATEWAY", "APPLIES_TO", "SVC-GATEWAY"],
  ["DEP-104", "IN_ENVIRONMENT", "ENV-PROD"],
  ["DEP-105", "IN_ENVIRONMENT", "ENV-PROD"],
  ["DEP-103", "IN_ENVIRONMENT", "ENV-STAGING"],
  ["ORG-NORTHSTAR", "HAS_TEAM", "TEAM-SRE"],
  ["ORG-NORTHSTAR", "HAS_TEAM", "TEAM-PAYMENTS"],
  ["ORG-NORTHSTAR", "HAS_TEAM", "TEAM-COMMERCE"],
  ["INC-1001", "HAS_EVIDENCE", "SEED-EV-1"],
  ["SVC-DB", "HAS_EVIDENCE", "SEED-EV-2"],
];
