/**
 * Unified trace model shared by every adapter (first-party and custom).
 */

export type AgentRuntime = "langgraph" | "claude-agent-sdk" | "manual" | (string & {});

export type TraceEventType = "node" | "tool" | "message" | "model" | "error" | "span";

export interface TokenUsage {
  input?: number;
  output?: number;
  total?: number;
}

export interface TraceEvent {
  id: string;
  step: number;
  type: TraceEventType;
  name: string;
  timestamp: string;
  durationMs: number;
  depth: number;
  input?: unknown;
  output?: unknown;
  tokens?: TokenUsage;
  costUsd?: number;
  error?: string;
  parentId?: string;
}

export interface TraceSummary {
  steps: number;
  durationMs: number;
  costUsd?: number;
  tokens?: TokenUsage;
}

export interface TraceFile {
  version: 1;
  runtime: AgentRuntime;
  entrypoint: string;
  startedAt: string;
  endedAt: string;
  events: TraceEvent[];
  summary: TraceSummary;
}

export function emptyTokenUsage(): TokenUsage {
  return {};
}

export function mergeTokenUsage(a?: TokenUsage, b?: TokenUsage): TokenUsage | undefined {
  if (!a && !b) return undefined;
  const input = (a?.input ?? 0) + (b?.input ?? 0);
  const output = (a?.output ?? 0) + (b?.output ?? 0);
  const total =
    a?.total !== undefined || b?.total !== undefined
      ? (a?.total ?? 0) + (b?.total ?? 0)
      : input + output || undefined;
  const usage: TokenUsage = {};
  if (input) usage.input = input;
  if (output) usage.output = output;
  if (total !== undefined && total > 0) usage.total = total;
  return Object.keys(usage).length ? usage : undefined;
}

export function buildSummary(events: TraceEvent[], durationMs: number): TraceSummary {
  let costUsd = 0;
  let hasCost = false;
  let tokens: TokenUsage | undefined;

  for (const event of events) {
    if (event.costUsd !== undefined) {
      costUsd += event.costUsd;
      hasCost = true;
    }
    // Skip chat `message` rows so Claude per-turn usage is not double-counted
    // against the final `result` totals.
    if (event.type !== "message") {
      tokens = mergeTokenUsage(tokens, event.tokens);
    }
  }

  const summary: TraceSummary = {
    steps: events.length,
    durationMs,
  };
  if (hasCost) summary.costUsd = costUsd;
  if (tokens) summary.tokens = tokens;
  return summary;
}
