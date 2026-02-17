# UX Guidelines — PrivacyPilot

Standards and patterns for consistent UI across the application.

---

## Table of Contents

1. [Component Library](#component-library)
2. [State Management Pattern](#state-management-pattern)
3. [Data Fetching](#data-fetching)
4. [Notifications](#notifications)
5. [Filter & Table Pattern](#filter--table-pattern)
6. [Error Handling](#error-handling)
7. [Accessibility](#accessibility)
8. [Internationalization](#internationalization)
9. [Export Pattern](#export-pattern)

---

## Component Library

All shared UI components live in `src/components/ui/`. Import via barrel:

```ts
import { PageState, DataBadge, ErrorBanner, useToast } from "@/components/ui";
```

### Available Components

| Component | Purpose | Key Props |
|-----------|---------|-----------|
| `PageState` | Unified loading/error/empty wrapper | `loading`, `error`, `empty`, `onRetry` |
| `LoadingSkeleton` | Skeleton placeholders | `variant` (table/card/stat/detail/inline), `rows` |
| `EmptyState` | Empty data placeholder | `title`, `description`, `icon`, `action` |
| `ErrorBanner` | Inline error/warning banner | `message`, `severity`, `onRetry`, `onDismiss` |
| `DataBadge` | Colored badges for enums | `label`, `variant` (status/priority/risk/type) |
| `Tooltip` | Hover/focus tooltip | `content`, `position`, `children` |
| `DisabledReason` | Disabled button with tooltip | `disabled`, `reason`, `children` |
| `InlineWarning` | Compact warning message | `message`, `severity` |
| `FilterBar` | URL-persisted filters | `filters[]` config |
| `DataTable` | Table with pagination | `columns`, `data`, `pagination`, `mobileCard` |
| `ExportButton` | Export with progress/retry | `endpoint`, `body`, `filename` |
| `ToastProvider` | Toast context provider | Wrap in Providers.tsx |
| `useToast` | Toast hook | `.success()`, `.error()`, `.warning()`, `.info()` |

---

## State Management Pattern

Every data-fetching page should handle three states:

```tsx
import { PageState } from "@/components/ui";

function MyPage() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  return (
    <PageState
      loading={loading}
      error={error}
      empty={data.length === 0}
      onRetry={fetchData}
      emptyTitle="No items found"
    >
      {/* Render data here */}
    </PageState>
  );
}
```

**Rules:**
- Never show empty state while loading
- Always provide a Retry button on error
- Empty states should have a helpful message + CTA when possible

---

## Data Fetching

Use the typed API client instead of raw `fetch`:

```ts
import { api } from "@/lib/api-client";

const { data, error, status } = await api.get<Case[]>("/api/cases");
if (error) {
  // error.message is user-safe
  // error.correlationId for support
  showToast(error.message);
  return;
}
```

**Rules:**
- Never silently swallow errors (`catch { /* silent */ }`)
- Always show user-facing error via toast or banner
- Use correlation IDs for debugging

---

## Notifications

```tsx
import { useToast } from "@/components/ui";

function MyComponent() {
  const { success, error, warning, info } = useToast();

  // After successful save
  success("Changes saved");

  // After API error
  error("Failed to update", apiError.message);

  // Custom toast with action
  toast({
    type: "warning",
    title: "Unsaved changes",
    message: "You have unsaved changes that will be lost.",
    action: { label: "Save", onClick: handleSave },
  });
}
```

**Rules:**
- Success: What happened ("Saved successfully")
- Error: What happened + what to do ("Failed to save. Please try again.")
- Never use `alert()` or `window.confirm()` — use toasts and modals
- Error toasts display for 8s, others for 5s
- Max 5 toasts visible at once

---

## Filter & Table Pattern

### URL-Persisted Filters

```tsx
import { FilterBar, DataTable, type FilterConfig, type ColumnDef } from "@/components/ui";

const filters: FilterConfig[] = [
  { key: "status", label: "Status", type: "select", options: [...] },
  { key: "q", label: "Search", type: "search", placeholder: "Search..." },
];

const columns: ColumnDef<Item>[] = [
  { key: "name", header: "Name", cell: (r) => r.name },
  { key: "status", header: "Status", cell: (r) => <DataBadge label={r.status} variant="status" /> },
];

<FilterBar filters={filters} />
<DataTable columns={columns} data={items} rowKey={(r) => r.id} pagination={...} />
```

**Rules:**
- Filters always stored in URL search params
- Changing a filter resets page to 1
- Tables must have pagination (max 50 per page)
- Provide mobile card layout via `mobileCard` prop for responsive tables

---

## Error Handling

### API Error Shape

```ts
// Success: { data: T, pagination?: {...} }
// Error:   { error: { code: string, message: string, correlationId?: string } }
```

### Error Display Priority

1. **Form validation**: Inline field errors
2. **API error on action**: Toast notification
3. **API error on page load**: Error banner with retry
4. **Network error**: Toast with "check your connection"
5. **Session expired**: Toast + redirect to login

---

## Accessibility

### Required Patterns

- **Skip link**: Every page has "Skip to main content" (handled in layout)
- **Focus ring**: Use `focus-ring` utility class or built-in button styles
- **Aria labels**: All icon-only buttons need `aria-label`
- **Aria hidden**: Decorative icons get `aria-hidden="true"`
- **Keyboard nav**: Table rows clickable with Enter/Space
- **Loading announcements**: Loading states use `role="status"` + `sr-only` text
- **Touch targets**: Minimum 44px (enforced via `min-h-[44px]` in button classes)

### Testing

```bash
# Run Lighthouse accessibility audit
# Test with keyboard only (Tab, Enter, Space, Escape)
# Test with screen reader (VoiceOver on Mac, NVDA on Windows)
```

---

## Internationalization

### Setup

```ts
import { useT } from "@/lib/i18n";

function MyComponent() {
  const t = useT();
  return <h1>{t("cases.title")}</h1>;
}
```

### Adding Translations

Edit `src/lib/i18n.ts` — add the key to both `en` and `de` objects.

### Switching Language

```ts
import { setLocale } from "@/lib/i18n";
setLocale("de"); // Persisted to localStorage
```

---

## Export Pattern

```tsx
import { ExportButton } from "@/components/ui";

<ExportButton
  endpoint="/api/cases/export"
  body={{ format: "csv", filters: currentFilters }}
  filename="cases-export.csv"
  onError={(msg) => showError("Export failed", msg)}
/>
```

**Flow:** idle → preparing (spinner) → ready (auto-download) → idle
                                     → failed (retry button)

**Rules:**
- Export button should respect current page filters
- Show progress indicator during preparation
- Always offer retry on failure
- Downloads should have descriptive filenames
