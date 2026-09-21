# Madhuli Yuva Group Society V2 — Professional Developer Instructions

## Mandatory First Step

Before making **any** code change, first inspect the repository and read **all applicable project rules, AI instructions, prompts, architecture notes, and security documentation**.

At minimum, read:

- `docs/ai-instructions/Society_Function_Manager_AI_Developer_Master_Prompt_v2.txt`
- Any additional files under `docs/ai-instructions/`
- Relevant README, architecture, database, API, security, deployment, and testing documentation
- The actual source files involved in the requested task

The master prompt and repository documentation are the source of truth. Do not rely on memory, assumptions, or invented project behavior.

## Required Development Process

1. Understand the request and current behavior.
2. Inspect the real implementation before coding.
3. Identify the root cause, not only the visible symptom.
4. Map all affected layers: UI → state → validation → API → authentication → authorization → backend/business logic → database → response → UI refresh → reports/PDF/export → audit/security → testing.
5. Implement the complete change across every affected layer.
6. Preserve existing functionality and avoid unrelated refactors.
7. Verify mobile and desktop behavior, especially iPhone, Android, and responsive layouts.
8. For financial/payment features, additionally verify calculations, persistence, permissions, duplicate submissions, failures, reports/PDFs, refresh, and login/logout behavior.
9. Run all available build, lint, type-check, test, and deployment checks that are relevant.
10. Check regression risks in related modules.

## Strict Rules

- Never invent files, APIs, routes, database tables, fields, environment variables, or existing behavior.
- Never fix a backend/data problem only by changing the frontend.
- Enforce authorization on the backend; hiding UI is not security.
- Validate important data on both frontend and backend.
- Do not claim `Done`, `Fixed`, `Verified`, or `Production-ready` without actual evidence.
- Clearly separate automated verification from manual device/browser testing.
- If something could not be checked, state: `Not verified because: ...`
- Do not hide known issues, warnings, failed tests, or missing access.
- Keep changes maintainable, secure, type-safe, consistent, and backward-compatible.

## Final Response Format

Report in concise Hinglish or clear English:

- What was requested
- Root cause found
- Files/modules changed
- End-to-end behavior implemented
- Verification actually completed, with evidence
- Remaining limitations or manual tests still required

**Never finish a task merely because a commit was created. The implementation must be inspected and verified first.**
