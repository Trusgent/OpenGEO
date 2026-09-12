import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { citations, jobs } from "../db/schema.js";
import { normalizeDomain, parseJsonObject } from "../domain.js";
import { ProjectService } from "./projects.js";
import { VisibilityService } from "./visibility.js";

export class RecheckService {
  private readonly projects: ProjectService;

  constructor(
    private readonly db: Db,
    private readonly visibility: VisibilityService,
  ) {
    this.projects = new ProjectService(db);
  }

  start(projectId: string, promptIds?: string[], baselineSnapshotId?: string) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("Project not found");

    const baseline =
      baselineSnapshotId
        ? this.visibility.getSnapshot(baselineSnapshotId)
        : this.visibility.latestSnapshot(projectId);

    if (!baseline) {
      throw new Error("No baseline snapshot found. Run visibility first.");
    }

    return this.visibility.startBatch({
      projectId,
      promptIds,
      label: "recheck",
      type: "recheck",
      baselineSnapshotId: baseline.id,
    });
  }

  diff(projectId: string, beforeId: string, afterId: string) {
    const before = this.visibility.getSnapshot(beforeId);
    const after = this.visibility.getSnapshot(afterId);
    if (!before || !after) {
      throw new Error("Snapshot not found");
    }
    if (before.projectId !== projectId || after.projectId !== projectId) {
      throw new Error("Snapshots do not belong to this project");
    }

    const project = this.projects.get(projectId)!;
    const own = normalizeDomain(project.domain);

    const beforeUrls = new Set(
      this.db
        .select()
        .from(citations)
        .where(eq(citations.snapshotId, beforeId))
        .all()
        .filter((row) => row.isOwnDomain || row.domain === own)
        .map((row) => row.url),
    );

    const afterOwn = this.db
      .select()
      .from(citations)
      .where(eq(citations.snapshotId, afterId))
      .all()
      .filter((row) => row.isOwnDomain || row.domain === own);

    const newCitations = afterOwn
      .filter((row) => !beforeUrls.has(row.url))
      .map((row) => ({
        url: row.url,
        domain: row.domain,
        title: row.title,
        promptId: row.promptId,
        engine: row.engine,
      }));

    const persistentGaps = this.visibility
      .citationGaps(projectId, 20)
      .filter((gap) => gap.count > 0);

    return {
      before,
      after,
      delta: {
        mentionRate: Number((after.mentionRate - before.mentionRate).toFixed(4)),
        citationRate: Number(
          (after.citationRate - before.citationRate).toFixed(4),
        ),
      },
      newCitations,
      persistentGaps,
    };
  }

  async waitForJob(jobId: string, timeoutMs = 30_000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const job = this.visibility.getJob(jobId);
      if (!job) throw new Error("Job not found");
      if (job.status === "completed" || job.status === "failed") {
        return job;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Timed out waiting for job");
  }

  getBaselineFromJob(jobId: string) {
    const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get();
    if (!row) return null;
    const meta = parseJsonObject<{
      baselineSnapshotId?: string;
      snapshotId?: string;
    }>(row.metaJson);
    return meta;
  }
}
