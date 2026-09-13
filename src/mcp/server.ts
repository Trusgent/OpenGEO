import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppServices } from "../app.js";
import { ENGINES } from "../domain.js";

function text(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createMcpServer(services: AppServices) {
  const server = new McpServer({
    name: "opengeo",
    version: "0.1.0",
  });

  server.tool("whoami", "Return local OpenGEO identity and available engines", {}, async () =>
    text({
      user: "local",
      plan: "self-host",
      provider: process.env.VISIBILITY_PROVIDER ?? "demo",
      engines: ENGINES,
    }),
  );

  server.tool("list_projects", "List OpenGEO projects", {}, async () =>
    text({ projects: services.projects.list() }),
  );

  server.tool(
    "create_project",
    "Create a project with brand, domain, and competitors",
    {
      name: z.string(),
      brand: z.string(),
      domain: z.string(),
      market: z.string().optional(),
      competitors: z
        .array(z.object({ name: z.string(), domain: z.string() }))
        .max(5)
        .optional(),
    },
    async (args) =>
      text({
        project: services.projects.create({
          name: args.name,
          brand: args.brand,
          domain: args.domain,
          market: args.market ?? "global",
          competitors: args.competitors ?? [],
        }),
      }),
  );

  server.tool(
    "get_project",
    "Get a project and its latest visibility snapshot",
    { project_id: z.string() },
    async ({ project_id }) => {
      const project = services.projects.get(project_id);
      if (!project) throw new Error("Project not found");
      return text({
        project,
        latestSnapshot: services.visibility.latestSnapshot(project_id),
      });
    },
  );

  server.tool(
    "list_prompts",
    "List prompts for a project",
    { project_id: z.string(), tag: z.string().optional() },
    async ({ project_id, tag }) =>
      text({ prompts: services.prompts.list(project_id, tag) }),
  );

  server.tool(
    "upsert_prompts",
    "Create or update prompts",
    {
      project_id: z.string(),
      prompts: z.array(
        z.object({
          text: z.string(),
          tags: z.array(z.string()).optional(),
        }),
      ),
    },
    async ({ project_id, prompts }) =>
      text(
        services.prompts.upsert(project_id, {
          prompts: prompts.map((p) => ({
            text: p.text,
            tags: p.tags ?? [],
          })),
        }),
      ),
  );

  server.tool(
    "suggest_prompts",
    "Suggest candidate prompts for a project",
    {
      project_id: z.string(),
      count: z.number().int().min(1).max(20).optional(),
    },
    async ({ project_id, count }) => {
      const project = services.projects.get(project_id);
      if (!project) throw new Error("Project not found");
      return text({
        candidates: services.prompts.suggest(
          project_id,
          project.brand,
          project.domain,
          count ?? 8,
        ),
      });
    },
  );

  server.tool(
    "run_prompt_check",
    "Run one prompt across AI answer engines",
    {
      project_id: z.string(),
      prompt_id: z.string().optional(),
      prompt: z.string().optional(),
      engines: z.array(z.enum(ENGINES)).optional(),
    },
    async (args) =>
      text(
        await services.visibility.runPromptCheck({
          projectId: args.project_id,
          promptId: args.prompt_id,
          prompt: args.prompt,
          engines: args.engines,
        }),
      ),
  );

  server.tool(
    "run_visibility_batch",
    "Queue a batch visibility run",
    {
      project_id: z.string(),
      prompt_ids: z.array(z.string()).optional(),
      engines: z.array(z.enum(ENGINES)).optional(),
    },
    async (args) =>
      text(
        services.visibility.startBatch({
          projectId: args.project_id,
          promptIds: args.prompt_ids,
          engines: args.engines,
        }),
      ),
  );

  server.tool(
    "get_job_status",
    "Get batch/recheck job status",
    { job_id: z.string() },
    async ({ job_id }) => {
      const job = services.visibility.getJob(job_id);
      if (!job) throw new Error("Job not found");
      return text({ job });
    },
  );

  server.tool(
    "get_visibility_snapshot",
    "Get latest or specific visibility snapshot",
    {
      project_id: z.string(),
      snapshot_id: z.string().optional(),
    },
    async ({ project_id, snapshot_id }) => {
      const snapshot = snapshot_id
        ? services.visibility.getSnapshot(snapshot_id)
        : services.visibility.latestSnapshot(project_id);
      return text({ snapshot });
    },
  );

  server.tool(
    "get_share_of_voice",
    "Get brand vs competitor share of voice",
    { project_id: z.string() },
    async ({ project_id }) => text(services.visibility.shareOfVoice(project_id)),
  );

  server.tool(
    "get_citation_gaps",
    "List citation gaps from the latest snapshot",
    {
      project_id: z.string(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    async ({ project_id, limit }) =>
      text({
        gaps: services.visibility.citationGaps(project_id, limit ?? 20),
      }),
  );

  server.tool(
    "generate_geo_brief",
    "Generate an Action Brief from citation gaps",
    {
      project_id: z.string(),
      max_actions: z.number().int().min(1).max(20).optional(),
    },
    async ({ project_id, max_actions }) =>
      text({
        brief: services.briefs.generate(project_id, max_actions ?? 5),
      }),
  );

  server.tool(
    "generate_citable_blocks",
    "Generate publishable citable content blocks",
    {
      project_id: z.string(),
      brief_id: z.string().optional(),
      action_id: z.string().optional(),
      formats: z
        .array(z.enum(["definition", "comparison", "faq", "sourced_bullets"]))
        .optional(),
    },
    async (args) =>
      text(
        services.blocks.generate(args.project_id, {
          briefId: args.brief_id,
          actionId: args.action_id,
          formats: args.formats,
        }),
      ),
  );

  server.tool(
    "run_recheck",
    "Re-run prompts and compare against a baseline later",
    {
      project_id: z.string(),
      prompt_ids: z.array(z.string()).optional(),
      baseline_snapshot_id: z.string().optional(),
    },
    async (args) =>
      text(
        services.rechecks.start(
          args.project_id,
          args.prompt_ids,
          args.baseline_snapshot_id,
        ),
      ),
  );

  server.tool(
    "get_recheck_diff",
    "Diff two snapshots after a re-check",
    {
      project_id: z.string(),
      before_id: z.string(),
      after_id: z.string(),
    },
    async ({ project_id, before_id, after_id }) =>
      text(services.rechecks.diff(project_id, before_id, after_id)),
  );

  server.tool(
    "export_visibility_report",
    "Export a Markdown or JSON visibility report for a project",
    {
      project_id: z.string(),
      format: z.enum(["markdown", "json"]).optional(),
    },
    async ({ project_id, format }) => {
      if ((format ?? "markdown") === "json") {
        return text(services.exports.json(project_id));
      }
      return {
        content: [
          {
            type: "text" as const,
            text: services.exports.markdown(project_id),
          },
        ],
      };
    },
  );

  server.tool(
    "audit_geo_readiness",
    "Check public GEO readiness signals (homepage, robots, llms.txt, sitemap)",
    {
      project_id: z.string(),
      base_url: z.string().url().optional(),
    },
    async ({ project_id, base_url }) =>
      text({ report: await services.readiness.audit(project_id, base_url) }),
  );

  return server;
}
