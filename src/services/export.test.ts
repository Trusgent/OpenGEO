import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAppServices } from "../app.js";

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function tempDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "opengeo-export-"));
  tempDirs.push(dir);
  return path.join(dir, "test.db");
}

describe("export + readiness wiring", () => {
  it("exports markdown after the P0 loop", async () => {
    const app = createAppServices(tempDb());
    try {
      const project = app.projects.create({
        name: "Acme",
        brand: "Acme",
        domain: "acme.test",
        market: "us",
        competitors: [{ name: "Beta", domain: "beta.test" }],
      });
      app.prompts.upsert(project.id, {
        prompts: [{ text: "what is Acme", tags: ["brand"] }],
      });
      const { jobId } = app.visibility.startBatch({ projectId: project.id });
      const started = Date.now();
      while (Date.now() - started < 10_000) {
        const job = app.visibility.getJob(jobId);
        if (job?.status === "completed") break;
        if (job?.status === "failed") throw new Error(job.error ?? "failed");
        await new Promise((r) => setTimeout(r, 20));
      }
      app.briefs.generate(project.id, 2);
      app.blocks.generate(project.id);

      const md = app.exports.markdown(project.id);
      expect(md).toContain("OpenGEO report — Acme");
      expect(md).toContain("Visibility snapshot");
      expect(md).toContain("Citable blocks");

      const json = app.exports.json(project.id);
      expect(json.project.brand).toBe("Acme");
      expect(json.snapshot).toBeTruthy();
    } finally {
      app.close();
    }
  });
});
