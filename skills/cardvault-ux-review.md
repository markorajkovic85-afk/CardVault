# Skill: cardvault-ux-review

## Description
This skill defines a complete, opinionated protocol for reviewing, auditing, and improving the CardVault PWA’s UX, visual design, AI patterns, accessibility, and performance using only vanilla JavaScript and the existing codebase. Use it whenever an AI assistant needs to evaluate a new feature, page, or change proposal for CardVault, or when generating UX recommendations and implementation snippets.

## App Identity
CardVault is a mobile-first Progressive Web App for scanning, organizing, and reusing business cards. Users capture physical cards with their phone camera; OCR and Google Gemini extract contact data; contacts and card images are stored in Supabase and cached in IndexedDB for offline use.

- **Primary users**: Networkers, freelancers, and professionals who collect many cards at events and need a fast, trustworthy way to digitize and rediscover contacts.
- **Core journeys**:
  - Scan card → review AI fields → add context → save → find later.
  - Maintain own digital card → share via QR/vCard.
  - Periodically review stats/dashboard and sync data.
- **Tech stack**:
  - Vanilla ES modules; hash-based SPA router in `src/js/app.js`.
  - Supabase (PostgreSQL + Auth + Storage) via `supabase-*.js`.
  - IndexedDB via `db.js` and `idb` library.
  - PWA shell: `src/index.html`, `src/manifest.json`, `src/sw.js`.
  - Custom CSS in `src/css/styles.css` (no framework).
- **URLs**:
  - Live: https://card-vault-zeta.vercel.app
  - Repo: https://github.com/markorajkovic85-afk/CardVault

## Design System Reference

This section is the source of truth for how CardVault currently looks. When reviewing or proposing changes, reuse and extend these tokens instead of inventing new, inconsistent styles.

### Tokens (from `src/css/styles.css`)
- **Colors** (quiet luxury palette):
  - `--color-primary: #1B2A4A` (deep navy)
  - `--color-primary-light: #2A3F6B`
  - `--color-primary-dark: #111D33`
  - `--color-accent: #C9A84C` (gold accent)
  - `--color-accent-hover`, `--color-accent-glow` (soft highlight)
  - Surface and text: `--color-bg: #EEECEA`, `--color-surface: #FFFFFF`, `--color-text: #1A1A1A`, `--color-text-light`, `--color-text-inverse`.
  - Status: `--color-success`, `--color-error`, `--color-warning`, `--color-border`.

- **Shape & spacing**:
  - Radii: `--radius: 12px`, `--radius-sm: 8px`.
  - App padding: `#app { padding: 16px 16px calc(var(--nav-height) + var(--safe-bottom) + 16px); max-width: 480px; }`.
  - Safe area: `--safe-bottom: env(safe-area-inset-bottom, 0px)`.

- **Shadows (depth scale)**:
  - `--shadow-xs`, `--shadow`, `--shadow-lg`, `--shadow-card`, `--shadow-inset` used to express hierarchy (items, cards, hero cards).

- **Motion**:
  - `--transition: 0.2s ease` (default), `--transition-slow: 0.35s cubic-bezier(0.4, 0, 0.2, 1)`.
  - Keyframes: `fadeIn`, `fadeInUp`, `slideDown`, `spin`.
  - Global `prefers-reduced-motion` guard that essentially disables animation when set.

### Typography
- Base font: Inter via Google Fonts, plus system fallbacks (`'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`).
- Sizes:
  - `h1` ~ 1.5rem, bold, negative letter-spacing for headings.
  - `h2` ~ 1.25rem, semi-bold.
  - `h3` ~ 1rem.
  - `.text-sm` ~ 0.813rem for meta/assistive text.
- Style: Business/professional, slightly condensed headings and generous whitespace.

### Key component classes

**Buttons (`.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-block`)**
- Pill-ish, bold uppercase-leaning labels, hover and active states with subtle scale.
- Primary: gold gradient background, used for main actions (Scan, Save, Share).
- Secondary: white surface with border; used for navigation, less critical actions.

**Cards (`.card`)**
- White surfaces with soft shadows, used for groups of controls or info sections.
- Animated in with `fadeIn` by default.

**Business card preview (`.business-card`)**
- Deep blue gradient background, accent underline and avatar circle.
- Applied on: My Card hero, Contact detail hero.

