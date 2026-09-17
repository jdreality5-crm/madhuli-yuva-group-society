# Login UI Reference

## Requirement

The V2 login page should use the animated login-page concept shown in the user-provided reference video in the project conversation.

## Design direction

- Premium, modern animated authentication experience.
- Use a split/switching layout with a polished animated panel rather than a static form-only page.
- Support smooth Login ↔ Signup transitions while keeping the authentication flow clear.
- Adapt the animation to the society's existing maroon + antique-gold + ivory visual system.
- Keep motion subtle and professional; avoid distracting or excessive effects.
- Preserve accessibility: keyboard navigation, visible focus states, readable contrast, reduced-motion support, and usable form validation/error states.
- Keep authentication behavior unchanged: login, owner signup, Master Admin approval, email OTP verification, resend/cooldown, and session creation remain server-controlled.
- Do not put secrets or authentication logic in client-side animation code.

## Responsive behavior

- Desktop: use the full split animated composition.
- Tablet: reduce decorative motion and preserve form width/readability.
- Mobile: prioritize the authentication form; simplify or collapse decorative animation so the page remains fast and usable.

## Implementation note

Treat the reference video as a visual interaction reference, not as a source for copying proprietary assets. Recreate the interaction using the project's own branding, typography, icons, and assets.
