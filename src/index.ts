/**
 * Public library API for agentinsight.
 */

export { Tracer } from "./tracer.js";
export type { ActiveSpan, EndSpanOptions, SpanOptions, TracerOptions } from "./tracer.js";

export type {
  AgentRuntime,
  TokenUsage,
  TraceEvent,
  TraceEventType,
  TraceFile,
  TraceMeta,
  TraceSummary,
} from "./types/trace.js";
export { buildSummary, mergeTokenUsage } from "./types/trace.js";

export type {
  AdapterRunOptions,
  AdapterRunResult,
  AgentAdapter,
  ClaudeEntrypoint,
  LangGraphEntrypoint,
  ManualEntrypoint,
} from "./adapters/types.js";

export { langGraphAdapter, LangGraphAdapter } from "./adapters/langgraph.js";
export { claudeAgentAdapter, ClaudeAgentAdapter } from "./adapters/claude.js";
export { manualAdapter, ManualAdapter } from "./adapters/manual.js";
export { detectRuntime, parseRuntimeFlag } from "./adapters/detect.js";

export { redactValue, redactString, redactTracePayload } from "./security/redact.js";

export { saveTrace, loadTrace, listTraces, TRACE_DIR_NAME } from "./persist/trace-store.js";
export { writeAuditBundle } from "./export/bundle.js";
export type { ExportBundleOptions, ExportBundleResult } from "./export/bundle.js";
export { formatTraceDiff, DEFAULT_MAX_STEP_CHANGES } from "./diff/format-diff.js";
export type { FormatDiffOptions, FormattedDiff } from "./diff/format-diff.js";
export { executeEntrypoint } from "./run/execute.js";
export { formatEventLine, printEvent } from "./render/formatter.js";
export { formatSummary, printSummary } from "./render/summary.js";
export {
  AUTO_COMPACT_STEP_THRESHOLD,
  buildExecutiveSummary,
  formatCompactEvents,
  formatExecutiveSummary,
  printCompactEvents,
  printExecutiveSummary,
} from "./render/views.js";

export const PACKAGE_NAME = "agentinsight" as const;
