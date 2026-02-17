# QA Checklist — Sprint 9.4

Manual QA checklist for UX/Quality Hardening. Run through before each release.

---

## 1. Loading States

- [ ] **Dashboard**: All stat cards show skeleton animation while loading
- [ ] **Cases list**: Table shows pulsing skeleton rows during fetch
- [ ] **Case detail**: Each tab shows loading state independently
- [ ] **Documents page**: Shows skeleton while fetching
- [ ] **Tasks page**: Shows skeleton while fetching
- [ ] No flash of empty state before data loads

## 2. Error States

- [ ] **Network disconnect**: Toast shows "Unable to connect" message
- [ ] **401 response**: Toast shows session expired message
- [ ] **403 response**: Toast shows permission denied message
- [ ] **500 response**: Error banner shows with Retry button
- [ ] **Cases list**: Error banner appears, Retry button re-fetches
- [ ] **Dashboard**: Error banner appears above stat cards
- [ ] Errors include correlation ID in toast (for support)

## 3. Empty States

- [ ] **Cases list** (no filters): Shows "No cases found" with icon + "Create New Case" button
- [ ] **Cases list** (with filters): Shows "Adjust your filters or create a new case"
- [ ] **Dashboard** (no cases): Shows empty state with "Create Case" link
- [ ] **Tasks page** (no tasks): Shows "No tasks yet" message
- [ ] **Documents page** (no docs): Shows "No documents yet" message
- [ ] Empty states are centered, have icon, title, description, and optional CTA

## 4. Filter Persistence (URL params)

- [ ] **Cases page**: Filter by status → URL updates with `?status=NEW`
- [ ] **Cases page**: Refresh page → filter preserved from URL
- [ ] **Cases page**: Share URL → recipient sees same filters
- [ ] **Cases page**: "Clear filters" removes all URL params
- [ ] **Pagination**: Page number in URL (`?page=2`)
- [ ] **Search**: Search query in URL (`?q=john`)
- [ ] Changing any filter resets page to 1

## 5. Notifications / Toasts

- [ ] **Success**: Green toast on case save / status change / task update
- [ ] **Error**: Red toast on API failure (with user-safe message)
- [ ] **Warning**: Yellow toast for recoverable issues
- [ ] **Auto-dismiss**: Success toasts disappear after 5s
- [ ] **Error duration**: Error toasts stay for 8s
- [ ] **Max toasts**: No more than 5 visible at once
- [ ] **Dismiss**: X button dismisses individual toast
- [ ] **Accessibility**: Toast container has `aria-live="polite"`

## 6. DataBadge Consistency

- [ ] **Status badges**: Consistent colors across all pages (cases list, dashboard, case detail)
- [ ] **Priority badges**: Same color mapping everywhere
- [ ] **Type badges**: Correct color per DSAR type
- [ ] **Task status**: Consistent with case status color scheme
- [ ] Badges use friendly labels (e.g., "Identity Verification" not "IDENTITY_VERIFICATION")

## 7. Export Functionality

- [ ] **Cases list**: Export button visible in header
- [ ] **Click export**: Button changes to "Preparing..." with spinner
- [ ] **Success**: File downloads automatically, button shows checkmark briefly
- [ ] **Failure**: Error message shown with Retry button
- [ ] **Retry**: Clicking retry restarts export
- [ ] Export respects current filters

## 8. Accessibility

- [ ] **Skip link**: Tab from fresh page → "Skip to main content" link appears
- [ ] **Focus ring**: All interactive elements show visible focus ring on Tab
- [ ] **Keyboard nav**: Can navigate through sidebar, table rows, filter dropdowns with keyboard
- [ ] **Table rows**: Enter/Space on focused row navigates to detail
- [ ] **Aria labels**: Pagination has `aria-label="Pagination"`
- [ ] **Screen reader**: Loading states announce "Loading..."
- [ ] **Dismiss buttons**: Have `aria-label="Dismiss"` or `aria-label="Dismiss notification"`
- [ ] **Min touch target**: All buttons/links at least 44px tall (min-h-[44px])

## 9. Responsive Design

- [ ] **Cases table**: Desktop shows full table, mobile shows card layout
- [ ] **Dashboard stats**: 1 col on mobile, 2 on tablet, 5 on desktop
- [ ] **Filter bar**: Wraps properly on small screens
- [ ] **Toasts**: Positioned correctly on mobile (bottom-right)
- [ ] **Export button**: Visible and usable on mobile

## 10. i18n (DE/EN)

- [ ] `localStorage.setItem("lang", "de")` + refresh → German labels appear
- [ ] `localStorage.setItem("lang", "en")` + refresh → English labels appear
- [ ] Default detection from `navigator.language`
- [ ] All translation keys have both EN and DE values

---

## Smoke Test Script

```bash
# 1. Start dev server
npm run dev

# 2. Open browser to http://localhost:3000
# 3. Login with admin@acme-corp.com / admin123456
# 4. Walk through checklist above
# 5. Test with DevTools network throttling (Slow 3G) for loading states
# 6. Test with DevTools network offline for error states
# 7. Test with keyboard only (no mouse)
# 8. Run Lighthouse accessibility audit
```

## Automated Tests

```bash
# Sprint 9.4 UX tests
npm test -- tests/unit/ux-hardening.test.ts

# Sprint 9.6 Smoke validation (all 10 flows)
npm test -- tests/unit/smoke-validation.test.ts

# Full validation (lint + typecheck + all unit tests)
npm run validate

# E2E smoke tests (requires running server + seeded DB)
npm run test:e2e
```

## Sprint 9.6: System Validation Flows

These smoke tests cover the 10 critical business flows:

- [ ] **Flow 1**: Intake → Case creation → Deadlines (state machine lifecycle)
- [ ] **Flow 2**: Dedupe & Clarification (submission validation, dedupe API)
- [ ] **Flow 3**: IDV Portal + Approval (token generation, portal endpoints)
- [ ] **Flow 4**: Data Collection — Systems + Vendors (API accessibility)
- [ ] **Flow 5**: Redaction / Exceptions gating (service exports, gate logic)
- [ ] **Flow 6**: Response Generator → Approval → Delivery (export modules, API)
- [ ] **Flow 7**: Incident Linking + Authority Export (schemas, executive dashboard)
- [ ] **Flow 8**: Search & eDiscovery (search API, audit trail)
- [ ] **Flow 9**: Security Regression (RBAC: 7 permission tests, auth enforcement)
- [ ] **Flow 10**: Performance Sanity (health, metrics, error reporter, feature flags)

See `docs/validation_report.md` for detailed results.
