# Architecture

## Application
- Next.js 16 / React 19
- App Router under `v2/app`
- Prisma 6 with PostgreSQL adapter
- Supabase PostgreSQL
- Supabase private Storage
- Cloudflare Workers runtime/deployment
- vinext + Wrangler

## Deployment Flow
`GitHub (fresh-society-v2) → build → vinext → Cloudflare Workers`

Cloudflare is the production runtime. Vercel is not the production target.

## Data Flow
Browser → Next.js route/page → authenticated server logic → Prisma → Supabase PostgreSQL.

Private uploads use Supabase Storage and signed/authorized access rather than public buckets.

## Property Model
- Society contains both property types.
- Apartment blocks A/B/C contain units 1–26.
- Tenaments 1–27 can have dynamically created floor units.
- A tenant occupies a PropertyUnit; tenant is not a Property.

## Identity
- Master Admin
- Up to 6 Sub Admin / Organizer accounts
- Resident accounts use DB role `OWNER`.
- `residentType` identifies OWNER or TENANT.

## Authorization
All protected operations must validate authenticated session, role, society scope, and operation-specific permission. Resident data must be filtered to the resident's permitted scope.

## Financial Privacy
Residents do not receive society-wide income/expense information. Admin/organizer financial access remains society scoped.

## Authentication
Resident registration:
pre-register unit → signup enabled → matching identity data → OTP email verification → Master Admin approval → active login.

## Storage
Profile images and payment screenshots use private Supabase Storage. URLs should be authorized/signed, not exposed as unrestricted public objects.
