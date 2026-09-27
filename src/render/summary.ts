import chalk from "chalk";
import type { TraceSummary } from "../types/trace.js";

export function formatSummary(summary: TraceSummary): string {
  const lines = [
    chalk.bold("Summary"),
    `  steps:    ${summary.steps}`,
    `  duration: ${summary.durationMs}ms`,
  ];
  if (summary.costUsd !== undefined) {
    lines.push(`  cost:     $${summary.costUsd.toFixed(6)}`);
  }
  if (summary.tokens) {
    const { input, output, total } = summary.tokens;
    const parts = [
      input !== undefined ? `in=${input}` : undefined,
      output !== undefined ? `out=${output}` : undefined,
      total !== undefined ? `total=${total}` : undefined,
    ].filter(Boolean);
    if (parts.length) lines.push(`  tokens:   ${parts.join(" ")}`);
  }
  return lines.join("\n");
}

export function printSummary(
  summary: TraceSummary,
  out: NodeJS.WritableStream = process.stdout,
): void {
  out.write(`\n${formatSummary(summary)}\n`);
}
