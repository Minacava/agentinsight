import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { compareTraces, formatOutputDiff } from "../../src/diff/compare-traces.js";
import type { TraceFile } from "../../src/types/trace.js";

async function loadFixture(name: string): Promise<TraceFile> {
  const file = path.join(process.cwd(), "tests/fixtures/diff", name);
  return JSON.parse(await readFile(file, "utf8")) as TraceFile;
}

describe("compareTraces", () => {
  it("detects an added step, duration delta, and final output change", async () => {
    const base = await loadFixture("base.json");
    const changed = await loadFixture("changed.json");
    const result = compareTraces(base, changed);

    const added = result.steps.filter((s) => s.status === "added");
    expect(added).toHaveLength(1);
    expect(added[0]?.right?.name).toBe("lookup");

    const answer = result.steps.find((s) => s.status === "changed" && s.left?.name === "answer");
    expect(answer).toBeTruthy();

    expect(result.duration.status).toBe("both");
    if (result.duration.status === "both") {
      expect(result.duration.delta).toBe(80);
    }

    expect(result.cost.status).toBe("neither");
    expect(result.finalOutput.changed).toBe(true);
    const lines = formatOutputDiff(result.finalOutput.left, result.finalOutput.right);
    expect(lines.some((l) => l.startsWith("- "))).toBe(true);
    expect(lines.some((l) => l.startsWith("+ "))).toBe(true);
  });

  it("reports asymmetric cost when only one run has costUsd", () => {
    const base: TraceFile = {
      version: 1,
      runtime: "manual",
      entrypoint: "a",
      startedAt: "2026-09-27T00:00:00.000Z",
      endedAt: "2026-09-27T00:00:01.000Z",
      events: [],
      summary: { steps: 0, durationMs: 10 },
    };
    const other: TraceFile = {
      ...base,
      summary: { steps: 0, durationMs: 12, costUsd: 0.01 },
    };
    const result = compareTraces(base, other);
    expect(result.cost.status).toBe("asymmetric");
  });
});
