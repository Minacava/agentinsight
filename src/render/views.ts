import chalk from "chalk";
import type { TraceEvent, TraceEventType, TraceFile, TokenUsage } from "../types/trace.js";
import { formatEventLine } from "./formatter.js";

export const AUTO_COMPACT_STEP_THRESHOLD = 80;

export interface ModelBreakdown {
  name: string;
  count: number;
  durationMs: number;
  tokens?: TokenUsage;
}

export interface ExecutiveSummary {
  steps: number;
  durationMs: number;
  errorCount: number;
  costUsd?: number;
  costSource: "runtime" | "not_reported";
  tokens?: TokenUsage;
  mix: Partial<Record<TraceEventType, number>>;
  slowest: Array<{ name: string; type: TraceEventType; durationMs: number; pct: number }>;
  byModel: ModelBreakdown[];
}

export interface CompactOptions {
  maxPayloadChars?: number;
  /** When true, skip aggregation and print every event line. */
  verbose?: boolean;
}

function mergeTokens(a?: TokenUsage, b?: TokenUsage): TokenUsage | undefined {
  if (!a && !b) return undefined;
  const input = (a?.input ?? 0) + (b?.input ?? 0);
  const output = (a?.output ?? 0) + (b?.output ?? 0);
  const total =
    a?.total !== undefined || b?.total !== undefined
      ? (a?.total ?? 0) + (b?.total ?? 0)
      : input + output || undefined;
  const usage: TokenUsage = {};
  if (input) usage.input = input;
  if (output) usage.output = output;
  if (total !== undefined && total > 0) usage.total = total;
  return Object.keys(usage).length ? usage : undefined;
}

function isModelLike(event: TraceEvent): boolean {
  return event.type === "model" || /^model[:/]/i.test(event.name);
}

export function buildExecutiveSummary(trace: TraceFile): ExecutiveSummary {
  const { events, summary } = trace;
  const mix: Partial<Record<TraceEventType, number>> = {};
  let errorCount = 0;
  const modelMap = new Map<string, ModelBreakdown>();

  for (const event of events) {
    mix[event.type] = (mix[event.type] ?? 0) + 1;
    if (event.type === "error" || event.error !== undefined) {
      errorCount += 1;
    }
    if (isModelLike(event)) {
      const key = event.name;
      const prev = modelMap.get(key) ?? {
        name: key,
        count: 0,
        durationMs: 0,
      };
      prev.count += 1;
      prev.durationMs += event.durationMs;
      const merged = mergeTokens(prev.tokens, event.tokens);
      if (merged) prev.tokens = merged;
      modelMap.set(key, prev);
    }
  }

  const totalDuration = summary.durationMs || 1;
  const slowest = [...events]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 3)
    .map((event) => ({
      name: event.name,
      type: event.type,
      durationMs: event.durationMs,
      pct: Math.round((event.durationMs / totalDuration) * 100),
    }));

  const byModel = [...modelMap.values()].sort(
    (a, b) => b.durationMs - a.durationMs || b.count - a.count,
  );

  const exec: ExecutiveSummary = {
    steps: summary.steps,
    durationMs: summary.durationMs,
    errorCount,
    costSource: summary.costUsd !== undefined ? "runtime" : "not_reported",
    mix,
    slowest,
    byModel,
  };
  if (summary.costUsd !== undefined) exec.costUsd = summary.costUsd;
  if (summary.tokens) exec.tokens = summary.tokens;
  return exec;
}

