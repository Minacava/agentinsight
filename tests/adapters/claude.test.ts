import { describe, expect, it } from "vitest";
import { claudeAgentAdapter } from "../../src/adapters/claude.js";

describe("claudeAgentAdapter", () => {
  it("captures tool hooks and messages from an injected query stream", async () => {
    async function* createQuery(params: { prompt: unknown; options?: Record<string, unknown> }) {
      const hooks = (params.options?.hooks ?? {}) as Record<
        string,
        Array<{
          hooks: Array<
            (
              input: Record<string, unknown>,
              id: string | undefined,
              opts: { signal: AbortSignal },
            ) => Promise<unknown>
          >;
        }>
      >;

      const run = async (name: string, input: Record<string, unknown>, id?: string) => {
        for (const matcher of hooks[name] ?? []) {
          for (const hook of matcher.hooks) {
            await hook(input, id, { signal: new AbortController().signal });
          }
        }
      };

      yield {
        type: "assistant",
        message: {
          content: [{ type: "tool_use", id: "t1", name: "ping", input: {} }],
          usage: { input_tokens: 1, output_tokens: 2 },
        },
      };
      await run(
        "PreToolUse",
        {
          tool_name: "ping",
          tool_input: {},
          tool_use_id: "t1",
        },
        "t1",
      );
      await run(
        "PostToolUse",
        {
          tool_name: "ping",
          tool_use_id: "t1",
          tool_response: "pong",
          duration_ms: 5,
        },
        "t1",
      );
      yield {
        type: "result",
        result: "pong",
        duration_ms: 10,
        total_cost_usd: 0.001,
        usage: { input_tokens: 1, output_tokens: 2 },
        is_error: false,
      };
    }

    const result = await claudeAgentAdapter.run({
      runtime: "claude-agent-sdk",
      prompt: "hi",
      createQuery,
    });

    expect(result.events.some((e) => e.type === "tool" && e.name === "ping")).toBe(true);
    expect(result.events.some((e) => e.name === "result")).toBe(true);
    expect(result.events[0]?.timestamp).toBeTruthy();
    expect(result.output).toBe("pong");
  });
});
