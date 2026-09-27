import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { TraceFile, TraceMeta } from "../types/trace.js";
import { redactValue } from "../security/redact.js";

export const TRACE_DIR_NAME = ".agentinsight";

export function resolveTraceDir(cwd: string = process.cwd()): string {
  return path.resolve(cwd, TRACE_DIR_NAME);
}

function timestampFilename(date = new Date()): string {
  return `${date.toISOString().replace(/[:.]/g, "-")}.json`;
}

export async function saveTrace(trace: TraceFile, cwd: string = process.cwd()): Promise<string> {
  const dir = resolveTraceDir(cwd);
  await mkdir(dir, { recursive: true });

  const safe = redactValue(trace) as TraceFile;
  const filePath = path.join(dir, timestampFilename());
  await writeFile(filePath, `${JSON.stringify(safe, null, 2)}\n`, "utf8");

  const latestPath = path.join(dir, "latest.json");
  await writeFile(latestPath, `${JSON.stringify(safe, null, 2)}\n`, "utf8");

  return filePath;
}

export async function loadTrace(filePath: string): Promise<TraceFile> {
  const raw = await readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as TraceFile;
  if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
    throw new Error(`Invalid trace file: ${filePath}`);
  }
  return parsed;
}

export interface TraceListItem {
  file: string;
  startedAt: string;
  durationMs: number;
  costUsd?: number;
  runtime: string;
  steps: number;
  meta?: TraceMeta;
}

export interface ListTracesOptions {
  tag?: string;
  env?: string;
  agent?: string;
  limit?: number;
}

export async function listTraces(
  cwd: string = process.cwd(),
  options: ListTracesOptions = {},
): Promise<TraceListItem[]> {
  const dir = resolveTraceDir(cwd);
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw err;
  }

  const items: TraceListItem[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || name === "latest.json") continue;
    const full = path.join(dir, name);
    try {
      const trace = await loadTrace(full);
      const meta = trace.meta;
      if (options.tag && !(meta?.tags ?? []).includes(options.tag)) continue;
      if (options.env && meta?.env !== options.env) continue;
      if (options.agent && meta?.agent !== options.agent) continue;
      items.push({
        file: full,
        startedAt: trace.startedAt,
        durationMs: trace.summary.durationMs,
        ...(trace.summary.costUsd !== undefined ? { costUsd: trace.summary.costUsd } : {}),
        runtime: String(trace.runtime),
        steps: trace.summary.steps,
        ...(meta ? { meta } : {}),
      });
    } catch {
      // Skip corrupt files rather than failing the whole list.
    }
  }

  items.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  if (options.limit !== undefined && options.limit >= 0) {
    return items.slice(0, options.limit);
  }
  return items;
}
