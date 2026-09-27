/**
 * Offline Claude Agent SDK-shaped demo for agentinsight.
 * Uses an injected createQuery stream — no API key required.
 *
 * For a live Claude Agent SDK session, replace createQuery with a real
 * `prompt` + `options` and ensure ANTHROPIC_API_KEY is set in your environment
 * (never commit secrets; see .env.example).
 *
 * Run:
 *   agentinsight run ./examples/claude-demo.ts
 */

async function* createQuery(_params: { prompt: unknown; options?: Record<string, unknown> }) {
  const hooks = (_params.options?.hooks ?? {}) as Record<
    string,
    Array<{ hooks: Array<(input: Record<string, unknown>, id?: string) => Promise<unknown>> }>
  >;

  const runHooks = async (name: string, input: Record<string, unknown>, toolUseID?: string) => {
    const matchers = hooks[name] ?? [];
    for (const matcher of matchers) {
      for (const hook of matcher.hooks) {
        await hook(input, toolUseID);
      }
    }
  };

  yield {
    type: "assistant",
    message: {
      content: [
        { type: "text", text: "I will look that up." },
        {
          type: "tool_use",
          id: "tool_1",
          name: "lookup",
          input: { topic: "tracing" },
        },
      ],
      usage: { input_tokens: 12, output_tokens: 9 },
    },
  };

  await runHooks(
    "PreToolUse",
    {
      hook_event_name: "PreToolUse",
      tool_name: "lookup",
      tool_input: { topic: "tracing" },
      tool_use_id: "tool_1",
    },
    "tool_1",
  );

  await runHooks(
    "PostToolUse",
    {
      hook_event_name: "PostToolUse",
      tool_name: "lookup",
      tool_input: { topic: "tracing" },
      tool_use_id: "tool_1",
      tool_response: "Tracing records each step with duration and cost.",
      duration_ms: 18,
    },
    "tool_1",
  );

  yield {
    type: "user",
    message: {
      content: [
        {
          type: "tool_result",
          tool_use_id: "tool_1",
          content: "Tracing records each step with duration and cost.",
        },
      ],
    },
  };

  yield {
    type: "assistant",
    message: {
      content: [
        {
          type: "text",
          text: "Done. Tracing helps debug multi-step agents.",
        },
      ],
      usage: { input_tokens: 20, output_tokens: 11 },
    },
  };

  yield {
    type: "result",
    subtype: "success",
    result: "Done. Tracing helps debug multi-step agents.",
    duration_ms: 42,
    num_turns: 2,
    total_cost_usd: 0.00021,
    usage: { input_tokens: 32, output_tokens: 20 },
    is_error: false,
  };
}

export default {
  runtime: "claude-agent-sdk" as const,
  prompt: "Explain why agent tracing matters",
  createQuery,
};
