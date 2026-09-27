/**
 * Minimal offline LangGraph agent for agentinsight demos.
 * No API keys required — nodes are deterministic.
 *
 * Run:
 *   agentinsight run ./examples/langgraph-demo.ts
 */
import { Annotation, StateGraph, START, END } from "@langchain/langgraph";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const State = Annotation.Root({
  topic: Annotation<string>,
  notes: Annotation<string>,
  finalAnswer: Annotation<string>,
});

const lookupTool = tool(
  async ({ topic }: { topic: string }) => {
    return `Notes about ${topic}: latency, cost, and tool calls matter when debugging agents.`;
  },
  {
    name: "lookup",
    description: "Lookup short research notes for a topic",
    schema: z.object({
      topic: z.string(),
    }),
  },
);

async function plan(state: typeof State.State) {
  return { topic: state.topic || "agent tracing" };
}

async function gather(state: typeof State.State) {
  const notes = await lookupTool.invoke({ topic: state.topic });
  return { notes: String(notes) };
}

async function finalize(state: typeof State.State) {
  return {
    finalAnswer: `Summary for "${state.topic}": ${state.notes}`,
  };
}

const graph = new StateGraph(State)
  .addNode("plan", plan)
  .addNode("gather", gather)
  .addNode("finalize", finalize)
  .addEdge(START, "plan")
  .addEdge("plan", "gather")
  .addEdge("gather", "finalize")
  .addEdge("finalize", END)
  .compile();

export default {
  runtime: "langgraph" as const,
  graph,
  input: { topic: "agentinsight" },
};
