import chalk from "chalk";
import type { Command } from "commander";
import { compareTraces, type MetricPresence } from "../diff/compare-traces.js";
import { formatTraceDiff } from "../diff/format-diff.js";
import { loadTrace } from "../persist/trace-store.js";

function printMetric(
  label: string,
  metric: MetricPresence<number>,
  format: (n: number) => string = (n) => String(n),
): void {
  if (metric.status === "neither") {
    console.log(`${label}: ${chalk.dim("not reported in either run")}`);
    return;
  }
  if (metric.status === "asymmetric") {
    const left = metric.left === undefined ? "not reported" : format(metric.left);
    const right = metric.right === undefined ? "not reported" : format(metric.right);
    console.log(`${label}: ${chalk.yellow("asymmetric")} (run1=${left}, run2=${right})`);
    return;
  }
  const sign = metric.delta > 0 ? "+" : "";
  console.log(
    `${label}: ${sign}${format(metric.delta)} (run1=${format(metric.left)}, run2=${format(metric.right)})`,
  );
}

function colorStepLine(line: string): string {
  if (line.startsWith("+ ")) return chalk.green(line);
  if (line.startsWith("- ")) return chalk.red(line);
  if (line.startsWith("~ ")) return chalk.yellow(line);
  if (line.startsWith("… ")) return chalk.dim(line);
  if (line.startsWith("(no ")) return chalk.dim(line);
  return chalk.dim(line);
}

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Compare two saved trace JSON files")
    .argument("<run1>", "Path to the baseline trace JSON")
    .argument("<run2>", "Path to the comparison trace JSON")
    .option("--full", "Show all steps (including unchanged) without truncating changes", false)
    .action(async (run1: string, run2: string, opts: { full?: boolean }) => {
      try {
        const left = await loadTrace(run1);
        const right = await loadTrace(run2);
        const result = compareTraces(left, right);
        const formatted = formatTraceDiff(result, { full: opts.full === true });

        console.log(chalk.bold("Step changes"));
        for (const line of formatted.stepLines) {
          console.log(`  ${colorStepLine(line)}`);
        }
        if (!opts.full && formatted.totalStepChanges > 0) {
          console.log(
            chalk.dim(
              `  (${formatted.totalStepChanges} change${formatted.totalStepChanges === 1 ? "" : "s"}; unchanged omitted)`,
            ),
          );
        }

        console.log();
        console.log(chalk.bold("Summary deltas"));
        printMetric("  duration", result.duration, (n) => `${n}ms`);
        printMetric("  cost", result.cost, (n) => `$${n.toFixed(6)}`);
        printMetric("  tokens.total", result.tokensTotal);

        console.log();
        console.log(chalk.bold("Final output"));
        for (const line of formatted.outputLines) {
          if (line.startsWith("- ")) console.log(chalk.red(line));
          else if (line.startsWith("+ ")) console.log(chalk.green(line));
          else console.log(chalk.dim(line));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
