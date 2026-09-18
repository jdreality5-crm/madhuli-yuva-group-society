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