**Contact list item (`.contact-item`)**
- Rounded card with accent-colored left border, avatar circle, and stacked text.
- Uses entrance animations on first few items.

**Empty state (`.empty-state`)**
- Centered icon circle, short headline, supporting text, and primary CTA.
- Used on: empty contacts, empty My Card, scan success “Contact Saved” confirmation.

**Toast notifications (`.toast-*`)**
- Fixed to top, blurred background, color-coded by status (success/error/warning/info).

**Navigation (`<nav-bar>`)**
- Fixed bottom, blurred glass effect, 5 main destinations (Dashboard, My Card, Scan, Contacts, Settings).
- `--nav-height` and `--safe-bottom` ensure safe area padding.
- Hidden on `#/login`.

Use these classes and tokens when proposing or implementing any new UI.

## UX Principles for This App

Every CardVault change must adhere to these principles:

1. **Mobile thumb-zone first**
   Core actions (Scan, Save, Contacts, My Card) must be reachable with the thumb on small devices without stretching. Avoid placing primary actions only at the top.

2. **AI assists, user decides**
   AI may extract, suggest, or re-read but never silently commits irreversible changes. Every AI action must have a clear decision moment (Approve / Edit / Reject).

3. **AI behavior must be explainable**
   When AI is involved, users should see what it did, what it’s not sure about, and how to correct it. Explanations must be short and in plain language.

4. **Offline is a first-class state**
   The app must always work offline for scanning and viewing existing contacts. Offline/online and sync status must be visible and never surprising.

5. **Optimistic, reversible operations**
   Save, delete, and sync should feel instant via optimistic UI, with clear feedback and a path to undo or recover from errors where feasible.

6. **Low cognitive load per screen**
   Each view focuses on one primary job: scan, review, browse, or configure. Avoid mixing creation, analytics, and heavy configuration on a single screen.

7. **Respect Core Web Vitals and bundle budget**
   No frameworks; keep JS lean (< 200 KB) and prioritize LCP and INP. Prefer CSS and small vanilla modules over large dependencies.

8. **Accessibility is non-negotiable**
   Touch targets, focus, and contrast must meet at least WCAG 2.2 AA. New patterns must not regress keyboard and screen reader support.

9. **Consistency over novelty**
   Prefer reusing existing patterns (cards, buttons, empty states, toasts) over adding entirely new component families.

10. **Clear data provenance**
    For contact fields, users should be able to infer whether data came from OCR, AI re-read, or manual entry — and what changed last.

## Current Page Inventory

For each page: route, primary file, purpose, main action, known UX weaknesses.

1. **Login**
   - Route: `#/login`
   - File: `src/pages/login.js`
   - Purpose: Email/password sign in and sign up.
   - Primary user action: Enter credentials → Sign In or Create Account.
   - Known weaknesses: No route-level focus management, no inline field error messages beyond toasts, limited guidance when Supabase is misconfigured.

2. **My Card**
   - Route: `#/my-card`
   - File: `src/pages/my-card.js`
   - Purpose: Create, view, and share the user’s digital business card + QR.
   - Primary action: Edit card / Share card.
   - Weaknesses: No explicit indication if card is only local vs synced; Share relies on text vCard, not yet showing AI usage (none for now).

3. **Contacts**
   - Route: `#/contacts`
   - File: `src/pages/contacts.js`
   - Purpose: Browse, search, sort, and delete contacts.
   - Primary action: Open a contact detail; secondary: delete, email, call.
   - Weaknesses: Icon/List buttons lack ARIA labels; swipe-to-delete CSS exists but behavior is click + confirm only; no skeleton loaders.

4. **Scan**
   - Route: `#/scan`
   - File: `src/pages/scan.js`
   - Purpose: Capture card images, run OCR and optional Gemini, review and save contacts.
   - Primary action: Scan front → (optional) scan back → review → save.
   - Weaknesses: No explicit AI confidence indicators; step changes are not announced for assistive tech; loading state is spinner-only.

5. **Dashboard**
   - Route: `#/dashboard`
   - File: `src/pages/dashboard.js`
   - Purpose: Show aggregate stats (totals, weekly/monthly, occasions, 30-day trend).
   - Primary action: Review stats; implicitly, decide to scan more or review contacts.
   - Weaknesses: No CTAs from stats into filtered contacts; chart has minimal accessibility affordances; layout is functional but not fully “bento.”

