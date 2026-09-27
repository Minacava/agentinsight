import type { Command } from "commander";
import { addFocusOptions, focusFromOpts } from "../cli/focus-options.js";
import { executeEntrypoint } from "../run/execute.js";
import { parseRedactProfile } from "../security/redact.js";
import type { TraceMeta } from "../types/trace.js";

function buildMeta(opts: {
  tag?: string[];
  env?: string;
  sessionId?: string;
  agent?: string;
}): TraceMeta | undefined {
  const meta: TraceMeta = {};
  if (opts.tag && opts.tag.length > 0) meta.tags = opts.tag;
  if (opts.env !== undefined) meta.env = opts.env;
  if (opts.sessionId !== undefined) meta.sessionId = opts.sessionId;
  if (opts.agent !== undefined) meta.agent = opts.agent;
  return Object.keys(meta).length ? meta : undefined;
}

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
    .option("--verbose", "Disable aggregation / auto-compact in compact mode", false)
    .option(
      "--tag <tag>",
      "Attach a tag to the saved trace (repeatable)",
      (value: string, prev: string[]) => {
        prev.push(value);
        return prev;
      },
      [] as string[],
    )
    .option("--env <env>", "Environment label stored on the trace (e.g. staging)")
    .option("--session-id <id>", "Session id stored on the trace")
    .option("--agent <name>", "Agent name stored on the trace (e.g. router)")
    .option("--redact <profile>", "Redaction profile when persisting: default|pii", "default");

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
        tag?: string[];
        env?: string;
        sessionId?: string;
        agent?: string;
        redact?: string;
      },
    ) => {
      try {
        const meta = buildMeta(opts);
        await executeEntrypoint(entrypoint, {
          ...(opts.type !== undefined ? { type: opts.type } : {}),
          persist: opts.persist !== false,
          compact: opts.compact === true,
          verbose: opts.verbose === true,
          focus: focusFromOpts(opts),
          redact: parseRedactProfile(opts.redact),
          ...(meta ? { meta } : {}),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    },
  );
}
