import { claudeAgentAdapter } from "../adapters/claude.js";
import { detectRuntime, parseRuntimeFlag } from "../adapters/detect.js";
import { langGraphAdapter } from "../adapters/langgraph.js";
import { manualAdapter } from "../adapters/manual.js";
import type { AgentAdapter } from "../adapters/types.js";
import { saveTrace } from "../persist/trace-store.js";
import { hasFocusFilters, selectFocusedEvents, type FocusOptions } from "../render/focus.js";
import { printEvent } from "../render/formatter.js";
import { printCompactEvents, printExecutiveSummary } from "../render/views.js";
import { buildSummary, type TraceFile, type TraceMeta } from "../types/trace.js";
import { loadEntrypoint } from "./load-entrypoint.js";

function adapterFor(runtime: ReturnType<typeof detectRuntime>): AgentAdapter {
  switch (runtime) {
    case "langgraph":
      return langGraphAdapter;
    case "claude-agent-sdk":
      return claudeAgentAdapter;
    case "manual":
      return manualAdapter;
    default: {
      const _exhaustive: never = runtime;
      throw new Error(`Unsupported runtime: ${String(_exhaustive)}`);
    }
  }
}

export interface ExecuteOptions {
  type?: string;
  quiet?: boolean;
  persist?: boolean;
  cwd?: string;
  compact?: boolean;
  verbose?: boolean;
  focus?: FocusOptions;
  meta?: TraceMeta;
}

export interface ExecuteResult {
  trace: TraceFile;
  tracePath?: string;
  output?: unknown;
}

export async function executeEntrypoint(
  entrypoint: string,
  options: ExecuteOptions = {},
): Promise<ExecuteResult> {
  const startedAt = new Date();
  const entry = await loadEntrypoint(entrypoint);
  const runtime = parseRuntimeFlag(options.type) ?? detectRuntime(entry);
  const adapter = adapterFor(runtime);
  const quiet = options.quiet === true;
  const compact = options.compact === true;
  const verbose = options.verbose === true;
  const focus = options.focus ?? {};
  const focusing = hasFocusFilters(focus);

  const wallStart = Date.now();
  const result = await adapter.run(
    entry,
    quiet || compact || focusing
      ? {}
      : {
          onEvent: (event) => {
            printEvent(event);
          },
        },
  );
  const endedAt = new Date();
  const durationMs = Date.now() - wallStart;
  const summary = buildSummary(result.events, durationMs);

  const trace: TraceFile = {
    version: 1,
    runtime: result.runtime,
    entrypoint,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    events: result.events,
    summary,
    ...(options.meta && Object.keys(options.meta).length > 0 ? { meta: options.meta } : {}),
  };

  let tracePath: string | undefined;
  if (options.persist !== false) {
    tracePath = await saveTrace(trace, options.cwd);
  }

  if (!quiet) {
    const displayEvents = focusing ? selectFocusedEvents(trace.events, focus) : trace.events;

    if (compact || focusing) {
      if (focusing) {
        process.stdout.write(
          `(focus: showing ${displayEvents.length}/${trace.events.length} events)\n`,
        );
      }
      if (compact) {
        printCompactEvents(displayEvents, { verbose });
      } else {
        for (const event of displayEvents) {
          printEvent(event);
        }
      }
    }

    printExecutiveSummary(trace);
    if (tracePath) {
      process.stdout.write(`\nTrace saved: ${tracePath}\n`);
    }
  }

  return { trace, ...(tracePath ? { tracePath } : {}), output: result.output };
}
