import { readFile } from "node:fs/promises";
import path from "node:path";
import chalk from "chalk";
import type { Command } from "commander";
import { writeAuditBundle } from "../export/bundle.js";
import { loadTrace } from "../persist/trace-store.js";
import { parseRedactProfile } from "../security/redact.js";

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("Export a redacted audit bundle (trace.json + summary.txt)")
    .argument("<file>", "Path to a saved trace JSON")
    .option("-o, --out <dir>", "Output directory for the bundle", "agentinsight-export")
    .option("--redact <profile>", "Redaction profile: default | pii", "default")
    .option("--assert <file>", "Optional assertion JSON to include evaluation results")
    .action(async (file: string, opts: { out: string; redact?: string; assert?: string }) => {
      try {
        const trace = await loadTrace(file);
        const profile = parseRedactProfile(opts.redact);
        let asserts: unknown;
        if (opts.assert) {
          asserts = JSON.parse(await readFile(opts.assert, "utf8")) as unknown;
        }

        const result = await writeAuditBundle(trace, {
          outDir: opts.out,
          profile,
          ...(asserts !== undefined ? { asserts } : {}),
        });

        console.log(chalk.bold("Audit bundle written"));
        console.log(`  dir: ${path.resolve(result.outDir)}`);
        for (const f of result.files) {
          console.log(`  - ${path.relative(process.cwd(), f) || f}`);
        }
        if (result.assertionResult) {
          const label = result.assertionResult.passed ? chalk.green("PASS") : chalk.red("FAIL");
          console.log(`  assertions: ${label} (${result.assertionResult.checked.length} checked)`);
          if (!result.assertionResult.passed) {
            process.exitCode = 1;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Error: ${message}`);
        process.exitCode = 1;
      }
    });
}
