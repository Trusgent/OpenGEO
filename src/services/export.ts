import type { BriefService } from "./brief.js";
import type { BlockService } from "./blocks.js";
import type { ProjectService } from "./projects.js";
import type { VisibilityService } from "./visibility.js";

export class ExportService {
  constructor(
    private readonly projects: ProjectService,
    private readonly visibility: VisibilityService,
    private readonly briefs: BriefService,
    private readonly blocks: BlockService,
  ) {}

  markdown(projectId: string): string {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("Project not found");

    const snapshot = this.visibility.latestSnapshot(projectId);
    const sov = this.visibility.shareOfVoice(projectId);
    const gaps = this.visibility.citationGaps(projectId, 15);
    const brief = this.briefs.list(projectId)[0];
    const blocks = this.blocks.list(projectId).slice(0, 8);

    const lines: string[] = [
      `# OpenGEO report — ${project.brand}`,
      "",
      `- Domain: ${project.domain}`,
      `- Market: ${project.market}`,
      `- Generated: ${new Date().toISOString()}`,
      "",
      "## Visibility snapshot",
      "",
    ];

    if (!snapshot) {
      lines.push("_No snapshot yet. Run a visibility batch first._", "");
    } else {
      lines.push(
        `- Snapshot: \`${snapshot.id}\``,
        `- Mention rate: ${(snapshot.mentionRate * 100).toFixed(1)}%`,
        `- Citation rate: ${(snapshot.citationRate * 100).toFixed(1)}%`,
        "",
      );
    }

    lines.push("## Share of voice", "");
    if (sov.brand) {
      lines.push(
        `- ${sov.brand.name}: mentions ${(sov.brand.mentionRate * 100).toFixed(1)}% / citations ${(sov.brand.citationRate * 100).toFixed(1)}%`,
      );
    }
    for (const [name, rate] of Object.entries(sov.competitors ?? {})) {
      lines.push(`- ${name}: ${(rate * 100).toFixed(1)}%`);
    }
    lines.push("");

    lines.push("## Citation gaps", "");
    if (!gaps.length) {
      lines.push("_No gaps recorded._", "");
    } else {
      for (const gap of gaps) {
        lines.push(
          `- **${gap.domain}** (${gap.count}×) — ${gap.url}${
            gap.competitorName ? ` · competitor: ${gap.competitorName}` : ""
          }`,
        );
      }
      lines.push("");
    }

    lines.push("## Action brief", "");
    if (!brief) {
      lines.push("_No brief generated yet._", "");
    } else {
      lines.push(`### ${brief.title}`, "");
      for (const action of brief.actions) {
        lines.push(
          `${action.priority}. **${action.what}**`,
          `   - Why: ${action.why}`,
          `   - Target: ${action.target}`,
          "",
        );
      }
    }

    lines.push("## Citable blocks", "");
    if (!blocks.length) {
      lines.push("_No blocks generated yet._", "");
    } else {
      for (const block of blocks) {
        lines.push(`### ${block.title} (\`${block.format}\`)`, "", block.markdown, "");
      }
    }

    return lines.join("\n");
  }

  json(projectId: string) {
    const project = this.projects.get(projectId);
    if (!project) throw new Error("Project not found");
    return {
      project,
      snapshot: this.visibility.latestSnapshot(projectId),
      shareOfVoice: this.visibility.shareOfVoice(projectId),
      gaps: this.visibility.citationGaps(projectId, 50),
      briefs: this.briefs.list(projectId),
      blocks: this.blocks.list(projectId),
      exportedAt: new Date().toISOString(),
    };
  }
}
