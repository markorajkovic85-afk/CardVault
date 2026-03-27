# CardVault Supabase Migration Runbook

## 1) Prepare Supabase

1. Create Supabase project.
2. Apply migration SQL:
   - `supabase/migrations/202603270001_initial.sql`
3. Confirm objects:
   - `public.contacts` table exists
   - RLS enabled and policies created
   - `card-images` storage bucket exists and is private

## 2) Configure app

1. Start app with `npm run dev`.
2. Open `#/settings`.
3. Enter Supabase URL + anon key.
4. Save config and run **Test Connection**.

## 3) Auth rollout

1. Open `#/login`.
2. Create account via email/password.
3. Sign in.
4. Verify protected routes (`#/contacts`, `#/scan`, `#/dashboard`) require active session.

## 4) Data migration from existing local cache

1. Ensure user is signed in.
2. Open Settings.
3. Click **Push Local → Supabase** to upload IndexedDB contacts and queue image uploads.
4. Click **Pull Supabase → Local** to normalize local cache to server state.

## 5) Storage migration behavior

- Existing cached base64 images remain in IndexedDB for offline mode.
- During sync, front/back images upload to `card-images/<user_id>/<contact_id>/{front|back}.jpg`.
- Contact rows store `front_image_path`/`back_image_path`.
- Contact detail page loads signed URLs for display when online.

## 6) Dashboard validation

Open `#/dashboard` and verify:
- Total contacts
- Contacts this week/month
- Distinct companies
- Top 5 occasions
- 30-day trend bars

## 7) Verification checklist

- Auth session persists on refresh.
- CRUD actions in one user are invisible to another user (RLS).
- Dashboard only reflects current authenticated user data.
- Offline saves queue and flush when online.
