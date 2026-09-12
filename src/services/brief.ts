import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { Db } from "../db/client.js";
import { briefs } from "../db/schema.js";
import { parseJsonArray, type BriefAction } from "../domain.js";
import { ProjectService } from "./projects.js";
import { PromptService } from "./prompts.js";
import { VisibilityService } from "./visibility.js";

export class BriefService {
  private readonly projects: ProjectService;
  private readonly prompts: PromptService;

  constructor(
    private readonly db: Db,
    private readonly visibility: VisibilityService,
  ) {
    this.projects = new ProjectService(db);
    this.prompts = new PromptService(db);
  }

  list(projectId: string) {
    return this.db
      .select()
      .from(briefs)
      .where(eq(briefs.projectId, projectId))
      .orderBy(desc(briefs.createdAt))
      .all()
      .map((row) => this.serialize(row));
  }

  get(briefId: string) {
    const row = this.db.select().from(briefs).where(eq(briefs.id, briefId)).get();
    return row ? this.serialize(row) : null;
  }

  generate(projectId: string, maxActions = 5) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("Project not found");

    const snapshot = this.visibility.latestSnapshot(projectId);
    if (!snapshot) {
      throw new Error("Run a visibility check before generating a brief");
    }

    const gaps = this.visibility.citationGaps(projectId, 50);
    const promptMap = new Map(
      this.prompts.list(projectId).map((p) => [p.id, p.text]),
    );

    const actions: BriefAction[] = gaps.slice(0, maxActions).map((gap, index) => {
      const samplePrompt =
        gap.promptIds
          .map((id) => promptMap.get(id))
          .filter(Boolean)
          .slice(0, 2)
          .join(" / ") || "tracked prompts";

      return {
        id: nanoid(8),
        priority: index + 1,
        why: `${gap.domain} is cited ${gap.count}× on prompts where ${project.brand} is weak or missing.`,
        what: `Publish a citable page that directly answers “${samplePrompt}” and earns first-party citations.`,
        target: `https://${project.domain}/geo/${slugify(samplePrompt)}`,
        evidence: {
          promptIds: gap.promptIds,
          competitorDomains: gap.competitorName ? [gap.domain] : [gap.domain],
          sampleUrls: [gap.url],
        },
        suggestedFormats:
          index % 2 === 0
            ? ["definition", "faq", "sourced_bullets"]
            : ["comparison", "sourced_bullets"],
      };
    });

    if (!actions.length) {
      actions.push({
        id: nanoid(8),
        priority: 1,
        why: `${project.brand} already appears in several answers, but coverage is still thin.`,
        what: `Strengthen a canonical explainer on ${project.domain} with crisp definitions and sourced bullets.`,
        target: `https://${project.domain}/geo/brand-explainer`,
        evidence: {
          promptIds: this.prompts.list(projectId).slice(0, 3).map((p) => p.id),
          competitorDomains: project.competitors.map((c) => c.domain),
          sampleUrls: [],
        },
        suggestedFormats: ["definition", "sourced_bullets", "faq"],
      });
    }

    const id = nanoid();
    this.db
      .insert(briefs)
      .values({
        id,
        projectId,
        snapshotId: snapshot.id,
        title: `GEO Action Brief — ${project.brand}`,
        actionsJson: JSON.stringify(actions),
      })
      .run();

    return this.get(id)!;
  }

  private serialize(row: typeof briefs.$inferSelect) {
    return {
      id: row.id,
      projectId: row.projectId,
      snapshotId: row.snapshotId,
      title: row.title,
      actions: parseJsonArray<BriefAction>(row.actionsJson),
      createdAt: row.createdAt,
    };
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
