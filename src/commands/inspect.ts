import chalk from "chalk";
import type { Command } from "commander";
import { loadTrace } from "../persist/trace-store.js";
import { redactValue } from "../security/redact.js";
import type { TraceEvent } from "../types/trace.js";

const PAYLOAD_TTY_LIMIT = 8 * 1024;

function formatPayload(value: unknown): string {
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(redactValue(value), null, 2);
  } catch {
    text = String(value);
  }
  if (Buffer.byteLength(text, "utf8") > PAYLOAD_TTY_LIMIT) {
    const truncated = text.slice(0, PAYLOAD_TTY_LIMIT);
    const omitted = Buffer.byteLength(text, "utf8") - PAYLOAD_TTY_LIMIT;
    return `${truncated}\n… (${omitted} bytes omitted; see full trace JSON on disk)`;
  }
  return text;
}

function printEventDetail(event: TraceEvent): void {
  console.log(chalk.bold(`[${event.type}] ${event.name}`));
  console.log(`  id:       ${event.id}`);
  console.log(`  step:     ${event.step}`);
  console.log(`  depth:    ${event.depth}`);
  console.log(`  duration: ${event.durationMs}ms`);
  console.log(`  time:     ${event.timestamp}`);
  if (event.parentId) console.log(`  parent:   ${event.parentId}`);
  if (event.tokens) {
    console.log(`  tokens:   ${JSON.stringify(event.tokens)}`);
  }
  if (event.costUsd !== undefined) {
    console.log(`  cost:     $${event.costUsd} (runtime)`);
  }
  if (event.error !== undefined) {
    console.log(chalk.red(`  error:\n${formatPayload(event.error)}`));
  }
  if (event.input !== undefined) {
    console.log(`  input:\n${formatPayload(event.input)}`);
  }
  if (event.output !== undefined) {
    console.log(`  output:\n${formatPayload(event.output)}`);
  }
}

export function registerInspectCommand(program: Command): void {
  program
    .command("inspect")
    .description("Show full detail for one step in a saved trace")
    .argument("<trace-file>", "Path to a .agentinsight JSON trace")
    .option("--step <n>", "1-based step number", (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) {
        throw new Error("--step must be a positive integer");
      }
      return n;
    })
    .option("--id <eventId>", "Event id")
    .action(async (traceFile: string, opts: { step?: number; id?: string }) => {
      try {
        if (opts.step === undefined && opts.id === undefined) {
          throw new Error("Provide --step <n> or --id <eventId>");
        }
        const trace = await loadTrace(traceFile);
        let event: TraceEvent | undefined;
        if (opts.id !== undefined) {
          event = trace.events.find((e) => e.id === opts.id);
          if (!event) throw new Error(`No event with id ${opts.id}`);
        } else if (opts.step !== undefined) {
          event = trace.events.find((e) => e.step === opts.step);
          if (!event) {
            event = trace.events[opts.step - 1];
          }
          if (!event) {
            throw new Error(
              `No event for step ${opts.step} (${trace.events.length} events in trace)`,
            );
          }
        }
        printEventDetail(event!);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
