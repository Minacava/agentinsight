# Retrieval demo

Entrypoint: [`../retrieval-demo.ts`](../retrieval-demo.ts)

Offline manual agent (plan → retrieval → model → answer). No API keys.

```bash
npm run build && npm link
agentinsight run ./examples/retrieval-demo.ts
```

You should see a `[retrieval]` step in the tree and a SUMMARY mix that includes `retrieval=1`.
