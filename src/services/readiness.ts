import { normalizeDomain } from "../domain.js";
import { ProjectService } from "./projects.js";
import type { Db } from "../db/client.js";

export type ReadinessCheck = {
  id: string;
  ok: boolean;
  detail: string;
};

export type ReadinessReport = {
  domain: string;
  checkedAt: string;
  score: number;
  checks: ReadinessCheck[];
};

/**
 * Lightweight public-web readiness checks (no crawl stack).
 * Uses HEAD/GET against common GEO entrypoints.
 */
export class ReadinessService {
  private readonly projects: ProjectService;

  constructor(db: Db) {
    this.projects = new ProjectService(db);
  }

  async audit(projectId: string, baseUrl?: string): Promise<ReadinessReport> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("Project not found");

    const origin = (baseUrl ?? `https://${normalizeDomain(project.domain)}`).replace(
      /\/$/,
      "",
    );

    const targets: Array<{ id: string; path: string; expect?: RegExp }> = [
      { id: "homepage", path: "/" },
      { id: "robots_txt", path: "/robots.txt" },
      { id: "llms_txt", path: "/llms.txt" },
      { id: "sitemap", path: "/sitemap.xml" },
    ];

    const checks: ReadinessCheck[] = [];
    for (const target of targets) {
      checks.push(await this.probe(`${origin}${target.path}`, target.id));
    }

    // Soft signal: robots mentions common AI crawlers or Sitemap
    const robots = checks.find((c) => c.id === "robots_txt");
    if (robots?.ok) {
      const body = await this.safeGetText(`${origin}/robots.txt`);
      const mentionsAi =
        !!body &&
        /(gptbot|claudebot|perplexitybot|google-extended|anthropic|ccbot)/i.test(
          body,
        );
      checks.push({
        id: "robots_ai_crawlers",
        ok: mentionsAi,
        detail: mentionsAi
          ? "robots.txt references at least one AI crawler token"
          : "robots.txt reachable, but no common AI crawler tokens found",
      });
      checks.push({
        id: "robots_sitemap_hint",
        ok: !!body && /sitemap:/i.test(body),
        detail:
          body && /sitemap:/i.test(body)
            ? "robots.txt declares a Sitemap"
            : "robots.txt has no Sitemap directive",
      });
    }

    const score = Number(
      (
        checks.filter((c) => c.ok).length / Math.max(checks.length, 1)
      ).toFixed(4),
    );

    return {
      domain: normalizeDomain(project.domain),
      checkedAt: new Date().toISOString(),
      score,
      checks,
    };
  }

  private async probe(url: string, id: string): Promise<ReadinessCheck> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "user-agent": "OpenGEO-Readiness/0.1" },
      });
      clearTimeout(timer);
      return {
        id,
        ok: response.ok,
        detail: `${response.status} ${response.statusText}`.trim(),
      };
    } catch (error) {
      return {
        id,
        ok: false,
        detail: error instanceof Error ? error.message : "request failed",
      };
    }
  }

  private async safeGetText(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8_000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "user-agent": "OpenGEO-Readiness/0.1" },
      });
      clearTimeout(timer);
      if (!response.ok) return null;
      return await response.text();
    } catch {
      return null;
    }
  }
}
