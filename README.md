# agentinsight

CLI for inspecting and debugging agents built with LangGraph or the Claude Agent SDK.

## Requirements

- Node.js 18+

## Install (local development)

```bash
npm install
npm run build
npm link
```

After linking, the `agentinsight` command is available on your PATH.

```bash
agentinsight --help
agentinsight --version
```

## Scripts

| Script           | Description                                 |
| ---------------- | ------------------------------------------- |
| `npm run build`  | Compile TypeScript to `dist/`               |
| `npm run dev`    | Run the CLI via `tsx` without a prior build |
| `npm test`       | Run Vitest                                  |
| `npm run lint`   | Run ESLint                                  |
| `npm run format` | Format with Prettier                        |

## Project layout

```
src/         CLI and library source
tests/       Vitest suites
examples/    Sample agents (added in later tickets)
.agentinsight/  Runtime traces (created by `run`, gitignored)
```

## License

MIT
