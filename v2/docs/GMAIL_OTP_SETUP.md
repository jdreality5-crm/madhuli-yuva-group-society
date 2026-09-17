# Gmail OTP Email Setup

## Purpose

The society application uses an email-provider abstraction for owner email verification. Gmail API is the preferred low-cost provider; Resend remains available as a fallback provider.

The application still owns OTP generation, hashing, expiry, attempt limits, resend cooldown, and verification. Gmail only transports the OTP email.

## Recommended account

Use a dedicated Gmail account for society verification mail. Do not authorize the application's Gmail integration with a personal/private mailbox that should remain separate from the society system.

The receiver sees the configured society sender address, not the developer's personal Gmail address.

## Google Cloud setup

1. Create or select a Google Cloud project dedicated to this application.
2. Enable the Gmail API.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID for the server-side application.
5. Use the narrow Gmail scope:
   `https://www.googleapis.com/auth/gmail.send`
6. Complete the one-time OAuth authorization for the dedicated sender Gmail account with offline access and obtain a refresh token.
7. Store the refresh token only as a deployment secret.

Google's server-side OAuth flow uses a refresh token for offline access, so the application does not need the Gmail account password. The Gmail API's `gmail.send` scope is limited to sending mail on the user's behalf; do not request `mail.google.com` because this application does not need mailbox read/delete access.

## Cloudflare secrets / environment variables

For Gmail provider:

- `EMAIL_PROVIDER=gmail`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL`

Never commit real values to GitHub, `.env` files that are tracked, logs, screenshots, or documentation.

## Provider fallback

For a controlled fallback, set:

- `EMAIL_PROVIDER=resend`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Do not configure both providers as an automatic per-message fallback without an explicit operational decision. Automatic fallback can accidentally send duplicate OTP emails if the primary provider accepts a request but the response is lost. The current provider switch is configuration-based and keeps delivery deterministic.

## Operational safeguards

The application should continue to enforce:

- 6-digit cryptographically random OTP
- hashed OTP storage only
- 10-minute expiry
- one-time token consumption
- maximum verification attempts
- resend cooldown
- invalidation of previous pending OTPs
- no account activation when email delivery fails
- provider errors must not reveal credentials or OTP values in logs
- sender credentials must remain server-side

Gmail sending limits are provider/account limits, not an application guarantee. The application must treat quota/rate-limit responses as delivery failures and avoid aggressive retries. For this society use case, the expected volume is low; if the system later grows beyond Gmail's practical limits, the provider abstraction allows migration to a dedicated transactional email service without changing the owner verification workflow.

## First production test

After secrets are configured:

1. Register an admin-approved owner using a test mailbox.
2. Request an OTP once.
3. Confirm the message arrives from the dedicated society sender.
4. Verify the OTP.
5. Confirm the token cannot be reused.
6. Confirm resend cooldown works.
7. Confirm an expired/wrong OTP is rejected.
8. Confirm Gmail/provider errors do not activate the account.
9. Check Cloudflare logs for errors only; never record the OTP or refresh token.

## Important

Do not put a Gmail password, app password, OAuth authorization code, access token, or refresh token in source control. The refresh token is a secret and must be supplied through the deployment secret mechanism.
