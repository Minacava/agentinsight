import path from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "node:module";

let tsxRegistered = false;

async function ensureTsxLoader(): Promise<void> {
  if (tsxRegistered) return;
  try {
    register("tsx/esm", pathToFileURL("./"));
    tsxRegistered = true;
  } catch {
    // tsx may already be registered (e.g. via `tsx` CLI / NODE_OPTIONS).
    tsxRegistered = true;
  }
}

/**
 * Dynamically import a user entrypoint (TS or JS) and resolve the agent export.
 */
export async function loadEntrypoint(entrypoint: string): Promise<unknown> {
  const absolute = path.resolve(process.cwd(), entrypoint);
  await ensureTsxLoader();

  const mod = (await import(pathToFileURL(absolute).href)) as Record<string, unknown>;

  if (mod.default !== undefined) return mod.default;
  if (mod.agent !== undefined) return mod.agent;
  if (mod.graph !== undefined) {
    return {
      graph: mod.graph,
      input: mod.input,
      config: mod.config,
      runtime: mod.runtime ?? "langgraph",
    };
  }
  if (mod.prompt !== undefined || mod.createQuery !== undefined) {
    return {
      prompt: mod.prompt,
      options: mod.options,
      createQuery: mod.createQuery,
      runtime: mod.runtime ?? "claude-agent-sdk",
    };
  }

  throw new Error(
    `No agent export found in ${entrypoint}. Export default, or named exports: graph/agent/prompt.`,
  );
}
