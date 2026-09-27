import { describe, expect, it } from "vitest";
import { redactValue } from "../../src/security/redact.js";

describe("redactValue", () => {
  it("redacts sensitive keys", () => {
    const out = redactValue({
      apiKey: "sk-secret-value-here",
      nested: { authorization: "Bearer abc.def" },
      safe: "hello",
    }) as Record<string, unknown>;

    expect(out.apiKey).toBe("[REDACTED]");
    expect((out.nested as Record<string, unknown>).authorization).toBe("[REDACTED]");
    expect(out.safe).toBe("hello");
  });

  it("redacts secret-looking substrings in strings", () => {
    const out = redactValue("token=sk-abcdefghijklmnopqrstuvwxyz");
    expect(String(out)).toContain("[REDACTED]");
    expect(String(out)).not.toContain("sk-abcdefghijklmnop");
  });
});