6. **Settings**
   - Route: `#/settings`
   - File: `src/pages/settings.js`
   - Purpose: Configure Supabase, inspect sync state, export/import data, sign out.
   - Primary action: Save Supabase config, test connection, push/pull data.
   - Weaknesses: No explicit AI configuration section; export/import operations lack progress feedback; large textareas not fully annotated for screen readers.

7. **Contact detail**
   - Route: `#/contact/:id`
   - File: `src/pages/contact-detail.js`
   - Purpose: View and edit a single contact, including context and scanned images.
   - Primary action: Edit contact or use email/phone/website.
   - Weaknesses: No explicit provenance (AI vs manual) for fields; limited description/alt text for stored images; no undo for edits.

## Trend Alignment Checklist

For any proposed UI/UX change to CardVault, the AI must answer each of these as **Yes/No** with a short justification:

1. **Mobile thumb-zone alignment**
   - Are primary actions reachable from the lower half of the screen on a typical phone without stretching?

2. **Design system reuse**
   - Does the change reuse existing tokens (`--color-*`, `--shadow-*`, `--radius*`) and core components (`.card`, `.btn`, `.business-card`, `.empty-state`, `.contact-item`) instead of inventing new styles?

3. **2025–2026 visual patterns**
   - Does it use depth, micro-interactions, and bento-style cards for complexity rather than flat, dense tables or aggressive skeuomorphism?

4. **AI UX trust patterns** (if AI involved)
   - Is there a clear distinction between what AI did and what the user confirms (e.g., review step, AI badges)?
   - Are confidence/limitations visible where stakes are meaningful?

5. **Progressive enhancement with AI**
   - Does the feature still work without AI or when the model is unavailable (e.g., manual entry, fallback flows)?

6. **Offline and sync clarity**
   - Is the offline/online state clear?
   - Are sync operations visible, with pending counts or banners when relevant?

7. **Accessibility (WCAG 2.2 AA minimum)**
   - Do interactive targets meet at least 24×24 CSS px and preferably approximate 44×44 for thumb-based controls?
   - Is focus clearly visible and not obscured by sticky elements?
   - Are dynamic updates (toasts, loading) announced appropriately?

8. **Performance and Core Web Vitals**
   - Does the change avoid large new dependencies and heavy blocking work on the main thread?
   - Are skeletons/optimistic patterns used instead of long spinners for key flows?

9. **Information hierarchy**
   - Does each screen still focus on one dominant task (scan, manage contacts, review stats, or configure settings) with supporting, not competing, actions?

10. **Consistency with existing flows**
    - Does the change preserve the expected user flows (scan → review → context → save → contacts) and navigation structure?

## Review Protocol

When an AI reviews a new CardVault feature/page, follow this exact protocol:

1. **Check against Design System Reference**
   - Verify that colors, typography, spacing, and component usage align with the tokens and components described above. Flag any new ad-hoc styles.

2. **Run Trend Alignment Checklist**
   - Evaluate the proposal against each checklist item, marking Yes/No with reasons. Explicitly call out where it diverges from current 2025–2026 best practices.

3. **Verify UX Principles**
   - Ensure the feature respects the UX principles (thumb-zone first, AI assists user, offline-first, optimistic/reversible, accessibility). Note any violations.

4. **Check mobile thumb zone and target sizes**
   - Examine whether primary actions are in the lower half of the screen and whether tap targets meet minimum recommended sizes.

5. **Verify AI-UX patterns (if AI involved)**
   - Assess clarity of AI behavior, presence of decision moments, confidence/uncertainty signaling, and error recovery pathways.

6. **Check accessibility minimums**
   - Confirm focus management, color contrast, target size, keyboard accessibility, and screen reader patterns for dynamic content.

7. **Output structured findings with severity ratings**
   - Summarize issues grouped by category (Visual Design, AI-UX, Mobile UX, Accessibility, Performance) and assign a severity level to each.

## Severity Rating Scale

Use this scale for every issue:

- **Critical**
  - Blocks core flows (login, scan, save, view contacts) for many users or causes data loss / action misfires.
  - Examples: Save button unreachable on mobile; AI auto-applies wrong phone numbers without review.

