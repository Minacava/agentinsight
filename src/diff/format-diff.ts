import type { DiffStep, TraceDiffResult } from "./compare-traces.js";

export const DEFAULT_MAX_STEP_CHANGES = 50;
export const DEFAULT_MAX_OUTPUT_CHARS = 200;

export interface FormatDiffOptions {
  /** Include unchanged steps in the step list. */
  full?: boolean;
  /** Max changed/added/removed rows before truncation (ignored when full). */
  maxStepChanges?: number;
  /** Truncate each final-output line beyond this length. */
  maxOutputChars?: number;
}

export interface FormattedDiff {
  stepLines: string[];
  truncatedSteps: number;
  shownStepChanges: number;
  totalStepChanges: number;
  outputLines: string[];
}

function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function stepLine(step: DiffStep): string {
  if (step.status === "added") {
    const ev = step.right!;
    return `+ [${ev.type}] ${ev.name}  (step ${ev.step}, ${ev.durationMs}ms)`;
  }
  if (step.status === "removed") {
    const ev = step.left!;
    return `- [${ev.type}] ${ev.name}  (step ${ev.step}, ${ev.durationMs}ms)`;
  }
  if (step.status === "changed") {
    const ev = step.right ?? step.left!;
    return `~ [${ev.type}] ${ev.name}  output changed (step ${ev.step})`;
  }
  const ev = step.right ?? step.left!;
  return `  [${ev.type}] ${ev.name}  (step ${ev.step}, unchanged)`;
}

/**
 * Compact terminal view of a trace diff: deltas by default, optional --full,
 * and truncation when step-changes exceed the budget.
 */
export function formatTraceDiff(
  result: TraceDiffResult,
  options: FormatDiffOptions = {},
): FormattedDiff {
  const full = options.full === true;
  const maxStepChanges = options.maxStepChanges ?? DEFAULT_MAX_STEP_CHANGES;
  const maxOutputChars = options.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;

  const candidates = full ? result.steps : result.steps.filter((s) => s.status !== "unchanged");
  const totalStepChanges = result.steps.filter((s) => s.status !== "unchanged").length;

  let shown = candidates;
  let truncatedSteps = 0;
  if (!full && candidates.length > maxStepChanges) {
    shown = candidates.slice(0, maxStepChanges);
    truncatedSteps = candidates.length - maxStepChanges;
  }

  const stepLines = shown.map(stepLine);
  if (truncatedSteps > 0) {
    stepLines.push(`… +${truncatedSteps} more (use --full)`);
  }
  if (stepLines.length === 0) {
    stepLines.push("(no step additions, removals, or output changes)");
  }

  const rawOutput = formatOutputLines(result.finalOutput.left, result.finalOutput.right);
  const outputLines = rawOutput.map((line) => {
    if (line.startsWith("- ") || line.startsWith("+ ")) {
      const prefix = line.slice(0, 2);
      return `${prefix}${truncateText(line.slice(2), maxOutputChars)}`;
    }
    return line;
  });

  return {
    stepLines,
    truncatedSteps,
    shownStepChanges: shown.filter((s) => s.status !== "unchanged").length,
    totalStepChanges,
    outputLines,
  };
}

function formatOutputLines(left: unknown, right: unknown): string[] {
  const leftText = serialize(left);
  const rightText = serialize(right);
  if (leftText === rightText) return ["(final output unchanged)"];
  const lines: string[] = [];
  if (leftText) lines.push(`- ${leftText}`);
  if (rightText) lines.push(`+ ${rightText}`);
  return lines;
}

function serialize(value: unknown): string {
  if (value === undefined) return "";
  try {
    return typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}
