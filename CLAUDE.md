# PropBooks — Developer Handoff & Guidelines

Real estate investor SPA targeting $25–$50/mo subscription.
Must look and feel like a polished, professional product — not a side project.

---

## Project Overview

**Product:** PropBooks — an all-in-one portfolio management tool for real estate investors. The app unifies two asset types — long-term **Rentals** and short-term **Rehabs** (fix-and-flip projects) — under a single asset list, ledger, and dashboard.
**Stack:** React (Vite), Supabase (auth + Postgres + Storage), Vercel (hosting), all in a single-page app.
**Live URL:** https://real-vault.vercel.app (custom domain pending)
**Supabase project ID:** `iiwmkazfocszxdbtxlct`

### Key files
| File | Purpose |
|------|---------|
| `App.jsx` | ~60-line root: ThemeProvider / ToastProvider / AuthProvider stack + AuthGate + ConfigErrorScreen. The actual shell is in `views/AppShell.jsx`. |
| `views/AppShell.jsx` | Sidebar + topbar + activeView routing. Hydrates the in-memory mirror arrays from Supabase on user-id change. Owns notifications, settings host, sign-out modal. |
| `views/*.jsx` | Per-screen components: AssetList, Ledger, PortfolioDashboard, Dashboard (rentals), DealDashboard, PropertyDetail, DealDetail, RehabItemDetail, TenantManagement, TenantDetail, MileageTracker, DealAnalyzer, GlobalSearch, UnifiedDashboard / UnifiedAnalytics / UnifiedReports / UnifiedNotes, RentalWizard, FlipWizard, WelcomeScreen, Attachments (DocumentsPanel), MentionTextarea, detailPanels. |
| `db/*.js` | Supabase wrapper per table — `properties`, `transactions`, `tenants`, `deals`, `dealMilestones`, `dealRehabItems`, `dealExpenses`, `contractors`, `contractorBids`, `notes`, `mileageTrips`, `maintenanceRequests`, `documents`. Each does snake↔camel mapping and is RLS-scoped. |
| `api.js` | In-memory mirror constants (`DEALS`, `CONTRACTORS`, `RENTAL_NOTES`, etc.) + demo-data snapshot/restore + small helpers (`fmt`, `newId`, REHAB_CATEGORIES, STAGE_ORDER, DEFAULT_MILESTONES). |
| `mockData.js` | Demo seed data for `PROPERTIES`, `TRANSACTIONS`, `TENANTS`, `MILEAGE_TRIPS` (the rental-side mirrors). |
| `auth.jsx` | Auth UI (login, signup, reset) + AuthProvider context |
| `deals.jsx` | Remaining flip-side screens not yet moved into `views/`: DealDashboard, DealContractors, ContractorDetail, DealAnalytics, DealMilestones. |
| `dealReports.jsx` | Rehab-side report tabs (consumed by `views/UnifiedReports.jsx`). |
| `settings.jsx` | Settings page + OnboardingWizard. |
| `supabase.js` | Supabase client init (reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` from `.env`) |
| `alerts.jsx` | Cross-portfolio alerts engine + QuickPayInline rent-mark-paid form. |
| `shared.jsx` | Atoms used everywhere: `Modal`, `StatCard`, `EmptyState`, `InfoTip`, `Badge`, `iS`, `sectionS`, `cardS`, `downloadFile`. |

### Env vars needed (create a `.env` file in the project root)
```
VITE_SUPABASE_URL=https://iiwmkazfocszxdbtxlct.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key from Supabase dashboard>
```

---

## Current State (as of May 2026)

### What's fully built
- **Unified Asset list** — single sortable/filterable list with Rental and Rehab type chips. Replaces the old separate Properties + Deal Pipeline pages.
- **Unified Ledger** — single income/expense table with kind chips (Rental Income / Rental Expense / Rehab Expense). Paid To / Received From has a typeahead that pulls contractors, tenants, and previous payees. Replaces the old per-screen Transactions and DealExpenses pages.
- **Unified Dashboard / Analytics / Reports** — top-level entries that tab between Rentals and Rehabs. The Portfolio Dashboard is a separate cross-asset overview.
- **Properties** — detail view with financials, documents, notes, transactions, tenants, sale flow, delete-with-cascade.
- **Tenants** — lease tracking, status badges (`active-lease` / `month-to-month` / `vacant` / `past`), documents, maintenance requests.
- **Rehabs (formerly Deals/Flips, internally still `deal_*`)** — DealDetail screen with tabs for Overview, Milestones, Rehab line items (with contractor assignment), Contractors, Expenses, Documents, Notes. RehabItemDetail drill-down. Close-rehab flow (sold + convert-to-rental). Clone Rehab.
- **Contractors** — list, detail view, bids, payments, documents, ratings. Quick Bid + auto-link from Paid To typeahead.
- **Mileage tracker** — trip log with IRS rate calculation, linked Property/Rehab dropdown.
- **Tax tools** — depreciation calculator, tax estimator.
- **Notes** — one UnifiedNotes hub with rental / rehab / general categories + @mentions.
- **Auth** — Supabase login/signup/reset with logo, Space Grotesk headings, Inter body.
- **Dark mode** — full theme toggle.
- **Global search** — across properties, tenants, rehabs, contractors, transactions, notes.

### Demo account
- Email: `demo@propbooks.com` / Password: `PropBooks2024!`
- Shows full mock portfolio (5 properties, 4 rehabs, 6 contractors, tenants, transactions, etc.)
- New accounts start completely empty (`clearDemoData()` runs for non-demo users; Supabase hydration replaces the contents).

### Data layer status
**Everything persists to Supabase.** `db/*.js` wrappers are the single source of truth; the in-memory `DEALS`, `CONTRACTORS`, `RENTAL_NOTES` etc. arrays are synchronous mirrors that AppShell hydrates on user-id change. Mutations in components write through both — DB call first, then update the local mirror with the saved row's id.

**Storage**: the `documents` bucket holds property/tenant/rehab/contractor uploads. Bucket is private; reads use 1-hour signed URLs (`db/documents.js#getDocumentUrl`). Size limit 25 MB; allowed MIME types are `image/*` and `application/pdf`.

**RLS**: every table has RLS enabled with an `auth.uid() = user_id` policy and `WITH CHECK`. Inserts in `db/*.js` set `user_id` from `supabase.auth.getUser()` (server-side JWT, not client input).

---

## What Still Needs to Be Built

### Priority 1 — Pre-launch blockers
- [x] **Password reset flow** — Supabase fires `PASSWORD_RECOVERY` on the email link; `App.jsx` now renders `<SetPasswordScreen>` (in `auth.jsx`) instead of dropping the user into the shell. Form calls `supabase.auth.updateUser({password})` and clears the recovery URL fragment on success.
- [x] **Profile-backed plan + onboarding flag** — `auth.jsx` fetches `public.profiles` on auth change and exposes `user.plan`, `user.hasOnboarded`, `user.subscriptionStatus`, `user.currentPeriodEnd`, `user.stripeCustomerId`. New signups get a profile row + personal account auto-created by the `on_auth_user_created` trigger. The hardcoded `plan: "pro"` is gone.
- [x] **Onboarding gate fix** — `AppShell.jsx` gates on `user.hasOnboarded === false`. Demo account is excluded.
- [x] **Multi-user / Account Members model** — Each user belongs to exactly one account (1 owner + up to 4 members at $25/mo). New tables: `accounts`, `account_invites`. Every data table gets an `account_id` column + RLS scoped by `account_id = my account_id` so all account members see the same portfolio. The `set_account_id_from_user` BEFORE-INSERT trigger auto-populates `account_id` so `db/*.js` code doesn't have to manage it. New `db/accounts.js` wrapper (`getCurrentAccount`, `listAccountMembers`, `inviteByEmail`, `revokeInvite`, `removeMember`, `acceptInvite`, `updateAccountName`). Settings now has a **Team** tab between Profile and Subscription with seat counter, invite-by-email form, members list, pending invites. `App.jsx` detects `?invite=TOKEN` in the URL and runs the `<InviteAcceptHandler>` for signed-in users; signing up with a pending email-matched invite auto-joins via the `handle_new_auth_user` trigger. The `TEAM_MEMBERS` mock array in `api.js` is now hydrated from real account members on login — `MentionTextarea` consumes it unchanged.
- [x] **Settings → Subscription rebuilt** — single $25 PropBooks plan card replaces the fake 3-plan grid. Reads real `subscription_status` and `current_period_end` from the user object. Subscribe / Manage-billing buttons are stubbed for the Stripe wiring PR.
- [ ] **Stripe billing wiring** — DB ready (stripe_* columns + indexes). Still needed: Stripe account + product/price, Supabase Edge Function for the webhook, `create-checkout-session` + Customer Portal endpoints, wire the two Settings buttons. Stripe customer == account owner (account-level subscription, not per-user).
- [ ] **Email confirmation + custom SMTP** — Supabase dashboard config: enable "Confirm email", set Site URL + Redirect URLs to the Vercel domain, wire custom SMTP via Resend or SendGrid. Once SMTP is wired, the invite flow should also send a real email instead of just copying the link to the owner's clipboard.

### Priority 2 — Feature gaps
- [ ] **Receipts + AI OCR** — receipt attachment UI on tx/expense forms is currently disabled. The plan is to bring it back as a single coherent feature: Storage upload + AI OCR auto-fill. The `mockOcrScan()` stub was removed in Phase 1.
- [ ] **Custom domain** — `real-vault.vercel.app` needs a real domain (propbooks.com or similar). Check availability, purchase, point to Vercel.
- [ ] **Mobile responsiveness** — desktop-only today. Fixed `repeat(N, 1fr)` grids will collapse below ~900px.
- [ ] **Property value lookup** — Rentcast or Zillow integration for live ARV / estimated value.

### Priority 3 — Polish
- [ ] **Lazy-load Reports / Analytics / DealAnalyzer** — `React.lazy()` + `Suspense`. Should drop initial bundle by ~25-30%.
- [ ] **`manualChunks`** for `recharts` and `lucide-react` in `vite.config.js` — better caching, parallel downloads.
- [ ] **Hardcoded color tokens** — `#cbd5e1` and `#1e3a5f` appear in ~12 files and break dark mode. Replace with `var(--text-muted)` / `var(--avatar-bg)` etc.
- [ ] **Empty state standardization** — use `<EmptyState>` from shared.jsx everywhere; some detail screens still hand-roll the icon-title-subtitle block.
- [ ] **Compress active logo** — `logos/PropBooks Horizontal Logo_transparent_white.png` is 1.1 MB and dominates first paint. Compress to <50 KB or convert to SVG.
- [ ] **Component extraction** — typeahead duplicated in DealDetail / Ledger / PropertyDetail; ConfirmDeleteModal duplicated everywhere; pill-tab bar duplicated; FilterBar duplicated. Consolidating into `shared.jsx` would simplify support.

### Known shape gotchas
- Rehab item `contractors[]` is **not** a real DB column. AppShell hydration derives it from `contractor_bids` rows whose `rehab_item` matches `r.category`. Adding/removing a contractor on a rehab item creates/deletes a bid row.
- Rehab item `canonicalCategory` is the same field as `slug` in the DB. AppShell hydration mirrors `r.slug` back as `canonicalCategory` so linked-expense matching keeps working.
- Internal identifiers stay `dealId` / `DEALS` / `db/deals.js` everywhere — only **user-facing** strings say "Rehab" (the rename pass kept internal code stable).
- The `purpose` field on mileage trips uses `"Deal"` as the stored enum value but the UI displays `"Rehab"`. Filtering still uses the raw value.

---

## Core Development Principles

### 1. Consistency Is Non-Negotiable
- Rental and Rehab modules use identical UI patterns: same card styles, filter placement,
  dropdown behavior, header hierarchy, spacing, and terminology.
- Before building anything new, check how the other module handles it and match exactly.
- When updating a pattern on one screen, audit ALL screens for the same pattern.

### 2. Every Field Must Be Editable
- If data is displayed, the user needs to edit it.
- Properties, tenants, rehabs, contractors, transactions, expenses — all editable.

### 3. InfoTips on Every KPI / Metric
- Every stat card, scorecard metric, and calculated value needs a hover tooltip
  explaining the formula in plain language.
- Use the `InfoTip` component from `shared.jsx` consistently.

### 4. Smart Defaults, Never Wrong Defaults
- Pre-populate fields with sensible values (e.g., today's date).
- Provide grouped typeaheads showing previous values (contractors, vendors, categories).
- Show stale data warnings when values haven't been updated in 90+ days.

### 5. Forms Must Behave Professionally
- Close after successful save.
- Destructive actions (delete) always require a confirmation dialog.
- Field ordering: most important fields first, related fields grouped.
- Income forms don't show "Payee"; expense forms don't show "Received From".
- Async saves disable the submit button until they resolve.

### 6. Persistence Is Non-Negotiable
- Every CRUD action goes through `db/*.js`. The local mirror gets the saved row, never a fake `newId()`-generated one.
- Failures surface a toast — never swallowed `console.error`.
- After delete, cascade child rows in memory (DB FKs cascade server-side, but the UI shouldn't show stale references until next reload).

---

## UI Consistency Checklist

Before submitting any screen change, verify:

- [ ] Header: `<h1>` (fontSize 26, fontWeight 700) + `<p>` subtitle (fontSize 15, color var(--text-secondary))
- [ ] Section cards: `sectionS` style from shared.jsx
- [ ] Chart headers: `<h3>` (fontSize 16, fontWeight 700) + `<p>` subtitle (fontSize 13, color var(--text-muted), marginBottom 20)
- [ ] KPI/stat cards: `<StatCard>` from shared.jsx with `tip` prop on every metric
- [ ] Filter placement: Header → Filter bar → Stat cards → Content (canonical across every list screen — Assets, Ledger, Tenants, Mileage, Reports. The old "Dashboard pattern" with stats above the pill bar is retired.)
- [ ] Modals use the `<Modal>` wrapper from shared.jsx, not inline rgba overlay divs
- [ ] Pill buttons: gray container (var(--surface-alt), border var(--border), borderRadius 10), amber active (#f59e0b)
- [ ] Fonts: Space Grotesk for h1/h2, Inter for everything else
- [ ] All user-facing "PropBooks" text must be all-caps: **PROPBOOKS**

## Naming Conventions
- "Paid To" (not "Vendor" or "Payee" for expenses)
- "All Properties" / "All Rehabs" (not "Entire Portfolio")
- Tenant status: "Active Lease" (not "Current")
- Button labels match action: "Add Income" / "Add Expense" (not "Log Transaction")

## How to Work
- Be methodical: plan before building, complete one feature fully before moving to next.
- Proactively suggest improvements — don't just build what's asked.
- When asked to review, audit ALL screens, not just the one mentioned.
- Present improvement ideas as a list first so user can prioritize.
- Incremental changes: fix 1–2 things at a time so they can be reviewed.
- After any change, verify bracket balance on modified files.
- No hardcoded calculations — derive from actual data; explain formulas in InfoTips.
- Run `npm run build` after significant changes to catch errors before pushing.
