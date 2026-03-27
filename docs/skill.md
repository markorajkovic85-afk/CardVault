# Skill: cardvault-ux-review

## Description
This skill defines a complete, opinionated protocol for reviewing, auditing, and improving the CardVault PWA's UX, visual design, AI patterns, accessibility, and performance using only vanilla JavaScript and the existing codebase. Use it whenever an AI assistant needs to evaluate a new feature, page, or change proposal for CardVault, or when generating UX recommendations and implementation snippets.

---

## App Identity

CardVault is a mobile-first Progressive Web App for scanning, organizing, and reusing business cards. Users capture physical cards with their phone camera; OCR and Google Gemini extract contact data; contacts and card images are stored in Supabase and cached in IndexedDB for offline use.

- **Primary users**: Networkers, freelancers, and professionals who collect many cards at events and need a fast, trustworthy way to digitize and rediscover contacts.
- **Core journeys**:
  - Scan card → review AI fields → add context → save → find later.
  - Maintain own digital card → share via QR/vCard.
  - Periodically review stats/dashboard and sync data.
- **Tech stack**:
  - Vanilla ES modules; hash-based SPA router in `src/js/app.js`.
  - Supabase (PostgreSQL + Auth + Storage) via `src/js/supabase-*.js`.
  - IndexedDB via `src/js/db.js` and `idb` library.
  - PWA shell: `src/index.html`, `src/manifest.json`, `src/sw.js`.
  - Custom CSS in `src/css/styles.css` (no framework).
- **URLs**:
  - Live: https://card-vault-zeta.vercel.app
  - Repo: https://github.com/markorajkovic85-afk/CardVault

---

## Design System Reference

This section is the source of truth for how CardVault currently looks. When reviewing or proposing changes, reuse and extend these tokens instead of inventing new, inconsistent styles.

### CSS Tokens (`src/css/styles.css`)

**Colors — "Quiet Luxury" palette**
```css
--color-primary: #1B2A4A        /* deep navy */
--color-primary-light: #2A3F6B
--color-primary-dark: #111D33
--color-accent: #C9A84C         /* gold */
--color-accent-hover: #B8963E
--color-accent-glow: rgba(201, 168, 76, 0.15)
--color-bg: #EEECEA             /* warm off-white surface */
--color-surface: #FFFFFF
--color-text: #1A1A1A
--color-text-light: #6B7280
--color-text-inverse: #FFFFFF
--color-success: #22C55E
--color-error: #EF4444
--color-warning: #F59E0B
--color-border: #D4D2CE
```

**Shape & Spacing**
```css
--radius: 12px
--radius-sm: 8px
/* App content area */
#app { padding: 16px 16px calc(var(--nav-height) + var(--safe-bottom) + 16px); max-width: 480px; }
--safe-bottom: env(safe-area-inset-bottom, 0px)
```

**Shadows (depth scale)**
```css
--shadow-xs     /* subtle lift, borders */
--shadow        /* default card elevation */
--shadow-lg     /* toasts, popovers */
--shadow-card   /* hero cards, business card */
--shadow-inset  /* input fields */
```

**Motion**
```css
--transition: 0.2s ease
--transition-slow: 0.35s cubic-bezier(0.4, 0, 0.2, 1)
/* Keyframes available: fadeIn, fadeInUp, slideDown, spin, skeleton-shimmer */
/* prefers-reduced-motion guard collapses all durations to 0.01ms */
```

### Typography
- Font: Inter (Google Fonts) + system stack fallback.
- `h1`: 1.5rem, 700, letter-spacing -0.02em.
- `h2`: 1.25rem, 600, letter-spacing -0.01em.
- `h3`: 1rem, 600.
- Body: 1rem / 1.5 line-height.
- `.text-sm` / captions: 0.813rem.
- Labels: 0.688rem, uppercase, letter-spacing 0.1em.

### Key Component Classes

