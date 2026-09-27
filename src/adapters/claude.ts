import { Tracer } from "../tracer.js";
import type { TokenUsage } from "../types/trace.js";
import type {
  AdapterRunOptions,
  AdapterRunResult,
  AgentAdapter,
  ClaudeEntrypoint,
  ClaudeMessageLike,
} from "./types.js";
import { isRecord } from "./types.js";

type HookCallback = (
  input: Record<string, unknown>,
  toolUseID: string | undefined,
  options: { signal: AbortSignal },
) => Promise<Record<string, unknown>>;

function asClaudeEntrypoint(entry: unknown): ClaudeEntrypoint {
  if (!isRecord(entry)) {
    throw new Error("Claude Agent SDK entrypoint must be an object");
  }
  if (entry.prompt === undefined && entry.createQuery === undefined) {
    throw new Error(
      "Claude entrypoint must provide `prompt` (and optional `options`) or `createQuery`",
    );
  }
  const ep: ClaudeEntrypoint = {
    runtime: "claude-agent-sdk",
    prompt: entry.prompt,
  };
  if (isRecord(entry.options)) ep.options = entry.options;
  if (typeof entry.createQuery === "function") {
    const createQuery = entry.createQuery as NonNullable<ClaudeEntrypoint["createQuery"]>;
    ep.createQuery = createQuery;
  }
  return ep;
}

async function loadSdkQuery(): Promise<
  (params: {
    prompt: unknown;
    options?: Record<string, unknown>;
  }) => AsyncIterable<ClaudeMessageLike>
> {
  const mod = (await import("@anthropic-ai/claude-agent-sdk")) as {
    query: (params: {
      prompt: unknown;
      options?: Record<string, unknown>;
    }) => AsyncIterable<ClaudeMessageLike>;
  };
  return mod.query;
}

function summarizeContent(content: unknown): unknown {
  if (!Array.isArray(content)) return content;
  return content.map((block) => {
    if (!isRecord(block)) return block;
    if (block.type === "text") return { type: "text", text: block.text };
    if (block.type === "tool_use") {
      return {
        type: "tool_use",
        name: block.name,
        id: block.id,
        input: block.input,
      };
    }
    if (block.type === "tool_result") {
      return {
        type: "tool_result",
        tool_use_id: block.tool_use_id,
        content: block.content,
      };
    }
    return { type: block.type };
  });
}

export class ClaudeAgentAdapter implements AgentAdapter {
  readonly runtime = "claude-agent-sdk" as const;

  async run(entry: unknown, options: AdapterRunOptions = {}): Promise<AdapterRunResult> {
    const claude = asClaudeEntrypoint(entry);
    const tracer =
      options.tracer ??
      new Tracer({
        ...(options.onEvent ? { onEvent: options.onEvent } : {}),
      });
    const pendingTools = new Map<string, { name: string; input: unknown; started: number }>();

    const onPreToolUse: HookCallback = async (input, toolUseID) => {
      const id = String(input.tool_use_id ?? toolUseID ?? randomId());
      pendingTools.set(id, {
        name: String(input.tool_name ?? "tool"),
        input: input.tool_input,
        started: Date.now(),
      });
      return {};
    };

    const onPostToolUse: HookCallback = async (input) => {
      const id = String(input.tool_use_id ?? "");
      const pending = pendingTools.get(id);
      pendingTools.delete(id);
      const durationMs =
        typeof input.duration_ms === "number"
          ? input.duration_ms
          : pending
            ? Date.now() - pending.started
            : 0;
      tracer.record("tool", String(input.tool_name ?? pending?.name ?? "tool"), {
        depth: 1,
        durationMs,
        ...(pending?.input !== undefined ? { input: pending.input } : {}),
        output: input.tool_response,
      });
      return {};
    };

    const onPostToolUseFailure: HookCallback = async (input) => {
      const id = String(input.tool_use_id ?? "");
      const pending = pendingTools.get(id);
      pendingTools.delete(id);
      const durationMs =
        typeof input.duration_ms === "number"
          ? input.duration_ms
          : pending
            ? Date.now() - pending.started
            : 0;
      tracer.record("error", String(input.tool_name ?? pending?.name ?? "tool"), {
        depth: 1,
        durationMs,
        ...(pending?.input !== undefined ? { input: pending.input } : {}),
        error: String(input.error ?? "tool failure"),
      });
      return {};
    };

    const userHooks = isRecord(claude.options?.hooks)
      ? (claude.options?.hooks as Record<string, unknown>)
      : {};

    const mergedOptions: Record<string, unknown> = {
      ...(claude.options ?? {}),
      hooks: {
        ...userHooks,
        PreToolUse: [{ hooks: [onPreToolUse] }, ...((userHooks.PreToolUse as unknown[]) ?? [])],
        PostToolUse: [{ hooks: [onPostToolUse] }, ...((userHooks.PostToolUse as unknown[]) ?? [])],
        PostToolUseFailure: [
          { hooks: [onPostToolUseFailure] },
          ...((userHooks.PostToolUseFailure as unknown[]) ?? []),
        ],
      },
    };

    const queryFn = claude.createQuery ?? (await loadSdkQuery());
    let finalOutput: unknown;
    let turn = 0;

    for await (const message of queryFn({
      prompt: claude.prompt,
      options: mergedOptions,
    })) {
      if (message.type === "assistant") {
        turn += 1;
        const usage = message.message?.usage;
        const tokens: TokenUsage | undefined = usage
          ? {
              ...(usage.input_tokens !== undefined ? { input: usage.input_tokens } : {}),
              ...(usage.output_tokens !== undefined ? { output: usage.output_tokens } : {}),
              ...(usage.input_tokens !== undefined || usage.output_tokens !== undefined
                ? {
                    total: (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
                  }
                : {}),
            }
          : undefined;
        tracer.record("message", `assistant#${turn}`, {
          depth: 0,
          output: summarizeContent(message.message?.content),
          ...(tokens && Object.keys(tokens).length ? { tokens } : {}),
        });
      } else if (message.type === "user") {
        tracer.record("message", "user", {
          depth: 0,
          output: summarizeContent(message.message?.content),
        });
      } else if (message.type === "result") {
        const tokens: TokenUsage | undefined = message.usage
          ? {
              ...(message.usage.input_tokens !== undefined
                ? { input: message.usage.input_tokens }
                : {}),
              ...(message.usage.output_tokens !== undefined
                ? { output: message.usage.output_tokens }
                : {}),
            }
          : undefined;
        tracer.record(message.is_error ? "error" : "span", "result", {
          depth: 0,
          durationMs: message.duration_ms ?? 0,
          output: {
            result: message.result,
            num_turns: message.num_turns,
          },
          ...(message.total_cost_usd !== undefined ? { costUsd: message.total_cost_usd } : {}),
          ...(tokens ? { tokens } : {}),
          ...(message.is_error ? { error: String(message.result ?? "error") } : {}),
        });
        finalOutput = message.result;
      }
    }

    for (const [, pending] of pendingTools) {
      tracer.record("error", pending.name, {
        depth: 1,
        durationMs: Date.now() - pending.started,
        input: pending.input,
        error: "tool closed without PostToolUse",
      });
    }

    return {
      runtime: this.runtime,
      events: tracer.getEvents(),
      output: finalOutput,
    };
  }
}

function randomId(): string {
  return `tool_${Math.random().toString(36).slice(2, 10)}`;
}

export const claudeAgentAdapter = new ClaudeAgentAdapter();
