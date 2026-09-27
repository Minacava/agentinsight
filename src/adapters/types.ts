import type { AgentRuntime, TraceEvent } from "../types/trace.js";
import type { Tracer } from "../tracer.js";

export interface AdapterRunResult {
  runtime: AgentRuntime;
  events: TraceEvent[];
  output?: unknown;
}

export interface AgentAdapter {
  readonly runtime: AgentRuntime;
  run(entry: unknown, options?: AdapterRunOptions): Promise<AdapterRunResult>;
}

export interface AdapterRunOptions {
  onEvent?: (event: TraceEvent) => void;
  tracer?: Tracer;
}

export interface LangGraphEntrypoint {
  runtime?: "langgraph";
  graph: LangGraphLike;
  input?: unknown;
  config?: Record<string, unknown>;
}

export interface LangGraphLike {
  streamEvents: (
    input: unknown,
    options: Record<string, unknown>,
  ) => Promise<AsyncIterable<StreamEventLike>> | AsyncIterable<StreamEventLike>;
  invoke?: (input: unknown, config?: Record<string, unknown>) => Promise<unknown>;
}

export interface StreamEventLike {
  event: string;
  name?: string;
  run_id?: string;
  parent_run_id?: string;
  data?: {
    input?: unknown;
    output?: unknown;
    error?: unknown;
  };
  metadata?: Record<string, unknown>;
}

export interface ClaudeEntrypoint {
  runtime?: "claude-agent-sdk";
  prompt: unknown;
  options?: Record<string, unknown>;
  /**
   * Inject a query implementation (tests / offline demos).
   * When omitted, the real SDK `query` is loaded dynamically.
   */
  createQuery?: (params: {
    prompt: unknown;
    options?: Record<string, unknown>;
  }) => AsyncIterable<ClaudeMessageLike>;
}

export interface ClaudeMessageLike {
  type: string;
  message?: {
    content?: unknown;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  total_cost_usd?: number;
  duration_ms?: number;
  num_turns?: number;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
  result?: unknown;
  is_error?: boolean;
}

export interface ManualEntrypoint {
  runtime: "manual";
  run: (tracer: Tracer) => Promise<unknown> | unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
