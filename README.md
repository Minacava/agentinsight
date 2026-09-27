# agentinsight

[![CI](https://github.com/Minacava/agentinsight/actions/workflows/ci.yml/badge.svg)](https://github.com/Minacava/agentinsight/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/agentinsight.svg)](https://www.npmjs.com/package/agentinsight)

CLI to inspect and debug agent runs from the terminal: nodes, tool calls, nesting, latency, and (when the runtime provides them) tokens/cost — with traces saved as structured JSON.

Works with:

- **LangGraph** (first-party adapter)
- **Claude Agent SDK** (first-party adapter)
- **Any custom agent** via the manual `Tracer` API / `runtime: "manual"`

## Requirements

- Node.js 18+

## Quickstart

```bash
npm install
npm run build
npm link

agentinsight run ./examples/langgraph-demo.ts
```

Example output shape:

```text
[node] plan  2ms  {"topic":"agentinsight"}
[tool] lookup  1ms  "Notes about agentinsight: …"
[node] gather  2ms  {"notes":"Notes about …"}
[node] finalize  1ms  {"finalAnswer":"Summary for …"}

Summary
  steps:    4
  duration: 12ms

Trace saved: .agentinsight/2026-09-27T17-30-00-123Z.json
```

Replay and list:

```bash
agentinsight replay .agentinsight/latest.json
agentinsight replay .agentinsight/latest.json --step
agentinsight list
```

Both offline demos (no API keys):

```bash
agentinsight run ./examples/langgraph-demo.ts
agentinsight run ./examples/claude-demo.ts
```

## Commands

| Command                                           | Description                                                |
| ------------------------------------------------- | ---------------------------------------------------------- |
| `agentinsight run <entrypoint>`                   | Execute an instrumented agent; print live trace; save JSON |
| `agentinsight replay <file>`                      | Replay a saved trace (optional `--step`)                   |
| `agentinsight list`                               | Table of traces in `.agentinsight/`                        |
| `agentinsight diff <run1.json> <run2.json>`       | Compare two saved traces (added/removed/changed steps)     |
| `agentinsight check <entrypoint> --assert <file>` | Run quietly and evaluate JSON assertions (exit 0/1 for CI) |

`run` flags:

- `--type langgraph|claude|claude-agent-sdk|manual` — force adapter
- `--no-persist` — skip writing `.agentinsight/`
- `--compact` — buffer events and print a compact tree at the end (better for large multi-model runs)
- `--verbose` — with `--compact`, print every event (no aggregation)
- `--only <types>` — display filter (e.g. `error,tool,model`)
- `--slow <ms>` — only events at least this duration
- `--name <substr>` / `--model <substr>` / `--depth <max>` — further display filters

`replay` supports the same focus flags. Filters affect the terminal view only; the saved JSON stays complete. Auto-compacts traces with more than 80 steps unless `--verbose`.

After `run` / `replay`, an executive **SUMMARY** is printed: step mix, slowest steps, cost only if the runtime reported it, and a **BY MODEL** breakdown when model events are present.

```bash
agentinsight run ./examples/langgraph-demo.ts --compact
agentinsight diff tests/fixtures/diff/base.json tests/fixtures/diff/changed.json
agentinsight check ./examples/langgraph-demo.ts --assert ./examples/assertions.json
```

Assertion file keys (all optional): `maxSteps`, `noErrors`, `outputContains`, `maxDurationMs`, `maxCostUsd`.

## Entrypoint contract

Export `default` (or named `graph` / `agent`) as one of:

```ts
// LangGraph
export default {
  runtime: "langgraph",
  graph,          // compiled graph with streamEvents()
  input: { ... },
};

// Claude Agent SDK
export default {
  runtime: "claude-agent-sdk",
  prompt: "…",
  options: { /* SDK options */ },
};

// Any custom agent
export default {
  runtime: "manual",
  async run(tracer) {
    await tracer.withSpan("retrieve", async () => { /* … */ }, { type: "tool" });
    await tracer.withSpan("answer", async () => { /* … */ }, { type: "node" });
  },
};
```

## Architecture

```text
entrypoint → detect runtime → adapter → TraceEvent[] → terminal renderer
                                         └→ .agentinsight/*.json (redacted)
```

1. **Unified model** — every adapter emits the same `TraceEvent` shape (`step`, `type`, `name`, `durationMs`, `depth`, payloads, tokens/cost).
2. **Adapters** — thin runtime-specific capture layers that only translate framework hooks into `TraceEvent`s.
3. **Manual tracer** — framework-agnostic API so unsupported stacks are instrumentable without waiting on a first-party adapter.
4. **Persistence** — JSON traces under `.agentinsight/` (gitignored). Values pass through secret redaction before disk write.
5. **Replay/list** — read-only views over saved traces; no LLM calls.

### LangGraph adapter

Wraps `graph.streamEvents(..., { version: "v2" })`, maps `on_chain_*` / `on_tool_*` / `on_chat_model_*` into events, and attaches `usage_metadata` when present.

### Claude Agent SDK adapter

Merges `PreToolUse` / `PostToolUse` / `PostToolUseFailure` hooks and observes the `query()` message stream (`assistant` / `user` / `result`) for turns, tokens, and `total_cost_usd` when the SDK reports them.

### Manual adapter

Calls your `run(tracer)` function. Use `tracer.record` / `tracer.withSpan` to emit events for any stack.

## Cost and tokens

agentinsight **does not calculate prices**. It only displays tokens and cost fields that an adapter forwards from the underlying runtime:

- If the adapter emits `tokens` / `costUsd` → they appear in the step line and in the summary.
- If the runtime provides nothing → the CLI shows `-` / omits cost (it does not invent tariffs).
- Values from a provider SDK (for example Claude Agent SDK `total_cost_usd`) are **runtime estimates**, not billing statements.
- Offline demos may include fixture cost figures for illustration only.

## Adapter roadmap

Shipped:

- Manual / custom agents (`Tracer`)
- LangGraph
- Claude Agent SDK

Next (in order):

1. OpenAI Agents SDK
2. Vercel AI SDK
3. LangChain callbacks (non-graph Runnables)
4. LlamaIndex TS
5. Additional frameworks as usage demands

Custom adapters only need to implement `AgentAdapter` and emit `TraceEvent`s.

## Library API

```ts
import { Tracer, executeEntrypoint, redactValue } from "agentinsight";
```

## Scripts

| Script           | Description                    |
| ---------------- | ------------------------------ |
| `npm run build`  | Compile TypeScript to `dist/`  |
| `npm test`       | Vitest                         |
| `npm run lint`   | ESLint                         |
| `npm run audit`  | Dependency vulnerability audit |
| `npm run format` | Prettier                       |

## License

MIT
