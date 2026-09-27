import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeAuditBundle } from "../../src/export/bundle.js";
import { loadTrace } from "../../src/persist/trace-store.js";

const dirs: string[] = [];

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe("writeAuditBundle", () => {
  it("writes redacted trace.json + summary.txt without fixture secrets", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "agentinsight-export-"));
    dirs.push(outDir);

    const trace = await loadTrace("tests/fixtures/export/secret-trace.json");
    const result = await writeAuditBundle(trace, { outDir, profile: "pii" });

    expect(result.files.map((f) => path.basename(f)).sort()).toEqual(["summary.txt", "trace.json"]);

    const json = await readFile(path.join(outDir, "trace.json"), "utf8");
    expect(json).not.toContain("sk-test-should-not-leak");
    expect(json).not.toContain("Bearer secret-token-value");
    expect(json).not.toContain("ops@example.com");
    expect(json).toContain("[REDACTED]");

    const summary = await readFile(path.join(outDir, "summary.txt"), "utf8");
    expect(summary).toMatch(/SUMMARY/);
    expect(summary).toMatch(/retrieval=/);
  });

  it("includes assertions.json when asserts are provided", async () => {
    const outDir = await mkdtemp(path.join(tmpdir(), "agentinsight-export-"));
    dirs.push(outDir);

    const trace = await loadTrace("tests/fixtures/export/secret-trace.json");
    const result = await writeAuditBundle(trace, {
      outDir,
      asserts: { noErrors: true, requiredSteps: ["answer"] },
    });

    expect(result.assertionResult?.passed).toBe(true);
    const assertRaw = await readFile(path.join(outDir, "assertions.json"), "utf8");
    const parsed = JSON.parse(assertRaw) as { passed: boolean; checked: string[] };
    expect(parsed.passed).toBe(true);
    expect(parsed.checked).toContain("requiredSteps");
  });
});
