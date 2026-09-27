import chalk from "chalk";
import type { TraceEvent } from "../types/trace.js";

function colorForType(type: TraceEvent["type"]): (text: string) => string {
  switch (type) {
    case "tool":
      return chalk.cyan;
    case "error":
      return chalk.red;
    case "model":
      return chalk.magenta;
    case "message":
      return chalk.blue;
    case "node":
      return chalk.green;
    case "retrieval":
      return chalk.yellow;
    default:
      return chalk.white;
  }
}

function summarizePayload(value: unknown, max = 80): string {
  if (value === undefined) return "";
  let text: string;
  try {
    text = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    text = String(value);
  }
  if (text.length > max) {
    return `${text.slice(0, max - 1)}…`;
  }
  return text;
}

export function formatEventLine(event: TraceEvent): string {
  const indent = "  ".repeat(Math.max(0, event.depth));
  const paint = colorForType(event.type);
  const label = paint(`[${event.type}] ${event.name}`);
  const duration = chalk.dim(`${event.durationMs}ms`);
  const summary = event.error
    ? chalk.red(summarizePayload(event.error))
    : chalk.gray(summarizePayload(event.output ?? event.input));

  const parts = [`${indent}${label}`, duration];
  if (summary) parts.push(summary);
  if (event.tokens?.total !== undefined) {
    parts.push(chalk.dim(`${event.tokens.total} tok`));
  }
  if (event.costUsd !== undefined) {
    parts.push(chalk.dim(`$${event.costUsd.toFixed(4)}`));
  }
  return parts.join("  ");
}

export function printEvent(event: TraceEvent, out: NodeJS.WritableStream = process.stdout): void {
  out.write(`${formatEventLine(event)}\n`);
}
