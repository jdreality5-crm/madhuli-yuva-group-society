# PROJECT CONTEXT — Society Function Management System V2

> **Purpose:** This file is the permanent AI handoff/context document for this repository. Any AI agent, developer, or future session should read this file before changing the V2 application.
>
> **Last verified against GitHub:** 2026-09-17

## 1. PROJECT IDENTITY

- Repository: `jdreality5-crm/madhuli-yuva-group-society`
- Active development branch: `fresh-society-v2`
- Default branch: `main` (legacy/reference branch; do not treat it as the active V2 development branch unless explicitly instructed)
- V2 application directory: `v2/`
- Product: Housing Society / Apartment Function & Society Management System
- Primary backend/data platform: Supabase PostgreSQL + Supabase Storage
- ORM: Prisma
- Framework: Next.js 16 + React 19
- Deployment target: Cloudflare Workers via Vinext/Cloudflare tooling

## 2. CURRENT V2 ARCHITECTURE

Browser → Next.js/React UI → protected server/API routes → Prisma → Supabase PostgreSQL + Supabase Storage → Cloudflare Workers.

Important: V2 is not the old SQLite/Express implementation described by some legacy README/project-summary material. Those documents are historical/reference material. The V2 source under `v2/` is the active architecture.

Current V2 package confirms Next.js, React, Prisma, PostgreSQL adapter, Supabase client, bcryptjs, jose, Zod, Vite/Vinext and Wrangler dependencies.

## 3. BUSINESS GOAL

Build a production-quality society management system supporting:

- Master Admin
- Up to 6 Sub Admin / Organizer accounts
- Unlimited Flat Owners
- Society and flat management
- Owner pre-registration and controlled signup
- Email verification using 6-digit OTP
- Programs / Events
- Income
- Expenses
- Bills / receipts
- Notices / announcements
- Gallery
- Reports and annual reports
- UPI / payment accounts
- Owner payment submission with UTR and screenshot evidence
- Admin payment verification
- Audit logs
- Private Supabase Storage
- Strong role/society/data isolation
- Professional responsive Gujarati-friendly UI

## 4. ROLES AND ACCESS RULES

### Master Admin
Full control over the society, including owners, flats, sub-admins, UPI/payment accounts, financial records, reports, configuration and security-sensitive operations.

### Sub Admin / Organizer
Operational management according to assigned permissions. Maximum 6 sub-admin/organizer accounts. Permissions must be enforced server-side, not only hidden in the UI.

### Flat Owner
Can access their own profile and permitted society content such as events/notices, and can submit payments with UTR/screenshot evidence. A flat owner must NEVER receive unrestricted society-wide financial ledger data.

### Universal authorization rule
Every protected endpoint must validate:
1. Authentication
2. User role
3. Society scope/ownership
4. Required permission
5. Resource ownership where applicable

Never rely on frontend route hiding as the security boundary.

## 5. DATA / MIGRATION REFERENCE

Historical migration reference recorded for V2:

- 1 society
- 5 flats
- 4 users
- 1 event
- Active society ID recorded in prior project documentation: `demo-society-v2`
- A-101 → Raj Patel
- A-102 → Priya Sharma
- A-103 → Amit Kumar
- A-104/A-105 → unregistered

Do not invent production data. Clearly distinguish test/demo data from real society data.

## 6. OWNER PRE-REGISTRATION + SIGNUP + EMAIL OTP

Intended production flow:

1. Master Admin creates/pre-registers a flat.
2. Admin enters the registered owner email/mobile and enables owner signup.
3. Owner opens signup and enters Name, Email, Mobile, Flat Number and Password.
4. Server verifies that the flat exists, is active, has signup enabled, and the entered email/mobile match the registered flat information.
5. Owner account enters the required approval/verification state.
6. System sends a 6-digit email OTP.
7. Correct OTP verifies the email and activates the account according to the configured approval rules.
8. Wrong/expired OTP is rejected.
9. OTP should expire after approximately 10 minutes, have limited attempts, resend cooldown and rate limiting.
10. Store an OTP hash, never the plain OTP.
11. Do not create a fully authenticated owner session before required verification/approval is complete.
12. Existing organizer/sub-admin accounts must not be broken by the owner verification flow.

Important status distinction: the V2 branch has recorded implementation for owner approval/email verification and recent build/deployment checks, but live end-to-end verification remains a production-readiness task unless verified directly.

## 7. FLAT SIGNUP CONTROL

Required behavior:

- `Flat.signupEnabled` controls whether a flat can be used for owner signup.
- Admin can Enable/Disable Owner Signup from the Flats management area.
- Registered mobile and email are stored on the flat/owner pre-registration record as designed by the current schema.
- Duplicate flat numbers must be blocked server-side within a society.
- Owner signup must reject disabled/unregistered flats.
- Owner signup must validate registered email/mobile.
- Flat search should support flat number, owner, mobile and email where implemented.
- APIs must return appropriate 400/403/409/500 errors instead of silently failing.

