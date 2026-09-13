# OpenGEO

> Open source AI search visibility — measure, act, rewrite, re-check

OpenGEO tracks whether AI search mentions and cites your brand across
ChatGPT, Perplexity, and Google AI Overviews. Then it turns gaps into an
action brief and citable content blocks, and re-checks the same prompts
after you ship.

> See the gap. Ship the block. Prove the citation.

## Why OpenGEO?

- **Prompt-first.** GEO starts with questions people ask AI.
- **Mentions + citations + share of voice.** Know who gets named and which URLs get sourced.
- **Action Brief.** Every gap becomes a concrete next step with evidence.
- **Citable Blocks.** Definition, comparison, FAQ, and sourced snippets ready to publish.
- **Re-check loop.** Run the same prompts again and see what actually moved.
- **MCP & Agent Skills.** Your agent runs the workflow; you review in the UI.
- **Pay for what you run.** Demo mode ships locally. Wire live providers when ready. Fork it. Self-host it.

## Quick start

Requires **Node 22** (see `.nvmrc`). Node 24 may fail to install native SQLite bindings without local C++ build tools.

```bash
pnpm install
cp .env.example .env
pnpm db:seed
pnpm dev
```

API: `http://127.0.0.1:8787`  
Web (Vite): `pnpm dev:web` → `http://127.0.0.1:5173`

Default API key from `.env.example`: `dev-opengeo-key`.

### Docker

```bash
docker compose up --build
```

## Main workflows

1. Create a project (brand, domain, competitors)
2. Seed / curate prompts
3. (Optional) Audit public GEO readiness (`llms.txt`, robots, sitemap)
4. Run visibility across engines
5. Inspect citation gaps + share of voice
6. Generate an Action Brief
7. Generate Citable Blocks and publish them on your site
8. Re-check the same prompts and read the diff
9. Export a Markdown / JSON report

## MCP

```bash
pnpm mcp
```

Example MCP client config:

```json
{
  "mcpServers": {
    "opengeo": {
      "command": "pnpm",
      "args": ["mcp"],
      "cwd": "/absolute/path/to/OpenGEO",
      "env": {
        "DATABASE_PATH": "./data/opengeo.db",
        "VISIBILITY_PROVIDER": "demo"
      }
    }
  }
}
```

### Tools

| Tool | Purpose |
|---|---|
| `whoami` | Identity + engines |
| `list_projects` / `create_project` / `get_project` | Projects |
| `list_prompts` / `upsert_prompts` / `suggest_prompts` | Prompt library |
| `run_prompt_check` / `run_visibility_batch` / `get_job_status` | Visibility runs |
| `get_visibility_snapshot` / `get_share_of_voice` / `get_citation_gaps` | Results |
| `generate_geo_brief` | Action Brief |
| `generate_citable_blocks` | Publishable blocks |
| `run_recheck` / `get_recheck_diff` | Post-publish proof |
| `export_visibility_report` | Markdown / JSON export |
| `audit_geo_readiness` | Public readiness checks |

## Agent Skills

Install skills into your agent skills directory from `.agents/skills/`:

- `/geo-project-setup`
- `/prompt-research`
- `/geo-readiness`
- `/visibility-check`
- `/citation-gap`
- `/geo-brief`
- `/citable-blocks`
- `/geo-recheck`
- `/geo-coach`

## Costs

Visibility runs can cost money once live providers are connected. Local **demo** mode is free and deterministic so you can validate the full loop without API keys.

Billing unit for live mode: `prompt × engine`.

## License

MIT
