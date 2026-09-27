# LangGraph demo

Entrypoint: [`../langgraph-demo.ts`](../langgraph-demo.ts)

Deterministic graph (plan → gather/`lookup` tool → finalize). No API keys.

```bash
npm run build && npm link
agentinsight run ./examples/langgraph-demo.ts
agentinsight check ./examples/langgraph-demo.ts --assert ./examples/assertions.json
```

`examples/assertions.json` expects `noErrors: true` and `maxSteps: 1`. The demo has more than one step, so `check` exits `1` and reports the failing assert (useful as a CI example).
