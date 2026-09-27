import { describe, expect, it } from "vitest";
import { compareTraces } from "../../src/diff/compare-traces.js";
import { formatTraceDiff } from "../../src/diff/format-diff.js";
import type { TraceEvent, TraceFile } from "../../src/types/trace.js";

function event(
  step: number,
  name: string,
  type: TraceEvent["type"] = "node",
  output: unknown = { v: step },
): TraceEvent {
  return {
    id: `e${step}`,
    step,
    type,
    name,
    timestamp: "2026-09-27T00:00:00.000Z",
    durationMs: step,
    depth: 0,
    output,
  };
}

function trace(events: TraceEvent[]): TraceFile {
  return {
    version: 1,
    runtime: "manual",
    entrypoint: "./x.ts",
    startedAt: "2026-09-27T00:00:00.000Z",
    endedAt: "2026-09-27T00:00:01.000Z",
    events,
    summary: { steps: events.length, durationMs: events.length * 10 },
  };
}

describe("formatTraceDiff", () => {
  it("omits unchanged steps by default (no spam)", () => {
    const left = trace([event(1, "plan", "node", { a: 1 }), event(2, "answer", "node", { a: 1 })]);
    const right = trace([event(1, "plan", "node", { a: 1 }), event(2, "answer", "node", { a: 2 })]);
    const formatted = formatTraceDiff(compareTraces(left, right));
    expect(formatted.stepLines.some((l) => l.includes("unchanged"))).toBe(false);
    expect(formatted.stepLines.some((l) => l.startsWith("~ ") && l.includes("answer"))).toBe(true);
    expect(formatted.totalStepChanges).toBe(1);
  });

  it("truncates when step-changes exceed the budget and hints --full", () => {
    const leftEvents = Array.from({ length: 60 }, (_, i) => event(i + 1, `n${i}`));
    const rightEvents = leftEvents.map((e, i) => event(e.step, e.name, "node", { v: i + 100 }));
    const formatted = formatTraceDiff(compareTraces(trace(leftEvents), trace(rightEvents)), {
      maxStepChanges: 50,
    });
    expect(formatted.truncatedSteps).toBe(10);
    expect(formatted.stepLines.at(-1)).toBe("… +10 more (use --full)");
    expect(formatted.stepLines.filter((l) => l.startsWith("~ "))).toHaveLength(50);
  });

  it("with --full shows unchanged and does not truncate", () => {
    const left = trace([event(1, "plan", "node", { a: 1 }), event(2, "answer", "node", { a: 1 })]);
    const right = trace([event(1, "plan", "node", { a: 1 }), event(2, "answer", "node", { a: 2 })]);
    const formatted = formatTraceDiff(compareTraces(left, right), { full: true });
    expect(formatted.truncatedSteps).toBe(0);
    expect(formatted.stepLines.some((l) => l.includes("unchanged"))).toBe(true);
    expect(formatted.stepLines.some((l) => l.startsWith("~ "))).toBe(true);
  });

  it("truncates long final output lines", () => {
    const long = "x".repeat(400);
    const left = trace([event(1, "answer", "node", long)]);
    const right = trace([event(1, "answer", "node", `${long}y`)]);
    const formatted = formatTraceDiff(compareTraces(left, right), { maxOutputChars: 40 });
    expect(formatted.outputLines[0]?.length).toBeLessThanOrEqual(42);
    expect(formatted.outputLines[0]?.endsWith("…")).toBe(true);
  });
});
