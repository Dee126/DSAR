# Architecture Guide

## Layered Architecture

This project follows a **vertical-slice feature architecture** with strict layer separation.

```
src/
├── app/                      # Next.js App Router — thin orchestrators only
│   ├── (dashboard)/          # Authenticated pages
│   └── api/                  # API routes (server-side, may use Prisma or Supabase)
├── features/                 # Feature modules (vertical slices)
│   └── <feature>/
│       ├── types/            # TypeScript interfaces & type aliases
│       ├── constants/        # Color maps, labels, config arrays
│       ├── repositories/     # Data access — ONLY place for Supabase/fetch/Prisma
│       ├── services/         # Business logic, orchestration, validation
│       ├── hooks/            # React state management — calls services only
│       ├── components/       # Presentational UI — no fetch, no logic
│       └── index.ts          # Barrel export
├── lib/
│   ├── supabase/             # Supabase client singletons (browser + server)
│   ├── prisma.ts             # Prisma client singleton (server-side)
│   └── ...                   # Auth, RBAC, validation, audit, etc.
├── shared/
│   ├── utils/                # Pure helper functions (formatDate, formatBytes, etc.)
│   ├── hooks/                # Cross-feature React hooks
│   └── components/           # Cross-feature UI components
└── types/                    # Global shared types
```

## Layer Responsibilities

### Repositories (`features/<feature>/repositories/`)
- **ONLY** place where data access happens (Supabase queries, `fetch()` calls, Prisma)
- One function per operation (`fetchCase`, `updateCase`, `createTask`)
- Return typed data, throw on errors
- No business logic, no UI state, no React

### Services (`features/<feature>/services/`)
- Business logic, orchestration, validation
- Call repositories for data access
- Perform data transformations, enforce rules
- State machine transitions, SLA calculations
- No Supabase/Prisma imports, no React, no UI

### Hooks (`features/<feature>/hooks/`)
- React state management (`useState`, `useEffect`, `useCallback`)
- Call services (never repositories directly)
- Expose state + handler functions to components
- No business rules — delegate to services
- One hook per logical concern (e.g., `useCaseDetail`, `useTasksTab`)

### Components (`features/<feature>/components/`)
- Presentational React components
- Receive data + handlers via props or hooks
- No `fetch()`, no Supabase, no Prisma, no business logic
- Max ~250 lines per file

### Pages (`app/(dashboard)/.../page.tsx`)
- Thin orchestrators — compose hooks + components
- Target: <150 lines
- No inline state management beyond tab selection
- Import from feature modules only

## File Size Policy

| Metric | Target | Hard Cap |
|--------|--------|----------|
| Lines per file | 250 | 400 |
| Lines per function | 80 | 150 |

ESLint enforces these limits. Files exceeding the hard cap will fail CI.

## Forbidden Patterns

### Never do this:

```typescript
// ❌ Supabase/Prisma in a component or hook
import { createBrowserSupabase } from "@/lib/supabase/browser";
function MyComponent() {
  const supabase = createBrowserSupabase();
  const data = await supabase.from("cases").select("*"); // WRONG
}

// ❌ fetch() in a component
function MyComponent() {
  useEffect(() => { fetch("/api/cases").then(...) }, []); // WRONG
}

// ❌ Business logic in a component
function MyComponent({ dueDate }) {
  const isOverdue = new Date(dueDate) < new Date(); // WRONG — move to service
}

// ❌ Cross-feature deep imports
import { useIncidentDetail } from "@/features/incidents/hooks/useIncidentDetail"; // WRONG
import { useIncidentDetail } from "@/features/incidents"; // OK — use barrel
```

### Always do this:

```typescript
// ✅ Repository handles data access
// features/cases/repositories/case-repository.ts
export async function fetchCase(caseId: string): Promise<CaseDetail> {
  const res = await fetch(`/api/cases/${caseId}`);
  if (!res.ok) throw new Error("Failed to load case");
  return res.json();
}

// ✅ Service handles business logic
// features/cases/services/case-service.ts
export function getSlaIndicator(dueDate: string): "ok" | "due_soon" | "overdue" { ... }
export function getAllowedTransitions(status: string): string[] { ... }

// ✅ Hook manages UI state, calls service
// features/cases/hooks/useCaseDetail.ts
export function useCaseDetail(caseId: string) {
  const [caseData, setCaseData] = useState(null);
  useEffect(() => { caseRepo.fetchCase(caseId).then(setCaseData); }, [caseId]);
  return { caseData };
}

// ✅ Component is purely presentational
// features/cases/components/OverviewTab.tsx
export function OverviewTab({ caseData, onSave }: Props) { return <div>...</div>; }
```

## How to Add a New Feature

1. Create folder: `src/features/<feature-name>/`
2. Define types: `types/<feature>.ts` — interfaces for all data shapes
3. Define constants: `constants/` — color maps, labels, config
4. Create repositories: `repositories/` — all data access functions
5. Create services: `services/` — business logic, validation, orchestration
6. Create hooks: `hooks/` — React state wrappers calling services
7. Create components: `components/` — presentational UI
8. Add barrel: `index.ts` — re-export public API
9. Wire into page: `app/(dashboard)/.../page.tsx` — thin orchestrator

## Multi-Tenancy

Every database query MUST filter by `tenantId` (from session). This is enforced in:
- API routes (server-side): `where: { tenantId: user.tenantId }`
- Repositories call API routes that enforce tenant isolation

## Existing Modules

| Feature | Status | Location |
|---------|--------|----------|
| Incidents | Refactored | `src/features/incidents/` |
| Cases | In progress | `src/features/cases/` |
| Settings | Pending | `src/features/settings/` |
| Governance | Pending | `src/features/governance/` |
| Integrations | Pending | `src/features/integrations/` |
| Copilot | Pending | `src/features/copilot/` |
