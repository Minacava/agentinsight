import { Tracer } from "../tracer.js";
import type {
  AdapterRunOptions,
  AdapterRunResult,
  AgentAdapter,
  ManualEntrypoint,
} from "./types.js";
import { isRecord } from "./types.js";

function asManualEntrypoint(entry: unknown): ManualEntrypoint {
  if (!isRecord(entry) || typeof entry.run !== "function") {
    throw new Error("Manual entrypoint must be `{ runtime: 'manual', run(tracer) { ... } }`");
  }
  return {
    runtime: "manual",
    run: entry.run as ManualEntrypoint["run"],
  };
}

/**
 * Framework-agnostic adapter: any agent can emit TraceEvents through Tracer.
 */
export class ManualAdapter implements AgentAdapter {
  readonly runtime = "manual" as const;

  async run(entry: unknown, options: AdapterRunOptions = {}): Promise<AdapterRunResult> {
    const manual = asManualEntrypoint(entry);
    const tracer =
      options.tracer ??
      new Tracer({
        ...(options.onEvent ? { onEvent: options.onEvent } : {}),
      });

    const output = await manual.run(tracer);

    return {
      runtime: this.runtime,
      events: tracer.getEvents(),
      output,
    };
  }
}

export const manualAdapter = new ManualAdapter();