## 8. PAYMENT ARCHITECTURE

Expected flow:

Owner → UPI/payment instruction → payment made externally → owner submits UTR/transaction reference + screenshot → admin cross-checks → payment VERIFIED → corresponding income ledger entry.

Core requirements:

- PaymentAccount for UPI/payment configuration
- Payment records
- UTR / transaction ID
- Screenshot evidence
- Processing status
- Admin verification/rejection
- Audit log
- Verified payment can create the appropriate Income ledger entry

Do NOT mark a payment successful merely because a screenshot was uploaded. Automatic bank-side confirmation requires a real payment gateway/PSP integration.

Payment verification must be concurrency-safe so two admins cannot create duplicate income records from the same payment.

Owner payment queries must return only that owner's permitted records. Admin queries must respect society and role scope.

## 9. STORAGE / FILE SECURITY

Supabase Storage bucket: `society-files` (private).

Sensitive files such as payment screenshots and bills must not be exposed through arbitrary public URLs. Validate file type/size and enforce authorization before issuing access.

Never trust a client-provided URL as proof that a file belongs to the society or payment.

## 10. DATABASE + SECURITY MODEL

Supabase PostgreSQL is the V2 database. Prisma is the server-side data-access layer.

Security hardening already recorded in project history:

- RLS enabled on public-schema tables
- Direct anon/authenticated table access revoked as part of hardening
- `_prisma_migrations` protected
- Missing foreign-key indexes added
- Security Advisor findings changed from RLS-disabled errors to informational RLS-without-policies messages

Important: RLS policies and the application authorization model still require a final production review. Do not blindly add policies without understanding how Prisma/server-side access is configured.

Required final security checks:

- Owner financial-data isolation
- Role isolation
- Society isolation
- Protected API authorization
- Storage authorization
- No secrets in source control
- Environment/deployment secrets used correctly
- Input validation
- Rate limiting for sensitive flows
- Secure OTP handling
- Safe error messages
- Audit trail for sensitive admin actions

## 11. UI / UX RULES

The product should feel like a professional premium society-management SaaS/application.

Design direction:

- Premium maroon + antique gold + ivory visual language
- Professional typography
- Gujarati-friendly typography and content handling
- Responsive desktop/tablet/mobile UX
- Touch-friendly controls
- Accessible contrast/focus states
- Clear loading, empty, success and error states
- No broken layouts at mobile widths
- Do not remove existing working functionality merely to simplify UI

## 12. REPORTS / PDF

Reports include financial summaries and detailed records, with professional PDF output.

Final QA must verify:

- Correct society identity/details
- Correct date ranges
- Correct income/expense totals
- Correct balance calculation
- Correct program/event association
- Correct Gujarati/English rendering where applicable
- Professional layout and pagination
- No unauthorized financial data in owner-facing outputs
- PDF output matches on-screen/source data

## 13. PROJECT PHASES

Use these phases as the master roadmap. A phase is not "done" just because code exists; it is done only after implementation + relevant verification.

### Phase 1 — Project analysis & V2 foundation
**Status: DONE**

- Legacy project understood
- V2 direction established
- Architecture defined
- Repository/branch structure established

### Phase 2 — Database & core backend
**Status: IMPLEMENTED / HARDENING VERIFICATION PENDING**

- Supabase/PostgreSQL integration
- Prisma schema and server-side data access
- Core society/flat/owner/event/finance structures
- Security hardening recorded
- Final access/RLS verification still required

### Phase 3 — Authentication & authorization
**Status: IMPLEMENTED / E2E VERIFICATION PENDING**

- Login/authentication
- JWT/session-related authorization
- Role protection
- Owner approval/verification implementation
- Email OTP implementation recorded
- Full live E2E testing still required

### Phase 4 — Society / Flat / Owner management
**Status: IMPLEMENTED / E2E VERIFICATION PENDING**

- Society management
- Flat management
- Owner management
- Signup enable/disable
- Registered owner contact validation
- Owner approval flow
- Search/filter behavior
- Live verification still required

### Phase 5 — Programs / Events / Notices / Gallery
**Status: IMPLEMENTED**

- Event/program management
- Notices/announcements
- Gallery/photo management
- Final regression/mobile verification required as part of production QA

### Phase 6 — Income / Expenses / Bills / Payments
**Status: IMPLEMENTED / SECURITY + E2E VERIFICATION PENDING**

- Income
- Expenses
- Bills/receipts
- Payment accounts
- Owner payment submission
- UTR/screenshot
- Admin verification/rejection
- Payment-to-income flow
- Concurrency/idempotency and isolation must be verified

### Phase 7 — Reports / Annual Reports / PDF
**Status: IMPLEMENTED / FINAL QA PENDING**

