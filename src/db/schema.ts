import { relations, sql } from "drizzle-orm";
import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  domain: text("domain").notNull(),
  market: text("market").notNull().default("global"),
  competitorsJson: text("competitors_json").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const prompts = sqliteTable(
  "prompts",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    tagsJson: text("tags_json").notNull().default("[]"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => ({
    projectTextIdx: uniqueIndex("prompts_project_text_idx").on(
      table.projectId,
      table.text,
    ),
  }),
);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // visibility_batch | recheck
  status: text("status").notNull().default("queued"), // queued | running | completed | failed
  progress: integer("progress").notNull().default(0),
  error: text("error"),
  metaJson: text("meta_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text("completed_at"),
});

export const snapshots = sqliteTable("snapshots", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  jobId: text("job_id").references(() => jobs.id, { onDelete: "set null" }),
  label: text("label").notNull().default("run"),
  mentionRate: real("mention_rate").notNull().default(0),
  citationRate: real("citation_rate").notNull().default(0),
  byEngineJson: text("by_engine_json").notNull().default("{}"),
  byCompetitorJson: text("by_competitor_json").notNull().default("{}"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const runResults = sqliteTable("run_results", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => snapshots.id, { onDelete: "cascade" }),
  promptId: text("prompt_id")
    .notNull()
    .references(() => prompts.id, { onDelete: "cascade" }),
  engine: text("engine").notNull(),
  mentionedBrand: integer("mentioned_brand", { mode: "boolean" })
    .notNull()
    .default(false),
  competitorsMentionedJson: text("competitors_mentioned_json")
    .notNull()
    .default("[]"),
  answerExcerpt: text("answer_excerpt").notNull().default(""),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const citations = sqliteTable("citations", {
  id: text("id").primaryKey(),
  runResultId: text("run_result_id")
    .notNull()
    .references(() => runResults.id, { onDelete: "cascade" }),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  snapshotId: text("snapshot_id")
    .notNull()
    .references(() => snapshots.id, { onDelete: "cascade" }),
  promptId: text("prompt_id")
    .notNull()
    .references(() => prompts.id, { onDelete: "cascade" }),
  engine: text("engine").notNull(),
  url: text("url").notNull(),
  domain: text("domain").notNull(),
  title: text("title"),
  isOwnDomain: integer("is_own_domain", { mode: "boolean" })
    .notNull()
    .default(false),
});

export const briefs = sqliteTable("briefs", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  snapshotId: text("snapshot_id").references(() => snapshots.id, {
    onDelete: "set null",
  }),
  title: text("title").notNull(),
  actionsJson: text("actions_json").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const citableBlocks = sqliteTable("citable_blocks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  briefId: text("brief_id").references(() => briefs.id, {
    onDelete: "set null",
  }),
  actionId: text("action_id"),
  format: text("format").notNull(), // definition | comparison | faq | sourced_bullets
  title: text("title").notNull(),
  markdown: text("markdown").notNull(),
  sourcePromptIdsJson: text("source_prompt_ids_json").notNull().default("[]"),
  claimedFactsJson: text("claimed_facts_json").notNull().default("[]"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  prompts: many(prompts),
  snapshots: many(snapshots),
  briefs: many(briefs),
}));

export const promptsRelations = relations(prompts, ({ one }) => ({
  project: one(projects, {
    fields: [prompts.projectId],
    references: [projects.id],
  }),
}));
