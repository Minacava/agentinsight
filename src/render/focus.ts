import type { TraceEvent, TraceEventType } from "../types/trace.js";

const ALL_TYPES: TraceEventType[] = [
  "node",
  "tool",
  "message",
  "model",
  "retrieval",
  "error",
  "span",
];

export interface FocusOptions {
  /** Comma-separated event types, e.g. "error,tool,model". */
  only?: string;
  /** Minimum duration in ms. */
  slow?: number;
  /** Substring match on event name (case-insensitive). */
  name?: string;
  /** Maximum depth inclusive. */
  depth?: number;
  /** Substring match on model-like event names (case-insensitive). */
  model?: string;
}

export function parseOnlyTypes(only: string | undefined): Set<TraceEventType> | undefined {
  if (!only || !only.trim()) return undefined;
  const set = new Set<TraceEventType>();
  for (const raw of only.split(",")) {
    const token = raw.trim().toLowerCase();
    if (!token) continue;
    const match = ALL_TYPES.find((t) => t === token);
    if (!match) {
      throw new Error(
        `Unknown type in --only: "${raw.trim()}". Expected one of: ${ALL_TYPES.join(", ")}`,
      );
    }
    set.add(match);
  }
  return set.size ? set : undefined;
}

function isModelLike(event: TraceEvent): boolean {
  return event.type === "model" || /^model[:/]/i.test(event.name);
}

/**
 * Filter events for display. Does not mutate the source array / persisted trace.
 */
export function selectFocusedEvents(
  events: TraceEvent[],
  options: FocusOptions = {},
): TraceEvent[] {
  const only = parseOnlyTypes(options.only);
  const nameNeedle = options.name?.trim().toLowerCase();
  const modelNeedle = options.model?.trim().toLowerCase();
  const slow = options.slow;
  const maxDepth = options.depth;

  return events.filter((event) => {
    if (only && !only.has(event.type)) return false;
    if (slow !== undefined && event.durationMs < slow) return false;
    if (maxDepth !== undefined && event.depth > maxDepth) return false;
    if (nameNeedle && !event.name.toLowerCase().includes(nameNeedle)) {
      return false;
    }
    if (modelNeedle) {
      if (!isModelLike(event)) return false;
      if (!event.name.toLowerCase().includes(modelNeedle)) return false;
    }
    return true;
  });
}

export function hasFocusFilters(options: FocusOptions): boolean {
  return (
    (options.only !== undefined && options.only.trim() !== "") ||
    options.slow !== undefined ||
    (options.name !== undefined && options.name.trim() !== "") ||
    options.depth !== undefined ||
    (options.model !== undefined && options.model.trim() !== "")
  );
}
