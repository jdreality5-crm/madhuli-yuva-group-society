# Changelog

## 2026-09-18
- Hardened file uploads with magic-byte validation for allowed image/PDF types, including payment QR images.
- Added database-backed login abuse protection: 5 failed password attempts trigger a 15-minute lock; successful login clears the lock.
- Added Prisma migration for login abuse tracking fields.
- Added permanent AI continuation and project status documentation.
- Locked Cloudflare Workers as the production deployment target.
- Documented Next.js + vinext + Wrangler deployment architecture.
- Documented security, authorization, database, storage, and continuation rules.
- Replaced the stale V1 deployment guide with the current V2 Cloudflare deployment guide.
- Identified the root README as stale V1 documentation; it is now being replaced with V2 guidance.

## Prior V2 work
Implementation history remains in Git commits for property units, resident signup/OTP, approval workflow, login/session enforcement, profile management, financial isolation, payment verification, and Cloudflare configuration.
