# Forge — Case Study

**A fitness & nutrition tracking platform, shipped twice: once as a native-first mobile app, once as an installable multi-user Progressive Web App — with the second iteration replacing the first after a hard constraint made the native path a dead end.**

---

## 1. Title & Summary

**Forge** is a full-stack fitness and nutrition tracker covering macro-target calculation, nutrition logging (including AI photo-based food recognition), workout tracking with progressive-overload comparison, sleep analysis, and habit-adherence analytics (streaks, weekly/monthly summaries). It exists as two complete, working implementations built in sequence:

- **V1**: a native iOS app built on Expo/React Native, running through Expo Go, with a local SQLite data layer.
- **V2 ("Forge PWA")**: a from-scratch rewrite as an installable Progressive Web App — React, TypeScript, and Tailwind on the frontend, Supabase (Postgres + Auth) on the backend, deployed to Vercel — that replaced V1 in production after a distribution constraint made the native path impractical to keep investing in.

V2 is the live, deployed system today: a multi-user application with row-level-security-enforced tenant isolation, a Supabase Auth login flow, and a CI-connected deployment pipeline (GitHub → Vercel, auto-deploy on push).

---

## 2. Problem Statement

The real-world need was simple: track nutrition and training with enough rigor to actually inform decisions — calorie/protein targets grounded in an actual metabolic formula rather than round numbers, workouts compared against your own history rather than logged in a vacuum — without paying for or depending on infrastructure the project didn't need.

That last constraint turned out to be the one that shaped the whole engineering trajectory. Two integrations that would make the app materially more useful — Apple HealthKit (automatic workout import, heart rate, active-energy data) and any form of standalone native distribution (a real home-screen app icon, not a browser tab) — both require an active **Apple Developer Program membership ($99/year)**. Expo Go, the free path, cannot load HealthKit's native module at all, and even without HealthKit, getting *any* build onto a physical iPhone outside of Expo Go requires the same paid membership. The problem the project actually had to solve was: **deliver a real, installable, home-screen-icon fitness app with no recurring cost**, while keeping the option open to add native device integrations later if that constraint ever changed.

---

## 3. Architecture & Tech Stack

### V1 — Expo / React Native (native-first)
- **Expo Router** for file-based navigation, running exclusively through Expo Go (no EAS build, no App Store)
- **Zustand** for state, split by durability: a small `persist`-backed store (AsyncStorage) for the user profile, versus SQLite-backed stores for anything that grows unbounded (food log, workout log, exercise sets)
- **expo-sqlite** as the local data layer — chosen specifically to avoid any backend dependency for a single-device, single-user app
- **Anthropic Claude API** (vision, forced tool-use) for AI food-photo macro estimation, called client-side with a user-supplied API key held only in `expo-secure-store` (device keychain) — never as a bundled env var, since Expo's public env vars ship in plaintext in the JS bundle
- **HealthKit** (`react-native-health`) integrated, then deliberately stripped — twice — once the $99/yr membership requirement was confirmed to be non-negotiable for any path that used it

