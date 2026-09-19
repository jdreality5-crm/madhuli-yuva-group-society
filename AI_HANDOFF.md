# AI HANDOFF — Society Management System

> **Primary continuation document for ChatGPT.** Any new ChatGPT session continuing this repository must read this file and `PROJECT_STATUS.md` first, then inspect the current branch state before changing code.

## PROJECT
Society Management System for Pramukhpark Society + Sarang Apartment.

## REPOSITORY / BRANCH
- Repository: `jdreality5-crm/madhuli-yuva-group-society`
- Active development branch: `fresh-society-v2`
- Production target: Cloudflare Workers
- Legacy/testing platform: Vercel; do not treat it as the production target.

## CURRENT PHASE
Security hardening, authorization audit, E2E verification, then production readiness.

## CURRENT TASK
Complete Firebase resident-auth configuration/live E2E verification and continue the protected-API/security audit. Profile updates now enforce the 15-day mobile lock while allowing normal name edits; email remains read-only in the profile API.

## NEXT TASK
Configure Firebase Email/Password Auth and the custom email action handler URL (`/verify-email`), add/verify `FIREBASE_WEB_API_KEY` in Cloudflare, then E2E-test signup → verification → activation → login and password recovery. After that, continue endpoint-by-endpoint authorization and payment idempotency review.

## COMPLETED
- V2 Next.js application established.
- Prisma + Supabase PostgreSQL integration.
- Supabase private storage integration.
- Apartment/tenament property model.
- Resident owner/tenant distinction.
- Resident signup with Firebase Authentication, Gmail-only validation, property/unit matching, and Firebase email verification.
- Resident account auto-activation after successful Firebase email verification; no new Master Admin approval step.
- Firebase resident password authentication with the existing application session layer.
- 15-day email/mobile contact lock fields added to the resident identity model.
- Session revalidation against current DB state.
- Profile image upload/change/remove and required mobile profile field.
- Property setup and unit/floor management.
- Resident approval UI/API.
- Financial role/society isolation improvements.
- Cross-society event validation for income/expense/bills.
- Payment submission and admin verification/rejection flow.
- Cloudflare Workers + vinext deployment configuration.
- Replaced stale root V1 README with V2 source-of-truth guidance.
- Added permanent AI handoff, status, architecture, development, security, deployment, and changelog docs.
- Fixed cross-society event linking on bill updates.
- Made resident payment evidence submission race-safe and cleaned losing uploaded screenshots.
- Signed payment-account QR URLs before returning them.
- Hardened legacy resident approval endpoint to require verified email and unlink rejected units.
- Restricted generic storage upload to organizers.
- Hardened property-unit resident linking to active/approved/email-verified residents and allowed safe empty-unit clearing.
- Fixed property-unit audit logging to use the actual Prisma AuditLog fields (`userId`, `action`, `module`, `recordId`, `details`) so the route matches the schema.
- Hardened profile email consistency by rejecting profile email changes and making the login email read-only in the UI.

## PENDING
1. Complete protected API authorization/society-scope audit.
2. Complete profile email/session consistency review.
3. Review remaining property edge cases and legacy flat compatibility.
4. Complete payment idempotency review, including transaction/reference uniqueness expectations.
5. E2E auth/signup/approval/rejection tests.
6. Final UI/UX/accessibility pass.
7. Production build/typecheck.
8. Cloudflare production deployment verification.
9. Final production sign-off.

## FINAL STAGE
Not production-signed-off yet.

## LOCKED REQUIREMENTS
- Maximum 6 Sub Admin / Organizer accounts.
- Unlimited residents.
- Pramukhpark Society = tenament side.
- Sarang Apartment = apartment side.
- Apartment blocks A/B/C, units 1–26 each = 78 apartment units.
- Society = 27 tenaments.
- Tenament floors are dynamic: Ground, Ground+1, Ground+2, etc.
- Tenant is an occupant of a specific unit/floor, not a separate property.
- DB role `OWNER` is retained for resident accounts; `residentType` distinguishes OWNER vs TENANT.
- Protected endpoints must enforce authentication, role, society scope, and relevant permission.
- Residents must only see their own permitted financial/payment data.
- Profile mobile number is compulsory.
- Profile images live in private Supabase Storage.
- Do not invent production/sample data.
- Do not casually change the established database role semantics or route compatibility.
- Cloudflare Workers is the production deployment target.
- Supabase PostgreSQL is the database.
- Supabase private Storage is the file store.
- Preserve the premium maroon + antique gold + ivory UI direction and Gujarati-friendly responsive UX.

