import chalk from "chalk";
import type { Command } from "commander";
import { compareTraces, formatOutputDiff, type MetricPresence } from "../diff/compare-traces.js";
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

export function registerDiffCommand(program: Command): void {
  program
    .command("diff")
    .description("Compare two saved trace JSON files")
    .argument("<run1>", "Path to the baseline trace JSON")
    .argument("<run2>", "Path to the comparison trace JSON")
    .action(async (run1: string, run2: string) => {
      try {
        const left = await loadTrace(run1);
        const right = await loadTrace(run2);
        const result = compareTraces(left, right);

        console.log(chalk.bold("Step changes"));
        let shown = 0;
        for (const step of result.steps) {
          if (step.status === "unchanged") continue;
          shown += 1;
          if (step.status === "added") {
            const ev = step.right!;
            console.log(
              chalk.green(`  + [${ev.type}] ${ev.name}  (step ${ev.step}, ${ev.durationMs}ms)`),
            );
          } else if (step.status === "removed") {
            const ev = step.left!;
            console.log(
              chalk.red(`  - [${ev.type}] ${ev.name}  (step ${ev.step}, ${ev.durationMs}ms)`),
            );
          } else {
            const ev = step.right ?? step.left!;
            console.log(
              chalk.yellow(`  ~ [${ev.type}] ${ev.name}  output changed (step ${ev.step})`),
            );
          }
        }
        if (shown === 0) {
          console.log(chalk.dim("  (no step additions, removals, or output changes)"));
        }

        console.log();
        console.log(chalk.bold("Summary deltas"));
        printMetric("  duration", result.duration, (n) => `${n}ms`);
        printMetric("  cost", result.cost, (n) => `$${n.toFixed(6)}`);
        printMetric("  tokens.total", result.tokensTotal);

        console.log();
        console.log(chalk.bold("Final output"));
        for (const line of formatOutputDiff(result.finalOutput.left, result.finalOutput.right)) {
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