| Class | Purpose | Notes |
|---|---|---|
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`, `.btn-block` | All interactive buttons | Primary = gold gradient; secondary = white + border |
| `.card` | White surface group | Soft shadow, 12px radius, fadeIn animation |
| `.business-card` | Hero contact/my-card preview | Navy gradient, gold accent underline, grain texture |
| `.contact-item` | List row for contacts | Gold left border, avatar circle, action icons |
| `.empty-state` | Zero-data placeholder | Centered, icon circle, heading, CTA button |
| `.toast-*` | Notification banners | Fixed top, blurred bg, color-coded by status |
| `.skeleton-card`, `.skeleton-line` | Loading placeholders | Shimmer animation, reuse for any list/card load |
| `.sheet-overlay`, `.sheet` | Bottom sheet | Blurred overlay, slides up from bottom |
| `.steps`, `.step` | Wizard step indicator | Gold active dot expands to pill |
| `.ai-badge` | Per-field AI confidence chip | Color variants: `--low` (amber), `--medium` (blue), `--high` (green) |
| `.scan-ai-banner` | Scan review step AI info strip | Gold-tinted, explains what AI did |
| `.inline-alert` | Inline warning/error in forms | Amber-tinted |
| `.bento-card`, `.dashboard-bento` | Dashboard 2×2 grid | Staggered fadeInUp entrances |
| `.status-dot` | Sync/online status indicator | `.online`, `.pending`, `.offline` color states |
| `<nav-bar>` (web component) | Fixed bottom navigation | 5 destinations, safe-area aware, hidden on login |

---

## UX Principles for This App

Every CardVault change **must** adhere to all of these:

1. **Mobile thumb-zone first**  
   Core actions (Scan, Save, Contacts, My Card) must be reachable in the lower half of the screen on a typical phone without stretching. Never place primary actions only at the top.

2. **AI assists — user decides**  
   AI may extract, suggest, or re-read but never silently commits irreversible changes. Every AI action must have a clear decision moment (Approve / Edit / Reject).

3. **AI behavior must be explainable**  
   When AI is involved, users see what it did, what it is unsure about, and how to correct it. Explanations must be short and in plain language — no technical jargon.

4. **Offline is a first-class state**  
   The app must always work offline for scanning and viewing existing contacts. Offline/online and sync status must be visible and never surprising. Never silently fail a sync.

5. **Optimistic, reversible operations**  
   Save, delete, and sync should feel instant via optimistic UI, with clear feedback and a path to undo or recover where feasible.

6. **Low cognitive load per screen**  
   Each view focuses on one primary job: scan, review, browse, or configure. Do not mix creation, analytics, and heavy configuration on one screen.

7. **Respect performance and bundle budget**  
   No frameworks. Keep total JS under 200 KB. Prioritize LCP < 2.5s and INP < 200ms. Prefer CSS and small vanilla modules over large dependencies.

8. **Accessibility is non-negotiable**  
   Touch targets, focus rings, and color contrast must meet at least WCAG 2.2 AA. New patterns must not regress keyboard or screen reader support.

9. **Consistency over novelty**  
   Prefer reusing existing patterns (cards, buttons, empty states, toasts) over adding entirely new component families.

10. **Clear data provenance**  
    For contact fields, users should be able to infer whether data came from OCR, AI re-read, or manual entry — and what was changed last.

---

## Current Page Inventory

| Route | Primary file | Purpose | Main user action | Known UX weaknesses |
|---|---|---|---|---|
| `#/login` | `src/pages/login.js` | Email/password sign in and sign up | Enter credentials → Sign In or Create Account | No route-level focus management; no inline field errors (only toasts); Supabase misconfiguration not surfaced helpfully |
| `#/my-card` | `src/pages/my-card.js` | Create, view, and share user's digital business card + QR | Edit card / Share card | No explicit local vs synced indicator; Share uses text vCard only |
| `#/contacts` | `src/pages/contacts.js` | Browse, search, sort, and delete contacts | Open contact detail; delete; email/call | Icon buttons lack ARIA labels; swipe-to-delete CSS exists but not wired up; no skeleton loaders |
| `#/scan` | `src/pages/scan.js` | Capture card images, run OCR + optional Gemini, review and save | Scan front → back (optional) → review → save | No per-field AI confidence indicators; step changes not announced for assistive tech; loading state is spinner-only |
| `#/dashboard` | `src/pages/dashboard.js` | Show aggregate stats and 30-day trend | Review stats; decide to scan more or review contacts | No CTA from stats into filtered contacts; chart has minimal a11y affordances; layout functional but not fully bento |
| `#/settings` | `src/pages/settings.js` | Configure Supabase, inspect sync state, export/import, sign out | Save Supabase config; test connection; push/pull data | No explicit AI config section; export/import lacks progress feedback; large textareas not fully annotated |
| `#/contact/:id` | `src/pages/contact-detail.js` | View and edit a single contact including context and scanned images | Edit contact; use email/phone/website | No AI vs manual field provenance; limited alt text for stored images; no undo for edits |

