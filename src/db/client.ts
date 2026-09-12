import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema.js";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

export function resolveDatabasePath(): string {
  return process.env.DATABASE_PATH ?? "./data/opengeo.db";
}

export function createDb(databasePath = resolveDatabasePath()): {
  db: Db;
  sqlite: Database.Database;
} {
  const dir = path.dirname(path.resolve(databasePath));
  fs.mkdirSync(dir, { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
