import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index.js";

describe("agentinsight smoke", () => {
  it("exports the package name", () => {
    expect(PACKAGE_NAME).toBe("agentinsight");
  });
});
