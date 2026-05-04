# PropBooks — Developer Handoff & Guidelines

Real estate investor SPA targeting $25–$50/mo subscription.
Must look and feel like a polished, professional product — not a side project.

---

## Project Overview

**Product:** PropBooks — an all-in-one portfolio management tool for real estate investors.
**Stack:** React (Vite), Supabase (auth), Vercel (hosting), all in a single-page app.
**Live URL:** https://real-vault.vercel.app (custom domain pending)
**Supabase project ID:** `iiwmkazfocszxdbtxlct`

### Key files
| File | Purpose |
|------|---------|
| `App.jsx` | Main app shell, all rental module views, layout, navigation |
| `api.js` | In-memory data layer (mock data + CRUD functions). Replace with Supabase queries later. |
| `auth.jsx` | Auth UI (login, signup, reset) + AuthProvider context |
| `deals.jsx` | Entire flip/deal module: DealDashboard, RehabTracker, DealExpenses, Contractors, etc. |
| `dealReports.jsx` | Deal-level PDF-style reports |
| `settings.jsx` | Settings page + OnboardingWizard |
| `supabase.js` | Supabase client init (reads VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY from .env) |

### Env vars needed (create a `.env` file in the project root)
```
VITE_SUPABASE_URL=https://iiwmkazfocszxdbtxlct.supabase.co
VITE_SUPABASE_ANON_KEY=<your anon key from Supabase dashboard>
```

---

## Current State (as of May 2026)

### What's fully built
- **Portfolio dashboard** — stat cards, cash flow chart, equity growth, expense breakdown
- **Properties** — add/edit/delete, detail view with financials, documents, stale-value warnings
- **Transactions** — income/expense ledger, receipts, OCR stub, categorization
- **Tenants** — lease tracking, status badges, documents, maintenance requests
- **Deals (Flips)** — deal dashboard, rehab tracker, deal expenses, deal analytics, milestones, notes
- **Contractors** — contractor list, detail view, bids, payments, documents, ratings
- **Mileage tracker** — trip log with IRS rate calculation
- **Tax tools** — depreciation calculator, tax estimator
- **Notes** — rental notes, deal notes, general notes
- **Reports** — deal-level reports (dealReports.jsx)
- **Auth** — Supabase login/signup/reset with real logo, Space Grotesk headings, Inter body
- **Dark mode** — full theme toggle
- **Global search** — across properties, tenants, deals, contractors, transactions, notes

### Demo account
- Email: `demo@propbooks.com` / Password: `PropBooks2024!`
- Shows full mock portfolio (5 properties, 4 deals, 6 contractors, tenants, transactions, etc.)
- New accounts start completely empty

### Data layer status
**All data is currently in-memory mock data** (see `api.js` and local arrays in `App.jsx`).
Nothing persists to Supabase yet — Supabase is auth-only.
The `api.js` functions are designed as a swap layer: each returns a Promise so replacing
with `supabase.from('table').select()` calls requires zero component changes.

---

## What Still Needs to Be Built

### Priority 1 — Pre-launch blockers
- [ ] **Supabase persistence** — wire all CRUD functions in `api.js` to real DB tables.
  Tables needed: `properties`, `transactions`, `tenants`, `deals`, `deal_expenses`,
  `contractors`, `contractor_bids`, `contractor_payments`, `deal_milestones`,
  `rental_notes`, `deal_notes`, `general_notes`, `mileage_trips`, `maintenance_requests`,
  `property_documents`, `deal_documents`, `tenant_documents`
- [ ] **Email confirmation + custom SMTP** — currently Supabase sends a broken confirmation
  email. Fix: set Site URL + Redirect URLs in Supabase Auth settings to the Vercel domain,
  enable "Confirm email", set up custom SMTP via Resend or SendGrid
- [ ] **Stripe billing** — $25–$50/mo subscription. Gate features behind plan check.
  Wire into the `user.plan` field already threaded through the app.

### Priority 2 — Feature gaps
- [ ] **File storage** — documents (leases, contracts, receipts) are stub records with `url: null`.
  Wire to Supabase Storage so users can actually upload files.