## DATABASE / AUTH
Prisma is the application data layer. Supabase PostgreSQL is the database. Resident signup requires a pre-registered unit with matching email/mobile and signup enabled, a @gmail.com address, Firebase email verification, then automatic activation. Firebase verification is an email link, not a 6-digit OTP. New resident registrations are automatically marked APPROVED for compatibility; legacy pending/rejected registrations remain blocked.

## DEPLOYMENT
Cloudflare Workers deployment uses vinext and Wrangler. See `DEPLOYMENT.md`.

## KNOWN ISSUES / AUDIT TARGETS
- Verify every protected route rather than assuming previously audited routes remain correct.
- Property-unit PATCH had an AuditLog field mismatch; fixed in `a74276aedeca921ef7a99e853b38f250fcdb870f`.
- Profile email is now read-only and API-enforced; a separate verified email-change flow is intentionally deferred.
- Legacy `Flat` model/routes coexist with the new `PropertyUnit` model and need compatibility review.
- Firebase Authentication configuration is code-ready. `FIREBASE_WEB_API_KEY` is now wired into the Cloudflare workflow/env example, but the actual secret, Firebase Email/Password setting, and Firebase custom email action-handler configuration are not yet verified.
- Legacy Gmail/Resend OTP helper and resend route remain in the repository for compatibility; the new resident signup path no longer depends on them.
- Payment transaction/reference uniqueness and repeated submission semantics need final review.
- Production deployment corresponding to the latest commit has not yet been verified.

## DO NOT CHANGE
- Production architecture without explicit justification.
- Resident role semantics.
- Society scope model.
- Cloudflare Workers production target.
- Private-storage security model.
- Existing approval compatibility routes unless there is a deliberate migration plan.

## TESTING CHECKLIST
- Authentication and role selection.
- Resident signup and Firebase email verification.
- New Firebase resident cannot log in before email verification.
- Firebase-verified resident becomes ACTIVE immediately and can log in.
- Legacy pending/rejected resident records remain blocked.
- Deactivated/rejected existing session is revalidated.
- Resident cannot cross society boundaries.
- Resident cannot access admin financial APIs.
- Organizer cannot access another society's data.
- Payment evidence submission is atomic/race-safe.
- Payment verification is atomic/race-safe.
- Private files require authorized signed access.
- Production build and Cloudflare deployment succeed.

## LAST VERIFIED STATE
Repository configuration and current branch were re-checked on 2026-09-18. Firebase resident-auth migration code is present on `fresh-society-v2`; email verification now activates the matching resident immediately and sets the 15-day contact locks. Cloudflare CI now passes `FIREBASE_WEB_API_KEY`. Latest implementation commit is `2d9346a7e3a8dad5cd884cd3303e8cfec1d2929c`. A local typecheck/build could not be executed because the execution environment could not resolve github.com, and no workflow run was associated with this commit yet. Cloudflare Workers configuration exists at `v2/wrangler.jsonc`; `v2/package.json` contains vinext/Wrangler/Cloudflare deployment scripts. A local typecheck could not be executed because the execution environment could not resolve github.com, so build status remains unverified.

## CONTINUATION RULE
Every major implementation step must update this file and `PROJECT_STATUS.md` with CURRENT TASK, NEXT TASK, completed work, known issues, and the last verified commit.


## SECURITY AUDIT NOTE (2026-09-18)
Profile API now enforces the 15-day mobile lock. A production duplicate-mobile check found 2 existing records sharing `9876543210`; therefore a database unique mobile constraint was intentionally NOT added yet. Existing duplicate must be reconciled before introducing a unique constraint.


## PAYMENT SECURITY AUDIT (2026-09-18)
Payment transaction references are now protected by a partial unique index per society (`societyId + transactionId`) for non-empty references. Existing production data had no duplicate transaction references, so the constraint was applied successfully. The resident payment PATCH also returns a conflict instead of a generic server error when a duplicate reference is submitted. Atomic payment review already claims PENDING rows before creating Income, preventing concurrent double-verification.


## AUTHORIZATION AUDIT (2026-09-18)
Reviewed the main protected admin/payment/dashboard routes: queries are scoped by `session.societyId`, owner payment reads/writes are scoped by `ownerUserId`, and role guards are present for organizer/master-admin operations. Hardened the six-Sub-Admin limit with a Serializable Prisma transaction so concurrent creation attempts cannot silently exceed the configured maximum; serialization conflicts return a retryable 409.


