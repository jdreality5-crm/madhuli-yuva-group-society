# Project Status

## Current
- Branch: `fresh-society-v2`
- Phase: Security hardening and production readiness
- Current task: Firebase resident-auth configuration + E2E verification, alongside remaining security audit
- Final stage: Not signed off
- Current implementation commit: `12b99f703c45cd15777e16ef4b693b8345ac52cb`

## Status Matrix

| Area | Status | Notes |
|---|---|---|
| Next.js V2 app | Complete | Active app under `v2/` |
| Prisma/PostgreSQL | Complete | Supabase PostgreSQL |
| Property model | Complete | Apartment + dynamic tenament floors |
| Resident signup | Implemented / config pending | Firebase Gmail-only signup + verification link; verification now activates the matching resident and starts 15-day contact locks |
| Login/session enforcement | Migrated / audit | Residents authenticate with Firebase; app session remains DB-revalidated |
| Profile | Implemented / audit | Review email/session consistency |
| Financial isolation | Audited / continue | Continue endpoint-by-endpoint audit |
| Payments | Hardened / audit | Evidence race fixed; final idempotency review pending |
| Property unit linking | Hardened | Active/approved resident requirement + empty-unit clearing |
| Legacy approval API | Hardened | Both approval paths now enforce verified email |
| Storage upload | Hardened | Generic upload restricted to organizers |
| Cloudflare Workers | Configured | vinext + Wrangler |
| Documentation | Complete | Handoff/status docs are source of truth |
| E2E testing | Pending | Firebase signup/login/password reset still requires live configuration and test |
| Production build/typecheck | Pending | Local environment could not reach GitHub |
| Production deployment verification | Pending | Must verify exact deployed commit |
| Production sign-off | Pending | Final gate |

## Confirmed Audit Fixes
- Bill update now validates referenced events against the current society.
- Resident payment evidence submission uses an atomic pending/expiry claim to prevent concurrent overwrites.
- Losing payment screenshot uploads are cleaned up after a failed atomic claim.
- Payment account QR images are returned through signed private-storage URLs.
- Legacy Master Admin resident approval route now matches secure approval semantics.
- Generic storage upload requires organizer authorization.
- Property unit linking only accepts active, approved, email-verified resident accounts.
- Property unit clearing safely removes resident linkage and allows empty unit fields.
- Property unit audit logging now matches the Prisma AuditLog schema.
- Profile login email is read-only and API-enforced until a dedicated email re-verification flow is implemented.
- Root README and deployment documentation now describe V2 + Cloudflare Workers rather than V1 Express/SQLite.

## Required Sequence
1. Configure Firebase Authentication and custom email action handler (`/verify-email`).
2. Configure and verify `FIREBASE_WEB_API_KEY` in Cloudflare.
3. E2E-test Gmail signup → verification link → automatic activation → login.
4. Add/verify Firebase password reset flow.
5. Audit remaining protected APIs/pages and legacy flat compatibility.
6. Complete payment idempotency/reference review.
7. UI/UX/accessibility final pass.
8. Production build/typecheck.
9. Verify Cloudflare deployment/version.
10. Final sign-off and update handoff.

## Rules
- Never claim deployment without checking the actual deployed version.
- Never introduce fake production data.
- Preserve locked architecture in `AI_HANDOFF.md`.
- Update status after meaningful implementation work.


### Payment security audit — 2026-09-18
- Unique transaction reference enforced per society at DB level for non-empty `transactionId` values.
- Existing production transaction-reference duplicates: none.
- Payment review remains atomic: only one concurrent reviewer can claim a PENDING payment before Income creation.
