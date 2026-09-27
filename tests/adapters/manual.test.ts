import { describe, expect, it } from "vitest";
import { manualAdapter } from "../../src/adapters/manual.js";

describe("manualAdapter", () => {
  it("captures spans from a custom agent", async () => {
    const result = await manualAdapter.run({
      runtime: "manual",
      run: async (tracer) => {
        await tracer.withSpan("step-a", async () => "a", { type: "node" });
        await tracer.withSpan(
          "tool-b",
          async () => {
            return { ok: true };
          },
          { type: "tool", input: { q: "x" } },
        );
        return "done";
      },
    });

    expect(result.runtime).toBe("manual");
    expect(result.events.length).toBe(2);
    expect(result.events[0]?.name).toBe("step-a");
    expect(result.events[1]?.type).toBe("tool");
    expect(result.events.every((e) => e.timestamp && e.step > 0)).toBe(true);
    expect(result.output).toBe("done");
  });
});
