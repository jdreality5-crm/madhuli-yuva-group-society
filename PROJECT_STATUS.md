# Project Status

## Current
- Branch: `fresh-society-v2`
- Phase: Security hardening and production readiness
- Current task: Firebase configuration readiness and live configuration gate
- Final stage: Not signed off
- Current implementation commit: `e94cfc8225eaf47c6cc8a15e5794894ad7b3de37`

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
| Payments | Hardened / audit | Evidence race fixed; final idempotency review pending |
| Property unit linking | Hardened | Active/approved resident requirement + empty-unit clearing |
| Legacy approval API | Hardened | Both approval paths enforce verified email |
| Storage upload | Hardened | Generic upload restricted to organizers |
| Cloudflare Workers | Configured | vinext + Wrangler |
| Documentation | Complete | Handoff/status docs are source of truth |
| E2E testing | Pending | Firebase signup/login/password reset requires live configuration and test |
| Production build/typecheck | Verified | V2 Build Check #454 passed on commit `89229d7f8e3efe65615c9e986827cd1ebe0b5435` |
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
- V2 Build Check #454 passed on the latest implementation commit `89229d7f8e3efe65615c9e986827cd1ebe0b5435`.
- Cloudflare Deploy #389 reached a successful Worker build, then failed only at the Firebase runtime-secret sync because `FIREBASE_WEB_API_KEY` is missing from GitHub Actions secrets; deployment was therefore correctly not attempted.
- Firebase custom email action handler code is present at `/verify-email`; Firebase documentation confirms custom handlers receive `mode` and `oobCode` parameters and can complete verification/reset flows. citeturn0search0turn0search1

### Internal verification — 2026-09-19
- Prisma schema formatting and Bill → PropertyUnit relation were repaired in commit `74a0ca901c278c00938926deb00460ab81cbeb27`.
- V2 Build Check workflow is `.github/workflows/v2-build.yml` and runs on pushes to `fresh-society-v2`.
- This status update intentionally triggers the V2 Build Check without changing application behavior.
- Firebase/Cloudflare live configuration has not been changed in this step.


### Auth verification review — 2026-09-19
- Firebase's official REST documentation was checked against the verification handler. The `accounts:update` email-verification response contains the Firebase user identity/email fields but does not document `requestType` or `emailVerified` in the response; the temporary extra response-field check was therefore reverted to avoid breaking legitimate verification links.
- The verification endpoint continues to use Firebase's dedicated `accounts:update` flow with the `oobCode`, then matches the returned `localId` and normalized Gmail against the pre-registered local resident before activation.
- Firebase/Cloudflare external configuration remains the live-auth gate.
