# Deployment — V2

## Production Platform
**Cloudflare Workers**

Current Worker: `society-function-management-v2`.

## Toolchain
- Next.js 16
- React 19
- vinext
- Wrangler
- Cloudflare Vite plugin
- Prisma + PostgreSQL adapter
- Supabase PostgreSQL
- Supabase private Storage

## Repository Configuration
Cloudflare configuration is at `v2/wrangler.jsonc`. It defines the Worker name, compatibility date, Node compatibility flags, vinext server entry, and preview URLs.

## Commands
From `v2/`:
- `npm run dev:vinext`
- `npm run build:vinext`
- `npm run deploy:cloudflare`

The regular `npm run build` and Workers/vinext build are distinct paths. A successful Next.js build alone does not prove the Cloudflare Workers deployment path works.

## Deployment Flow
`GitHub / fresh-society-v2 → vinext build → Wrangler / Cloudflare Workers → production`

If Cloudflare Workers Builds is connected, verify its configured production branch, build command, deploy command, and environment variables in Cloudflare before release.

## Secrets
Never commit production secrets. Configure database, Supabase, authentication, email, and other secrets in the deployment environment.

## Production Verification
Before sign-off:
1. Verify the exact commit deployed.
2. Verify Cloudflare build/deployment succeeded.
3. Verify the active Worker version/deployment.
4. Smoke-test login and role enforcement.
5. Smoke-test resident signup → OTP → approval → login.
6. Smoke-test profile/private image access.
7. Smoke-test payment submission/verification.
8. Confirm private Storage objects are not publicly accessible.
9. Record the verified deployment state in `AI_HANDOFF.md`.

## Legacy
Vercel is not the production deployment target. Historical Vercel configuration should not override Cloudflare Workers architecture.
