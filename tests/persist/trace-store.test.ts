import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listTraces, loadTrace, saveTrace } from "../../src/persist/trace-store.js";
import type { TraceFile } from "../../src/types/trace.js";

describe("trace-store", () => {
  it("saves a redacted parseable trace and lists it", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agentinsight-"));
    const trace: TraceFile = {
      version: 1,
      runtime: "manual",
      entrypoint: "./x.ts",
      startedAt: "2026-09-27T00:00:00.000Z",
      endedAt: "2026-09-27T00:00:01.000Z",
      events: [
        {
          id: "1",
          step: 1,
          type: "node",
          name: "n",
          timestamp: "2026-09-27T00:00:00.000Z",
          durationMs: 10,
          depth: 0,
          input: { apiKey: "sk-should-not-persist-plaintext" },
        },
      ],
      summary: { steps: 1, durationMs: 10, costUsd: 0.01 },
    };

    const filePath = await saveTrace(trace, cwd);
    const raw = await readFile(filePath, "utf8");
    expect(raw).toContain("[REDACTED]");
    expect(raw).not.toContain("sk-should-not-persist-plaintext");

    const loaded = await loadTrace(filePath);
    expect(loaded.summary.steps).toBe(1);

    const listed = await listTraces(cwd);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.costUsd).toBe(0.01);
  });
});