---

## Trend Alignment Checklist

For any proposed change, answer each item **Yes / No** with a brief justification:

- [ ] **Thumb-zone alignment** — Are primary actions reachable from the lower half of the screen on a small phone without stretching?
- [ ] **Design system reuse** — Does the change use existing `--color-*`, `--shadow-*`, `--radius*` tokens and core component classes instead of inventing ad-hoc styles?
- [ ] **2025–2026 visual patterns** — Does it use depth (shadows, layers), micro-interactions, and bento-style cards for complexity rather than flat dense tables or aggressive skeuomorphism?
- [ ] **AI trust patterns** (if AI involved) — Is there a clear distinction between what AI did vs what the user confirms? Are confidence/limitations visible where stakes are high?
- [ ] **Progressive enhancement with AI** — Does the feature still work without AI or when the model is unavailable (e.g., manual entry fallback)?
- [ ] **Offline and sync clarity** — Is offline/online state visible? Are pending sync counts or banners shown when relevant?
- [ ] **WCAG 2.2 AA minimum** — Do interactive targets meet at least ~44×44 px recommended for thumb controls? Is focus clearly visible and not obscured by sticky elements? Are dynamic updates announced?
- [ ] **Performance budget** — Does the change avoid large new dependencies and heavy main-thread work? Are skeletons/optimistic patterns used instead of long spinners?
- [ ] **Single dominant purpose per screen** — Does each screen keep one clear job (scan, manage contacts, review stats, configure settings) with supporting, not competing, secondary actions?
- [ ] **Consistent flows** — Does the change preserve the expected scan → review → context → save → contacts path and existing navigation structure?

---

## Review Protocol

When conducting a UX review of any new CardVault feature or page, follow these steps **in order**:

**Step 1: Check against Design System Reference**  
Verify that colors, typography, spacing, shadows, and component usage align with the tokens and classes documented above. Flag any new ad-hoc styles that should instead reuse existing tokens.

**Step 2: Run Trend Alignment Checklist**  
Evaluate the proposal against each checklist item. Mark Yes/No with reasons. Explicitly call out where the proposal diverges from 2025–2026 best practices.

**Step 3: Verify UX Principles**  
Check all 10 UX principles. Note any violations. A violation of principles 1–5 (thumb-zone, AI assist, explainability, offline, optimistic) is at minimum High severity.

**Step 4: Check mobile thumb zone and target sizes**  
Examine whether primary actions are in the lower half of the screen (roughly the bottom 60% on a 375px-wide phone) and whether tap targets meet the ~44×44 px recommendation. Check that no critical action is exclusively accessible via small icons.

**Step 5: Verify AI-UX patterns (if AI involved)**  
Assess: Is there a review/confirm step? Is there a failure fallback? Are confidence signals present where relevant? Is the AI action reversible? Is the user in control?