export function formatExecutiveSummary(summary: ExecutiveSummary): string {
  const costPart =
    summary.costSource === "runtime" && summary.costUsd !== undefined
      ? `cost=$${summary.costUsd.toFixed(6)} (runtime)`
      : "cost=not reported";

  const tokenPart = summary.tokens
    ? `tokens=${[
        summary.tokens.input !== undefined ? `in=${summary.tokens.input}` : undefined,
        summary.tokens.output !== undefined ? `out=${summary.tokens.output}` : undefined,
        summary.tokens.total !== undefined ? `total=${summary.tokens.total}` : undefined,
      ]
        .filter(Boolean)
        .join(" ")}`
    : undefined;

  const header = [
    chalk.bold("SUMMARY"),
    `steps=${summary.steps}`,
    `duration=${summary.durationMs}ms`,
    costPart,
    `errors=${summary.errorCount}`,
    ...(tokenPart ? [tokenPart] : []),
  ].join("  ");

  const mix = Object.entries(summary.mix)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([type, count]) => `${type}=${count}`)
    .join("  ");

  const slow =
    summary.slowest.length === 0
      ? chalk.dim("(none)")
      : summary.slowest.map((s) => `${s.name} ${s.durationMs}ms (${s.pct}%)`).join(" · ");

  const lines = [header, `MIX      ${mix || chalk.dim("(empty)")}`, `SLOWEST  ${slow}`];

  if (summary.byModel.length > 0) {
    const modelLines = summary.byModel.map((m) => {
      const tok =
        m.tokens?.total !== undefined
          ? `  tok=${m.tokens.total}`
          : m.tokens
            ? `  tok=in${m.tokens.input ?? 0}/out${m.tokens.output ?? 0}`
            : "";
      return `  ${m.name}  n=${m.count}  ${m.durationMs}ms${tok}`;
    });
    lines.push(`BY MODEL`);
    lines.push(...modelLines);
  }

  return lines.join("\n");
}

export function printExecutiveSummary(
  trace: TraceFile,
  out: NodeJS.WritableStream = process.stdout,
): void {
  out.write(`\n${formatExecutiveSummary(buildExecutiveSummary(trace))}\n`);
}

/**
 * Compact L1 view: aggregate consecutive same type+name+depth; optionally
 * auto-compact large traces to errors + slowest + aggregates only.
 */
export function formatCompactEvents(events: TraceEvent[], options: CompactOptions = {}): string[] {
  const verbose = options.verbose === true;

  if (verbose) {
    return events.map((event) => formatEventLine(event));
  }

  const aggregated = aggregateConsecutive(events);
  const heavy = events.length > AUTO_COMPACT_STEP_THRESHOLD;

  if (!heavy) {
    return aggregated.map((row) => formatAggregateLine(row));
  }

  // Large traces: repeat aggregates, errors, and top slow steps.
  const errorRows = aggregated.filter((row) => row.type === "error" || row.error !== undefined);
  const slowIndividuals = [...events].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5);

  const lines: string[] = [
    chalk.dim(
      `(auto-compact: ${events.length} steps → aggregates + errors + top slow; use --verbose for full tree)`,
    ),
  ];

  for (const row of aggregated) {
    if (row.count > 1) {
      lines.push(formatAggregateLine(row));
    }
  }

  for (const row of errorRows) {
    if (row.count === 1) {
      lines.push(formatAggregateLine(row));
    }
  }

  lines.push(chalk.bold("TOP SLOW"));
  for (const event of slowIndividuals) {
    lines.push(formatEventLine(event));
  }

  return [...new Set(lines)];
}

interface AggregateRow {
  depth: number;
  type: TraceEventType;
  name: string;
  count: number;
  durationMs: number;
  error?: string;
  sample?: TraceEvent;
}

function aggregateConsecutive(events: TraceEvent[]): AggregateRow[] {
  const rows: AggregateRow[] = [];
  for (const event of events) {
    const last = rows[rows.length - 1];
    if (
      last &&
      last.depth === event.depth &&
      last.type === event.type &&
      last.name === event.name
    ) {
      last.count += 1;
      last.durationMs += event.durationMs;
      if (event.error !== undefined) last.error = event.error;
      continue;
    }
    const row: AggregateRow = {
      depth: event.depth,
      type: event.type,
      name: event.name,
      count: 1,
      durationMs: event.durationMs,
      sample: event,
    };
    if (event.error !== undefined) row.error = event.error;
    rows.push(row);
  }
  return rows;
}

function formatAggregateLine(row: AggregateRow): string {
  if (row.count === 1 && row.sample) {
    return formatEventLine(row.sample);
  }
  const indent = "  ".repeat(Math.max(0, row.depth));
  const label = chalk.cyan(`[${row.type}] ${row.name} ×${row.count}`);
  const duration = chalk.dim(`${row.durationMs}ms (agg)`);
  return `${indent}${label}  ${duration}`;
}

export function printCompactEvents(
  events: TraceEvent[],
  options: CompactOptions = {},
  out: NodeJS.WritableStream = process.stdout,
): void {
  for (const line of formatCompactEvents(events, options)) {
    out.write(`${line}\n`);
  }
}
