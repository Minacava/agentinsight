import type { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadTrace } from "../persist/trace-store.js";
import { printEvent } from "../render/formatter.js";
import { printSummary } from "../render/summary.js";

async function waitForEnter(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    await rl.question("");
  } finally {
    rl.close();
  }
}

export function registerReplayCommand(program: Command): void {
  program
    .command("replay")
    .description("Replay a saved trace in the terminal without calling an LLM")
    .argument("<trace-file>", "Path to a .agentinsight JSON trace")
    .option("--step", "Advance one event at a time (press Enter)", false)
    .action(async (traceFile: string, opts: { step?: boolean }) => {
      try {
        const trace = await loadTrace(traceFile);
        for (const event of trace.events) {
          printEvent(event);
          if (opts.step) {
            output.write("Press Enter for next step…");
            await waitForEnter();
          }
        }
        printSummary(trace.summary);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
