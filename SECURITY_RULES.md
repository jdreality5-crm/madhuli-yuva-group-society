# Security Rules

## Authentication
- Protected APIs require a valid authenticated session.
- Residents require email verification, approval, and ACTIVE status.
- Current DB state must be checked where session invalidation matters.
- OTPs are hashed at rest, expire, have attempt limits, and support resend throttling.

## Authorization
- Master Admin and Organizer permissions are explicit.
- Resident endpoints are restricted to resident-owned/permitted records.
- Society scope is mandatory for administrative reads/writes.
- Never trust client-supplied society IDs, user IDs, role claims, or property IDs without server-side validation.

## Property / Resident Linking
- Unit links must be unique and society scoped.
- Reassignment must safely unlink old relationships.
- Tenant identity is represented by `residentType=TENANT`, not by changing DB role away from `OWNER`.

## Financial Data
- Residents must not access society-wide income, expense, bill, or report data.
- Payment records must be owner scoped on resident operations.
- Admin verification must be society scoped and atomic.

## Files
- Sensitive uploads stay in private Supabase Storage.
- Validate size and allowed media type.
- Prefer content/signature validation where feasible, not MIME type alone.
- Signed URLs must be issued only after authorization.

## Auditing
Sensitive administrative state changes should create audit records, especially resident approval/rejection and payment verification/rejection.

## Concurrency
State transitions such as payment verification, OTP consumption, approval, and unit linking must use atomic conditions/transactions to prevent double-processing.
