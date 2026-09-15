# Society Function Management V2

Fresh production-oriented rebuild of the Society Function Management system.

Goals: preserve existing features, add missing reference-report fields, enforce organizer-only financial access, support Gujarati, and provide production-ready deployment configuration.

## Security
Financial endpoints and financial UI data must never be exposed to flat owners.

## Deployment

V2 keeps the existing Next.js + Supabase architecture and now includes a Cloudflare Workers deployment path using vinext. Cloudflare recommends vinext for full-stack Next.js applications on Workers.

### Cloudflare setup

1. Import the GitHub repository into Cloudflare Workers Builds.
2. Set the project root/directory to `v2`.
3. Production branch: `fresh-society-v2`.
4. Build command:
   `npm run db:generate:edge && npm run db:migrate && npm run db:seed && npm run build:vinext`
5. Deploy command:
   `npx wrangler deploy`
6. Add these as Cloudflare Worker secrets/environment variables; never commit values:
   - `DATABASE_URL`
   - `JWT_SECRET`
   - `MASTER_ADMIN_PASSWORD`
   - `RESET_MASTER_ADMIN_PASSWORD` (temporary only when a one-time password reset is required)
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_STORAGE_BUCKET`

The Prisma client uses the engine-less client with `@prisma/adapter-pg`, which is suitable for Workers' serverless runtime. The existing Supabase PostgreSQL database and Storage bucket remain the data layer.

### Local Cloudflare check

From `v2`:

```bash
npm install
npx vinext check
npm run db:generate:edge
npm run build:vinext
```

Cloudflare authentication is required before the first real deployment. Use `wrangler login` locally or a Cloudflare API token in CI. Do not put secrets in Git.