## Firebase action-handler verification — 2026-09-18
- Firebase's documented email-action flow uses an oobCode and custom action-handler URL; the current app handler is /verify-email and correctly processes verifyEmail / resetPassword modes.
- Firebase Console must have the project's email templates configured to use the deployed /verify-email custom action handler. This is an external Firebase-console configuration and cannot be verified from repository source alone.
- Firebase REST verification implementation is aligned with the documented accounts:update + oobCode flow.

## CI/deployment verification — 2026-09-18
- Current branch HEAD: 6ed47f14ae6bf2e4293c405737db02c3dae8fbfb.
- GitHub reports no workflow runs attached to this commit, so this repo does not currently provide a GitHub Actions deployment result for the latest changes.
- Cloudflare Workers remains the production deployment target. Cloudflare's current documentation confirms vinext + Wrangler as the supported Next.js Workers path.
- Do not claim the latest Firebase/security changes are production-deployed until the Cloudflare Worker version/commit is independently verified.


## LEGACY V1 SURFACE AUDIT — 2026-09-18
- The repository root still contains historical V1 Express/SQLite assets (server.js, root package.json, society.db, Docker/Railway configuration, and old frontend package files).
- These files are not part of the V2 Cloudflare workflow: both V2 GitHub workflows use v2/ as their working directory, and the Cloudflare workflow deploys the V2 Worker.
- The root V1 server has insecure legacy defaults and must not be deployed or used as the production application. It contains a fallback JWT secret, SQLite storage, permissive CORS, seeded sample credentials/data, and public uploads behavior.
- Do not delete or migrate the historical V1 database automatically; preserve it unless an explicit archival/removal plan is requested.
- V2 remains the sole production source of truth.


## E2E AUTH READINESS AUDIT — 2026-09-18
- Signup path requires Firebase configuration, Gmail, pre-registered active unit/legacy flat, signupEnabled, matching registered email/mobile, and an unused residence link.
- New resident DB accounts are created inactive/approved and linked to the unit with an atomic `residentUserId IS NULL` guard; Firebase cleanup is attempted if the DB transaction fails.
- Verification activates only a matching OWNER/APPROVED DB user whose Firebase UID equals the verification result; session creation remains a normal login step.
- Login revalidates DB status/role/society on every session request and requires Firebase email verification for Firebase residents.
- Password recovery uses a generic response to reduce account enumeration and supports normalized Gmail aliases.
- Login abuse protection locks accounts after five failed attempts for 15 minutes.
- Payment creation/evidence submission/review are society- and owner-scoped, with atomic pending-row claims and transaction-reference uniqueness.
- Remaining E2E blockers are environment/configuration dependent: Firebase Console Email/Password + custom action handler, production `FIREBASE_WEB_API_KEY`, live Cloudflare deployment verification, and an actual browser/database test run.


## FINAL SECURITY SURFACE PASS — 2026-09-18
- Reviewed public health, residence-discovery, login/logout, password recovery, Firebase verification, and legacy verification endpoints.
- Health endpoint exposes only boolean configuration/database health flags and timestamp; no secret values are returned.
- Signup residence discovery exposes only active signup-enabled, unclaimed units needed for registration and is restricted to the configured society.
- Legacy OTP resend endpoint was disabled with HTTP 410 because the new resident flow uses Firebase email-link verification; this removes an unauthenticated OTP-generation and account-enumeration surface.
- Session cookie remains HttpOnly, Secure in production, SameSite=Lax, path=/, with 7-day expiry; every session request revalidates the DB user, role, society, active state, approval, and resident email verification.
- No production sign-off yet: live E2E, build/typecheck, Firebase Console configuration, and Cloudflare deployment verification remain external verification items.


## PROFILE CAMERA CAPTURE — 2026-09-18
- Profile page now provides a direct `Take Photo` action using the browser camera capture hint (`capture="user"`) plus a separate gallery/file picker.
- Existing private Supabase Storage upload, 3 MB limit, MIME checks, replacement and removal flow remains unchanged.
- Camera behavior is platform/browser controlled; supported mobile browsers open the front-camera capture UI, while unsupported browsers fall back to normal file selection.


