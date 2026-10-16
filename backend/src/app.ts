import express from "express";
import cors from "cors";
import { z, ZodError } from "zod";
import { config } from "./config.js";
import { Repository } from "./repository.js";
import { query } from "./db.js";
import { investigate } from "./engine.js";
import { HttpError } from "./types.js";
const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(/^[A-Za-z0-9_.:-]+$/);
const pagination = z.object({
  limit: z.coerce.number().int().min(1).max(120).default(50),
  offset: z.coerce.number().int().min(0).max(10000).default(0),
});
const memorySchema = z
  .object({
    type: z.enum(["episodic", "semantic", "procedural"]),
    content: z.string().trim().min(10).max(3000),
    source: idSchema,
    incidentId: idSchema,
    evidenceIds: z.array(idSchema).min(1).max(120),
    confidence: z.number().min(0).max(1).default(0.5),
  })
  .strict();
export function createApp(repo = new Repository(query)) {
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.origin }));
  app.use(express.json({ limit: "64kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    const start = Date.now();
    res.on("finish", () =>
      console.log(
        JSON.stringify({
          event: "http",
          method: req.method,
          path: req.route?.path || "unmatched",
          status: res.statusCode,
          ms: Date.now() - start,
        }),
      ),
    );
    next();
  });
  // API is local/demo-only; deploy behind authentication before making it accessible to others.
  app.get("/api/health", async (_req, res) =>
    res.json({
      status: "ok",
      database: "connected",
      graph: config.graph,
      nodeCount: await repo.health(),
      analysisMode: config.key
        ? "LLM-assisted ranking available"
        : "deterministic",
      providerConfigured: !!config.key,
      synthetic: true,
    }),
  );
  app.get("/api/overview", async (_req, res) => {
    const counts: Record<string, number> = {};
    for (const label of [
      "Incident",
      "Service",
      "Deployment",
      "Investigation",
      "Memory",
    ]) {
      const [r] = await repo.q<{ count: number }>(
        `MATCH (n:${label}) RETURN count(n) AS count`,
      );
      if (!r || typeof r.count !== "number") throw new Error("Invalid count");
      counts[label] = r.count;
    }
    const [open] = await repo.q<{ count: number }>(
      "MATCH (n:Incident) WHERE NOT toLower(coalesce(n.status,'')) IN ['resolved','closed'] RETURN count(n) AS count",
    );
    res.json({
      counts: { ...counts, openIncidents: open.count },
      recentIncidents: await repo.list("Incident", 8),
      recentInvestigations: await repo.investigations(),
      synthetic: true,
    });
  });
  app.get("/api/incidents", async (req, res) => {
    const { limit, offset } = pagination.parse(req.query);
    const status = z.string().max(50).default("").parse(req.query.status);
    res.json(
      (
        await repo.q<{ node: object }>(
          "MATCH (n:Incident) WHERE ($status='' OR n.status=$status) RETURN properties(n) AS node ORDER BY n.id SKIP $offset LIMIT $limit",
          { status, limit, offset },
        )
      ).map((r) => r.node),
    );
  });
  app.get("/api/services", async (_req, res) =>
    res.json(await repo.list("Service")),
  );
  app.post("/api/incidents", async (req, res) => {
    const b = z
      .object({
        title: z.string().trim().min(5).max(150),
        summary: z.string().trim().min(10).max(3000),
        serviceId: idSchema,
        syntheticAcknowledged: z.literal(true),
      })
      .strict()
      .parse(req.body);
    res.status(201).json(await repo.intake(b.title, b.summary, b.serviceId));
  });
  app.get("/api/incidents/:incidentId", async (req, res) => {
    const id = idSchema.parse(req.params.incidentId);
    res.json({
      incident: await repo.getIncident(id),
      affectedServices: await repo.affected(id),
      dependencies: await repo.dependencies(id),
      history: await repo.history(id),
    });
  });
  app.get("/api/investigate/:incidentId", async (req, res) => {
    const id = idSchema.parse(req.params.incidentId);
    await repo.getIncident(id);
    const evidence = await repo.history(id);
    res.json({ incidentId: id, evidenceCount: evidence.length, evidence });
  });
  app.get("/api/graph", async (req, res) => {
    const { limit } = pagination.parse(req.query);
    const label = z
      .enum([
        "",
        "Incident",
        "Service",
        "Deployment",
        "Team",
        "Person",
        "Memory",
        "Runbook",
        "Resolution",
        "Investigation",
        "Evidence",
        "Decision",
        "Action",
        "Organization",
        "Environment",
      ])
      .default("")
      .parse(req.query.label);
    res.json(await repo.graph(limit, label));
  });
  app.get("/api/graph/neighborhood/:nodeId", async (req, res) => {
    const { limit } = pagination.parse(req.query);
    res.json(await repo.graph(limit, "", idSchema.parse(req.params.nodeId)));
  });
  app.post("/api/investigations", async (req, res) => {
    const b = z.object({ incidentId: idSchema }).strict().parse(req.body);
    res.status(201).json(await investigate(repo, b.incidentId));
  });
  app.get("/api/investigations", async (_req, res) =>
    res.json(await repo.investigations()),
  );
  app.get("/api/investigations/by-incident/:incidentId", async (req, res) =>
    res.json(await repo.investigations(idSchema.parse(req.params.incidentId))),
  );
  app.get("/api/investigations/:investigationId", async (req, res) =>
    res.json(await repo.report(idSchema.parse(req.params.investigationId))),
  );
  app.patch("/api/investigations/:investigationId", async (req, res) => {
    const b = z
      .object({ feedback: z.enum(["useful", "needs-review"]) })
      .strict()
      .parse(req.body);
    res.json(
      await repo.feedback(
        idSchema.parse(req.params.investigationId),
        b.feedback,
      ),
    );
  });
  app.get("/api/memory", async (req, res) => {
    const { offset, limit } = pagination.parse(req.query);
    const type = z
      .enum(["", "episodic", "semantic", "procedural"])
      .default("")
      .parse(req.query.type);
    res.json(await repo.memory(type, offset, limit));
  });
  app.post("/api/memory", async (req, res) =>
    res.status(201).json(await repo.saveMemory(memorySchema.parse(req.body))),
  );
  app.patch("/api/memory/:memoryId", async (req, res) => {
    const b = z
      .object({ status: z.enum(["reviewed", "archived", "unreviewed"]) })
      .strict()
      .parse(req.body);
    res.json(
      await repo.patchMemory(idSchema.parse(req.params.memoryId), b.status),
    );
  });
  app.get("/api/runbooks", async (_req, res) =>
    res.json(await repo.runbooks()),
  );
  app.use((_req, res) => res.status(404).json({ error: "Route not found" }));
  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const status =
        error instanceof ZodError
          ? 400
          : error instanceof HttpError
            ? error.status
            : typeof error === "object" && error && "status" in error
              ? Number(error.status)
              : 500;
      const safeStatus = status >= 400 && status <= 599 ? status : 500;
      res
        .status(safeStatus)
        .json({
          error:
            error instanceof ZodError
              ? "Invalid request"
              : safeStatus === 500
                ? "Internal server error"
                : error instanceof Error
                  ? error.message
                  : "Request failed",
          ...(error instanceof ZodError
            ? {
                issues: error.issues.map((i) => ({
                  path: i.path,
                  message: i.message,
                })),
              }
            : {}),
          ...(safeStatus === 503
            ? { database: "disconnected", graph: config.graph }
            : {}),
        });
    },
  );
  return app;
}
