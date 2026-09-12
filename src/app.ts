import { createDb, type Db } from "./db/client.js";
import { migrate } from "./db/migrate.js";
import { createVisibilityProvider } from "./providers/index.js";
import { BlockService } from "./services/blocks.js";
import { BriefService } from "./services/brief.js";
import { ProjectService } from "./services/projects.js";
import { PromptService } from "./services/prompts.js";
import { RecheckService } from "./services/recheck.js";
import { VisibilityService } from "./services/visibility.js";

export type AppServices = {
  db: Db;
  projects: ProjectService;
  prompts: PromptService;
  visibility: VisibilityService;
  briefs: BriefService;
  blocks: BlockService;
  rechecks: RecheckService;
  close: () => void;
};

export function createAppServices(databasePath?: string): AppServices {
  migrate(databasePath);
  const { db, sqlite } = createDb(databasePath);
  const provider = createVisibilityProvider();
  const projects = new ProjectService(db);
  const prompts = new PromptService(db);
  const visibility = new VisibilityService(db, provider);
  const briefs = new BriefService(db, visibility);
  const blocks = new BlockService(db, briefs);
  const rechecks = new RecheckService(db, visibility);

  return {
    db,
    projects,
    prompts,
    visibility,
    briefs,
    blocks,
    rechecks,
    close: () => sqlite.close(),
  };
}
