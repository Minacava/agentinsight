# Security Policy

## Supported versions

Security fixes are accepted for the latest `0.x` release line.

## Reporting a vulnerability

Do **not** open a public GitHub issue for security reports.

Email the maintainer via the address on the GitHub profile of the repository owner, or use GitHub Security Advisories for this repository:

https://github.com/Minacava/agentinsight/security/advisories/new

Include:

- affected version / commit
- reproduction steps
- impact assessment

## Hardening defaults in this project

- Trace files under `.agentinsight/` are gitignored (may contain prompts and tool payloads).
- Environment files (`.env`) and credential material are gitignored.
- Trace persistence runs a redaction pass for common secret keys and token patterns before writing JSON.
- CI runs `npm audit` on every pull request.

Still treat saved traces as sensitive: do not publish `.agentinsight/` contents or paste secrets into issues.
