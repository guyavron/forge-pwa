# Forge PWA — Fitness & Nutrition Tracker

React + Vite + TypeScript + Tailwind + Supabase, installable to an iPhone home screen as a
standalone app via "Add to Home Screen" — no App Store, no Apple Developer account, no cost.

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env` with your Supabase project's values (Project Settings → API in the Supabase
dashboard):

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Then run the DDL script you already have against that project's SQL Editor if you haven't yet
(the 5 tables: `profiles`, `workouts`, `exercise_logs`, `meals`, `sleep_logs`).

```bash
npm run dev      # local dev server at http://localhost:5173
npm run build    # production build to dist/ — also generates the service worker + manifest
```

## Getting it on your iPhone home screen

Two steps, both free:

1. **Deploy it somewhere with a real HTTPS URL.** This is the part that actually solves the
   problem — a local dev server on your computer only works for a phone on the exact same
   WiFi network reaching your computer's local IP, which runs into the same firewall/router
   isolation issues as any local dev server. A deployed URL sidesteps all of that. The
   simplest free options for a Vite app:
   - **Vercel** (`npx vercel`) or **Netlify** (`npx netlify deploy`) — both auto-detect Vite,
     free tier is plenty for personal use, gives you a real `https://...` URL in under a minute.
   - Add the same `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as environment variables in
     whichever host's dashboard — they need to be set at build time, not just in your local `.env`.
2. **On the iPhone**, open that URL in **Safari** (must be Safari, not Chrome — "Add to Home
   Screen" as a standalone app is a Safari-only feature on iOS), tap the Share icon, then
   **Add to Home Screen**. It launches full-screen with no browser chrome from then on,
   exactly like a native app icon.

Local dev (`npm run dev`) is fine for building/testing on your computer's own browser, but
treat deployment as the real path to your phone — not local-network tunneling.

## Architecture

```
src/
  lib/
    supabaseClient.ts   # reads import.meta.env.VITE_SUPABASE_* — throws clearly if missing
    api.ts               # all Supabase queries live here, typed; components never call
                           # supabase.from(...) directly
    dateHelpers.ts        # calendar-day bucketing for the timestamptz columns
  types/
    database.ts            # hand-written row types matching the SQL schema
  screens/
    Dashboard.tsx           # calorie/protein progress vs profile targets, today's training,
                              # latest sleep_logs row
    Nutrition.tsx             # meal-category sections, multi-item quick-add sheet, delete
    Workouts.tsx                # activity type, duration/calories/HR/notes, exercise sets
                                  # sub-form for Gym/Bouldering, progressive-overload comparison
    Profile.tsx                   # shared between onboarding (no profile row yet) and editing
  components/ui/                # Card, ProgressBar, SectionHeading
  App.tsx                        # profile-loading gate + bottom tab shell
```

### Why this shape

- **Single-user, no auth** — matches the DB schema (no `user_id` columns). `getProfile()`
  always fetches the first/only `profiles` row; `App.tsx` shows the onboarding form full-screen
  until one exists, then the tabbed shell.
- **No `Database` generic on the Supabase client** — supabase-js's generic inference expects a
  very specific shape (Row/Insert/Update *and* a Relationships array per table); a hand-rolled
  type that's close-but-not-exact silently produces `never` types on every insert/update
  instead of a helpful error. Type safety instead lives at the `api.ts` boundary via explicit
  function signatures, which is what the rest of the app actually imports from. If this grows,
  regenerate real types with `npx supabase gen types typescript` and wire the generic back in.
- **Progressive overload comparison** (`getPreviousBestForExercise` in `api.ts`) searches
  backward through your last 20 workouts for the most recent one containing a matching
  `exercise_name`, and compares best `weight_kg`. It runs *before* the new workout is inserted
  (using a captured timestamp) so the new session never compares against itself.
- **RLS is wide open** per the DDL script — fine for solo prototyping, not for anything with
  real other users. See the comment block at the top of the SQL script for what to change.

## Known gaps

- **No sleep-logging UI** — the Dashboard reads and displays the latest `sleep_logs` row, but
  nothing in the app writes to that table (wasn't in the original feature spec). Add a form if
  you want to actually populate it, or connect a source that writes there automatically.
- **`daily_calorie_target` / `daily_protein_target` are manual inputs**, not calculated — the
  `profiles` table schema doesn't include the fields (sex, activity level) a real BMR/TDEE
  formula needs, so Profile just asks you to enter your own targets directly.
- Not tested against a live Supabase project yet (this environment doesn't have your
  credentials) — the build compiles clean and the app boots/renders correctly with a
  gracefully-handled connection failure, but the actual Dashboard/Nutrition/Workouts screens
  need a real database to exercise fully. Worth going through each screen once you're pointed
  at your real project.
