import type { Command } from "commander";
import type { FocusOptions } from "../render/focus.js";

/** Shared focus flags for run / replay. */
export function addFocusOptions(command: Command): Command {
  return command
    .option(
      "--only <types>",
      "Show only these event types (comma-separated: node,tool,message,model,error,span)",
    )
    .option("--slow <ms>", "Show only events with duration >= ms", (v) => {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) {
        throw new Error("--slow must be a non-negative number");
      }
      return n;
    })
    .option("--name <substr>", "Show only events whose name contains substr")
    .option("--depth <max>", "Show only events with depth <= max", (v) => {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) {
        throw new Error("--depth must be a non-negative integer");
      }
      return n;
    })
    .option("--model <substr>", "Show only model-like events whose name contains substr");
}

export function focusFromOpts(opts: {
  only?: string;
  slow?: number;
  name?: string;
  depth?: number;
  model?: string;
}): FocusOptions {
  const focus: FocusOptions = {};
  if (opts.only !== undefined) focus.only = opts.only;
  if (opts.slow !== undefined) focus.slow = opts.slow;
  if (opts.name !== undefined) focus.name = opts.name;
  if (opts.depth !== undefined) focus.depth = opts.depth;
  if (opts.model !== undefined) focus.model = opts.model;
  return focus;
}
