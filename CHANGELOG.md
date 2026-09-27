# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- CLI command `diff` to compare two saved traces (step alignment, duration/cost/token deltas, final output diff).
- CLI command `check` to run an entrypoint against a JSON assertion file (CI exit codes).
- Executive L0 summary after `run`/`replay` (mix, slowest, cost source, optional by-model breakdown) and compact L1 aggregation (`--compact` / auto-compact on large replays).
- Focus filters on `run`/`replay`: `--only`, `--slow`, `--name`, `--depth`, `--model` (display-only; full trace still persisted).
- CLI command `inspect` to show redacted detail for one trace step (`--step` / `--id`).
- Run metadata (`--tag`, `--env`, `--session-id`, `--agent`) and `list` filters (`--tag`, `--env`, `--agent`, `--limit`).

## [0.1.0] - 2026-09-27

### Added

- Unified `TraceEvent` model and `Tracer` API for any custom agent.
- First-party adapters: LangGraph (`streamEvents` v2) and Claude Agent SDK (hooks + message stream).
- CLI commands: `run`, `replay` (`--step`), `list`.
- Trace persistence under `.agentinsight/` with secret redaction.
- Nested/depth-aware colored terminal rendering.
- Offline examples for LangGraph and Claude Agent SDK shapes.
- GitHub Actions CI (lint, format, test, build, `npm audit`) and npm publish on version tags.
- `SECURITY.md`, `.env.example`, and adapter roadmap in the README.
