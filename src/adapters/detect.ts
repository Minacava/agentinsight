import type { AgentRuntime } from "../types/trace.js";
import { isLangGraphLike } from "./langgraph.js";
import { isRecord } from "./types.js";

export type DetectedRuntime = Extract<AgentRuntime, "langgraph" | "claude-agent-sdk" | "manual">;

/**
 * Infer which adapter should run an entrypoint export.
 */
export function detectRuntime(entry: unknown): DetectedRuntime {
  if (!isRecord(entry)) {
    throw new Error("Entrypoint export must be an object");
  }

  const explicit = entry.runtime;
  if (explicit === "langgraph" || explicit === "claude-agent-sdk" || explicit === "manual") {
    return explicit;
  }

  if (typeof entry.run === "function" && entry.runtime === "manual") {
    return "manual";
  }

  if (typeof entry.run === "function" && !entry.graph && !entry.prompt) {
    return "manual";
  }

  if (isLangGraphLike(entry) || isLangGraphLike(entry.graph)) {
    return "langgraph";
  }

  if (entry.prompt !== undefined || typeof entry.createQuery === "function") {
    return "claude-agent-sdk";
  }

  throw new Error(
    "Unable to detect agent runtime. Set `runtime` to 'langgraph' | 'claude-agent-sdk' | 'manual', or pass --type.",
  );
}

export function parseRuntimeFlag(value: string | undefined): DetectedRuntime | undefined {
  if (!value) return undefined;
  if (
    value === "langgraph" ||
    value === "claude" ||
    value === "claude-agent-sdk" ||
    value === "manual"
  ) {
    return value === "claude" ? "claude-agent-sdk" : value;
  }
  throw new Error(
    `Unknown --type "${value}". Expected langgraph | claude | claude-agent-sdk | manual.`,
  );
}
