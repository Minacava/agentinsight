import { describe, expect, it } from "vitest";
import { selectFocusedEvents } from "../../src/render/focus.js";
import type { TraceEvent } from "../../src/types/trace.js";

function ev(
  partial: Pick<TraceEvent, "step" | "type" | "name" | "durationMs"> & Partial<TraceEvent>,
): TraceEvent {
  return {
    id: `e${partial.step}`,
    timestamp: "2026-09-27T00:00:00.000Z",
    depth: 0,
    ...partial,
  };
}

const events: TraceEvent[] = [
  ev({ step: 1, type: "node", name: "plan", durationMs: 5 }),
  ev({ step: 2, type: "tool", name: "lookup", durationMs: 80, depth: 1 }),
  ev({ step: 3, type: "model", name: "claude-sonnet", durationMs: 120 }),
  ev({ step: 4, type: "error", name: "cite", durationMs: 3, error: "x" }),
  ev({ step: 5, type: "model", name: "gpt-4.1-mini", durationMs: 40 }),
];

describe("selectFocusedEvents", () => {
  it("filters by only + slow", () => {
    const out = selectFocusedEvents(events, { only: "error,tool", slow: 50 });
    expect(out.map((e) => e.name)).toEqual(["lookup"]);
  });

  it("filters by model substr", () => {
    const out = selectFocusedEvents(events, { model: "claude" });
    expect(out).toHaveLength(1);
    expect(out[0]?.name).toBe("claude-sonnet");
  });

  it("filters by name and depth", () => {
    const out = selectFocusedEvents(events, { name: "lookup", depth: 1 });
    expect(out.map((e) => e.name)).toEqual(["lookup"]);
    const none = selectFocusedEvents(events, { name: "lookup", depth: 0 });
    expect(none).toHaveLength(0);
  });
});
