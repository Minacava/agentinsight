/**
 * Redact secrets and credentials from values before they are printed or persisted.
 * Open-source consumers must never accidentally commit API keys via traces.
 */

const SENSITIVE_KEY =
  /^(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|auth|password|passwd|secret|client[_-]?secret|private[_-]?key|bearer|token|x-api-key|credential|session)$/i;

const SECRET_PATTERN =
  /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._\-+=/]+)\b/g;

const REDACTED = "[REDACTED]";

export function redactString(value: string): string {
  return value.replace(SECRET_PATTERN, REDACTED);
}

export function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 12) return "[MaxDepth]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return redactString(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(nested, depth + 1);
      }
    }
    return out;
  }

  return String(value);
}

export function redactTracePayload<T>(value: T): T {
  return redactValue(value) as T;
}
