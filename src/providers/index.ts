import { DemoVisibilityProvider } from "./demo.js";
import type { VisibilityProvider } from "./types.js";

export function createVisibilityProvider(): VisibilityProvider {
  const mode = process.env.VISIBILITY_PROVIDER ?? "demo";
  if (mode === "demo") {
    return new DemoVisibilityProvider();
  }
  // Live connectors can be registered here without changing service call sites.
  return new DemoVisibilityProvider();
}