- Financial reports
- Program-wise reporting
- PDF generation
- Annual/reporting structures
- Final PDF visual/data verification pending

### Phase 8 — UI/UX + responsive/mobile QA
**Status: IMPLEMENTED / FINAL POLISH + QA PENDING**

- Premium UI
- Responsive navigation
- Mobile layouts
- Loading/empty/error states
- Gujarati-friendly UI
- Final device-width QA pending

### Phase 9 — Production verification & release audit
**Status: CURRENT PHASE**

This is the current gate before calling the system production-ready.

Required sequence:

1. Owner Signup → Approval → Email OTP → Activation E2E
2. Master Admin authentication E2E
3. Sub Admin permission E2E
4. Owner financial-data isolation E2E
5. Payment submission → verification → income E2E
6. Storage/file authorization verification
7. Final RLS/security review
8. PDF/report data and visual QA
9. Mobile/responsive QA
10. Final deployment/runtime verification
11. Record test evidence and remaining defects

## 14. CURRENT TASK — DO NOT SKIP AHEAD

**Current task:** complete production-readiness verification, beginning with the Owner Signup → Approval → Email OTP → Activation flow.

Before implementing unrelated new features, verify the existing flow in the actual V2 branch and fix defects found by testing.

The immediate questions to answer in the code/runtime are:

- Is admin flat pre-registration working?
- Does `signupEnabled` actually gate signup server-side?
- Are email/mobile matching rules enforced server-side?
- Is the owner approval state correct?
- Is the 6-digit OTP generated and stored safely?
- Is OTP hashed rather than stored plaintext?
- Are expiry, attempts and resend cooldown enforced?
- Does successful OTP verification activate the intended account state?
- Can an unverified owner obtain an authenticated session?
- Do invalid/expired OTPs fail safely?
- Does the existing organizer/sub-admin login remain unaffected?
- Is a real email provider/configuration present in deployment?

If live email delivery cannot be tested because credentials/provider configuration is absent, do not fake success. Mark the exact blocker and continue with all verifiable automated/static checks.

## 15. NEXT TASKS AFTER CURRENT TASK

After Owner Signup/OTP is verified:

1. Verify Master Admin auth and access boundaries.
2. Verify Sub Admin max-6 rule and permission boundaries.
3. Verify owner financial isolation.
4. Verify payment submission and admin verification, including duplicate/concurrent verification protection.
5. Review Supabase RLS/storage security and Prisma access assumptions.
6. Verify reports/PDF data and rendering.
7. Perform mobile/responsive QA.
8. Run final production audit and document release status.

## 16. AI DEVELOPMENT RULES

Any AI modifying this repository must follow these rules:

1. Read `PROJECT_CONTEXT.md` first.
2. Work on `fresh-society-v2` unless explicitly instructed otherwise.
3. Treat `main` as legacy/reference unless explicitly instructed.
4. Inspect existing code before adding new code.
5. Do not rewrite working modules unnecessarily.
6. Do not invent database fields, API routes, environment variables, credentials, users, payments or production data.
7. Never expose secrets in code, logs or documentation.
8. Never weaken role, society, financial or storage isolation for convenience.
9. Server-side authorization is mandatory even if UI already hides a feature.
10. Do not treat screenshot upload as payment confirmation.
11. Preserve Gujarati/English support and responsive UX.
12. Prefer small, testable changes over broad rewrites.
13. After a code change, run the relevant build/tests and inspect failures before claiming completion.
14. If a required external service is not configured, document the blocker rather than simulating a production result.
15. Update this context file when project architecture, phase status, current task or important rules materially change.

## 17. CHANGE MANAGEMENT

For every meaningful implementation task, the AI should:

- State the exact task being addressed.
- Identify relevant existing files/routes/schema.
- Make the smallest safe change.
- Validate type/build/tests where available.
- Check authorization/security implications.
- Check mobile/UI impact when UI changes are made.
- Record what was verified and what could not be verified.
- Update `PROJECT_CONTEXT.md` if the roadmap/current status changes.

## 18. DEFINITION OF DONE

A task is complete only when:

- Required code exists
- Server-side security is correct
- Relevant tests/build checks pass
- Runtime behavior is verified where possible
- No known regression is introduced
- Documentation/status is updated when needed

"Implemented" and "verified" are intentionally different states in this project.

## 19. AI HANDOFF FORMAT

At the end of a substantial task, record:

- Task
- Files changed
- Database/schema changes
- API changes
- Security considerations
- Tests/build executed
- Runtime verification performed
- Known blockers
- Next recommended task
- Updated phase status

## 20. GOLDEN RULE

**Do not start by adding new features. First understand the current V2 state, verify the current task, fix what is broken, then proceed through the roadmap in order.**

The source of truth for active implementation is the V2 code under `v2/` on `fresh-society-v2`, together with this context file and the actual Supabase configuration/state available to the authorized project tooling.
