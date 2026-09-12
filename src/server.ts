import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppServices } from "./app.js";
import { createApi } from "./api/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile() {
  const envPath = path.join(root, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile();

const services = createAppServices();
const app = createApi(services);

const webDist = path.join(root, "web", "dist");
if (fs.existsSync(webDist)) {
  app.use("/*", serveStatic({ root: "./web/dist" }));
  app.get("*", serveStatic({ path: "./web/dist/index.html" }));
} else {
  app.get("/", (c) =>
    c.html(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>OpenGEO</title>
  <style>
    :root { color-scheme: light; font-family: "Segoe UI", system-ui, sans-serif; }
    body { margin: 0; background: #f4f1ea; color: #1c1917; }
    main { max-width: 720px; margin: 10vh auto; padding: 2rem; }
    h1 { font-size: 2.4rem; margin-bottom: .4rem; }
    p { line-height: 1.55; color: #44403c; }
    code { background: #e7e5e4; padding: .1rem .35rem; border-radius: 4px; }
    a { color: #0f766e; }
  </style>
</head>
<body>
  <main>
    <h1>OpenGEO</h1>
    <p>See the gap. Ship the block. Prove the citation.</p>
    <p>API is up at <code>/api</code>. Build the web UI with <code>pnpm dev:web</code> or <code>pnpm build</code>.</p>
    <p>Health: <a href="/health">/health</a></p>
  </main>
</body>
</html>`),
  );
}

const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

serve({ fetch: app.fetch, port, hostname: host }, (info) => {
  console.log(`OpenGEO listening on http://${info.address}:${info.port}`);
});
