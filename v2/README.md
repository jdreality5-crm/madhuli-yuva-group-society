# Society Function Management V2

Fresh production-oriented rebuild of the Society Function Management system.

Goals: preserve existing features, add missing reference-report fields, enforce organizer-only financial access, support Gujarati, and provide production-ready deployment configuration.

## Security
Financial endpoints and financial UI data must never be exposed to flat owners.

## Deployment
The V2 application is designed for Vercel with an external persistent database. Secrets are environment variables only.
