import { createHash } from "node:crypto";
import { normalizeDomain, type Engine, type VisibilityCheckResult } from "../domain.js";
import type { VisibilityProvider, VisibilityProviderInput } from "./types.js";

function hashInt(seed: string): number {
  const digest = createHash("sha256").update(seed).digest();
  return digest.readUInt32BE(0);
}

function pick<T>(items: T[], seed: string): T {
  return items[hashInt(seed) % items.length]!;
}

/**
 * Deterministic demo provider so the full P0 loop works without live API keys.
 * Swap VISIBILITY_PROVIDER=live once real connectors are configured.
 */
export class DemoVisibilityProvider implements VisibilityProvider {
  name = "demo";

  async check(input: VisibilityProviderInput): Promise<VisibilityCheckResult[]> {
    const own = normalizeDomain(input.domain);
    return input.engines.map((engine) => this.checkOne(input, engine, own));
  }

  private checkOne(
    input: VisibilityProviderInput,
    engine: Engine,
    ownDomain: string,
  ): VisibilityCheckResult {
    const seed = `${input.brand}|${input.prompt}|${engine}`;
    const score = hashInt(seed) % 100;
    const mentionedBrand = score >= 62;
    const ownCited = score >= 78;

    const competitorHits = input.competitors.filter((competitor, index) => {
      const cScore = hashInt(`${seed}|${competitor.domain}`) % 100;
      return cScore < 55 + index * 5;
    });

    const citations: VisibilityCheckResult["citations"] = [];

    if (ownCited) {
      citations.push({
        url: `https://${ownDomain}/guides/${slugify(input.prompt)}`,
        domain: ownDomain,
        title: `${input.brand} guide: ${input.prompt}`,
      });
    }

    for (const competitor of competitorHits.slice(0, 2)) {
      const domain = normalizeDomain(competitor.domain);
      citations.push({
        url: `https://${domain}/blog/${slugify(input.prompt)}`,
        domain,
        title: `${competitor.name} on ${input.prompt}`,
      });
    }

    if (citations.length === 0) {
      const filler = pick(
        ["wikipedia.org", "reddit.com", "nytimes.com", "forbes.com"],
        seed,
      );
      citations.push({
        url: `https://${filler}/topic/${slugify(input.prompt)}`,
        domain: filler,
        title: `Background reading: ${input.prompt}`,
      });
    }

    const competitorNames = competitorHits.map((c) => c.name);
    const mentionedList = [
      ...(mentionedBrand ? [input.brand] : []),
      ...competitorNames,
    ];

    const answerExcerpt = mentionedList.length
      ? `For “${input.prompt}”, sources often mention ${mentionedList.join(", ")}. ${
          ownCited
            ? `${input.brand} appears with a first-party citation.`
            : `${input.brand} is weak or missing in cited sources.`
        }`
      : `Answers for “${input.prompt}” stay generic and rarely name vendors.`;

    return {
      engine,
      mentionedBrand,
      competitorsMentioned: competitorNames,
      answerExcerpt,
      citations,
    };
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
