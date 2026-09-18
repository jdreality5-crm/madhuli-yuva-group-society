# Development Rules

1. Work on `fresh-society-v2` unless explicitly instructed otherwise.
2. Read `AI_HANDOFF.md` and `PROJECT_STATUS.md` before implementation.
3. Inspect current code before modifying it; do not rely only on old chat context.
4. Preserve locked requirements and established route compatibility.
5. Do not invent production data or silently change business semantics.
6. Every protected API must enforce authentication and authorization server-side.
7. Every society-owned record must be scoped to the authenticated user's society where applicable.
8. Keep resident `OWNER` DB role semantics and use `residentType` for OWNER/TENANT distinction.
9. Treat Cloudflare Workers as production runtime and test the Workers/vinext path, not only `next dev`.
10. Keep Supabase Storage buckets private for sensitive files.
11. Prefer atomic database operations for approval, payment verification, linking, and other state transitions.
12. Validate external identifiers belong to the current society before creating relationships.
13. After meaningful changes, run the most relevant typecheck/build/tests available.
14. Update handoff/status documentation after major work.
15. Never claim a deployment is live until the actual deployed version has been verified.
16. Avoid destructive schema/data changes unless explicitly required and safely migrated.
