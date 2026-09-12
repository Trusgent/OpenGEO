import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAppServices } from "../app.js";

const tempDirs: string[] = [];
const apps: Array<ReturnType<typeof createAppServices>> = [];

afterEach(() => {
  for (const app of apps.splice(0)) {
    app.close();
  }
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opengeo-"));
  tempDirs.push(dir);
  return path.join(dir, "test.db");
}

describe("OpenGEO P0 loop", () => {
  it("runs visibility → brief → blocks → recheck diff", async () => {
    const app = createAppServices(tempDb());
    apps.push(app);
    const project = app.projects.create({
      name: "Acme",
      brand: "Acme",
      domain: "acme.test",
      market: "us",
      competitors: [{ name: "Beta", domain: "beta.test" }],
    });

    app.prompts.upsert(project.id, {
      prompts: [
        { text: "best tools for AI search visibility", tags: ["core"] },
        { text: "what is Acme", tags: ["brand"] },
      ],
    });

    const { jobId } = app.visibility.startBatch({ projectId: project.id });
    const job = await wait(app, jobId);
    expect(job.status).toBe("completed");

    const before = app.visibility.latestSnapshot(project.id);
    expect(before).toBeTruthy();
    expect(before!.mentionRate).toBeGreaterThanOrEqual(0);

    const brief = app.briefs.generate(project.id, 3);
    expect(brief.actions.length).toBeGreaterThan(0);

    const blocks = app.blocks.generate(project.id, { briefId: brief.id });
    expect(blocks.blocks.length).toBeGreaterThan(0);
    expect(blocks.blocks[0]!.markdown).toContain("Acme");

    const recheck = app.rechecks.start(project.id, undefined, before!.id);
    const recheckJob = await wait(app, recheck.jobId);
    expect(recheckJob.status).toBe("completed");

    const afterId = (recheckJob.meta.snapshotId as string) ?? "";
    expect(afterId).toBeTruthy();

    const diff = app.rechecks.diff(project.id, before!.id, afterId);
    expect(diff.before.id).toBe(before!.id);
    expect(diff.after.id).toBe(afterId);
    expect(diff.delta).toBeTruthy();
  });
});

async function wait(
  app: ReturnType<typeof createAppServices>,
  jobId: string,
) {
  const started = Date.now();
  while (Date.now() - started < 10_000) {
    const job = app.visibility.getJob(jobId);
    if (!job) throw new Error("missing job");
    if (job.status === "completed" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error("timeout");
}
