import type { Command } from "commander";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { addFocusOptions, focusFromOpts } from "../cli/focus-options.js";
import { loadTrace } from "../persist/trace-store.js";
import { hasFocusFilters, selectFocusedEvents } from "../render/focus.js";
import { printEvent } from "../render/formatter.js";
import {
  AUTO_COMPACT_STEP_THRESHOLD,
  printCompactEvents,
  printExecutiveSummary,
} from "../render/views.js";

async function waitForEnter(): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    await rl.question("");
  } finally {
    rl.close();
  }
}

export function registerReplayCommand(program: Command): void {
  const cmd = program
    .command("replay")
    .description("Replay a saved trace in the terminal without calling an LLM")
    .argument("<trace-file>", "Path to a .agentinsight JSON trace")
    .option("--step", "Advance one event at a time (press Enter)", false)
    .option("--verbose", "Print every event line (disable auto-compact for large traces)", false)
    .option("--compact", "Force compact aggregation even for small traces", false);

  addFocusOptions(cmd).action(
    async (
      traceFile: string,
      opts: {
        step?: boolean;
        verbose?: boolean;
        compact?: boolean;
        only?: string;
        slow?: number;
        name?: string;
        depth?: number;
        model?: string;
      },
    ) => {
      try {
        const trace = await loadTrace(traceFile);
        const verbose = opts.verbose === true;
        const focus = focusFromOpts(opts);
        const focusing = hasFocusFilters(focus);
        const displayEvents = focusing ? selectFocusedEvents(trace.events, focus) : trace.events;

        if (focusing) {
          output.write(`(focus: showing ${displayEvents.length}/${trace.events.length} events)\n`);
        }

        const useCompactView =
          !opts.step &&
          !verbose &&
          (opts.compact === true || displayEvents.length > AUTO_COMPACT_STEP_THRESHOLD);

        if (useCompactView) {
          printCompactEvents(displayEvents, { verbose: false });
        } else {
          for (const event of displayEvents) {
            printEvent(event);
            if (opts.step) {
              output.write("Press Enter for next step…");
              await waitForEnter();
            }
          }
        }

        printExecutiveSummary(trace);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    },
  );
}