- **High**
  - Seriously harms trust, accessibility, or reliability but has a workaround.
  - Examples: No offline indication; destructive actions with no confirmation; very low contrast on primary text.

- **Medium**
  - Noticeable UX friction but not flow-blocking.
  - Examples: Misplaced secondary CTA, confusing label, minor focus issues, missing skeleton loaders.

- **Low**
  - Cosmetic or minor consistency issue.
  - Examples: Slight spacing inconsistencies, icon misalignment, non-critical animation roughness.

- **Enhancement**
  - Optional improvements that align with trends or polish but are not required for functional or accessible use.
  - Examples: Additional view transitions, richer charts, more advanced AI summaries.

## Output Format

When using this skill, the AI must produce UX review outputs in **Markdown** with this exact structure:

```markdown
# CardVault UX Review – [Feature/Page Name]

## Summary
- One-three bullet summary of overall UX quality and main issues.

## Page Context
- **Route:** `#/scan`
- **Files touched:** `src/pages/scan.js`, `src/js/ocr.js`
- **Primary user goal:** Short description.

## Findings Table

| Category | Area | Severity | Finding | Recommendation |
| --- | --- | --- | --- | --- |
| Visual Design | Example | Medium | Short description of issue. | Concrete improvement tied to design system/trend. |
| AI-UX | Example | High | … | … |

## Detailed Findings

### Visual Design
1. **[Severity] Finding title**
   - **What:** Explain the issue.
   - **Why it matters:** Tie to design system or trend.
   - **Recommendation:** Specific change.

### AI-UX Patterns
… (same structure)

### Mobile UX
…

### Accessibility
…

### Performance & Offline UX
…

## Trend Alignment Checklist

- [x] Mobile thumb-zone alignment – brief justification.
- [ ] AI UX trust patterns – explanation.
- [x] Offline & sync clarity – explanation.
- …

## Implementation Notes

- Short list of implementation hints (CSS/JS snippets, files to touch).
```

All findings must be concrete, implementation-oriented, and tied back to either the design system, UX principles, or 2024–2026 trends.

## Common Patterns Library

These patterns are pre-approved for CardVault and must be implemented using vanilla JS and existing CSS tokens.

### 1. Skeleton loader

**CSS:**

```css
.skeleton-card {
  border-radius: var(--radius);
  padding: 14px 16px;
  background: linear-gradient(90deg, #e5e3df 0%, #f2f0ec 40%, #e5e3df 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
  margin-bottom: 8px;
}

.skeleton-line {
  height: 10px;
  border-radius: 999px;
  background: rgba(0,0,0,0.06);
  margin: 6px 0;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Usage in JS (example for contacts list):**

```js
function renderContactsLoading(container) {
  container.innerHTML = `
    <h1>Contacts</h1>
    <div class="skeleton-card">
      <div class="skeleton-line" style="width:40%;"></div>
      <div class="skeleton-line" style="width:60%;"></div>
      <div class="skeleton-line" style="width:30%;"></div>
    </div>
    <div class="skeleton-card">
      <div class="skeleton-line" style="width:55%;"></div>
      <div class="skeleton-line" style="width:35%;"></div>
    </div>
  `;
}
```

### 2. Bottom sheet

**CSS:**

```css
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(27, 42, 74, 0.4);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
  display: flex;
  justify-content: center;
  align-items: flex-end;
  z-index: 2100;
}

.sheet {
  width: 100%;
  max-width: 480px;
  border-radius: 16px 16px 0 0;
  background: var(--color-surface);
  box-shadow: var(--shadow-card);
  padding: 16px 16px calc(16px + var(--safe-bottom));
  animation: fadeInUp 0.25s var(--transition-slow);
}
```

**JS (open/close helpers):**

```js
export function openBottomSheet(contentHtml) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `<div class="sheet">${contentHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return overlay;
}
```

### 3. Swipe to delete (with non-drag fallback)

Use this only as an enhancement, with a standard Delete button still present.

**CSS (already partially present):**

```css
.contact-item {
  position: relative;
  touch-action: pan-y;
  /* existing styles … */
}

.contact-item .delete-bg {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 80px;
  background: var(--color-error);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.813rem;
  transform: translateX(100%);
  transition: transform var(--transition);
}
```

**JS (gesture enhancer):**

```js
function attachSwipeToDelete(el, onDelete) {
  let startX = 0;
  let currentX = 0;
  const deleteBg = el.querySelector('.delete-bg');
  if (!deleteBg) return;

  el.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    el.setPointerCapture(e.pointerId);
  });

  el.addEventListener('pointermove', (e) => {
    if (!startX) return;
    currentX = e.clientX;
    const delta = Math.min(0, currentX - startX);
    el.style.transform = `translateX(${delta}px)`;
    deleteBg.style.transform = `translateX(${100 + (delta / 0.8)}%)`;
  });

  el.addEventListener('pointerup', () => {
    if (startX - currentX > 60) {
      onDelete();
    }
    el.style.transform = '';
    deleteBg.style.transform = 'translateX(100%)';
    startX = 0;
  });
}
```

### 4. Pull to refresh (list views only)

Provide as enhancement on `#/contacts`, not on forms or scan.

