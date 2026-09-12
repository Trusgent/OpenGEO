export const ENGINES = [
  "chatgpt_web",
  "perplexity",
  "google_ai_overviews",
] as const;

export type Engine = (typeof ENGINES)[number];

export type Competitor = {
  name: string;
  domain: string;
};

export type BriefAction = {
  id: string;
  priority: number;
  why: string;
  what: string;
  target: string;
  evidence: {
    promptIds: string[];
    competitorDomains: string[];
    sampleUrls: string[];
  };
  suggestedFormats: Array<
    "definition" | "comparison" | "faq" | "sourced_bullets"
  >;
};

export type CitationGap = {
  domain: string;
  url: string;
  title: string | null;
  count: number;
  promptIds: string[];
  engines: string[];
  competitorName: string | null;
};

export type VisibilityCheckResult = {
  engine: Engine;
  mentionedBrand: boolean;
  competitorsMentioned: string[];
  answerExcerpt: string;
  citations: Array<{
    url: string;
    domain: string;
    title?: string;
  }>;
};

export function normalizeDomain(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]!;
}

export function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function parseJsonObject<T extends Record<string, unknown>>(
  value: string,
): T {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as T)
      : ({} as T);
  } catch {
    return {} as T;
  }
}
