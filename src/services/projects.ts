import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";
import type { Db } from "../db/client.js";
import { projects } from "../db/schema.js";
import {
  normalizeDomain,
  parseJsonArray,
  type Competitor,
} from "../domain.js";

const competitorSchema = z.object({
  name: z.string().min(1),
  domain: z.string().min(1),
});

export const createProjectSchema = z.object({
  name: z.string().min(1),
  brand: z.string().min(1),
  domain: z.string().min(1),
  market: z.string().min(1).default("global"),
  competitors: z.array(competitorSchema).max(5).default([]),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export class ProjectService {
  constructor(private readonly db: Db) {}

  list() {
    return this.db
      .select()
      .from(projects)
      .all()
      .map((row) => this.serialize(row));
  }

  get(projectId: string) {
    const row = this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    return row ? this.serialize(row) : null;
  }

  create(input: CreateProjectInput) {
    const id = nanoid();
    const competitors = input.competitors.slice(0, 5).map((c) => ({
      name: c.name,
      domain: normalizeDomain(c.domain),
    }));

    this.db
      .insert(projects)
      .values({
        id,
        name: input.name,
        brand: input.brand,
        domain: normalizeDomain(input.domain),
        market: input.market,
        competitorsJson: JSON.stringify(competitors),
      })
      .run();

    return this.get(id)!;
  }

  private serialize(row: typeof projects.$inferSelect) {
    return {
      id: row.id,
      name: row.name,
      brand: row.brand,
      domain: row.domain,
      market: row.market,
      competitors: parseJsonArray<Competitor>(row.competitorsJson),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
