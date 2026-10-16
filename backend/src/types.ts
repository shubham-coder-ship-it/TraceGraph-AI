export type Entity = {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  severity?: string;
  summary?: string;
  [key: string]: unknown;
};
export type GraphNode = { id: string; label: string; properties: Entity };
export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  type: string;
};
export type Evidence = {
  id: string;
  kind: string;
  source: string;
  path: string[];
  facts: Record<string, unknown>;
};
export type Hypothesis = {
  id: string;
  title: string;
  description: string;
  confidence: number;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  reasoning: string;
  recommendedChecks: string[];
};
export type Memory = Entity & {
  type: string;
  content: string;
  source: string;
  createdAt: string;
  confidence: number;
  status: string;
  evidenceIds: string[];
  incidentId: string;
  accessCount: number;
  lastAccessedAt?: string;
};
export type Report = {
  id: string;
  incidentId: string;
  incident: Entity;
  createdAt: string;
  analysisMode: string;
  summary: string;
  hypotheses: Hypothesis[];
  evidence: Evidence[];
  affectedServices: Entity[];
  dependencies: Record<string, unknown>[];
  deployments: Record<string, unknown>[];
  historicalIncidents: Record<string, unknown>[];
  runbooks: Record<string, unknown>[];
  owners: Record<string, unknown>[];
  memoriesRetrieved: Memory[];
  memoriesCreated: string[];
  recommendedChecks: string[];
  unknowns: string[];
  limitations: string[];
  toolTrace: { tool: string; count: number }[];
};
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
