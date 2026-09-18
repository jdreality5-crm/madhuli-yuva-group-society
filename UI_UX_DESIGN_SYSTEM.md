# UI/UX DESIGN SYSTEM — Madhuli Yuva Group

## Direction
The V2 application uses a Creative Tim-inspired professional admin/UI direction while keeping the locked identity: premium maroon + antique gold + ivory, Gujarati-friendly typography, responsive/mobile-first behavior, and accessible controls.

Creative Tim is used as a design reference/source for free, open-source patterns only. Current references include Material Dashboard Shadcn, Soft UI Dashboard Tailwind, and Material Tailwind Dashboard React.

## Rules for every screen
1. Do not redesign each page independently; use the shared visual language.
2. Keep the maroon/gold/ivory brand palette; adapt Creative Tim patterns to this identity.
3. Prefer clean cards, generous spacing, restrained shadows, rounded controls, strong hierarchy, and clear primary actions.
4. Tables must remain readable on mobile; use horizontal scrolling where safe collapse is not possible.
5. Forms need visible labels, 44px+ touch targets, clear focus states, validation/error feedback, and loading/disabled states.
6. Use status badges for state, not color alone.
7. Empty/loading/error states must be intentional UI.
8. Use Gujarati alongside English where it improves resident comprehension.
9. Avoid excessive gradients, animation, glassmorphism, or decoration that hurts performance/readability.
10. Never expose financial, resident, or admin data merely for visual/demo purposes.

## Shared visual tokens
- Maroon: #641d2a
- Deep maroon: #42131c
- Antique gold: #b18a3a
- Gold highlight: #e7d5a8
- Ivory background: #faf8f3
- Surface: #ffffff
- Soft surface: #f7f2eb
- Ink: #292523
- Muted: #746b65
- Border: #e6ddd3

## Component language
- App shell: sticky topbar + desktop sidebar + mobile bottom navigation.
- Page header: eyebrow + clear H1 + supporting context + optional action/meta.
- Cards: 14–20px radius, subtle border, restrained shadow.
- Primary button: maroon filled.
- Secondary button: ivory/soft surface with border.
- Destructive action: explicit danger styling and confirmation for consequential changes.
- Data tables: clear headers, compact rows, mobile overflow.
- Stat cards: simple number + label + supporting note.
- Auth screens: premium but calm, focused on secure sign-in/signup.
- Resident screens: fewer admin controls, larger touch targets, clear payment/profile actions.

## Creative Tim free references
- Free template catalog: https://www.creative-tim.com/templates/free
- Free Tailwind dashboard catalog: https://www.creative-tim.com/templates/tailwind-dashboard
- Material Dashboard Shadcn: https://www.creative-tim.com/product/material-dashboard-shadcn
- Soft UI Dashboard Tailwind: https://www.creative-tim.com/product/soft-ui-dashboard-tailwind
- Material Tailwind Dashboard React: https://www.creative-tim.com/product/material-tailwind-dashboard-react

## Implementation policy
The project does not need to migrate frameworks just to imitate a template. Existing Next.js/React/Vinext architecture remains locked. Reusable visual primitives and CSS are preferred over adding a large UI dependency unless a dependency provides a clear accessibility or maintenance benefit.

## Rollout
- Phase 1: root app shell, global tokens, PWA/common chrome.
- Phase 2: dashboard + authentication screens.
- Phase 3: admin CRUD modules (properties, flats, events, notices, gallery).
- Phase 4: finance/payment/reporting modules.
- Phase 5: resident mobile flows and final accessibility/performance pass.

Every migrated page must preserve API behavior, authorization, data scope, and route compatibility.
