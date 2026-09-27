import type { TraceFile } from "../types/trace.js";

export interface AssertionFile {
  maxSteps?: number;
  noErrors?: boolean;
  outputContains?: string;
  maxDurationMs?: number;
  maxCostUsd?: number;
}

export interface AssertionFailure {
  rule: string;
  expected: string;
  actual: string;
}

export interface AssertionResult {
  passed: boolean;
  failures: AssertionFailure[];
  checked: string[];
}

function hasErrorEvents(trace: TraceFile): boolean {
  return trace.events.some((event) => event.type === "error" || event.error !== undefined);
}

function outputAsString(output: unknown): string {
  if (output === undefined || output === null) return "";
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
}

export function parseAssertionFile(raw: unknown): AssertionFile {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Assertion file must be a JSON object");
  }
  const obj = raw as Record<string, unknown>;
  const asserts: AssertionFile = {};

  if (obj.maxSteps !== undefined) {
    if (typeof obj.maxSteps !== "number" || !Number.isFinite(obj.maxSteps)) {
      throw new Error("assertions.maxSteps must be a number");
    }
    asserts.maxSteps = obj.maxSteps;
  }
  if (obj.noErrors !== undefined) {
    if (typeof obj.noErrors !== "boolean") {
      throw new Error("assertions.noErrors must be a boolean");
    }
    asserts.noErrors = obj.noErrors;
  }
  if (obj.outputContains !== undefined) {
    if (typeof obj.outputContains !== "string") {
      throw new Error("assertions.outputContains must be a string");
    }
    asserts.outputContains = obj.outputContains;
  }
  if (obj.maxDurationMs !== undefined) {
    if (typeof obj.maxDurationMs !== "number" || !Number.isFinite(obj.maxDurationMs)) {
      throw new Error("assertions.maxDurationMs must be a number");
    }
    asserts.maxDurationMs = obj.maxDurationMs;
  }
  if (obj.maxCostUsd !== undefined) {
    if (typeof obj.maxCostUsd !== "number" || !Number.isFinite(obj.maxCostUsd)) {
      throw new Error("assertions.maxCostUsd must be a number");
    }
    asserts.maxCostUsd = obj.maxCostUsd;
  }

  return asserts;
}

export function evaluateAssertions(
  trace: TraceFile,
  finalOutput: unknown,
  asserts: AssertionFile,
): AssertionResult {
  const failures: AssertionFailure[] = [];
  const checked: string[] = [];

  if (asserts.maxSteps !== undefined) {
    checked.push("maxSteps");
    if (trace.summary.steps > asserts.maxSteps) {
      failures.push({
        rule: "maxSteps",
        expected: `<= ${asserts.maxSteps}`,
        actual: String(trace.summary.steps),
      });
    }
  }

  if (asserts.noErrors !== undefined) {
    checked.push("noErrors");
    const hasErrors = hasErrorEvents(trace);
    if (asserts.noErrors && hasErrors) {
      failures.push({
        rule: "noErrors",
        expected: "true (no error events)",
        actual: "error events present",
      });
    }
    if (!asserts.noErrors && !hasErrors) {
      failures.push({
        rule: "noErrors",
        expected: "false (errors expected)",
        actual: "no error events",
      });
    }
  }

  if (asserts.outputContains !== undefined) {
    checked.push("outputContains");
    const text = outputAsString(finalOutput);
    if (!text.includes(asserts.outputContains)) {
      failures.push({
        rule: "outputContains",
        expected: `string containing ${JSON.stringify(asserts.outputContains)}`,
        actual: text ? JSON.stringify(text).slice(0, 200) : "(empty output)",
      });
    }
  }

  if (asserts.maxDurationMs !== undefined) {
    checked.push("maxDurationMs");
    if (trace.summary.durationMs > asserts.maxDurationMs) {
      failures.push({
        rule: "maxDurationMs",
        expected: `<= ${asserts.maxDurationMs}`,
        actual: String(trace.summary.durationMs),
      });
    }
  }

  if (asserts.maxCostUsd !== undefined) {
    checked.push("maxCostUsd");
    if (trace.summary.costUsd === undefined) {
      failures.push({
        rule: "maxCostUsd",
        expected: `<= ${asserts.maxCostUsd}`,
        actual: "cost not reported by runtime",
      });
    } else if (trace.summary.costUsd > asserts.maxCostUsd) {
      failures.push({
        rule: "maxCostUsd",
        expected: `<= ${asserts.maxCostUsd}`,
        actual: String(trace.summary.costUsd),
      });
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    checked,
  };
}
