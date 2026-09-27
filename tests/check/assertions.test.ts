import { describe, expect, it } from "vitest";
import { evaluateAssertions, parseAssertionFile } from "../../src/check/assertions.js";
import type { TraceFile } from "../../src/types/trace.js";

function sampleTrace(overrides: Partial<TraceFile> = {}): TraceFile {
  return {
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
        name: "answer",
        timestamp: "2026-09-27T00:00:00.000Z",
        durationMs: 5,
        depth: 0,
        output: { finalAnswer: "hello agentinsight" },
      },
    ],
    summary: { steps: 4, durationMs: 40 },
    ...overrides,
  };
}

describe("assertions", () => {
  it("parses optional fields only", () => {
    const asserts = parseAssertionFile({ noErrors: true, maxSteps: 1 });
    expect(asserts).toEqual({ noErrors: true, maxSteps: 1 });
  });

  it("passes noErrors and fails maxSteps with expected vs actual", () => {
    const result = evaluateAssertions(
      sampleTrace(),
      { finalAnswer: "hello agentinsight" },
      { noErrors: true, maxSteps: 1 },
    );
    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.rule).toBe("maxSteps");
    expect(result.failures[0]?.expected).toBe("<= 1");
    expect(result.failures[0]?.actual).toBe("4");
    expect(result.checked).toContain("noErrors");
  });

  it("fails maxCostUsd when runtime does not report cost", () => {
    const result = evaluateAssertions(sampleTrace(), "x", { maxCostUsd: 0.01 });
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.actual).toBe("cost not reported by runtime");
  });

  it("checks outputContains against final output", () => {
    const pass = evaluateAssertions(
      sampleTrace(),
      { finalAnswer: "hello agentinsight" },
      { outputContains: "agentinsight" },
    );
    expect(pass.passed).toBe(true);

    const fail = evaluateAssertions(
      sampleTrace(),
      { finalAnswer: "hello" },
      { outputContains: "agentinsight" },
    );
    expect(fail.passed).toBe(false);
    expect(fail.failures[0]?.rule).toBe("outputContains");
  });

  it("fails requiredSteps when a name is missing", () => {
    const result = evaluateAssertions(sampleTrace(), "x", {
      requiredSteps: ["answer", "missing-node"],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.rule).toBe("requiredSteps");
    expect(result.failures[0]?.actual).toContain("missing-node");
  });

  it("fails maxStepDurationMs when a named step is too slow", () => {
    const result = evaluateAssertions(sampleTrace(), "x", {
      maxStepDurationMs: [{ name: "answer", maxMs: 1 }],
    });
    expect(result.passed).toBe(false);
    expect(result.failures[0]?.rule).toBe("maxStepDurationMs");
    expect(result.failures[0]?.actual).toBe("5ms");
  });
});