**Step 6: Check accessibility minimums**  
Verify focus management on route changes, color contrast (4.5:1 for normal text, 3:1 for large), keyboard accessibility, ARIA labels for icon-only buttons, and screen reader patterns for dynamic content (toasts, loading states, step changes).

**Step 7: Output structured findings with severity ratings**  
Summarize all issues using the Output Format below, grouped by category, with a severity level and specific recommendation for each.

---

## Severity Rating Scale

| Level | Criteria | Examples |
|---|---|---|
| **Critical** | Blocks core flows for many users, causes data loss, or misfires destructive actions | Save button unreachable on mobile; AI auto-applies wrong data without review |
| **High** | Seriously harms trust, accessibility, or reliability; workaround exists but is non-obvious | No offline indication; destructive action with no confirmation; very low text contrast |
| **Medium** | Noticeable UX friction but not flow-blocking | Misplaced secondary CTA; confusing label; minor focus issues; missing skeleton loader |
| **Low** | Cosmetic or minor consistency issue | Slight spacing inconsistency; icon misalignment; non-critical animation roughness |
| **Enhancement** | Optional improvements aligning with trends or polish; not required for functional/accessible use | View transitions; richer chart interactions; advanced AI summaries |

---

## Output Format

When outputting a UX review using this skill, use this exact markdown structure:

```markdown
# CardVault UX Review — [Feature/Page Name]

## Summary
- One–three bullet summary of overall UX quality and main issues.

## Page Context
- **Route:** `#/scan`
- **Files touched:** `src/pages/scan.js`, `src/js/ocr.js`
- **Primary user goal:** Short description.

## Findings Table

| Category | Area | Severity | Finding | Recommendation |
|---|---|---|---|---|
| Visual Design | Button spacing | Medium | Primary CTA too close to top edge on small phones. | Move to bottom 40% of screen, use `.btn-block` pattern. |
| AI-UX | Confidence | High | No field-level indicator of AI certainty on review form. | Add `.ai-badge--low` chip next to uncertain fields. |

## Detailed Findings

### Visual Design
1. **[Severity] Finding title**
   - **What:** Explain the specific issue.
   - **Why it matters:** Tie to design system token or 2025–2026 trend.
   - **Recommendation:** Specific change with file reference if applicable.

### AI-UX Patterns
*(same structure)*

### Mobile UX
*(same structure)*

### Accessibility
*(same structure)*

### Performance & Offline UX
*(same structure)*

## Trend Alignment Checklist
- [x] Thumb-zone alignment — primary action `.btn-primary` is at bottom of scroll.
- [ ] AI trust patterns — no confidence cues on extracted fields. See Finding AI-2.
- …

