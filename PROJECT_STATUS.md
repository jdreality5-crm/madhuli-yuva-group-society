# Project Status

## Current
- Branch: `fresh-society-v2`
- Phase: Security hardening and production readiness
- Current task: Continue protected API/page authorization audit + E2E verification after fixing property-unit AuditLog schema mismatch
- Final stage: Not signed off
- Current verified audit-fix commit: `a74276aedeca921ef7a99e853b38f250fcdb870f`

## Status Matrix

| Area | Status | Notes |
|---|---|---|
| Next.js V2 app | Complete | Active app under `v2/` |
| Prisma/PostgreSQL | Complete | Supabase PostgreSQL |
| Property model | Complete | Apartment + dynamic tenament floors |
| Resident signup | Complete | Email OTP + Master Admin approval |
| Login/session enforcement | Complete | DB revalidation implemented |
| Profile | Implemented / audit | Review email/session consistency |
| Financial isolation | Audited / continue | Continue endpoint-by-endpoint audit |
| Payments | Hardened / audit | Evidence race fixed; final idempotency review pending |
| Property unit linking | Hardened | Active/approved resident requirement + empty-unit clearing |
| Legacy approval API | Hardened | Both approval paths now enforce verified email |
| Storage upload | Hardened | Generic upload restricted to organizers |
| Cloudflare Workers | Configured | vinext + Wrangler |
| Documentation | Complete | Handoff/status docs are source of truth |
| E2E testing | Pending | Required before sign-off |
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
- Root README and deployment documentation now describe V2 + Cloudflare Workers rather than V1 Express/SQLite.

## Required Sequence
1. Audit all remaining protected APIs/pages.
2. Fix confirmed security/authorization issues.
3. Audit profile email/session consistency.
4. Audit legacy flat/property compatibility.
5. Complete payment idempotency/reference review.
6. Execute E2E auth/approval/rejection scenarios.
7. UI/UX/accessibility final pass.
8. Production build/typecheck.
9. Verify Cloudflare deployment/version.
10. Final sign-off and update handoff.

## Rules
- Never claim deployment without checking the actual deployed version.
- Never introduce fake production data.
- Preserve locked architecture in `AI_HANDOFF.md`.
- Update status after meaningful implementation work.
