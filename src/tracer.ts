import { randomUUID } from "node:crypto";
import type { TokenUsage, TraceEvent, TraceEventType } from "./types/trace.js";
import { redactValue } from "./security/redact.js";

export interface SpanOptions {
  type?: TraceEventType;
  depth?: number;
  parentId?: string;
  input?: unknown;
}

export interface EndSpanOptions {
  output?: unknown;
  tokens?: TokenUsage;
  costUsd?: number;
  error?: string;
}

export interface ActiveSpan {
  id: string;
  end: (options?: EndSpanOptions) => TraceEvent;
}

export interface TracerOptions {
  onEvent?: (event: TraceEvent) => void;
}

/**
 * Collects unified TraceEvents. Used by first-party adapters and by the
 * manual instrumentation API for any custom agent runtime.
 */
export class Tracer {
  private events: TraceEvent[] = [];
  private step = 0;
  private readonly stack: string[] = [];
  private readonly onEvent: ((event: TraceEvent) => void) | undefined;

  constructor(options: TracerOptions = {}) {
    this.onEvent = options.onEvent;
  }

  get depth(): number {
    return this.stack.length;
  }

  getEvents(): TraceEvent[] {
    return [...this.events];
  }

  private push(event: TraceEvent): TraceEvent {
    this.events.push(event);
    this.onEvent?.(event);
    return event;
  }

  /**
   * Record a completed step in one call.
   */
  record(
    type: TraceEventType,
    name: string,
    options: {
      durationMs?: number;
      input?: unknown;
      output?: unknown;
      tokens?: TokenUsage;
      costUsd?: number;
      error?: string;
      depth?: number;
      parentId?: string;
      timestamp?: string;
    } = {},
  ): TraceEvent {
    const parentId = options.parentId ?? this.stack[this.stack.length - 1];
    const event: TraceEvent = {
      id: randomUUID(),
      step: ++this.step,
      type,
      name,
      timestamp: options.timestamp ?? new Date().toISOString(),
      durationMs: options.durationMs ?? 0,
      depth: options.depth ?? this.depth,
      ...(parentId !== undefined ? { parentId } : {}),
      ...(options.input !== undefined ? { input: redactValue(options.input) } : {}),
      ...(options.output !== undefined ? { output: redactValue(options.output) } : {}),
      ...(options.tokens !== undefined ? { tokens: options.tokens } : {}),
      ...(options.costUsd !== undefined ? { costUsd: options.costUsd } : {}),
      ...(options.error !== undefined ? { error: String(redactValue(options.error)) } : {}),
    };
    return this.push(event);
  }

  startSpan(name: string, options: SpanOptions = {}): ActiveSpan {
    const id = randomUUID();
    const started = Date.now();
    const depth = options.depth ?? this.depth;
    const parentId = options.parentId ?? this.stack[this.stack.length - 1];
    const type = options.type ?? "span";
    const input = options.input !== undefined ? redactValue(options.input) : undefined;

    this.stack.push(id);

    return {
      id,
      end: (endOptions: EndSpanOptions = {}) => {
        const idx = this.stack.lastIndexOf(id);
        if (idx >= 0) this.stack.splice(idx, 1);

        const event: TraceEvent = {
          id,
          step: ++this.step,
          type: endOptions.error ? "error" : type,
          name,
          timestamp: new Date(started).toISOString(),
          durationMs: Date.now() - started,
          depth,
          ...(parentId !== undefined ? { parentId } : {}),
          ...(input !== undefined ? { input } : {}),
          ...(endOptions.output !== undefined ? { output: redactValue(endOptions.output) } : {}),
          ...(endOptions.tokens !== undefined ? { tokens: endOptions.tokens } : {}),
          ...(endOptions.costUsd !== undefined ? { costUsd: endOptions.costUsd } : {}),
          ...(endOptions.error !== undefined
            ? { error: String(redactValue(endOptions.error)) }
            : {}),
        };
        return this.push(event);
      },
    };
  }

  async withSpan<T>(name: string, fn: () => Promise<T> | T, options: SpanOptions = {}): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const output = await fn();
      span.end({ output });
      return output;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      span.end({ error: message });
      throw err;
    }
  }
}
