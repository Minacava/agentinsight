import { describe, expect, it } from "vitest";
import { executeEntrypoint } from "../../src/run/execute.js";
import { formatEventLine } from "../../src/render/formatter.js";

describe("retrieval demo", () => {
  it("emits a visible [retrieval] step in the offline multi-step flow", async () => {
    const { trace } = await executeEntrypoint("./examples/retrieval-demo.ts", {
      quiet: true,
      persist: false,
    });

    const types = trace.events.map((e) => e.type);
    expect(types).toContain("retrieval");
    expect(types).toContain("model");
    expect(types).toEqual(expect.arrayContaining(["node", "retrieval", "model", "node"]));

    const retrieval = trace.events.find((e) => e.type === "retrieval");
    expect(retrieval?.name).toBe("vector.search");
    expect(formatEventLine(retrieval!)).toContain("[retrieval]");
    expect(formatEventLine(retrieval!)).toContain("vector.search");
  });
});