## Implementation Notes
- Short bullet list of implementation hints with CSS class names, file paths, or code snippets.
```

---

## Common Patterns Library

These patterns are pre-approved for CardVault. All must be implemented in vanilla JS + CSS using existing design tokens.

---

### 1. Skeleton Loader

```css
/* Already in styles.css — reuse as-is */
.skeleton-card {
  border-radius: var(--radius);
  padding: 14px 16px;
  background: linear-gradient(90deg, #e5e3df 0%, #f2f0ec 40%, #e5e3df 80%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
  margin-bottom: 8px;
  box-shadow: var(--shadow-xs);
}
.skeleton-line {
  height: 10px;
  border-radius: 999px;
  background: rgba(0,0,0,0.06);
  margin: 6px 0;
}
```

```js
function renderContactsLoading(container) {
  container.innerHTML = `
    <h1>Contacts</h1>
    ${[40, 60, 45].map(w => `
      <div class="skeleton-card">
        <div class="skeleton-line" style="width:${w}%;"></div>
        <div class="skeleton-line" style="width:${w + 20}%;"></div>
      </div>`).join('')}
  `;
}
```

---

### 2. Bottom Sheet

```css
/* Already in styles.css — reuse as-is */
/* .sheet-overlay and .sheet */
```

```js
export function openBottomSheet(contentHtml, onClose) {
  const overlay = document.createElement('div');
  overlay.className = 'sheet-overlay';
  overlay.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${contentHtml}</div>`;
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) { overlay.remove(); if (onClose) onClose(); }
  });
  document.body.appendChild(overlay);
  overlay.querySelector('.sheet').focus?.();
  return overlay;
}
```

---

### 3. Swipe to Delete (with non-drag fallback for WCAG 2.5.7)

Always keep a standard Delete button as the primary affordance. Swipe is progressive enhancement only.

```js
function attachSwipeToDelete(el, onDelete) {
  let startX = 0, currentX = 0;
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
    deleteBg.style.transform = `translateX(${100 + delta / 0.8}%)`;
  });
  el.addEventListener('pointerup', () => {
    if (startX - currentX > 60) onDelete();
    el.style.transform = '';
    deleteBg.style.transform = 'translateX(100%)';
    startX = 0;
  });
}
```

---

### 4. Pull to Refresh

Use only on `#/contacts` list view. Do NOT attach to scan steps or forms.

```js
function attachPullToRefresh(scrollContainer, onRefresh) {
  let startY = 0, pulling = false;
  scrollContainer.addEventListener('touchstart', (e) => {
    if (scrollContainer.scrollTop !== 0) return;
    startY = e.touches[0].clientY;
  });
  scrollContainer.addEventListener('touchmove', (e) => {
    if (!startY) return;
    if (e.touches[0].clientY - startY > 60) pulling = true;
  });
  scrollContainer.addEventListener('touchend', async () => {
    if (pulling) await onRefresh();
    startY = 0; pulling = false;
  });
}
```

---

### 5. AI Confidence Badge

```css
/* Already in styles.css — reuse as-is */
.ai-badge {
  border: 1px solid rgba(201, 168, 76, 0.55);
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 0.625rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
/* Add these confidence variants */
.ai-badge--low    { background: #fef3c7; color: #92400e; border-color: rgba(245,158,11,0.4); }
.ai-badge--medium { background: #e0f2fe; color: #075985; border-color: rgba(14,165,233,0.4); }
.ai-badge--high   { background: #dcfce7; color: #166534; border-color: rgba(34,197,94,0.4); }
```

```js
// In scan review form, after Gemini response:
function confidenceLevel(score) {
  if (score >= 0.8) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function labelForLevel(level) {
  return { high: 'AI — likely correct', medium: 'AI — verify', low: 'AI — check carefully' }[level];
}

function renderFieldWithBadge(label, value, confidence) {
  const level = confidenceLevel(confidence);
  return `
    <div class="form-group">
      <label class="form-label">
        ${label}
        <span class="ai-badge ai-badge--${level}">${labelForLevel(level)}</span>
      </label>
      <input class="form-input" value="${value || ''}" />
    </div>`;
}
```

---

### 6. Optimistic Update Pattern

```js
/**
 * Apply change locally (fast), run remote async, roll back on failure.
 * @param {Function} applyLocal  - synchronous local DB update; return rollback fn or null
 * @param {Function} runRemote   - async remote operation
 * @param {Function} [onError]   - called with error if remote fails
 */
async function optimisticUpdate(applyLocal, runRemote, onError) {
  const rollback = await applyLocal();
  try {
    return await runRemote();
  } catch (err) {
    if (typeof rollback === 'function') await rollback();
    if (onError) onError(err);
    throw err;
  }
}

// Example: delete contact
async function deleteContactOptimistic(id) {
  await optimisticUpdate(
    async () => {
      const saved = await getContact(id);          // backup
      await deleteLocalContact(id);                // optimistic remove
      renderContactList();                         // immediate UI update
      return async () => { await saveLocalContact(saved); renderContactList(); };
    },
    () => deleteRemoteContact(id),
    (err) => showToast('Delete failed — contact restored', 'error')
  );
}
```

---

### 7. Offline Indicator Banner

```css
.offline-banner {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: 0; right: 0;
  z-index: 900;
  padding: 8px 16px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.813rem;
  font-weight: 500;
  text-align: center;
  box-shadow: var(--shadow-xs);
  animation: slideDown 0.25s ease;
}
```

```js
// In src/js/app.js, call once on init
function initOfflineBanner() {
  const id = 'cv-offline-banner';
  function update() {
    let el = document.getElementById(id);
    if (!navigator.onLine) {
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.className = 'offline-banner';
        el.setAttribute('role', 'status');
        el.setAttribute('aria-live', 'polite');
        el.textContent = 'Offline — new cards will sync when you\'re back online.';
        document.body.appendChild(el);
      }
    } else if (el) {
      el.remove();
    }
  }
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  update();
}
```

---

### 8. Standard Empty State Component

Reuse existing `.empty-state` — this is the standard pattern:

```js
function renderEmptyState({ icon = '📭', title, body, ctaLabel, ctaHref }) {
  return `
    <div class="empty-state">
      <div class="icon">${icon}</div>
      <h2>${title}</h2>
      <p>${body}</p>
      ${ctaLabel ? `<a href="${ctaHref}" class="btn btn-primary mt-16">${ctaLabel}</a>` : ''}
    </div>`;
}

// Usage:
// renderEmptyState({ icon:'📇', title:'No contacts yet', body:'Scan your first business card to get started.', ctaLabel:'Scan a card', ctaHref:'#/scan' })
```

---

### 9. View Transition Wrapper (progressive enhancement)

```js
// Wrap the core navigate() render call in src/js/app.js
async function renderWithTransition(renderFn) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) {
    return renderFn();
  }
  return document.startViewTransition(renderFn).finished;
}
```

---

### 10. Focus Management on Route Change

```js
// Call after each route render in navigate()
function moveFocusToMainHeading(container) {
  const heading = container.querySelector('h1');
  if (heading) {
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: false });
  }
}
```

---

## Do Not Do

The following are **forbidden** patterns for CardVault. Violating these is a Critical or High severity finding:

1. **No new JS frameworks** — Do not introduce React, Vue, Svelte, Lit, or similar. All changes must use vanilla JS modules.

2. **No heavy UI libraries** — Avoid large component libraries or animation frameworks. Prefer small, targeted utilities or pure CSS.

3. **No blocking global spinners for primary flows** — Never block the entire screen with a full-page spinner for operations that can be optimistic or incremental (saving, syncing, loading lists). Use skeleton loaders or progress indicators instead.

4. **No breaking offline behavior** — Do not create flows that require network connectivity where offline alternatives exist. The app must support scanning, viewing, and saving contacts while offline.

5. **No silent AI writes** — AI must never overwrite user data without a visible review step. Avoid any pattern where AI modifies multiple fields without an explicit user confirmation.

6. **No low-contrast text or tiny tap targets** — Do not introduce controls with contrast below 4.5:1 (normal text) or 3:1 (large text/UI). Do not create icon-only buttons without ARIA labels or targets smaller than 24×24 px (aim for ~44×44).

7. **No cluttered mixed-purpose screens** — Do not put scanning, analytics, and settings on the same view. Keep single-purpose screens.

8. **No conflicting edge gestures** — Do not use left/right edge swipes in ways that conflict with iOS/Android system back gestures. Swipe-to-delete must only operate on horizontal item swipes, not full-screen gestures.

9. **No ignoring `prefers-reduced-motion`** — Any new animation or transition must be suppressed or reduced to a near-instant fade when this preference is set. The global CSS guard in `styles.css` handles most cases — never override it.

10. **No diverging from the visual language without justification** — New UI must feel like CardVault: navy + gold + off-white, `var(--radius)` corners, Inter typeface, and the existing shadow scale. Introducing a contradicting visual style without a documented, approved reason is forbidden.

---

*Last updated: 2026-03-27 — Generated by Perplexity AI UX audit of CardVault v1.*
