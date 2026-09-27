# Contributing

## Setup

```bash
npm install
npm run build
npm test
npm run lint
```

## Workflow

1. Create a focused branch.
2. Keep changes scoped (one concern per PR).
3. Add or update Vitest coverage for adapters and persistence.
4. Run `npm run build && npm test && npm run lint && npm run audit`.
5. Use Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`).

## Adding an adapter

1. Emit the shared `TraceEvent` model (`src/types/trace.ts`).
2. Implement `AgentAdapter` under `src/adapters/`.
3. Register detection in `src/adapters/detect.ts` and wiring in `src/run/execute.ts`.
4. Prefer optional `peerDependencies` + dynamic import so users only install the SDK they need.
5. Add offline tests (no network, no real API keys).
6. Add a minimal example under `examples/` when the adapter ships.
7. Update the adapter roadmap in `README.md`.

## Security expectations

- Never commit secrets, tokens, or real `.env` files.
- Do not check in `.agentinsight/` traces.
- Keep examples offline or document env vars via `.env.example` placeholders only.
- Route vulnerability reports through [SECURITY.md](./SECURITY.md).

## Docs

README and example docs stay technical: install, commands, architecture, contracts. No marketing CTAs.
