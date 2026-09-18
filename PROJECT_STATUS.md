# Project Status

## Current
- Branch: `fresh-society-v2`
- Phase: Security hardening and production readiness
- Current task: Firebase resident-auth configuration + E2E verification, alongside remaining security audit
- Final stage: Not signed off
- Current implementation commit: `cc68c418a17f6346fdeba23f31aff44716ca46be`

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


### Authorization audit — 2026-09-18
- Reviewed protected admin, payment, dashboard, storage and master-admin routes for role/society scoping.
- Hardened the maximum-6 Sub Admin creation path against concurrent requests using a Serializable transaction.


### Firebase / deployment verification — 2026-09-18
- Firebase custom email action handler is implemented in v2/app/verify-email/page.tsx; Firebase Console template configuration still needs explicit verification.
- Firebase REST email verification uses the documented oobCode flow.
- Latest branch HEAD is 6ed47f14ae6bf2e4293c405737db02c3dae8fbfb.
- No GitHub Actions workflow run is attached to this commit; latest production deployment is therefore not claimed as verified.
- Cloudflare Workers remains the production target.


### Login abuse protection — 2026-09-18
- Added database-backed failed-login tracking and a 15-minute lock after 5 failed password attempts.
- Successful authentication clears the failure counter and lock.
- Firebase resident invalid-password failures and legacy bcrypt failures both use the same lockout path.
- Login abuse migration is present at v2/prisma/migrations/20260918170000_add_login_abuse_controls/migration.sql.
- Direct production schema preparation was verified; Prisma migration deployment still needs to run through the normal Cloudflare build/deploy path.


### Storage upload hardening — 2026-09-18
- Generic organizer uploads now validate magic-byte signatures for JPG, PNG, WEBP and PDF instead of trusting MIME type alone.
- Payment-account QR uploads now validate decoded image signatures and reject empty/mismatched content.
- Private storage continues to use the society-scoped path and signed URLs.


## E2E READINESS AUDIT — 2026-09-18
- Static authorization/auth-flow review completed for resident signup, Firebase verification, login, password recovery, resident sessions, and payment submission/review.
- No additional application-code change was justified by this pass.
- Required live tests before production sign-off: unverified-login rejection; verification activation; owner/tenant unit linking; duplicate email/mobile rejection; password reset; disabled/rejected session rejection; cross-society denial; payment evidence race; concurrent payment review; private-file access.
- Live E2E remains pending because Firebase Console configuration and current Cloudflare deployment cannot be independently verified from repository source in this environment.
