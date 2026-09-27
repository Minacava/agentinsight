import { Tracer } from "../tracer.js";
import type { TokenUsage, TraceEvent } from "../types/trace.js";
import type {
  AdapterRunOptions,
  AdapterRunResult,
  AgentAdapter,
  LangGraphEntrypoint,
  LangGraphLike,
  StreamEventLike,
} from "./types.js";
import { isRecord } from "./types.js";

const SKIP_NAMES = new Set([
  "LangGraph",
  "RunnableSequence",
  "RunnableLambda",
  "ChannelWrite",
  "ChannelRead",
  "__start__",
  "__end__",
]);

function asLangGraphEntrypoint(entry: unknown): LangGraphEntrypoint {
  if (!isRecord(entry)) {
    throw new Error("LangGraph entrypoint must be an object");
  }

  if (isLangGraphLike(entry.graph)) {
    const ep: LangGraphEntrypoint = {
      runtime: "langgraph",
      graph: entry.graph,
      input: entry.input,
    };
    if (isRecord(entry.config)) ep.config = entry.config;
    return ep;
  }

  if (isLangGraphLike(entry)) {
    return {
      runtime: "langgraph",
      graph: entry,
    };
  }

  throw new Error(
    "LangGraph entrypoint must export `{ graph, input }` or a compiled graph with streamEvents()",
  );
}

export function isLangGraphLike(value: unknown): value is LangGraphLike {
  return isRecord(value) && typeof value.streamEvents === "function";
}

function tokensFromOutput(output: unknown): TokenUsage | undefined {
  if (!isRecord(output)) return undefined;
  const usage = output.usage_metadata;
  if (!isRecord(usage)) return undefined;
  const tokens: TokenUsage = {};
  if (typeof usage.input_tokens === "number") tokens.input = usage.input_tokens;
  if (typeof usage.output_tokens === "number") tokens.output = usage.output_tokens;
  if (typeof usage.total_tokens === "number") tokens.total = usage.total_tokens;
  return Object.keys(tokens).length ? tokens : undefined;
}

function eventType(streamEvent: string, name: string): TraceEvent["type"] {
  if (streamEvent.includes("tool")) return "tool";
  if (streamEvent.includes("chat_model") || streamEvent.includes("llm")) return "model";
  if (name.toLowerCase().includes("tool")) return "tool";
  return "node";
}

export class LangGraphAdapter implements AgentAdapter {
  readonly runtime = "langgraph" as const;

  async run(entry: unknown, options: AdapterRunOptions = {}): Promise<AdapterRunResult> {
    const { graph, input, config } = asLangGraphEntrypoint(entry);
    const tracer =
      options.tracer ??
      new Tracer({
        ...(options.onEvent ? { onEvent: options.onEvent } : {}),
      });
    const open = new Map<
      string,
      { name: string; started: number; depth: number; type: TraceEvent["type"] }
    >();
    const depthByRun = new Map<string, number>();
    let finalOutput: unknown;

    const stream = await graph.streamEvents(input ?? null, {
      ...(config ?? {}),
      version: "v2",
    });

    for await (const raw of stream) {
      const ev = raw as StreamEventLike;
      const runId = ev.run_id ?? "";
      const name = ev.name ?? "unknown";
      const parent = ev.parent_run_id;

      if (ev.event.endsWith("_start")) {
        const parentDepth = parent && depthByRun.has(parent) ? (depthByRun.get(parent) ?? 0) : -1;
        const depth = parentDepth + 1;
        depthByRun.set(runId, depth);

        if (SKIP_NAMES.has(name) && !ev.event.includes("tool")) {
          continue;
        }

        open.set(runId, {
          name,
          started: Date.now(),
          depth,
          type: eventType(ev.event, name),
        });
        continue;
      }

      if (ev.event.endsWith("_end") || ev.event.endsWith("_error")) {
        const started = open.get(runId);
        open.delete(runId);

        if (!started && SKIP_NAMES.has(name)) {
          if (name === "LangGraph") {
            finalOutput = ev.data?.output;
          }
          continue;
        }

        const metaNode = ev.metadata?.langgraph_node;
        const displayName = started?.name ?? (typeof metaNode === "string" ? metaNode : name);

        if (SKIP_NAMES.has(displayName) && !ev.event.includes("tool")) {
          continue;
        }

        const isError = ev.event.endsWith("_error");
        const tokens = tokensFromOutput(ev.data?.output);
        const type = isError ? "error" : (started?.type ?? eventType(ev.event, displayName));
        let depth = started?.depth ?? depthByRun.get(runId) ?? 0;
        // Tools invoked inside a node should render nested even if the
        // callback parent chain is flattened by the runtime.
        if (type === "tool" && depth < 1) depth = 1;
        tracer.record(type, displayName, {
          durationMs: started ? Date.now() - started.started : 0,
          depth,
          ...(parent !== undefined ? { parentId: parent } : {}),
          ...(ev.data?.input !== undefined ? { input: ev.data.input } : {}),
          ...(!isError && ev.data?.output !== undefined ? { output: ev.data.output } : {}),
          ...(isError
            ? {
                error: String(ev.data?.error ?? ev.data?.output ?? "error"),
              }
            : {}),
          ...(tokens ? { tokens } : {}),
        });

        if (displayName === "LangGraph") {
          finalOutput = ev.data?.output;
        }
      }
    }

    // Flush any spans that never received an end event.
    for (const [, span] of open) {
      tracer.record(span.type, span.name, {
        durationMs: Date.now() - span.started,
        depth: span.depth,
        error: "span ended without matching end event",
      });
    }

    return {
      runtime: this.runtime,
      events: tracer.getEvents(),
      output: finalOutput,
    };
  }
}

export const langGraphAdapter = new LangGraphAdapter();
