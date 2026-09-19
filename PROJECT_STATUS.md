# Project Status

## Current
- Branch: `fresh-society-v2`
- Phase: Security hardening and production readiness
- Current task: Firebase configuration readiness and live configuration gate
- Final stage: Not signed off
- Current implementation commit: `eb66b14bc7ea52ca322072774a8342c026ef415f`

## Status Matrix

| Area | Status | Notes |
|---|---|---|
| Next.js V2 app | Complete | Active app under `v2/` |
| Prisma/PostgreSQL | Complete | Supabase PostgreSQL |
| Property model | Complete | Apartment + dynamic tenament floors |
| Resident signup | Implemented / config pending | Firebase Gmail-only signup + verification link; verification activates the matching resident and starts 15-day contact locks |
| Login/session enforcement | Migrated / audit | Residents authenticate with Firebase; app session remains DB-revalidated |
| Profile | Implemented / audit | Review email/session consistency |
| Financial isolation | Audited / continue | Continue endpoint-by-endpoint audit |
| Payments | Hardened / build verification pending | Payment-session race protection, expiry restart, rejection release, and transaction-reference uniqueness reviewed |
| Property unit linking | Hardened | Active/approved resident requirement + empty-unit clearing |
| Legacy approval API | Hardened | Both approval paths enforce verified email |
| Storage upload | Hardened | Generic upload restricted to organizers |
| Cloudflare Workers | Configured | vinext + Wrangler |
| Documentation | Complete | Handoff/status docs are source of truth |
| E2E testing | Pending | Firebase signup/login/password reset requires live configuration and test |
| Production build/typecheck | Previously verified | V2 Build Check #454 passed on commit `89229d7f8e3efe65615c9e986827cd1ebe0b5435`; latest payment hardening still needs a fresh run |
| Production deployment verification | Blocked | Cloudflare Deploy #389 built successfully but stopped because `FIREBASE_WEB_API_KEY` GitHub Secret is not configured |
| Production sign-off | Pending | Final gate |

## Required Sequence
1. Internal V2 build/typecheck verification.
2. Configure Firebase Authentication and custom email action handler (`/verify-email`).
3. Configure and verify `FIREBASE_WEB_API_KEY` in Cloudflare.
4. E2E-test Gmail signup → verification link → automatic activation → login.
5. Verify Firebase password reset flow.
6. Audit remaining protected APIs/pages and legacy flat compatibility.
7. Complete payment idempotency/reference review.
8. UI/UX/accessibility final pass.
9. Verify Cloudflare deployment/version.
10. Final sign-off and update handoff.

## Rules
- Never claim deployment without checking the actual deployed version.
- Never introduce fake production data.
- Preserve locked architecture in `AI_HANDOFF.md`.
- Cloudflare Workers is the V2 production target; Vercel is not part of the V2 deployment path.
- Update status after meaningful implementation work.

### Verification update — 2026-09-19
- V2 Build Check #454 passed on the implementation commit `89229d7f8e3efe65615c9e986827cd1ebe0b5435`.
- Cloudflare Deploy #389 reached a successful Worker build, then failed only at the Firebase runtime-secret sync because `FIREBASE_WEB_API_KEY` is missing from GitHub Actions secrets; deployment was therefore correctly not attempted.
- Firebase custom email action handler code is present at `/verify-email`; Firebase documentation confirms custom handlers receive `mode` and `oobCode` parameters and can complete verification/reset flows.

### Internal verification — 2026-09-19
- Prisma schema formatting and Bill → PropertyUnit relation were repaired in commit `74a0ca901c278c00938926deb00460ab81cbeb27`.
- V2 Build Check workflow is `.github/workflows/v2-build.yml` and runs on pushes to `fresh-society-v2`.
- Firebase/Cloudflare live configuration has not been changed in this step.

### Auth verification review — 2026-09-19
- Firebase's official REST documentation was checked against the verification handler. The `accounts:update` email-verification response does not document `requestType` or `emailVerified`; the temporary extra response-field check was reverted to avoid breaking legitimate verification links.
- The verification endpoint continues to use Firebase's dedicated `accounts:update` flow with the `oobCode`, then matches the returned `localId` and normalized Gmail against the pre-registered local resident before activation.
- Firebase/Cloudflare external configuration remains the live-auth gate.

### Protected API audit — 2026-09-19
- Session authorization is DB-authoritative in `v2/lib/auth.ts`: current role, society, active status, approval status, email verification, and Sub Admin permissions are revalidated on every session read.
- Resident profile API enforces society scope and keeps email read-only; mobile changes remain subject to the 15-day lock and duplicate check.
- Resident bills, dashboard, notices, and programs APIs are society-scoped and require an authenticated session; resident bills are additionally limited to units linked to the resident.
- Generic storage upload is organizer-only and validates file size, declared MIME type, and file signature before private-bucket upload.
- No new authorization defect was found in this pass; legacy Flat compatibility and payment idempotency/reference review remain open audit items.

### Payment idempotency review — 2026-09-19
- Bill-linked payment initiation now claims the bill's payment state transactionally, preventing concurrent duplicate payment sessions for the same bill.
- Expired pending bill sessions can be restarted safely; rejected bill payments release the bill back to UNPAID, while verified payments move it to PAID.
- Existing transaction-reference uniqueness remains enforced by the society-scoped partial unique database index.
- Payment-session claims are now serialized with a PostgreSQL transaction-scoped advisory lock keyed to the bill ID, closing the remaining concurrent payment-session creation race.
- Fresh V2 build verification is still required for these latest payment changes; no green build is claimed until GitHub Actions reports it.
