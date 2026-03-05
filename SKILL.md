# SKILL.md — CardVault Frontend Design

> This skill governs all frontend work on CardVault: a mobile-first PWA
> for managing business cards. Vanilla JS · No build step · CDN only ·
> Navy + Gold aesthetic · Max 480px viewport.
>
> Read CLAUDE.md and AGENTS.md before any frontend task.

---

## Project Aesthetic Identity

CardVault is a **professional personal tool** used in contexts of trust —
handing over a business card is a social act with stakes. The interface
must reflect that weight: refined, confident, not flashy. Think a
well-designed leather wallet or a premium metal card case.

**The Tone:** Quiet luxury / institutional authority.
- Navy communicates depth, credibility, professionalism.
- Gold communicates value, premium-ness, warmth.
- Together: something between a private bank and a luxury hotel concierge.

**The One Unforgettable Thing:** Every card in the vault should *feel
like it has physical weight.* Depth, shadow, and subtle material texture
are the primary tools to achieve this.

Never undercut the aesthetic with flat white cards, system fonts,
purple gradients, or generic mobile app patterns.

---

## Hard Constraints (CardVault-Specific)

These are project-level constraints. They override general frontend
best practices where they conflict:

| Constraint | Rule |
|---|---|
| **No build step** | Vanilla JS, ES modules, CDN imports only |
| **No npm packages** | CDN only — unpkg, jsDelivr, or official CDNs |
| **No localStorage for data** | IndexedDB only; localStorage only for settings |
| **No bundler/transpiler** | Write syntax all modern browsers understand today |
| **Max viewport** | `max-width: 480px` — design for mobile first, always |
| **PWA offline** | All UI states must account for offline (pending sync badge, etc.) |
| **No secrets in code** | Sheets URL is user-configured, never hardcoded |
| **No framework components** | Web Components or plain DOM only |

---

## Design Tokens — Single Source of Truth

**Never** hardcode color, spacing, radius, shadow, or timing values.
Every new component or page must use these CSS custom properties:

```css
/* Colors */
--color-primary: #1B2A4A;        /* Navy — dominant, 60% */
--color-primary-light: #2A3F6B;  /* Lighter navy — hover, gradient end */
--color-accent: #C9A84C;         /* Gold — accent, 10% — CTAs, highlights */
--color-accent-hover: #B8963E;   /* Gold hover state */
--color-bg: #F5F5F5;             /* App background */
--color-surface: #FFFFFF;        /* Card/panel surfaces */
--color-text: #1A1A1A;           /* Body text */
--color-text-light: #6B7280;     /* Metadata, labels */
--color-text-inverse: #FFFFFF;   /* Text on dark surfaces */
--color-success: #22C55E;
--color-error: #EF4444;
--color-warning: #F59E0B;
--color-border: #E5E7EB;

/* Spacing & Shape */
--radius: 12px;
--radius-sm: 8px;
--shadow: 0 2px 8px rgba(0,0,0,0.08);
--shadow-lg: 0 4px 16px rgba(0,0,0,0.12);
--nav-height: 64px;
--safe-bottom: env(safe-area-inset-bottom, 0px);

/* Motion */
--transition: 0.2s ease;
```
