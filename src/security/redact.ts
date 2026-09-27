/**
 * Redact secrets and credentials from values before they are printed or persisted.
 * Open-source consumers must never accidentally commit API keys via traces.
 */

export type RedactProfile = "default" | "pii";

const SENSITIVE_KEY =
  /^(api[_-]?key|access[_-]?token|refresh[_-]?token|authorization|auth|password|passwd|secret|client[_-]?secret|private[_-]?key|bearer|token|x-api-key|credential|session)$/i;

const SECRET_PATTERN =
  /\b(sk-[A-Za-z0-9_-]{8,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[baprs]-[A-Za-z0-9-]{10,}|Bearer\s+[A-Za-z0-9._\-+=/]+)\b/g;

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;

const PHONE_PATTERN = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{2,4}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;

const REDACTED = "[REDACTED]";

export function parseRedactProfile(value: string | undefined): RedactProfile {
  if (!value || value === "default") return "default";
  if (value === "pii") return "pii";
  throw new Error(`Unknown --redact profile "${value}". Expected default|pii`);
}

export function redactString(value: string, profile: RedactProfile = "default"): string {
  let out = value.replace(SECRET_PATTERN, REDACTED);
  if (profile === "pii") {
    out = out.replace(EMAIL_PATTERN, REDACTED);
    out = out.replace(PHONE_PATTERN, REDACTED);
  }
  return out;
}

export function redactValue(
  value: unknown,
  depth = 0,
  profile: RedactProfile = "default",
): unknown {
  if (depth > 12) return "[MaxDepth]";
  if (value === null || value === undefined) return value;

  if (typeof value === "string") {
    return redactString(value, profile);
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
      message: redactString(value.message, profile),
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, depth + 1, profile));
  }

  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY.test(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactValue(nested, depth + 1, profile);
      }
    }
    return out;
  }

  return String(value);
}

export function redactTracePayload<T>(value: T, profile: RedactProfile = "default"): T {
  return redactValue(value, 0, profile) as T;
}
