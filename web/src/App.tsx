import { useEffect, useMemo, useState } from "react";

type Project = {
  id: string;
  name: string;
  brand: string;
  domain: string;
  competitors: Array<{ name: string; domain: string }>;
};

type Snapshot = {
  id: string;
  mentionRate: number;
  citationRate: number;
  byCompetitor: Record<string, number>;
};

type Prompt = { id: string; text: string; tags: string[] };
type Brief = {
  id: string;
  title: string;
  actions: Array<{ id: string; priority: number; why: string; what: string; target: string }>;
};
type Block = { id: string; title: string; format: string; markdown: string };

const API_KEY = "dev-opengeo-key";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error ?? data.message ?? "Request failed");
  }
  return data as T;
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function App() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [gaps, setGaps] = useState<Array<{ url: string; domain: string; count: number }>>([]);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    name: "Demo Project",
    brand: "Northstar",
    domain: "northstar.example",
    competitorName: "RivalAI",
    competitorDomain: "rivalai.example",
  });

  const selected = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

  async function refreshProjects() {
    const data = await api<{ projects: Project[] }>("/api/projects");
    setProjects(data.projects);
    if (!projectId && data.projects[0]) {
      setProjectId(data.projects[0].id);
    }
  }

  async function refreshProject(id: string) {
    const [projectData, promptData, gapData, briefData, blockData] =
      await Promise.all([
        api<{ project: Project; latestSnapshot: Snapshot | null }>(
          `/api/projects/${id}`,
        ),
        api<{ prompts: Prompt[] }>(`/api/projects/${id}/prompts`),
        api<{ gaps: Array<{ url: string; domain: string; count: number }> }>(
          `/api/projects/${id}/citation-gaps`,
        ),
        api<{ briefs: Brief[] }>(`/api/projects/${id}/briefs`),
        api<{ blocks: Block[] }>(`/api/projects/${id}/blocks`),
      ]);
    setSnapshot(projectData.latestSnapshot);
    setPrompts(promptData.prompts);
    setGaps(gapData.gaps);
    setBrief(briefData.briefs[0] ?? null);
    setBlocks(blockData.blocks);
  }

  useEffect(() => {
    refreshProjects().catch((error) => setStatus(String(error.message ?? error)));
  }, []);

  useEffect(() => {
    if (!projectId) return;
    refreshProject(projectId).catch((error) =>
      setStatus(String(error.message ?? error)),
    );
  }, [projectId]);

  async function run(label: string, fn: () => Promise<void>) {
    setBusy(true);
    setStatus(label);
    try {
      await fn();
      setStatus("Done.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  async function waitJob(jobId: string) {
    for (let i = 0; i < 80; i += 1) {
      const data = await api<{ job: { status: string; error?: string; meta: Record<string, unknown> } }>(
        `/api/jobs/${jobId}`,
      );
      if (data.job.status === "completed") return data.job;
      if (data.job.status === "failed") {
        throw new Error(data.job.error ?? "Job failed");
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    throw new Error("Timed out waiting for job");
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <h1 className="brand">OpenGEO</h1>
        <p className="tagline">
          See the gap. Ship the block. Prove the citation. Track AI answer
          mentions, turn them into action briefs and citable content, then
          re-check.
        </p>
        <p className="status">{status}</p>
      </header>

      <div className="grid two">
        <section className="panel stack">
          <h2>Project</h2>
          <label>
            Existing project
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name} ({project.brand})
                </option>
              ))}
            </select>
          </label>

          <div className="grid two">
            <label>
              Name
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Brand
              <input
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
              />
            </label>
            <label>
              Domain
              <input
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
              />
            </label>
            <label>
              Competitor
              <input
                value={`${form.competitorName} / ${form.competitorDomain}`}
                onChange={(e) => {
                  const [name, domain] = e.target.value.split("/").map((s) => s.trim());
                  setForm({
                    ...form,
                    competitorName: name || form.competitorName,
                    competitorDomain: domain || form.competitorDomain,
                  });
                }}
              />
            </label>
          </div>

          <div className="row">
            <button
              disabled={busy}
              onClick={() =>
                run("Creating project…", async () => {
                  const data = await api<{ project: Project }>("/api/projects", {
                    method: "POST",
                    body: JSON.stringify({
                      name: form.name,
                      brand: form.brand,
                      domain: form.domain,
                      competitors: [
                        {
                          name: form.competitorName,
                          domain: form.competitorDomain,
                        },
                      ],
                    }),
                  });
                  await refreshProjects();
                  setProjectId(data.project.id);
                })
              }
            >
              Create project
            </button>
            <button
              className="secondary"
              disabled={busy || !selected}
              onClick={() =>
                run("Suggesting + saving prompts…", async () => {
                  const suggested = await api<{
                    candidates: Array<{ text: string; tags: string[] }>;
                  }>(`/api/projects/${projectId}/prompts/suggest`);
                  await api(`/api/projects/${projectId}/prompts`, {
                    method: "POST",
                    body: JSON.stringify({ prompts: suggested.candidates }),
                  });
                  await refreshProject(projectId);
                })
              }
            >
              Seed prompts
            </button>
          </div>

          {selected ? (
            <p className="muted">
              Active: <strong>{selected.brand}</strong> on {selected.domain}
            </p>
          ) : null}
        </section>

        <section className="panel stack">
          <h2>Visibility</h2>
          <div className="metrics">
            <div className="metric">
              <strong>{snapshot ? pct(snapshot.mentionRate) : "—"}</strong>
              <span>Mention rate</span>
            </div>
            <div className="metric">
              <strong>{snapshot ? pct(snapshot.citationRate) : "—"}</strong>
              <span>Citation rate</span>
            </div>
            <div className="metric">
              <strong>{prompts.length}</strong>
              <span>Prompts</span>
            </div>
          </div>
          <div className="row">
            <button
              disabled={busy || !projectId}
              onClick={() =>
                run("Running visibility batch…", async () => {
                  const { jobId } = await api<{ jobId: string }>(
                    `/api/projects/${projectId}/visibility/batch`,
                    { method: "POST", body: "{}" },
                  );
                  await waitJob(jobId);
                  await refreshProject(projectId);
                })
              }
            >
              Run visibility
            </button>
            <button
              className="secondary"
              disabled={busy || !projectId || !snapshot}
              onClick={() =>
                run("Re-checking…", async () => {
                  const beforeId = snapshot!.id;
                  const { jobId } = await api<{ jobId: string }>(
                    `/api/projects/${projectId}/recheck`,
                    {
                      method: "POST",
                      body: JSON.stringify({ baselineSnapshotId: beforeId }),
                    },
                  );
                  const job = await waitJob(jobId);
                  const afterId = String(job.meta.snapshotId ?? "");
                  const diff = await api<{
                    delta: { mentionRate: number; citationRate: number };
                  }>(
                    `/api/projects/${projectId}/recheck/diff?before=${beforeId}&after=${afterId}`,
                  );
                  setStatus(
                    `Re-check delta — mentions ${pct(diff.delta.mentionRate)}, citations ${pct(diff.delta.citationRate)}`,
                  );
                  await refreshProject(projectId);
                })
              }
            >
              Re-check
            </button>
            <button
              className="secondary"
              disabled={busy || !projectId}
              onClick={() =>
                run("Exporting markdown report…", async () => {
                  const response = await fetch(
                    `/api/projects/${projectId}/export?format=markdown`,
                    {
                      headers: { authorization: `Bearer ${API_KEY}` },
                    },
                  );
                  if (!response.ok) {
                    throw new Error("Export failed");
                  }
                  const markdown = await response.text();
                  await navigator.clipboard.writeText(markdown);
                  setStatus("Report copied to clipboard.");
                })
              }
            >
              Export report
            </button>
            <button
              className="secondary"
              disabled={busy || !projectId || !selected}
              onClick={() =>
                run("Auditing GEO readiness…", async () => {
                  const data = await api<{
                    report: { score: number; checks: Array<{ id: string; ok: boolean }> };
                  }>(`/api/projects/${projectId}/readiness`, {
                    method: "POST",
                    body: "{}",
                  });
                  const passed = data.report.checks.filter((c) => c.ok).length;
                  setStatus(
                    `Readiness ${(data.report.score * 100).toFixed(0)}% — ${passed}/${data.report.checks.length} checks passed`,
                  );
                })
              }
            >
              Readiness
            </button>
          </div>
        </section>
      </div>

      <div className="grid two" style={{ marginTop: "1rem" }}>
        <section className="panel">
          <h2>Citation gaps</h2>
          <div className="list">
            {gaps.length === 0 ? (
              <p className="muted">Run visibility to surface gaps.</p>
            ) : (
              gaps.slice(0, 6).map((gap) => (
                <div className="item" key={gap.url}>
                  <h3>
                    {gap.domain} · {gap.count}×
                  </h3>
                  <p>{gap.url}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="panel stack">
          <h2>Action Brief + Citable Blocks</h2>
          <div className="row">
            <button
              disabled={busy || !projectId || !snapshot}
              onClick={() =>
                run("Generating brief…", async () => {
                  const data = await api<{ brief: Brief }>(
                    `/api/projects/${projectId}/briefs`,
                    { method: "POST", body: "{}" },
                  );
                  setBrief(data.brief);
                })
              }
            >
              Generate brief
            </button>
            <button
              className="secondary"
              disabled={busy || !projectId || !brief}
              onClick={() =>
                run("Generating citable blocks…", async () => {
                  const data = await api<{ blocks: Block[] }>(
                    `/api/projects/${projectId}/blocks`,
                    {
                      method: "POST",
                      body: JSON.stringify({ briefId: brief!.id }),
                    },
                  );
                  setBlocks(data.blocks);
                })
              }
            >
              Generate blocks
            </button>
          </div>

          {brief ? (
            <div className="list">
              {brief.actions.slice(0, 3).map((action) => (
                <div className="item" key={action.id}>
                  <h3>
                    #{action.priority} {action.what}
                  </h3>
                  <p>{action.why}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No brief yet.</p>
          )}
        </section>
      </div>

      <section className="panel" style={{ marginTop: "1rem" }}>
        <h2>Citable blocks</h2>
        <div className="list">
          {blocks.length === 0 ? (
            <p className="muted">Generate blocks to copy markdown onto your site.</p>
          ) : (
            blocks.slice(0, 4).map((block) => (
              <div className="item" key={block.id}>
                <h3>
                  {block.title} · {block.format}
                </h3>
                <pre>{block.markdown}</pre>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
