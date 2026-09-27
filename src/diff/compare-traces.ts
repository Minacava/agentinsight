import type { TokenUsage, TraceEvent, TraceFile } from "../types/trace.js";

export type DiffStatus = "unchanged" | "changed" | "added" | "removed";

export interface DiffStep {
  status: DiffStatus;
  key: string;
  left?: TraceEvent;
  right?: TraceEvent;
}

export type MetricPresence<T> =
  | { status: "both"; left: T; right: T; delta: number }
  | { status: "asymmetric"; left: T | undefined; right: T | undefined }
  | { status: "neither" };

export interface TraceDiffResult {
  steps: DiffStep[];
  duration: MetricPresence<number>;
  cost: MetricPresence<number>;
  tokensTotal: MetricPresence<number>;
  finalOutput: {
    left: unknown;
    right: unknown;
    changed: boolean;
  };
}

function eventKey(event: TraceEvent): string {
  return `${event.type}\0${event.name}`;
}

function serializeOutput(value: unknown): string {
  if (value === undefined) return "";
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function finalOutputOf(trace: TraceFile): unknown {
  for (let i = trace.events.length - 1; i >= 0; i -= 1) {
    const event = trace.events[i];
    if (event && event.output !== undefined) return event.output;
  }
  return undefined;
}

function alignByPosition(left: TraceEvent[], right: TraceEvent[]): DiffStep[] {
  const steps: DiffStep[] = [];
  for (let i = 0; i < left.length; i += 1) {
    const l = left[i]!;
    const r = right[i]!;
    const same =
      serializeOutput(l.output) === serializeOutput(r.output) &&
      (l.error ?? "") === (r.error ?? "");
    steps.push({
      status: same ? "unchanged" : "changed",
      key: eventKey(l),
      left: l,
      right: r,
    });
  }
  return steps;
}

/**
 * Greedy sequential alignment by type+name when step counts differ.
 */
function alignByNameType(left: TraceEvent[], right: TraceEvent[]): DiffStep[] {
  const steps: DiffStep[] = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    const l = left[i]!;
    const r = right[j]!;
    const lk = eventKey(l);
    const rk = eventKey(r);

    if (lk === rk) {
      const same =
        serializeOutput(l.output) === serializeOutput(r.output) &&
        (l.error ?? "") === (r.error ?? "");
      steps.push({
        status: same ? "unchanged" : "changed",
        key: lk,
        left: l,
        right: r,
      });
      i += 1;
      j += 1;
      continue;
    }

    // Look ahead: if left's key appears later in right, current right is an insertion.
    const rIdx = right.findIndex((ev, idx) => idx > j && eventKey(ev) === lk);
    const lIdx = left.findIndex((ev, idx) => idx > i && eventKey(ev) === rk);

    if (rIdx !== -1 && (lIdx === -1 || rIdx - j <= lIdx - i)) {
      steps.push({ status: "added", key: rk, right: r });
      j += 1;
    } else if (lIdx !== -1) {
      steps.push({ status: "removed", key: lk, left: l });
      i += 1;
    } else {
      steps.push({ status: "removed", key: lk, left: l });
      steps.push({ status: "added", key: rk, right: r });
      i += 1;
      j += 1;
    }
  }

  while (i < left.length) {
    const l = left[i]!;
    steps.push({ status: "removed", key: eventKey(l), left: l });
    i += 1;
  }
  while (j < right.length) {
    const r = right[j]!;
    steps.push({ status: "added", key: eventKey(r), right: r });
    j += 1;
  }

  return steps;
}

function metricNumber(left: number | undefined, right: number | undefined): MetricPresence<number> {
  if (left === undefined && right === undefined) return { status: "neither" };
  if (left === undefined || right === undefined) {
    return { status: "asymmetric", left, right };
  }
  return { status: "both", left, right, delta: right - left };
}

function tokensTotal(usage: TokenUsage | undefined): number | undefined {
  if (!usage) return undefined;
  if (usage.total !== undefined) return usage.total;
  if (usage.input === undefined && usage.output === undefined) return undefined;
  return (usage.input ?? 0) + (usage.output ?? 0);
}

export function compareTraces(left: TraceFile, right: TraceFile): TraceDiffResult {
  const steps =
    left.events.length === right.events.length
      ? alignByPosition(left.events, right.events)
      : alignByNameType(left.events, right.events);

  const leftFinal = finalOutputOf(left);
  const rightFinal = finalOutputOf(right);

  return {
    steps,
    duration: metricNumber(left.summary.durationMs, right.summary.durationMs),
    cost: metricNumber(left.summary.costUsd, right.summary.costUsd),
    tokensTotal: metricNumber(tokensTotal(left.summary.tokens), tokensTotal(right.summary.tokens)),
    finalOutput: {
      left: leftFinal,
      right: rightFinal,
      changed: serializeOutput(leftFinal) !== serializeOutput(rightFinal),
    },
  };
}

export function formatOutputDiff(left: unknown, right: unknown): string[] {
  const leftText = serializeOutput(left);
  const rightText = serializeOutput(right);
  if (leftText === rightText) return ["(final output unchanged)"];
  const lines: string[] = [];
  if (leftText) lines.push(`- ${leftText}`);
  if (rightText) lines.push(`+ ${rightText}`);
  return lines;
}
