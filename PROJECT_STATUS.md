# Project Status

## Current
- Branch: `fresh-society-v2`
- Phase: Security hardening and production readiness
- Current task: Security hardening and production verification
- Final stage: Not signed off
- Current implementation commit: `77b52480f90479a117f916f1f68fcafe30de2196`

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
| Payments | Hardened / verified | Payment-session race protection, expiry restart, rejection release, transaction-reference uniqueness, and payment-method/income-reference persistence reviewed |
| Property unit linking | Hardened | Active/approved resident requirement + empty-unit clearing |
| Legacy approval API | Hardened | Both approval paths enforce verified email |
| Storage upload | Hardened | Generic upload restricted to organizers; bill documents restricted to private society-scoped storage paths |
| Cloudflare Workers | Configured | vinext + Wrangler |
| Documentation | Complete | Handoff/status docs are source of truth |
| E2E testing | Pending | Firebase signup/login/password reset and mobile payment return/proof-upload flow require live testing |
| Production build/typecheck | Verified | V2 Build Check has passed on the active branch during recent changes |
| Production deployment verification | Automated verified | Cloudflare Deploy #825 succeeded on commit `77b52480f90479a117f916f1f68fcafe30de2196`; database migrations, Worker build, deployment, and signup residences smoke test passed |
| Production sign-off | Pending | Manual live E2E and payment flow verification remain required |

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

### Verification update — 2026-09-23
- The failed Prisma migration `20260923170000_add_payment_method_to_payment` was repaired through a targeted database migration-state recovery after confirming that `Payment.paymentMethod` already existed; the failed record is rolled back and a completed record is present.
- The migration file was made recoverable with `ADD COLUMN IF NOT EXISTS` in commit `c316bc33bcb3ac419fd6cc0df449487037be77eb`.
- Payment income persistence was hardened in migration `20260923114115_harden_payment_income_idempotency`, including payment-method-aware income description/reference handling; matching migration commit `35c8eb60c992c7a485b2af90d494c89cbd79865e`.
- The one-time workflow recovery step was removed after database recovery in commit `77b52480f90479a117f916f1f68fcafe30de2196`.
- Cloudflare Deploy #825 completed successfully: dependency installation, database migrations, Prisma generation, Worker build, runtime secret preparation, Cloudflare deployment, and signup residences smoke test all passed.
- Automated deployment verification is complete for this run. Manual mobile payment app return, proof upload, receipt generation, and income visibility testing remain pending; production sign-off is not claimed.

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

### Bill authorization and payment-safety review — 2026-09-19
- Bill PUT/DELETE now enforce the same DB-backed BILLS permission used by the bill list/create APIs; the previous organizer-only guard could bypass a Sub Admin's module restriction.
- Bill edits now validate any reassigned PropertyUnit within the current society and allow relinking only while the bill is UNPAID.
- Paid or pending bills cannot be edited or deleted.
- Bills with any payment history cannot be deleted, preserving payment/audit history instead of relying on the Payment → Bill SetNull relation.
- Fresh V2 build verification is still required for this change.

### Bill document storage hardening — 2026-09-19
- Bill create/update APIs now accept only society-scoped private storage paths matching the authenticated society ID; arbitrary external URLs are rejected.
- This keeps resident bill downloads on the existing signed private-storage path and prevents a client from attaching an unrelated external document URL through the bill API.
- V2 Build Check #477 passed after this hardening.
- Cloudflare Deploy #412 succeeded for the resulting branch head.

### Legacy property compatibility review — 2026-09-19
- Reviewed the legacy `Flat` admin route alongside the current `Property`/`PropertyUnit` model. The legacy route remains organizer-protected and society-scoped and is retained for route compatibility; no new cross-society authorization defect was found.
- The current Properties UI was calling `/api/admin/properties/setup`, but that route was missing from the V2 API tree. Restored the organizer-protected setup endpoint with an idempotent transaction for Sarang Apartment (A/B/C, 26 units each) and Pramukhpark Society (27 tenaments).
- Apartment units are created without invented floor assignments (`floorLabel: Flat`); Pramukhpark floors remain dynamic and are added separately.
- V2 Build Check #480 passed and Cloudflare Deploy #415 succeeded for the fix.

## Dependency security hardening — 2026-09-19
- Added a `deepmerge-ts` `^8.0.1` package override after CI identified the vulnerable transitive dependency.
- V2 Build Check #484 passed with `npm install` reporting **0 vulnerabilities**.
- Cloudflare Deploy #419 succeeded for commit `f31185f89e15699cbf71750c146c9b48b476af27`.
- Exact deployed Cloudflare Worker version: `bffbeabc-87b9-45be-8276-530e5ca0cbfa`.

## Protected API final pass — 2026-09-19
- Reviewed the V2 API route surface under `v2/app/api`.
- Administrative routes use DB-backed role/module guards and reviewed routes are society scoped.
- Resident dashboard/notices/programs/profile routes require authenticated sessions; resident financial/payment access remains owner/unit scoped.
- Public health and residence-discovery routes remain intentionally unauthenticated with restricted response/data scope.
- No new authorization defect found in this pass.

## Current external verification gate
- Firebase Console Email/Password + custom `/verify-email` action-handler configuration still needs external console verification.
- Live browser E2E signup → Firebase verification → activation → login and password recovery remains pending.
- Production sign-off remains pending until live E2E and final smoke tests are completed.

## Accessibility hardening — 2026-09-19
- Added explicit `htmlFor`/input `id` associations to previously unassociated authentication form labels on signup, forgot-password, and reset-password pages.
- No authentication or validation behavior changed.

## Form accessibility hardening — 2026-09-19
- Added explicit `htmlFor`/input `id` associations to payment, admin bill, and admin gallery form fields.
- No business logic or authorization behavior changed.
- V2 Build Check #494 and Cloudflare Deploy #429 succeeded; deployment reported 0 npm vulnerabilities.
- Latest deployed Worker version: `9c2330db-2ec7-4b6e-990c-5cbe277edf2b`.

### Atomic resident login activation — 2026-09-19
- Firebase resident login activation was made transactional, matching the earlier email-verification transaction hardening.
- Residence claim and user activation now succeed or roll back together.
- Commit: `c00682a72bd0b93d3f1d632fbbb3e71133c4f651`.
- GitHub Actions has not yet reported a workflow run for this commit, so build/deployment status remains unverified.