```js
function attachPullToRefresh(container, onRefresh) {
  let startY = 0;
  let pulling = false;

  container.addEventListener('touchstart', (e) => {
    if (container.scrollTop !== 0) return;
    startY = e.touches[0].clientY;
  });

  container.addEventListener('touchmove', (e) => {
    if (!startY) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 40) pulling = true;
  });

  container.addEventListener('touchend', async () => {
    if (pulling) await onRefresh();
    startY = 0;
    pulling = false;
  });
}
```

### 5. AI confidence badge

```css
.ai-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border-radius: 999px;
  font-size: 0.688rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ai-badge--low { background: #fef3c7; color: #92400e; }
.ai-badge--medium { background: #e0f2fe; color: #075985; }
.ai-badge--high { background: #dcfce7; color: #166534; }
```

**Example usage in a form group:**

```html
<div class="form-group">
  <label class="form-label">
    Email
    <span class="ai-badge ai-badge--low">AI - check</span>
  </label>
  <input class="form-input" type="email" name="email" />
</div>
```

### 6. Optimistic update pattern

**Generic helper:**

```js
async function optimisticUpdate(applyLocal, runRemote, onError) {
  const rollback = await applyLocal();
  try {
    const result = await runRemote();
    return result;
  } catch (err) {
    if (rollback) await rollback();
    if (onError) onError(err);
    throw err;
  }
}
```

Use this for delete/update flows where you update IndexedDB immediately and then sync to Supabase.

### 7. Offline indicator banner

See Phase 1 quick win pattern; reuse `.offline-banner` for any feature that needs global offline visibility.

### 8. Standard empty state component

Reuse and extend existing `.empty-state` styles, with this markup structure:

```html
<div class="empty-state">
  <div class="icon">[SVG or emoji]</div>
  <h2>Title</h2>
  <p>Short explanation, max two lines.</p>
  <button class="btn btn-primary mt-16">Primary action</button>
</div>
```

Use this component for any new views that can be empty (filters, dashboards, etc.).

## Do Not Do

The following are **forbidden** patterns for CardVault:

1. **No new JS frameworks**
   Do not introduce React, Vue, Svelte, or similar. All UX changes must be implementable with vanilla JS modules.

2. **No heavy UI libraries**
   Avoid importing large component libraries or animation frameworks. Prefer small, targeted utilities or pure CSS.

3. **No blocking global spinners for primary flows**
   Never block the entire screen with a spinner for operations that can be optimistic or incremental (saving, syncing, loading lists).

4. **No breaking offline behavior**
   Do not create flows that require network connectivity where offline alternatives exist (e.g., forcing online login to scan and store cards locally).

5. **No unreviewable AI actions**
   AI must not overwrite user data silently. Avoid any pattern where AI modifies multiple fields without a visible review step.

6. **No low-contrast or tiny tap targets**
   Do not introduce controls with small icons only or poor contrast against backgrounds, especially for primary actions.

7. **No cluttered mixed-purpose screens**
   Avoid putting scanning, analytics, and settings together. Each screen should keep a single, clear purpose.

8. **No custom gestures that conflict with system back/home gestures**
   Edge swipes should not block OS back; pull-to-refresh must be used carefully and only where it cannot cause data loss.

9. **No ignoring `prefers-reduced-motion`**
   Any new animations or transitions must be disabled or dramatically reduced when this preference is set.

10. **No divergence from the existing visual language without reason**
    New UI should feel like CardVault — reusing existing colors, radii, shadows, typography — not like a different product.
