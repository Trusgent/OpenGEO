import type { Engine, VisibilityCheckResult } from "../domain.js";

export type VisibilityProviderInput = {
  brand: string;
  domain: string;
  competitors: Array<{ name: string; domain: string }>;
  prompt: string;
  engines: Engine[];
};

export interface VisibilityProvider {
  name: string;
  check(input: VisibilityProviderInput): Promise<VisibilityCheckResult[]>;
}