- [ ] **Custom domain** — real-vault.vercel.app needs a proper domain (propbooks.com or similar).
  Check domain availability, purchase, point to Vercel.
- [ ] **Mobile responsiveness** — app is desktop-only right now. Needs responsive breakpoints
  for at least tablet use.
- [ ] **Onboarding flow** — OnboardingWizard exists in settings.jsx but isn't auto-triggered
  for new users in a useful way.

### Priority 3 — Polish
- [ ] **Real OCR** — `mockOcrScan()` in api.js is a stub. Integrate a real OCR service
  (Google Vision, AWS Textract, or similar) for receipt scanning.
- [ ] **Property value lookup** — `lookupPropertyByAddress()` in api.js is a stub.
  Wire to Rentcast or Zillow API for live value estimates.
- [ ] **Export to CSV/PDF** — users need to export transaction history and reports.

---

## Core Development Principles

### 1. Consistency Is Non-Negotiable
- Rental and Flip modules use identical UI patterns: same card styles, filter placement,
  dropdown behavior, header hierarchy, spacing, and terminology
- Before building anything new, check how the other module handles it and match exactly
- When updating a pattern on one screen, audit ALL screens for the same pattern

### 2. Every Field Must Be Editable
- If data is displayed, the user needs to edit it
- Properties, tenants, deals, contractors, transactions, expenses — all editable

### 3. InfoTips on Every KPI / Metric
- Every stat card, scorecard metric, and calculated value needs a hover tooltip
  explaining the formula in plain language
- Use the `InfoTip` component consistently (defined in App.jsx, also used in deals.jsx)

### 4. Smart Defaults, Never Wrong Defaults
- Pre-populate fields with sensible values (e.g., today's date)
- Provide grouped typeaheads showing previous values (contractors, vendors, categories)
- Show stale data warnings when values haven't been updated in 90+ days

### 5. Forms Must Behave Professionally
- Close after successful save
- Destructive actions (delete) always require a confirmation dialog
- Field ordering: most important fields first, related fields grouped
- Income forms don't show "Payee"; expense forms don't show "Received From"

---

## UI Consistency Checklist

Before submitting any screen change, verify:

- [ ] Header: `<h1>` (fontSize 26, fontWeight 700) + `<p>` subtitle (fontSize 15, color #64748b)
- [ ] Section cards: `sectionS` style (borderRadius 16, padding 24, boxShadow, border #f1f5f9)
- [ ] Chart headers: `<h3>` (fontSize 16, fontWeight 700) + `<p>` subtitle (fontSize 13, color #94a3b8, marginBottom 20)
- [ ] KPI/stat cards: `cardS` style with InfoTip on every label, uppercase label, large colored value
- [ ] Filter placement: Header → Dropdown/Filter bar → Stat cards → Content
- [ ] Analytics: property/deal dropdown (not pills) → conditional portfolio vs single-item view
- [ ] Bar radius: 6 on top corners for vertical bars, 6 on right corners for horizontal
- [ ] Tooltip styling: borderRadius 10, border #e2e8f0, fontSize 12
- [ ] Pill buttons: gray container (#f8fafc, border #e2e8f0, borderRadius 10), amber active (#f59e0b)
- [ ] "Clear filter" button: background none, color #94a3b8, fontSize 12, X icon
- [ ] Fonts: Space Grotesk for h1/h2 display headings, Inter for everything else
- [ ] All user-facing "PropBooks" text must be all-caps: **PROPBOOKS**

## Naming Conventions
- "Paid To" (not "Vendor" or "Payee" for expenses)
- "All Properties" / "All Deals" (not "Entire Portfolio")
- Tenant status: "Active Lease" (not "Current")
- Button labels match action: "Add Income" / "Add Expense" (not "Log Transaction")

## How to Work
- Be methodical: plan before building, complete one feature fully before moving to next
- Proactively suggest improvements — don't just build what's asked
- When asked to review, audit ALL screens, not just the one mentioned
- Present improvement ideas as a list first so user can prioritize
- Incremental changes: fix 1–2 things at a time so they can be reviewed
- After any change, verify bracket balance on modified files
- No hardcoded calculations — derive from actual data; explain formulas in InfoTips
- Run `npm run build` after significant changes to catch errors before pushing
