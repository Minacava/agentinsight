/**
 * Offline multi-step demo with a retrieval event for agentinsight.
 * No API keys required — plan → retrieval → model → answer.
 *
 * Run:
 *   agentinsight run ./examples/retrieval-demo.ts
 */
import type { Tracer } from "../src/tracer.js";

const CORPUS: Record<string, string> = {
  tracing:
    "Tracing records each agent step with duration, nesting, and optional tokens/cost from the runtime.",
  retrieval:
    "Retrieval pulls grounded passages before the model answers so product teams can audit evidence.",
};

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export default {
  runtime: "manual" as const,
  async run(tracer: Tracer) {
    const topic = "tracing";

    await tracer.withSpan(
      "plan",
      async () => {
        await sleep(2);
        return { intent: "answer_with_sources", topic };
      },
      { type: "node", input: { topic } },
    );

    const passages = await tracer.withSpan(
      "vector.search",
      async () => {
        await sleep(8);
        const hit = CORPUS[topic] ?? CORPUS.retrieval!;
        return {
          query: topic,
          hits: [{ id: "doc-1", score: 0.91, text: hit }],
        };
      },
      { type: "retrieval", input: { query: topic, k: 1 } },
    );

    await tracer.withSpan(
      "model:demo-small",
      async () => {
        await sleep(5);
        return {
          text: `Based on retrieval: ${passages.hits[0]?.text}`,
        };
      },
      {
        type: "model",
        input: { topic, passages: passages.hits },
      },
    );

    await tracer.withSpan(
      "answer",
      async () => {
        await sleep(1);
        return {
          finalAnswer: `Summary for "${topic}": ${passages.hits[0]?.text}`,
          sources: passages.hits.map((h) => h.id),
        };
      },
      { type: "node" },
    );
  },
};
