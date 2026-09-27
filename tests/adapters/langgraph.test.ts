import { describe, expect, it } from "vitest";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { langGraphAdapter } from "../../src/adapters/langgraph.js";

describe("langGraphAdapter", () => {
  it("captures node steps from a compiled graph", async () => {
    const State = Annotation.Root({
      value: Annotation<string>,
    });

    const graph = new StateGraph(State)
      .addNode("alpha", async (state) => ({ value: `${state.value}-a` }))
      .addNode("beta", async (state) => ({ value: `${state.value}-b` }))
      .addEdge(START, "alpha")
      .addEdge("alpha", "beta")
      .addEdge("beta", END)
      .compile();

    const result = await langGraphAdapter.run({
      runtime: "langgraph",
      graph,
      input: { value: "x" },
    });

    expect(result.runtime).toBe("langgraph");
    expect(result.events.length).toBeGreaterThanOrEqual(2);
    const names = result.events.map((e) => e.name);
    expect(names).toEqual(expect.arrayContaining(["alpha", "beta"]));
    expect(result.events.every((e) => typeof e.durationMs === "number")).toBe(true);
    expect(result.events.every((e) => e.step > 0)).toBe(true);
  });
});
