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
Perform a full security + authorization audit of all protected API routes and dashboard pages, followed by E2E authentication/signup/approval/rejection testing.

## NEXT TASK
After the audit: fix confirmed findings, run production build/typecheck, verify Cloudflare deployment, then complete final production sign-off.

## COMPLETED
- V2 Next.js application established.
- Prisma + Supabase PostgreSQL integration.
- Supabase private storage integration.
- Apartment/tenament property model.
- Resident owner/tenant distinction.
- Resident signup with email OTP and Master Admin approval.
- Login approval/email verification enforcement.
- Session revalidation against current DB state.
- Profile image upload/change/remove and required mobile profile field.
- Property setup and unit/floor management.
- Resident approval UI/API.
- Financial role/society isolation improvements.
- Cross-society event validation for income/expense/bills.
- Payment submission and admin verification/rejection flow.
- Cloudflare Workers + vinext deployment configuration.

## PENDING
1. Full protected API authorization/society-scope audit.
2. Profile email/session consistency review.
3. Property-unit assignment and clear-state edge cases.
4. Payment race/idempotency audit.
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
Prisma is the application data layer. Supabase PostgreSQL is the database. Resident signup requires a pre-registered unit with matching email/mobile and signup enabled, email OTP verification, then Master Admin approval before activation.

## DEPLOYMENT
Cloudflare Workers deployment uses vinext and Wrangler. See `DEPLOYMENT.md`.

## KNOWN ISSUES / AUDIT TARGETS
- Root README is stale and must not be treated as V2 architecture.
- Verify every protected route rather than assuming previously audited routes remain correct.
- Profile email changes must not leave an unsafe/stale authenticated identity.
- Unit clearing/reassignment must handle empty units and unlinking safely.
- Payment mutation must be race-safe/idempotent.
- Deployment must be verified from the actual current commit before claiming production status.

## DO NOT CHANGE
- Production architecture without explicit justification.
- Resident role semantics.
- Society scope model.
- Cloudflare Workers production target.
- Private-storage security model.
- Existing approval compatibility route unless there is a deliberate migration plan.

## TESTING CHECKLIST
- Authentication and role selection.
- Resident signup and OTP.
- Pending approval cannot log in.
- Approved + verified resident can log in.
- Rejected resident cannot log in.
- Deactivated/rejected existing session is revalidated.
- Resident cannot cross society boundaries.
- Resident cannot access admin financial APIs.
- Organizer cannot access another society's data.
- Payment verification is atomic and race-safe.
- Private files require authorized signed access.
- Production build and Cloudflare deployment succeed.

## LAST VERIFIED STATE
Repository configuration was re-checked on 2026-09-18. Cloudflare Workers configuration exists at `v2/wrangler.jsonc`; `v2/package.json` contains vinext/Wrangler/Cloudflare deployment scripts. The exact production deployment corresponding to the latest code still requires verification.

## CONTINUATION RULE
Every major implementation step must update this file and `PROJECT_STATUS.md` with CURRENT TASK, NEXT TASK, completed work, known issues, and the last verified commit.
