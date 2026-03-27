# CardVault

Offline-first business card manager with OCR capture, IndexedDB cache, and Supabase sync.

## Supabase Setup

1. Create a Supabase project.
2. In Supabase SQL editor, run:
   - `supabase/migrations/202603270001_initial.sql`
3. In Auth settings, enable Email/Password provider.
4. In the app Settings page, paste:
   - Supabase URL (`https://<project>.supabase.co`)
   - Supabase anon key
5. Sign up/sign in from `#/login`.

### Environment Variables

For deployments, inject runtime config in `index.html` before `app.js`:

```html
<script>
  window.__CARDVAULT_CONFIG__ = {
    supabaseUrl: 'https://your-project.supabase.co',
    supabaseAnonKey: 'your-anon-key'
  };
</script>
```

The app also supports entering these values in the Settings page and storing them in `localStorage`.

### One-command local dev setup

```bash
npm run dev
```

Then open `http://localhost:3000` and configure Supabase in Settings.

## Tests

```bash
npm test
```

Covers:
- auth route guard behavior
- scoped contact payload (user isolation)
- dashboard aggregation helpers

## Migration Runbook

See [docs/MIGRATION_RUNBOOK.md](docs/MIGRATION_RUNBOOK.md).
