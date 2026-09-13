import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import type { AppServices } from "../app.js";
import { ENGINES, type Engine } from "../domain.js";
import { generateBlocksSchema } from "../services/blocks.js";
import { createProjectSchema } from "../services/projects.js";
import { upsertPromptsSchema } from "../services/prompts.js";

type Env = {
  Variables: {
    services: AppServices;
  };
};

function requireApiKey(apiKey: string | undefined) {
  return async (
    c: { req: { header: (name: string) => string | undefined } },
    next: () => Promise<void>,
  ) => {
    if (!apiKey) {
      await next();
      return;
    }
    const header = c.req.header("authorization") ?? c.req.header("x-api-key");
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : header;
    if (token !== apiKey) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
    await next();
  };
}

export function createApi(services: AppServices) {
  const app = new Hono<Env>();
  const apiKey = process.env.API_KEY;

  app.use("*", cors());
  app.use("*", async (c, next) => {
    c.set("services", services);
    await next();
  });

  app.get("/health", (c) =>
    c.json({
      ok: true,
      service: "opengeo",
      provider: process.env.VISIBILITY_PROVIDER ?? "demo",
    }),
  );

  app.get("/api/whoami", requireApiKey(apiKey), (c) =>
    c.json({
      user: "local",
      plan: "self-host",
      provider: process.env.VISIBILITY_PROVIDER ?? "demo",
      engines: ENGINES,
    }),
  );

  app.get("/api/projects", requireApiKey(apiKey), (c) => {
    return c.json({ projects: services.projects.list() });
  });

  app.post("/api/projects", requireApiKey(apiKey), async (c) => {
    const body = createProjectSchema.parse(await c.req.json());
    const project = services.projects.create(body);
    return c.json({ project }, 201);
  });

  app.get("/api/projects/:projectId", requireApiKey(apiKey), (c) => {
    const project = services.projects.get(c.req.param("projectId"));
    if (!project) throw new HTTPException(404, { message: "Project not found" });
    const snapshot = services.visibility.latestSnapshot(project.id);
    return c.json({ project, latestSnapshot: snapshot });
  });

  app.get("/api/projects/:projectId/prompts", requireApiKey(apiKey), (c) => {
    const tag = c.req.query("tag") ?? undefined;
    return c.json({
      prompts: services.prompts.list(c.req.param("projectId"), tag),
    });
  });

  app.post("/api/projects/:projectId/prompts", requireApiKey(apiKey), async (c) => {
    const body = upsertPromptsSchema.parse(await c.req.json());
    const result = services.prompts.upsert(c.req.param("projectId"), body);
    return c.json(result);
  });

  app.post(
    "/api/projects/:projectId/prompts/suggest",
    requireApiKey(apiKey),
    (c) => {
      const project = services.projects.get(c.req.param("projectId"));
      if (!project) {
        throw new HTTPException(404, { message: "Project not found" });
      }
      const count = Number(c.req.query("count") ?? 8);
      return c.json({
        candidates: services.prompts.suggest(
          project.id,
          project.brand,
          project.domain,
          count,
        ),
      });
    },
  );

  app.post(
    "/api/projects/:projectId/visibility/check",
    requireApiKey(apiKey),
    async (c) => {
      const body = (await c.req.json()) as {
        promptId?: string;
        prompt?: string;
        engines?: Engine[];
      };
      const result = await services.visibility.runPromptCheck({
        projectId: c.req.param("projectId"),
        ...body,
      });
      return c.json(result);
    },
  );

  app.post(
    "/api/projects/:projectId/visibility/batch",
    requireApiKey(apiKey),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        promptIds?: string[];
        engines?: Engine[];
      };
      const result = services.visibility.startBatch({
        projectId: c.req.param("projectId"),
        ...body,
      });
      return c.json(result, 202);
    },
  );

  app.get("/api/jobs/:jobId", requireApiKey(apiKey), (c) => {
    const job = services.visibility.getJob(c.req.param("jobId"));
    if (!job) throw new HTTPException(404, { message: "Job not found" });
    return c.json({ job });
  });

  app.get(
    "/api/projects/:projectId/snapshots",
    requireApiKey(apiKey),
    (c) => {
      return c.json({
        snapshots: services.visibility.listSnapshots(c.req.param("projectId")),
      });
    },
  );

  app.get(
    "/api/projects/:projectId/snapshots/latest",
    requireApiKey(apiKey),
    (c) => {
      return c.json({
        snapshot: services.visibility.latestSnapshot(c.req.param("projectId")),
      });
    },
  );

  app.get(
    "/api/projects/:projectId/share-of-voice",
    requireApiKey(apiKey),
    (c) => c.json(services.visibility.shareOfVoice(c.req.param("projectId"))),
  );

  app.get(
    "/api/projects/:projectId/citation-gaps",
    requireApiKey(apiKey),
    (c) => {
      const limit = Number(c.req.query("limit") ?? 20);
      return c.json({
        gaps: services.visibility.citationGaps(
          c.req.param("projectId"),
          limit,
        ),
      });
    },
  );

  app.post(
    "/api/projects/:projectId/briefs",
    requireApiKey(apiKey),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        maxActions?: number;
      };
      const brief = services.briefs.generate(
        c.req.param("projectId"),
        body.maxActions ?? 5,
      );
      return c.json({ brief }, 201);
    },
  );

  app.get("/api/projects/:projectId/briefs", requireApiKey(apiKey), (c) => {
    return c.json({ briefs: services.briefs.list(c.req.param("projectId")) });
  });

  app.post(
    "/api/projects/:projectId/blocks",
    requireApiKey(apiKey),
    async (c) => {
      const body = generateBlocksSchema.parse(
        await c.req.json().catch(() => ({})),
      );
      const result = services.blocks.generate(c.req.param("projectId"), body);
      return c.json(result, 201);
    },
  );

  app.get("/api/projects/:projectId/blocks", requireApiKey(apiKey), (c) => {
    return c.json({ blocks: services.blocks.list(c.req.param("projectId")) });
  });

  app.post(
    "/api/projects/:projectId/recheck",
    requireApiKey(apiKey),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        promptIds?: string[];
        baselineSnapshotId?: string;
      };
      const result = services.rechecks.start(
        c.req.param("projectId"),
        body.promptIds,
        body.baselineSnapshotId,
      );
      return c.json(result, 202);
    },
  );

  app.get(
    "/api/projects/:projectId/recheck/diff",
    requireApiKey(apiKey),
    (c) => {
      const beforeId = c.req.query("before");
      const afterId = c.req.query("after");
      if (!beforeId || !afterId) {
        throw new HTTPException(400, {
          message: "before and after query params are required",
        });
      }
      return c.json(
        services.rechecks.diff(c.req.param("projectId"), beforeId, afterId),
      );
    },
  );

  app.get(
    "/api/projects/:projectId/export",
    requireApiKey(apiKey),
    (c) => {
      const format = (c.req.query("format") ?? "markdown").toLowerCase();
      const projectId = c.req.param("projectId");
      if (format === "json") {
        return c.json(services.exports.json(projectId));
      }
      const markdown = services.exports.markdown(projectId);
      return c.text(markdown, 200, {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="opengeo-${projectId}.md"`,
      });
    },
  );

  app.post(
    "/api/projects/:projectId/readiness",
    requireApiKey(apiKey),
    async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as {
        baseUrl?: string;
      };
      const report = await services.readiness.audit(
        c.req.param("projectId"),
        body.baseUrl,
      );
      return c.json({ report });
    },
  );

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    const status =
      message.includes("not found") || message.includes("No ")
        ? 400
        : 500;
    return c.json({ error: message }, status);
  });

  return app;
}
