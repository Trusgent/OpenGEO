import fs from "node:fs";
import path from "node:path";
import { createAppServices } from "../app.js";

async function seed() {
  const databasePath = process.env.DATABASE_PATH ?? "./data/opengeo.db";
  fs.mkdirSync(path.dirname(path.resolve(databasePath)), { recursive: true });

  const app = createAppServices(databasePath);
  const existing = app.projects.list()[0];
  if (existing) {
    console.log(`Seed skipped. Existing project: ${existing.id}`);
    return;
  }

  const project = app.projects.create({
    name: "OpenGEO Demo",
    brand: "OpenGEO",
    domain: "opengeo.example",
    market: "global",
    competitors: [
      { name: "CiteLy", domain: "citely.example" },
      { name: "AnswerRank", domain: "answerrank.example" },
    ],
  });

  const suggested = app.prompts.suggest(
    project.id,
    project.brand,
    project.domain,
    8,
  );
  app.prompts.upsert(project.id, { prompts: suggested });

  const { jobId } = app.visibility.startBatch({ projectId: project.id });
  const started = Date.now();
  while (Date.now() - started < 15_000) {
    const job = app.visibility.getJob(jobId);
    if (job?.status === "completed") break;
    if (job?.status === "failed") throw new Error(job.error ?? "seed failed");
    await new Promise((r) => setTimeout(r, 50));
  }

  const brief = app.briefs.generate(project.id, 3);
  app.blocks.generate(project.id, { briefId: brief.id });

  console.log(
    JSON.stringify(
      {
        projectId: project.id,
        briefId: brief.id,
        snapshot: app.visibility.latestSnapshot(project.id),
      },
      null,
      2,
    ),
  );
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
