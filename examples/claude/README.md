# Claude Agent SDK demo

Entrypoint: [`../claude-demo.ts`](../claude-demo.ts)

Offline stream that exercises tool hooks (`PreToolUse` / `PostToolUse`) without calling Anthropic.

```bash
npm run build && npm link
agentinsight run ./examples/claude-demo.ts
```

For a live SDK session, export `{ runtime: "claude-agent-sdk", prompt, options }` and set `ANTHROPIC_API_KEY` in your environment (see root `.env.example`). Never commit secrets.
