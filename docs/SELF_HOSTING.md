# Self-hosting OpenGEO

## Local Node

1. Install Node 20+
2. `pnpm install`
3. `cp .env.example .env`
4. `pnpm db:seed`
5. `pnpm dev`
6. Optional UI: `pnpm dev:web`

## Docker

```bash
docker compose up --build
```

Open `http://localhost:8787`.

## Configuration

| Variable | Meaning |
|---|---|
| `PORT` | HTTP port (default `8787`) |
| `HOST` | Bind address |
| `DATABASE_PATH` | SQLite file path |
| `VISIBILITY_PROVIDER` | `demo` for local deterministic runs |
| `API_KEY` | Required on API requests as `Authorization: Bearer …` |

## MCP

Point your MCP client at `pnpm mcp` with the same env vars so it shares the database with the HTTP server.
