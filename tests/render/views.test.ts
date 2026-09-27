import { describe, expect, it } from "vitest";
import {
  AUTO_COMPACT_STEP_THRESHOLD,
  buildExecutiveSummary,
  formatCompactEvents,
  formatExecutiveSummary,
} from "../../src/render/views.js";
import type { TraceEvent, TraceFile } from "../../src/types/trace.js";

function event(
  partial: Pick<TraceEvent, "step" | "type" | "name" | "durationMs"> & Partial<TraceEvent>,
): TraceEvent {
  return {
    id: `e${partial.step}`,
    timestamp: "2026-09-27T00:00:00.000Z",
    depth: 0,
    ...partial,
  };
}

function buildLargeTrace(): TraceFile {
  const events: TraceEvent[] = [];
  let step = 0;
  for (let i = 0; i < 40; i += 1) {
    step += 1;
    events.push(
      event({
        step,
        type: "tool",
        name: "lookup",
        durationMs: 5,
        depth: 1,
        output: "x",
      }),
    );
  }
  for (let i = 0; i < 30; i += 1) {
    step += 1;
    events.push(
      event({
        step,
        type: "node",
        name: "plan",
        durationMs: 2,
        output: { i },
      }),
    );
  }
  for (let i = 0; i < 20; i += 1) {
    step += 1;
    events.push(
      event({
        step,
        type: "model",
        name: i % 2 === 0 ? "gpt-4.1-mini" : "claude-sonnet",
        durationMs: i % 2 === 0 ? 40 : 80,
        tokens: { input: 10, output: 5, total: 15 },
      }),
    );
  }
  step += 1;
  events.push(
    event({
      step,
      type: "error",
      name: "cite",
      durationMs: 12,
      error: "missing doc",
    }),
  );
  // pad to > 80
  while (events.length <= AUTO_COMPACT_STEP_THRESHOLD) {
    step += 1;
    events.push(event({ step, type: "span", name: "misc", durationMs: 1, output: 1 }));
  }

  return {
    version: 1,
    runtime: "manual",
    entrypoint: "./large.ts",
    startedAt: "2026-09-27T00:00:00.000Z",
    endedAt: "2026-09-27T00:00:10.000Z",
    events,
    summary: {
      steps: events.length,
      durationMs: 10_000,
      costUsd: 0.02,
      tokens: { input: 200, output: 100, total: 300 },
    },
  };
}

describe("executive summary and compact views", () => {
  it("builds L0 summary with mix, slowest, cost source, and byModel", () => {
    const trace = buildLargeTrace();
    const summary = buildExecutiveSummary(trace);
    expect(summary.steps).toBeGreaterThan(AUTO_COMPACT_STEP_THRESHOLD);
    expect(summary.costSource).toBe("runtime");
    expect(summary.errorCount).toBeGreaterThanOrEqual(1);
    expect(summary.mix.tool).toBe(40);
    expect(summary.byModel.length).toBe(2);
    expect(summary.byModel.map((m) => m.name).sort()).toEqual(["claude-sonnet", "gpt-4.1-mini"]);

    const text = formatExecutiveSummary(summary);
    expect(text).toContain("SUMMARY");
    expect(text).toContain("BY MODEL");
    expect(text).toContain("claude-sonnet");
    expect(text).toContain("(runtime)");
    expect(text.split("\n").length).toBeLessThan(40);
  });

  it("auto-compacts large traces to under ~40 lines by default", () => {
    const trace = buildLargeTrace();
    const lines = formatCompactEvents(trace.events);
    expect(lines.some((l) => l.includes("auto-compact"))).toBe(true);
    expect(lines.some((l) => l.includes("lookup ×"))).toBe(true);
    expect(lines.length).toBeLessThan(40);
  });

  it("verbose mode prints one line per event", () => {
    const trace = buildLargeTrace();
    const lines = formatCompactEvents(trace.events, { verbose: true });
    expect(lines.length).toBe(trace.events.length);
  });

  it("marks cost as not reported when missing", () => {
    const trace = buildLargeTrace();
    delete (trace.summary as { costUsd?: number }).costUsd;
    const summary = buildExecutiveSummary(trace);
    expect(summary.costSource).toBe("not_reported");
    expect(formatExecutiveSummary(summary)).toContain("cost=not reported");
  });
});
