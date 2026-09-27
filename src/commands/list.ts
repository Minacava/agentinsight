import chalk from "chalk";
import type { Command } from "commander";
import { listTraces } from "../persist/trace-store.js";

function pad(value: string, width: number): string {
  if (value.length >= width) return value.slice(0, width);
  return value + " ".repeat(width - value.length);
}

export function registerListCommand(program: Command): void {
  program
    .command("list")
    .description("List saved traces in .agentinsight/ (newest first)")
    .action(async () => {
      try {
        const items = await listTraces();
        if (items.length === 0) {
          console.log("No traces found in .agentinsight/");
          return;
        }

        const header = [
          pad("DATE", 24),
          pad("DURATION", 10),
          pad("COST", 10),
          pad("STEPS", 6),
          pad("RUNTIME", 16),
          "FILE",
        ].join("  ");
        console.log(chalk.bold(header));

        for (const item of items) {
          const line = [
            pad(item.startedAt, 24),
            pad(`${item.durationMs}ms`, 10),
            pad(item.costUsd !== undefined ? `$${item.costUsd.toFixed(4)}` : "-", 10),
            pad(String(item.steps), 6),
            pad(item.runtime, 16),
            item.file,
          ].join("  ");
          console.log(line);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
