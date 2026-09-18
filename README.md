# Society Management System — V2

Production-focused society management application for **Pramukhpark Society** and **Sarang Apartment**.

## Current Source of Truth
Before continuing development, read:
1. `AI_HANDOFF.md`
2. `PROJECT_STATUS.md`
3. `ARCHITECTURE.md`
4. `DEVELOPMENT_RULES.md`
5. `SECURITY_RULES.md`
6. `DEPLOYMENT.md`

The old V1 architecture is not authoritative.

## Stack
- Next.js 16
- React 19
- Prisma 6
- PostgreSQL on Supabase
- Supabase private Storage
- Cloudflare Workers
- vinext
- Wrangler
- TypeScript

## Production Architecture
`GitHub → vinext/Wrangler → Cloudflare Workers → Supabase PostgreSQL / private Storage`

Cloudflare Workers is the production deployment target. Vercel is legacy/testing only.

## Property Structure
- **Sarang Apartment:** Blocks A, B, C; units 1–26 in each block.
- **Pramukhpark Society:** Tenaments 1–27.
- Tenament floors are dynamic.
- Tenants are occupants of a specific PropertyUnit.

## Roles
- Master Admin
- Up to 6 Sub Admin / Organizers
- Unlimited residents
- Resident DB role remains `OWNER`; `residentType` distinguishes OWNER/TENANT.

## Major Modules
- Society/property and resident management
- Resident signup + email OTP + Master Admin approval
- Authentication/session enforcement
- Programs/events
- Income, expenses, bills
- Notices
- Gallery
- Reports/annual reports
- UPI/payment accounts and resident payments
- UTR/screenshot verification
- Audit logs
- Resident profile and private profile images

## Security Principles
- Server-side authentication and authorization
- Society-scoped administrative access
- Resident data isolation
- Private Supabase Storage
- Hashed/expiring/rate-limited OTP
- Atomic state transitions where required
- No invented production data

## Development
From `v2/`:

```bash
npm install
npm run dev
npm run dev:vinext
npm run build
npm run build:vinext
npm run deploy:cloudflare
```

## Current Stage
Security/authorization audit → E2E verification → production readiness.

## Status
See `PROJECT_STATUS.md` for the exact current task and pending sequence.
