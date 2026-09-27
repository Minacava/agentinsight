import type { Command } from "commander";
import { addFocusOptions, focusFromOpts } from "../cli/focus-options.js";
import { executeEntrypoint } from "../run/execute.js";

export function registerRunCommand(program: Command): void {
  const cmd = program
    .command("run")
    .description("Execute an agent entrypoint and print a live execution trace")
    .argument("<entrypoint>", "Path to the agent module (TS/JS)")
    .option("-t, --type <runtime>", "Force runtime: langgraph | claude | claude-agent-sdk | manual")
    .option("--no-persist", "Do not write a trace file under .agentinsight/")
    .option(
      "--compact",
      "Buffer events and print a compact L1 tree at the end (better for large runs)",
      false,
    )
    .option("--verbose", "Disable aggregation / auto-compact in compact mode", false);

  addFocusOptions(cmd).action(
    async (
      entrypoint: string,
      opts: {
        type?: string;
        persist?: boolean;
        compact?: boolean;
        verbose?: boolean;
        only?: string;
        slow?: number;
        name?: string;
        depth?: number;
        model?: string;
      },
    ) => {
      try {
        await executeEntrypoint(entrypoint, {
          ...(opts.type !== undefined ? { type: opts.type } : {}),
          persist: opts.persist !== false,
          compact: opts.compact === true,
          verbose: opts.verbose === true,
          focus: focusFromOpts(opts),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    },
  );
}
