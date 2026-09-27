# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- README keeps a source-based quickstart only (npm version badge removed until the package is published).
- Removed top-level `CONTRIBUTING.md` and `SECURITY.md` from the public tree.

### Added

- CLI command `diff` to compare two saved traces (step alignment, duration/cost/token deltas, final output diff).
- CLI command `check` to run an entrypoint against a JSON assertion file (CI exit codes).
- Executive SUMMARY after `run`/`replay` (step mix, slowest steps, cost only when reported, optional by-model breakdown) and compact event aggregation (`--compact` / auto-compact on large replays).
- Focus filters on `run`/`replay`: `--only`, `--slow`, `--name`, `--depth`, `--model` (display-only; full trace still persisted).
- CLI command `inspect` to show redacted detail for one trace step (`--step` / `--id`).
- Run metadata (`--tag`, `--env`, `--session-id`, `--agent`) and `list` filters (`--tag`, `--env`, `--agent`, `--limit`).
- Redaction profiles on persist: `--redact default|pii` (`pii` also strips emails/phones).
- Richer `check` asserts: `requiredSteps`, `maxStepDurationMs`.
- `retrieval` event type with offline multi-step demo (`examples/retrieval-demo.ts`).
- CLI command `export` for redacted audit bundles (`trace.json`, `summary.txt`, optional `assertions.json`).
- Compact `diff` output by default (deltas only, truncate after 50 changes, truncated final output) with `--full`.

## [0.1.0] - 2026-09-27

### Added

- Unified `TraceEvent` model and `Tracer` API for any custom agent.
- First-party adapters: LangGraph (`streamEvents` v2) and Claude Agent SDK (hooks + message stream).
- CLI commands: `run`, `replay` (`--step`), `list`.
- Trace persistence under `.agentinsight/` with secret redaction.
- Nested/depth-aware colored terminal rendering.
- Offline examples for LangGraph and Claude Agent SDK shapes.
- GitHub Actions CI (lint, format, test, build, `npm audit`) and npm publish on version tags.
- `.env.example` and adapter roadmap in the README.
