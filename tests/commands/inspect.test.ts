import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { TraceFile } from "../../src/types/trace.js";

describe("inspect fixtures", () => {
  it("changed fixture has addressable steps", async () => {
    const file = path.join(process.cwd(), "tests/fixtures/diff/changed.json");
    const trace = JSON.parse(await readFile(file, "utf8")) as TraceFile;
    expect(trace.events[0]?.step).toBe(1);
    expect(trace.events.some((e) => e.name === "lookup")).toBe(true);
  });
});
