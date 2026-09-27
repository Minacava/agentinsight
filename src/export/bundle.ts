import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import {
  evaluateAssertions,
  parseAssertionFile,
  type AssertionResult,
} from "../check/assertions.js";
import { finalOutputOf } from "../diff/compare-traces.js";
import { buildExecutiveSummary, formatExecutiveSummary } from "../render/views.js";
import { redactTracePayload, type RedactProfile } from "../security/redact.js";
import type { TraceFile } from "../types/trace.js";

function formatPlainExecutiveSummary(trace: TraceFile): string {
  const previousLevel = chalk.level;
  chalk.level = 0;
  try {
    return formatExecutiveSummary(buildExecutiveSummary(trace));
  } finally {
    chalk.level = previousLevel;
  }
}

export interface ExportBundleOptions {
  outDir: string;
  profile?: RedactProfile;
  /** Raw assertion JSON object, already parsed. */
  asserts?: unknown;
}

export interface ExportBundleResult {
  outDir: string;
  files: string[];
  assertionResult?: AssertionResult;
}

export async function writeAuditBundle(
  trace: TraceFile,
  options: ExportBundleOptions,
): Promise<ExportBundleResult> {
  const profile = options.profile ?? "default";
  const outDir = path.resolve(options.outDir);
  await mkdir(outDir, { recursive: true });

  const safe = redactTracePayload(trace, profile);
  const summaryText = formatPlainExecutiveSummary(safe);

  const files: string[] = [];

  const tracePath = path.join(outDir, "trace.json");
  await writeFile(tracePath, `${JSON.stringify(safe, null, 2)}\n`, "utf8");
  files.push(tracePath);

  const summaryPath = path.join(outDir, "summary.txt");
  await writeFile(summaryPath, `${summaryText}\n`, "utf8");
  files.push(summaryPath);

  let assertionResult: AssertionResult | undefined;
  if (options.asserts !== undefined) {
    const asserts = parseAssertionFile(options.asserts);
    assertionResult = evaluateAssertions(safe, finalOutputOf(safe), asserts);
    const assertPath = path.join(outDir, "assertions.json");
    await writeFile(
      assertPath,
      `${JSON.stringify(
        {
          passed: assertionResult.passed,
          checked: assertionResult.checked,
          failures: assertionResult.failures,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    files.push(assertPath);
  }

  return {
    outDir,
    files,
    ...(assertionResult ? { assertionResult } : {}),
  };
}
