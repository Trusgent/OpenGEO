import { desc, eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "../db/client.js";
import {
  citations,
  jobs,
  prompts,
  runResults,
  snapshots,
} from "../db/schema.js";
import {
  ENGINES,
  normalizeDomain,
  parseJsonObject,
  type CitationGap,
  type Competitor,
  type Engine,
} from "../domain.js";
import type { VisibilityProvider } from "../providers/types.js";
import { ProjectService } from "./projects.js";
import { PromptService } from "./prompts.js";

export class VisibilityService {
  private readonly projects: ProjectService;
  private readonly promptService: PromptService;

  constructor(
    private readonly db: Db,
    private readonly provider: VisibilityProvider,
  ) {
    this.projects = new ProjectService(db);
    this.promptService = new PromptService(db);
  }

  async runPromptCheck(input: {
    projectId: string;
    promptId?: string;
    prompt?: string;
    engines?: Engine[];
  }) {
    const project = this.projects.get(input.projectId);
    if (!project) throw new Error("Project not found");

    let promptText = input.prompt?.trim();
    let promptId = input.promptId;

    if (promptId) {
      const existing = this.promptService.get(input.projectId, promptId);
      if (!existing) throw new Error("Prompt not found");
      promptText = existing.text;
    } else if (promptText) {
      const saved = this.promptService.upsert(input.projectId, {
        prompts: [{ text: promptText, tags: ["ad-hoc"] }],
      });
      promptId = saved.prompts[0]!.id;
    } else {
      throw new Error("prompt_id or prompt is required");
    }

    const engines = input.engines?.length ? input.engines : [...ENGINES];
    const results = await this.provider.check({
      brand: project.brand,
      domain: project.domain,
      competitors: project.competitors,
      prompt: promptText!,
      engines,
    });

    const snapshotId = nanoid();
    const jobId = nanoid();
    this.db
      .insert(jobs)
      .values({
        id: jobId,
        projectId: input.projectId,
        type: "visibility_batch",
        status: "completed",
        progress: 100,
        metaJson: JSON.stringify({ promptIds: [promptId], engines }),
        completedAt: new Date().toISOString(),
      })
      .run();

    this.persistSnapshot({
      snapshotId,
      jobId,
      projectId: input.projectId,
      label: "single-check",
      projectDomain: project.domain,
      competitors: project.competitors,
      rows: results.map((result) => ({
        promptId: promptId!,
        result,
      })),
    });

    return {
      snapshotId,
      promptId,
      results: results.map((result) => ({
        ...result,
        promptId,
      })),
    };
  }

  startBatch(input: {
    projectId: string;
    promptIds?: string[];
    engines?: Engine[];
    label?: string;
    type?: "visibility_batch" | "recheck";
    baselineSnapshotId?: string;
  }) {
    const project = this.projects.get(input.projectId);
    if (!project) throw new Error("Project not found");

    const allPrompts = this.promptService.list(input.projectId);
    const selected = input.promptIds?.length
      ? allPrompts.filter((p) => input.promptIds!.includes(p.id))
      : allPrompts;

    if (!selected.length) {
      throw new Error("No prompts to run");
    }

    const engines = input.engines?.length ? input.engines : [...ENGINES];
    const jobId = nanoid();
    this.db
      .insert(jobs)
      .values({
        id: jobId,
        projectId: input.projectId,
        type: input.type ?? "visibility_batch",
        status: "queued",
        progress: 0,
        metaJson: JSON.stringify({
          promptIds: selected.map((p) => p.id),
          engines,
          label: input.label ?? "batch",
          baselineSnapshotId: input.baselineSnapshotId,
        }),
      })
      .run();

    // Fire-and-forget for local MVP; errors land on the job row.
    void this.executeJob(jobId);

    return { jobId };
  }

  getJob(jobId: string) {
    const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    if (!row) return null;
    return {
      id: row.id,
      projectId: row.projectId,
      type: row.type,
      status: row.status,
      progress: row.progress,
      error: row.error,
      meta: parseJsonObject<Record<string, unknown>>(row.metaJson),
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    };
  }

  latestSnapshot(projectId: string) {
    const row = this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, projectId))
      .orderBy(desc(snapshots.createdAt))
      .get();
    return row ? this.serializeSnapshot(row) : null;
  }

  getSnapshot(snapshotId: string) {
    const row = this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.id, snapshotId))
      .get();
    return row ? this.serializeSnapshot(row) : null;
  }

  listSnapshots(projectId: string) {
    return this.db
      .select()
      .from(snapshots)
      .where(eq(snapshots.projectId, projectId))
      .orderBy(desc(snapshots.createdAt))
      .all()
      .map((row) => this.serializeSnapshot(row));
  }

  shareOfVoice(projectId: string) {
    const snapshot = this.latestSnapshot(projectId);
    if (!snapshot) {
      return { snapshotId: null, brand: null, competitors: {} as Record<string, number> };
    }
    const project = this.projects.get(projectId)!;
    return {
      snapshotId: snapshot.id,
      brand: {
        name: project.brand,
        mentionRate: snapshot.mentionRate,
        citationRate: snapshot.citationRate,
      },
      competitors: snapshot.byCompetitor,
      byEngine: snapshot.byEngine,
    };
  }

  citationGaps(projectId: string, limit = 20): CitationGap[] {
    const snapshot = this.latestSnapshot(projectId);
    if (!snapshot) return [];
    const project = this.projects.get(projectId)!;
    const own = normalizeDomain(project.domain);
    const competitorByDomain = new Map(
      project.competitors.map((c) => [normalizeDomain(c.domain), c.name]),
    );

    const rows = this.db
      .select()
      .from(citations)
      .where(eq(citations.snapshotId, snapshot.id))
      .all()
      .filter((row) => !row.isOwnDomain && row.domain !== own);

    const grouped = new Map<string, CitationGap>();
    for (const row of rows) {
      const key = row.url;
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, {
          domain: row.domain,
          url: row.url,
          title: row.title,
          count: 1,
          promptIds: [row.promptId],
          engines: [row.engine],
          competitorName: competitorByDomain.get(row.domain) ?? null,
        });
      } else {
        existing.count += 1;
        if (!existing.promptIds.includes(row.promptId)) {
          existing.promptIds.push(row.promptId);
        }
        if (!existing.engines.includes(row.engine)) {
          existing.engines.push(row.engine);
        }
      }
    }

    return [...grouped.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  private async executeJob(jobId: string) {
    const job = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    if (!job) return;

    try {
      this.db
        .update(jobs)
        .set({ status: "running", progress: 5 })
        .where(eq(jobs.id, jobId))
        .run();

      const meta = parseJsonObject<{
        promptIds: string[];
        engines: Engine[];
        label?: string;
      }>(job.metaJson);

      const project = this.projects.get(job.projectId);
      if (!project) throw new Error("Project not found");

      const selectedPrompts = this.db
        .select()
        .from(prompts)
        .where(inArray(prompts.id, meta.promptIds))
        .all();

      const rows: Array<{
        promptId: string;
        result: Awaited<ReturnType<VisibilityProvider["check"]>>[number];
      }> = [];

      let done = 0;
      for (const prompt of selectedPrompts) {
        const results = await this.provider.check({
          brand: project.brand,
          domain: project.domain,
          competitors: project.competitors,
          prompt: prompt.text,
          engines: meta.engines,
        });
        for (const result of results) {
          rows.push({ promptId: prompt.id, result });
        }
        done += 1;
        const progress = Math.round((done / selectedPrompts.length) * 90) + 5;
        this.db
          .update(jobs)
          .set({ progress })
          .where(eq(jobs.id, jobId))
          .run();
      }

      const snapshotId = nanoid();
      this.persistSnapshot({
        snapshotId,
        jobId,
        projectId: job.projectId,
        label: meta.label ?? job.type,
        projectDomain: project.domain,
        competitors: project.competitors,
        rows,
      });

      this.db
        .update(jobs)
        .set({
          status: "completed",
          progress: 100,
          completedAt: new Date().toISOString(),
          metaJson: JSON.stringify({ ...meta, snapshotId }),
        })
        .where(eq(jobs.id, jobId))
        .run();
    } catch (error) {
      this.db
        .update(jobs)
        .set({
          status: "failed",
          error: error instanceof Error ? error.message : "Unknown error",
        })
        .where(eq(jobs.id, jobId))
        .run();
    }
  }

  private persistSnapshot(input: {
    snapshotId: string;
    jobId: string;
    projectId: string;
    label: string;
    projectDomain: string;
    competitors: Competitor[];
    rows: Array<{
      promptId: string;
      result: Awaited<ReturnType<VisibilityProvider["check"]>>[number];
    }>;
  }) {
    const own = normalizeDomain(input.projectDomain);
    const total = input.rows.length || 1;
    const brandMentions = input.rows.filter((r) => r.result.mentionedBrand).length;
    const ownCitations = input.rows.filter((r) =>
      r.result.citations.some((c) => normalizeDomain(c.domain) === own),
    ).length;

    const byEngine: Record<string, { mentionRate: number; citationRate: number; n: number }> =
      {};
    const competitorMentions: Record<string, number> = {};
    for (const competitor of input.competitors) {
      competitorMentions[competitor.name] = 0;
    }

    for (const row of input.rows) {
      const engineStats = byEngine[row.result.engine] ?? {
        mentionRate: 0,
        citationRate: 0,
        n: 0,
      };
      engineStats.n += 1;
      if (row.result.mentionedBrand) engineStats.mentionRate += 1;
      if (
        row.result.citations.some((c) => normalizeDomain(c.domain) === own)
      ) {
        engineStats.citationRate += 1;
      }
      byEngine[row.result.engine] = engineStats;

      for (const name of row.result.competitorsMentioned) {
        competitorMentions[name] = (competitorMentions[name] ?? 0) + 1;
      }
    }

    const byEngineNormalized = Object.fromEntries(
      Object.entries(byEngine).map(([engine, stats]) => [
        engine,
        {
          mentionRate: Number((stats.mentionRate / stats.n).toFixed(4)),
          citationRate: Number((stats.citationRate / stats.n).toFixed(4)),
          samples: stats.n,
        },
      ]),
    );

    const byCompetitor = Object.fromEntries(
      Object.entries(competitorMentions).map(([name, count]) => [
        name,
        Number((count / total).toFixed(4)),
      ]),
    );

    this.db
      .insert(snapshots)
      .values({
        id: input.snapshotId,
        projectId: input.projectId,
        jobId: input.jobId,
        label: input.label,
        mentionRate: Number((brandMentions / total).toFixed(4)),
        citationRate: Number((ownCitations / total).toFixed(4)),
        byEngineJson: JSON.stringify(byEngineNormalized),
        byCompetitorJson: JSON.stringify(byCompetitor),
      })
      .run();

    for (const row of input.rows) {
      const runId = nanoid();
      this.db
        .insert(runResults)
        .values({
          id: runId,
          projectId: input.projectId,
          snapshotId: input.snapshotId,
          promptId: row.promptId,
          engine: row.result.engine,
          mentionedBrand: row.result.mentionedBrand,
          competitorsMentionedJson: JSON.stringify(
            row.result.competitorsMentioned,
          ),
          answerExcerpt: row.result.answerExcerpt,
        })
        .run();

      for (const citation of row.result.citations) {
        const domain = normalizeDomain(citation.domain);
        this.db
          .insert(citations)
          .values({
            id: nanoid(),
            runResultId: runId,
            projectId: input.projectId,
            snapshotId: input.snapshotId,
            promptId: row.promptId,
            engine: row.result.engine,
            url: citation.url,
            domain,
            title: citation.title ?? null,
            isOwnDomain: domain === own,
          })
          .run();
      }
    }
  }

  private serializeSnapshot(row: typeof snapshots.$inferSelect) {
    return {
      id: row.id,
      projectId: row.projectId,
      jobId: row.jobId,
      label: row.label,
      mentionRate: row.mentionRate,
      citationRate: row.citationRate,
      byEngine: parseJsonObject<Record<string, unknown>>(row.byEngineJson),
      byCompetitor: parseJsonObject<Record<string, number>>(
        row.byCompetitorJson,
      ),
      createdAt: row.createdAt,
    };
  }
}
