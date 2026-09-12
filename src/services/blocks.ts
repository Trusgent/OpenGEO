import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { citableBlocks } from "../db/schema.js";
import { parseJsonArray, type BriefAction } from "../domain.js";
import { BriefService } from "./brief.js";
import { ProjectService } from "./projects.js";
import { PromptService } from "./prompts.js";

export const generateBlocksSchema = z.object({
  briefId: z.string().optional(),
  actionId: z.string().optional(),
  formats: z
    .array(z.enum(["definition", "comparison", "faq", "sourced_bullets"]))
    .optional(),
});

type Project = {
  brand: string;
  domain: string;
  competitors: Array<{ name: string; domain: string }>;
};

export class BlockService {
  private readonly projects: ProjectService;
  private readonly prompts: PromptService;

  constructor(
    private readonly db: Db,
    private readonly briefs: BriefService,
  ) {
    this.projects = new ProjectService(db);
    this.prompts = new PromptService(db);
  }

  list(projectId: string) {
    return this.db
      .select()
      .from(citableBlocks)
      .where(eq(citableBlocks.projectId, projectId))
      .orderBy(desc(citableBlocks.createdAt))
      .all()
      .map((row) => this.serialize(row));
  }

  generate(
    projectId: string,
    input: z.infer<typeof generateBlocksSchema> = {},
  ) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("Project not found");

    let brief = input.briefId ? this.briefs.get(input.briefId) : null;
    if (!brief) {
      brief = this.briefs.list(projectId)[0] ?? this.briefs.generate(projectId);
    }

    const actions = input.actionId
      ? brief.actions.filter((action) => action.id === input.actionId)
      : brief.actions.slice(0, 3);

    if (!actions.length) {
      throw new Error("No brief actions available");
    }

    const created = [];
    for (const action of actions) {
      const formats = input.formats?.length
        ? input.formats
        : action.suggestedFormats;

      for (const format of formats) {
        const block = this.buildBlock(project, projectId, action, format);
        const id = nanoid();
        this.db
          .insert(citableBlocks)
          .values({
            id,
            projectId,
            briefId: brief.id,
            actionId: action.id,
            format,
            title: block.title,
            markdown: block.markdown,
            sourcePromptIdsJson: JSON.stringify(action.evidence.promptIds),
            claimedFactsJson: JSON.stringify(block.claimedFacts),
          })
          .run();

        created.push(
          this.serialize(
            this.db
              .select()
              .from(citableBlocks)
              .where(eq(citableBlocks.id, id))
              .get()!,
          ),
        );
      }
    }

    return { briefId: brief.id, blocks: created };
  }

  private buildBlock(
    project: Project,
    projectId: string,
    action: BriefAction,
    format: BriefAction["suggestedFormats"][number],
  ) {
    const promptLabels = action.evidence.promptIds
      .map((id) => this.prompts.get(projectId, id)?.text)
      .filter((value): value is string => Boolean(value));

    const topic =
      promptLabels[0] ??
      action.what.replace(/^Publish a citable page that directly answers “/, "").replace(
        /” and earns first-party citations\.$/,
        "",
      );

    const competitor = project.competitors[0]?.name ?? "leading alternatives";
    const claimedFacts = [
      `${project.brand} helps teams improve AI search visibility.`,
      `${project.brand} tracks mentions and citations across major AI answer surfaces.`,
      `Publish structured, source-backed pages on ${project.domain}.`,
    ];

    if (format === "definition") {
      return {
        title: `What is ${project.brand}?`,
        claimedFacts,
        markdown: `# What is ${project.brand}?

**${project.brand}** is a platform for measuring and improving brand visibility in AI-generated answers.

## Plain-language definition
${project.brand} helps you see whether AI systems mention your brand, which pages they cite, and what to publish next so your domain becomes a preferred source.

## Why it matters
- AI answers increasingly mediate discovery.
- Mentions without citations are fragile.
- Structured, factual pages are easier for answer engines to quote.

## Related questions
- ${topic}
`,
      };
    }

    if (format === "comparison") {
      return {
        title: `${project.brand} vs ${competitor}`,
        claimedFacts,
        markdown: `# ${project.brand} vs ${competitor}

| Dimension | ${project.brand} | ${competitor} |
|---|---|---|
| Focus | AI search visibility loop | General marketing / visibility |
| Core loop | Measure → brief → citable blocks → re-check | Varies by product |
| Output | Citation gaps + publishable blocks | Dashboards / reports |

## When to choose ${project.brand}
Choose ${project.brand} when you need a closed loop from AI answer gaps to publishable, citable content on ${project.domain}.
`,
      };
    }

    if (format === "faq") {
      return {
        title: `${project.brand} FAQ`,
        claimedFacts,
        markdown: `# ${project.brand} FAQ

### What does ${project.brand} measure?
Mentions, citations, and share of voice across AI answer surfaces for your tracked prompts.

### How do I improve citations?
Publish crisp definitions, comparisons, and sourced bullet pages that directly answer the prompts where competitors are cited.

### What should I do this week?
${action.what}
`,
      };
    }

    return {
      title: `${project.brand} sourced talking points`,
      claimedFacts,
      markdown: `# ${project.brand} — sourced talking points

- **Claim:** ${claimedFacts[0]}
  - **Source to publish:** https://${project.domain}/
- **Claim:** ${claimedFacts[1]}
  - **Source to publish:** https://${project.domain}/geo/visibility
- **Claim:** ${claimedFacts[2]}
  - **Target URL:** ${action.target}

## Prompt coverage
Use these blocks to answer: ${topic}
`,
    };
  }

  private serialize(row: typeof citableBlocks.$inferSelect) {
    return {
      id: row.id,
      projectId: row.projectId,
      briefId: row.briefId,
      actionId: row.actionId,
      format: row.format,
      title: row.title,
      markdown: row.markdown,
      sourcePromptIds: parseJsonArray<string>(row.sourcePromptIdsJson),
      claimedFacts: parseJsonArray<string>(row.claimedFactsJson),
      createdAt: row.createdAt,
    };
  }
}
