import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { prompts } from "../db/schema.js";
import { parseJsonArray } from "../domain.js";

export const upsertPromptsSchema = z.object({
  prompts: z
    .array(
      z.object({
        text: z.string().min(3),
        tags: z.array(z.string()).default([]),
      }),
    )
    .min(1)
    .max(200),
});

export class PromptService {
  constructor(private readonly db: Db) {}

  list(projectId: string, tag?: string) {
    const rows = this.db
      .select()
      .from(prompts)
      .where(eq(prompts.projectId, projectId))
      .all()
      .map((row) => this.serialize(row));

    if (!tag) return rows;
    return rows.filter((row) => row.tags.includes(tag));
  }

  get(projectId: string, promptId: string) {
    const row = this.db
      .select()
      .from(prompts)
      .where(and(eq(prompts.projectId, projectId), eq(prompts.id, promptId)))
      .get();
    return row ? this.serialize(row) : null;
  }

  upsert(projectId: string, input: z.infer<typeof upsertPromptsSchema>) {
    const saved = [];
    for (const item of input.prompts) {
      const existing = this.db
        .select()
        .from(prompts)
        .where(
          and(eq(prompts.projectId, projectId), eq(prompts.text, item.text)),
        )
        .get();

      if (existing) {
        this.db
          .update(prompts)
          .set({ tagsJson: JSON.stringify(item.tags) })
          .where(eq(prompts.id, existing.id))
          .run();
        saved.push(this.get(projectId, existing.id)!);
        continue;
      }

      const id = nanoid();
      this.db
        .insert(prompts)
        .values({
          id,
          projectId,
          text: item.text,
          tagsJson: JSON.stringify(item.tags),
        })
        .run();
      saved.push(this.get(projectId, id)!);
    }
    return { savedCount: saved.length, prompts: saved };
  }

  suggest(_projectId: string, brand: string, domain: string, count = 8) {
    const seeds = [
      `best ${brand} alternatives`,
      `what is ${brand}`,
      `${brand} vs competitors`,
      `how does ${brand} work`,
      `${domain} review`,
      `tools like ${brand}`,
      `${brand} pricing explained`,
      `who should use ${brand}`,
      `${brand} for startups`,
      `is ${brand} worth it`,
    ];
    return seeds.slice(0, Math.min(count, seeds.length)).map((text) => ({
      text,
      tags: ["suggested"],
    }));
  }

  private serialize(row: typeof prompts.$inferSelect) {
    return {
      id: row.id,
      projectId: row.projectId,
      text: row.text,
      tags: parseJsonArray<string>(row.tagsJson),
      createdAt: row.createdAt,
    };
  }
}
