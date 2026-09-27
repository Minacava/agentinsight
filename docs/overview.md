# What agentinsight does

agentinsight is a terminal CLI for **inspecting and debugging agent runs**.  
It executes an agent entrypoint, prints each step as it happens, saves a structured JSON trace, and lets you replay or list past runs — without building a custom dashboard.

Supported day-1 runtimes:

- LangGraph
- Claude Agent SDK
- Any custom agent via the manual `Tracer` API

## What it is for

Use it when you need to answer questions like:

| Question | How the CLI helps |
| -------- | ----------------- |
| What did the agent do? | Live step list: nodes, tools, messages |
| Where did time go? | Per-step `durationMs` + total duration |
| Did a tool fail? | Error-typed events, nested under the caller when depth is known |
| What did this step return? | Short output summary on each line |
| How much did the runtime report for tokens/cost? | Shown **only** if the adapter forwards them (never invented by agentinsight) |
| Can I re-check a past run without calling the LLM again? | `replay` over `.agentinsight/*.json` |

Typical real uses:

- Local debug of a LangGraph or Claude Agent SDK agent before shipping
- Comparing two runs (save traces, replay side by side)
- Sharing a trace file with a teammate instead of screenshots of logs
- Auditing tool-call order and payloads during an incident

It is **not** a billing product, a Neo4j admin UI, or a hosted observability suite. Cost/token numbers are whatever the adapter/runtime provides.

## Install (local)

```bash
npm install
npm run build
npm link

agentinsight --help
```

## Commands

| Command | Purpose |
| ------- | ------- |
| `agentinsight run <entrypoint>` | Run an agent with instrumentation; print live trace; save JSON |
| `agentinsight replay <file>` | Replay a saved trace (optional `--step` for Enter-per-event) |
| `agentinsight list` | Table of traces in `.agentinsight/` (newest first) |

Useful `run` flags:

- `--type langgraph\|claude\|claude-agent-sdk\|manual` — force adapter
- `--no-persist` — do not write under `.agentinsight/`

## Example 1 — LangGraph (offline demo)

```bash
agentinsight run ./examples/langgraph-demo.ts
```

Example output:

```text
[node] plan       1ms  {"topic":"agentinsight"}
  [tool] lookup   0ms  Notes about agentinsight: latency, cost…
[node] gather     3ms  {"notes":"Notes about agentinsight…"}
[node] finalize   1ms  {"finalAnswer":"Summary for \"agentinsight\"…"}

Summary
  steps:    4
  duration: 26ms

Trace saved: .agentinsight/2026-09-27T17-54-57-394Z.json
```

How to read it:

- `[node]` / `[tool]` — event type (colors in a real terminal)
- Indentation — nesting depth (tool under a node)
- `Nms` — step duration
- Trailing text — short summary of output (or error)
- **Summary** — step count and wall time for the run
- No cost line here — the LangGraph demo does not report cost

## Example 2 — Claude Agent SDK shape (offline demo)

```bash
agentinsight run ./examples/claude-demo.ts
```

Example output:

```text
[message] assistant#1  0ms   [{"type":"text",…},{"type":"tool_use","name":"lookup",…}]  21 tok
  [tool] lookup       18ms   Tracing records each step with duration and cost.
[message] user         0ms   [{"type":"tool_result",…}]
[message] assistant#2  0ms   [{"type":"text","text":"Done. …"}]  31 tok
[span] result         42ms   {"result":"Done. …","num_turns":2}  $0.0002

Summary
  steps:    5
  duration: 2ms
  cost:     $0.000210
  tokens:   in=32 out=20 total=52
```

Notes:

- This demo uses an injected stream (no API key).
- The `$` figure is a **fixture** for illustration, or — with a real SDK — a **runtime estimate**, not an invoice.
- agentinsight only prints cost/tokens the adapter puts on the events.

## Example 3 — List and replay

```bash
agentinsight list
```

```text
DATE                      DURATION    COST      STEPS   RUNTIME            FILE
2026-09-27T17:54:56.928Z  26ms        -         4       langgraph          .agentinsight/….json
2026-09-27T17:52:10.136Z  2ms         $0.0002   5       claude-agent-sdk   .agentinsight/….json
```

```bash
agentinsight replay .agentinsight/latest.json
agentinsight replay .agentinsight/latest.json --step
```

Replay redraws the same visual format from JSON. No LLM calls.

## Entrypoint shapes (minimal)

```ts
// LangGraph
export default {
  runtime: "langgraph",
  graph,       // compiled graph with streamEvents()
  input: { … },
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

## Trace files

- Written to `.agentinsight/<timestamp>.json` (also `latest.json` for convenience)
- Directory is gitignored — traces can contain prompts and tool payloads
- Sensitive-looking keys/patterns are redacted before write

## Cost and tokens (important)

agentinsight **does not calculate prices**.

- Shows only `tokens` / `costUsd` forwarded by adapters from the runtime
- If the runtime sends nothing → `-` / omitted
- Provider SDK figures are estimates, not billing

See also the [Cost and tokens](../README.md#cost-and-tokens) section in the README.

## Related docs

- [README](../README.md) — quickstart and architecture
- [examples/langgraph](../examples/langgraph/README.md) — LangGraph demo
- [examples/claude](../examples/claude/README.md) — Claude demo
- [CONTRIBUTING](../CONTRIBUTING.md) — how to extend adapters