## Latest security hardening — Sub Admin permissions
- Backend module APIs now enforce DB-backed Sub Admin permissions for EVENTS, NOTICES, GALLERY (where applicable), BILLS, EXPENSES, INCOME, PAYMENTS, and REPORTS.
- MASTER_ADMIN bypasses module permission checks; ORGANIZER/Sub Admin access is limited by its stored permissions array.
- Login sessions now carry the current permissions snapshot; `getSession()` remains DB-authoritative and reloads permissions from the User row.
- Sub Admin profile edits use the fixed Manager/Accountant/Watcher permission presets instead of accepting arbitrary permission arrays.
- Sensitive Sub Admin account management remains MASTER_ADMIN-only.


## UI/UX DESIGN SYSTEM — 2026-09-18
- Established a shared Creative Tim-inspired visual direction in UI_UX_DESIGN_SYSTEM.md using free/open-source Creative Tim references (Material Dashboard Shadcn, Soft UI Dashboard Tailwind, Material Tailwind Dashboard React).
- Locked the existing maroon + antique gold + ivory identity; Creative Tim patterns are adapted rather than replacing the product brand.
- Added a real Next.js root app layout at v2/app/layout.tsx so global CSS, metadata, theme color, manifest and the PWA install prompt are mounted across the application instead of only the home page.
- Removed duplicate global CSS/PWA mounting from the home and login pages.
- UI rollout should continue page-by-page: dashboard/auth, CRUD modules, finance/payment/reporting, then resident mobile/accessibility/performance.
- Do not add a large UI framework merely to imitate a template; preserve Next.js/React/Vinext and prefer reusable primitives/CSS.


## AUTH ACTION-CODE REVIEW — 2026-09-19
- The temporary response-field check for `requestType === VERIFY_EMAIL` and `emailVerified === true` was reverted after checking Firebase's documented `accounts:update` response shape; those fields are not documented as required response fields for this flow.
- The current verification handler uses Firebase's `accounts:update` + `oobCode` flow, then validates the matching local OWNER, APPROVED record and Firebase UID before activation.

## DEPENDENCY SECURITY HARDENING — 2026-09-19
- Added a `deepmerge-ts` `^8.0.1` package override after CI dependency audit identified the vulnerable transitive version.
- V2 Build Check #484 passed with `npm install` reporting **0 vulnerabilities**.
- Cloudflare Deploy #419 passed for the same commit and deployed Worker version `bffbeabc-87b9-45be-8276-530e5ca0cbfa`.
- Current verified implementation commit: `f31185f89e15699cbf71750c146c9b48b476af27`.

## FINAL PROTECTED-API PASS — 2026-09-19
- Reviewed the V2 API route surface under `v2/app/api`.
- Administrative routes use DB-backed role/module guards (`requireMasterAdmin`, `requireOrganizer`, or `requireSubAdminPermission`) and society scoping was present across the reviewed admin financial/property/content routes.
- Resident dashboard/notices/programs/profile routes require an authenticated session; resident bills and payments remain owner/unit scoped.
- Public health and residence-discovery routes remain intentionally unauthenticated with restricted response/data scope.
- No new authorization defect was found in this pass.

## CURRENT EXTERNAL VERIFICATION GATE
- Firebase Console Email/Password and custom `/verify-email` action-handler configuration still require external Firebase Console verification.
- Live browser E2E for signup → verification → activation → login and password recovery remains pending.
- Production sign-off remains pending until the live Firebase E2E path and final smoke tests are completed.


## ACCESSIBILITY HARDENING — 2026-09-19
- Added explicit label/input associations to resident signup residence and resident-type controls, plus password-recovery and password-reset fields.
- This improves keyboard/screen-reader form navigation without changing validation or auth behavior.
- CI/deployment verification for the latest accessibility commits remains pending until the push-triggered workflows complete.


## FORM ACCESSIBILITY HARDENING — 2026-09-19
- Added explicit label/input associations to resident payment fields and reviewed admin bill/gallery form controls.
- No payment, upload, authorization, or validation behavior changed.
- Verified by V2 Build Check #494 and Cloudflare Deploy #429.


## ATOMIC RESIDENT LOGIN ACTIVATION — 2026-09-19
- Firebase resident login now claims the PropertyUnit and activates the User inside one Prisma transaction when completing first verified login.
- A failed activation cannot leave the residence claimed while the account remains inactive.
- Commit: `c00682a72bd0b93d3f1d632fbbb3e71133c4f651`.
- GitHub Actions has not yet reported a workflow run for this commit, so build/deployment status remains unverified.
