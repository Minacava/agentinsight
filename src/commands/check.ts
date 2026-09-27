import { readFile } from "node:fs/promises";
import chalk from "chalk";
import type { Command } from "commander";
import { evaluateAssertions, parseAssertionFile } from "../check/assertions.js";
import { finalOutputOf } from "../diff/compare-traces.js";
import { executeEntrypoint } from "../run/execute.js";

export function registerCheckCommand(program: Command): void {
  program
    .command("check")
    .description("Run an agent and evaluate JSON assertions (CI-friendly; quiet by default)")
    .argument("<entrypoint>", "Path to the agent module (TS/JS)")
    .requiredOption(
      "--assert <file>",
      "Path to a JSON assertion file (maxSteps, noErrors, outputContains, …)",
    )
    .option("-t, --type <runtime>", "Force runtime: langgraph | claude | claude-agent-sdk | manual")
    .option("--quiet", "Omit live trace output (default: true)", true)
    .option("--no-quiet", "Print the live trace while checking")
    .option("--persist", "Also save a trace under .agentinsight/", false)
    .action(
      async (
        entrypoint: string,
        opts: {
          assert: string;
          type?: string;
          quiet?: boolean;
          persist?: boolean;
        },
      ) => {
        try {
          const raw = JSON.parse(await readFile(opts.assert, "utf8")) as unknown;
          const asserts = parseAssertionFile(raw);

          const { trace, output } = await executeEntrypoint(entrypoint, {
            ...(opts.type !== undefined ? { type: opts.type } : {}),
            quiet: opts.quiet !== false,
            persist: opts.persist === true,
          });

          const finalOutput = output ?? finalOutputOf(trace);
          const result = evaluateAssertions(trace, finalOutput, asserts);

          if (result.checked.length === 0) {
            console.log(chalk.yellow("No assertions present in file; nothing to validate."));
            process.exitCode = 0;
            return;
          }

          if (result.passed) {
            console.log(
              chalk.green(
                `PASS (${result.checked.length} assertion${result.checked.length === 1 ? "" : "s"})`,
              ),
            );
            for (const rule of result.checked) {
              console.log(chalk.green(`  ✓ ${rule}`));
            }
            process.exitCode = 0;
            return;
          }

          console.log(chalk.red(`FAIL (${result.failures.length} assertion(s))`));
          for (const failure of result.failures) {
            console.log(chalk.red(`  ✗ ${failure.rule}`));
            console.log(`      expected: ${failure.expected}`);
            console.log(`      actual:   ${failure.actual}`);
          }
          const passed = result.checked.filter(
            (rule) => !result.failures.some((f) => f.rule === rule),
          );
          for (const rule of passed) {
            console.log(chalk.green(`  ✓ ${rule}`));
          }
          process.exitCode = 1;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Error: ${message}`);
          process.exitCode = 1;
        }
      },
    );
}
