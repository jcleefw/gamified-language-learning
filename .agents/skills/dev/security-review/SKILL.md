---
name: security-review
description: 'Reviews code for security vulnerabilities. Use before merging any code that touches authentication, authorization, user input, data access, or external APIs.'
tools: Read, Glob, Grep
---

# Security Review

When this skill is loaded, perform a targeted security review. Do not edit any files.

## Checklist

### Injection

- Is user input passed to SQL, shell commands, file paths, or template engines without sanitization?
- Are parameterized queries or prepared statements used for all database access?

### Authentication & Authorization

- Are authentication checks enforced at every protected entry point?
- Are authorization checks applied to every resource access (not just route-level)?
- Are session tokens, JWTs, or API keys validated correctly?

### Sensitive Data Exposure

- Are secrets, credentials, or PII logged, returned in responses, or stored in plaintext?
- Is sensitive data transmitted over unencrypted channels?

### Input Validation

- Is all external input (user, API, file, environment) validated at the boundary?
- Are file uploads restricted by type, size, and storage path?

### Dependency Risk

- Are any dependencies known to have CVEs relevant to how they're used here?

### Error Handling

- Do error messages leak stack traces, internal paths, or system details to the client?

## Output Format

For each finding:

```
[SEVERITY] <category>
Location: <file>:<line>
Vulnerability: <what it is>
Risk: <what an attacker could do>
Fix: <what to do>
```

Severity levels: `CRITICAL` / `HIGH` / `MEDIUM` / `LOW`

End with: total findings by severity and overall risk rating.

## Rules

- Read-only. Output findings as text — do not edit files.
- Flag CRITICAL and HIGH issues first.
- Do not flag theoretical risks with no realistic attack path.
- If no issues are found, state that explicitly with confidence level.
