import type { TraceFile } from "../types/trace.js";

export interface StepDurationAssert {
  name: string;
  maxMs: number;
}

export interface AssertionFile {
  maxSteps?: number;
  noErrors?: boolean;
  outputContains?: string;
  maxDurationMs?: number;
  maxCostUsd?: number;
  requiredSteps?: string[];
  maxStepDurationMs?: StepDurationAssert[];
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
  if (obj.requiredSteps !== undefined) {
    if (
      !Array.isArray(obj.requiredSteps) ||
      !obj.requiredSteps.every((s) => typeof s === "string")
    ) {
      throw new Error("assertions.requiredSteps must be an array of strings");
    }
    asserts.requiredSteps = obj.requiredSteps;
  }
  if (obj.maxStepDurationMs !== undefined) {
    if (!Array.isArray(obj.maxStepDurationMs)) {
      throw new Error("assertions.maxStepDurationMs must be an array");
    }
    asserts.maxStepDurationMs = obj.maxStepDurationMs.map((item, i) => {
      if (
        typeof item !== "object" ||
        item === null ||
        typeof (item as { name?: unknown }).name !== "string" ||
        typeof (item as { maxMs?: unknown }).maxMs !== "number"
      ) {
        throw new Error(
          `assertions.maxStepDurationMs[${i}] must be { name: string, maxMs: number }`,
        );
      }
      return {
        name: (item as StepDurationAssert).name,
        maxMs: (item as StepDurationAssert).maxMs,
      };
    });
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

  if (asserts.requiredSteps !== undefined) {
    checked.push("requiredSteps");
    const names = new Set(trace.events.map((e) => e.name));
    const missing = asserts.requiredSteps.filter((n) => !names.has(n));
    if (missing.length > 0) {
      failures.push({
        rule: "requiredSteps",
        expected: `includes ${JSON.stringify(asserts.requiredSteps)}`,
        actual: `missing ${JSON.stringify(missing)}`,
      });
    }
  }

  if (asserts.maxStepDurationMs !== undefined) {
    checked.push("maxStepDurationMs");
    for (const rule of asserts.maxStepDurationMs) {
      const matches = trace.events.filter((e) => e.name === rule.name);
      if (matches.length === 0) {
        failures.push({
          rule: "maxStepDurationMs",
          expected: `${rule.name} <= ${rule.maxMs}ms`,
          actual: `step "${rule.name}" not found`,
        });
        continue;
      }
      const slowest = Math.max(...matches.map((e) => e.durationMs));
      if (slowest > rule.maxMs) {
        failures.push({
          rule: "maxStepDurationMs",
          expected: `${rule.name} <= ${rule.maxMs}ms`,
          actual: `${slowest}ms`,
        });
      }
    }
  }

  return {
    passed: failures.length === 0,
    failures,
    checked,
  };
}