### V2 — Forge PWA (multi-user, cloud-backed)
- **React 19 + TypeScript + Vite 8**, styled with **Tailwind CSS v4** (CSS-native `@theme` token system)
- **vite-plugin-pwa** (Workbox) generating the manifest + service worker that makes "Add to Home Screen" produce a genuine standalone app on iOS Safari — the mechanism that replaced native distribution entirely
- **Supabase** (managed Postgres) as the backend: **Supabase Auth** for email/password sessions, **Row-Level Security** policies as the actual multi-tenant boundary (every table scoped to `auth.uid()`), called directly from the client via `@supabase/supabase-js` — no custom API server
- **Google Gemini API** (`gemini-2.0-flash`, vision) for AI food-photo scanning in V2, replacing the Claude integration from V1
- **Vercel**, connected to a GitHub repository — every push to `main` triggers an automatic production build and deploy, with environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GEMINI_API_KEY`) managed at the platform level rather than committed
- No backend framework, ORM, or custom REST layer: the entire data-access surface is a single typed module (`src/lib/api.ts`) wrapping `supabase-js` calls, which is the whole point of choosing Supabase — Postgres + Auth + a generated REST/RPC layer, with RLS doing the authorization work that would otherwise need hand-written middleware.

Both codebases are comparable in scope — each in the 3,000–4,000 line range across their respective `src`/`app` trees — but V2 carries meaningfully more product surface area (multi-user auth, five tracked domains instead of three, richer analytics) in roughly the same code volume, largely because Supabase's managed Postgres + RLS eliminated an entire backend-and-auth layer V1 never needed to write but V2 would have, had it used a hand-rolled server.

---

## 4. Version Evolution (V1 → V2)

**V1 shipped and worked** — onboarding, macro-target calculation, nutrition logging with saved-meal templates, manual workout logging with progressive-overload comparison, and (for a time) HealthKit sync — but it could only ever be *run*, never truly *installed*. Every session meant opening Expo Go and scanning a QR code. That gap — "how do I get this onto my actual home screen" — was the question that ended V1's active development. Once it was clear that closing that gap meant a recurring $99/year regardless of whether HealthKit stayed in the picture, the decision was made explicitly to **not** pay for infrastructure a personal tracking app didn't strictly need, and to find a distribution path that was actually free.

That path was a **Progressive Web App**: installed via Safari's native "Add to Home Screen," which produces a real standalone, full-screen, home-screen-icon app on iOS with zero App Store review, zero paid account, and zero native build step. That single distribution decision is what triggered the full rewrite rather than an incremental port — a PWA has no access to `expo-sqlite`, `expo-secure-store`, or any Expo native module, so the data layer, auth model, and AI integration all had to be rebuilt for the browser rather than carried over.

**V2 started as a direct feature port** — same five tracked domains (profile, nutrition, workouts, sleep, and eventually favorites) — but quickly grew past parity with V1:

- **Single-user local storage → multi-user cloud backend.** V1's SQLite file was implicitly single-tenant; V2 added real Supabase Auth (email/password) and retrofitted every table with `auth.uid()`-scoped Row-Level Security, so the same deployed app now serves isolated data per signed-in account.
- **Static onboarding targets → a real Mifflin-St Jeor calculation engine.** V1 asked users to type in their own calorie/protein targets. V2 computes BMR from age/gender/height/weight, applies an activity multiplier, adjusts for the user's stated goal (surplus for muscle gain, deficit for fat loss), and derives protein from body weight — with the raw numbers surfaced as an editable "Calculated Recommendation," not a black box.
- **Fixed daily budget → workout-aware dynamic budgeting.** V2 added the ability to expand a day's calorie target by whatever was actually burned that day (real logged workouts plus a "steps & daily movement" quick-entry for wearable-reported activity that isn't a discrete workout), with an explicit breakdown (`base + workouts + daily movement = target`) rather than a single opaque number.
- **A flat sleep log → an Apple Health-style sleep dashboard.** What started as a single `sleep_hours` number became a full stage-breakdown model (Awake / REM / Core / Deep, in Apple's own stage colors), with a smart-entry modal that either accepts a direct duration or a bedtime/wake-time pair, and estimates a healthy stage split when the user doesn't want to enter it manually.
- **AI vision provider swap.** V1 used Claude's vision API; V2 moved to Gemini, both via the same pattern (client-side call with a forced structured-output schema so the model can't return unparseable prose).
- **From "log it" to "understand it."** V2 added a History tab with Daily / Weekly / Monthly views, adherence streaks, a favorites system for one-tap re-logging of recurring meals, and CSV export of the full nutrition/workout history — none of which existed in V1.

---

## 5. Technical Challenges & Bug Fixes

**Live schema drift as a recurring, self-inflicted incident class.** The single most distinctive engineering problem in V2 wasn't a code bug at all — it was the discovery, twice, that the *live* Supabase schema no longer matched what the application code assumed, because the schema had been modified independently between sessions (outside the application code path entirely). The `profiles` table's primary key semantics changed — `id` became the auth user ID directly (with RLS checking `auth.uid() = id`), rather than a separate generated `id` plus a `user_id` foreign key — and the `favorite_meals` table's column names and shape changed as well (`name`/`calories`/`protein` instead of `food_name`/`calories`/`protein_g`, with `meal_category` dropped entirely). Both surfaced as opaque `400`/`403` failures from Supabase. Rather than patch based on assumption, each was diagnosed by querying `information_schema.columns` and `pg_policies` directly against the live database to get ground truth before touching a line of application code — which is what turned a guessing exercise into a same-session fix each time: realign the TypeScript types and the `api.ts` data-access layer to the *actual* schema, not the originally-designed one.

**Multi-tenant retrofit under Row-Level Security.** Converting a schema and application originally designed as single-user into a properly isolated multi-tenant one meant more than adding a `WHERE user_id = ...` clause — it meant establishing RLS as the actual security boundary (not just a client-side filter, which is trivially bypassable), keying every insert/update to the authenticated session's `auth.uid()`, and handling the asymmetry that resulted when one table (`profiles`) ended up keyed by `id` while every other table stayed keyed by a separate `user_id` — two valid but different multi-tenancy patterns coexisting in one schema, which the application layer had to know about explicitly rather than assume were interchangeable.

**Progressive-overload comparison without comparing a session against itself.** Computing "did you lift more than last time" required capturing a timestamp *before* inserting the new workout, then searching backward through the previous ~20 sessions for the most recent one containing a matching exercise name — a small but easy-to-get-backwards piece of logic, since inserting first and then querying "the most recent session" would trivially match the session just created.

**iOS PWA viewport/scroll hardening — catching a regression before it shipped.** Fixing iOS Safari's rubber-band whole-page scroll meant setting `overflow: hidden` on `html`/`body` globally, which is the standard fix — but doing that blindly would have broken two screens (the login form and the onboarding flow) that were, until that point, relying on default document-level scrolling with no internal scroll container of their own. Because the onboarding form is long enough to exceed the viewport once an on-screen keyboard is factored in, that combination would have made its "Finish Setup" button genuinely unreachable on real devices. The fix was caught by tracing every top-level render path (not just the ones with an obvious scroll bar) before applying the global rule, then verified concretely — not just by inspection — by shrinking the browser viewport to simulate keyboard occlusion and confirming programmatically that the affected container's `scrollHeight` exceeded its `clientHeight` with `overflow-y: auto` actively engaged, while `document.body` stayed exactly bounded to the viewport with no overflow of its own.

**Environment-specific tooling failures (V1).** Expo Router's root layout could not perform any navigation of its own (`router.replace()` or a conditional `return null`) without throwing "Attempted to navigate before mounting the Root Layout component," even when a navigator visibly rendered — resolved by moving the onboarding gate to a nested layout using a declarative `<Redirect>`, keyed off a real reactive "has the persisted store hydrated yet" flag rather than a timing guess. Separately, Metro's bundler cache lived outside the project (in the OS temp directory) and went stale independently of `expo start -c`, which only clears the in-project cache — surfacing as `UnableToResolveError` for modules that demonstrably existed on disk, fixed by clearing the OS-level Metro Haste/file-map cache explicitly.

---

## 6. Results & Impact

- **A working product shipped on both architectures**, not just the second one — V1 was a functioning native-adjacent app with real onboarding, logging, and progressive-overload tracking before the distribution constraint triggered the rewrite.
- **Zero recurring infrastructure cost**, by design: no Apple Developer Program membership, no custom backend server or hosting bill beyond free tiers (Supabase, Vercel, Vercel's GitHub integration) — the constraint that shaped the entire V2 architecture was fully satisfied, not worked around.
- **A live, installable, multi-user production deployment**: GitHub-connected Vercel project with automatic build-and-deploy on every push to `main`, a real Supabase Auth signup/login flow with email confirmation, and Row-Level-Security-enforced data isolation verified against the live database (not just assumed from the schema design).
- **A clean, currently-passing build** (`npm run build` — TypeScript project references plus a Vite production build — completes with zero type or build errors) at every stage of iterative feature work, including through two live schema-drift incidents and a global CSS/layout change with real regression risk.
- **Meaningful feature growth without architectural strain**: what began as a direct feature port of a 3-domain single-user app grew, within the same codebase, into a 5-domain multi-user product (profile/macros, nutrition with AI vision and favorites, workouts with progressive overload, an Apple Health-style sleep dashboard, and cross-domain history/streak analytics) — evidence that the Supabase-plus-RLS backend choice scaled with the product rather than becoming a bottleneck.
