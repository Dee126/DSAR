# PrivacyPilot — Vollständige Plattform-Architektur

> **Zweck**: Dieses Dokument beschreibt die gesamte Architektur der PrivacyPilot DSAR-Management-Plattform.
> Es ist so geschrieben, dass ein KI-Assistent (z.B. ChatGPT) damit vollständigen Kontext hat, um Fehler zu diagnostizieren und zu beheben.

---

## 1. Projektübersicht

**Name**: PrivacyPilot (DSAR Copilot)
**Zweck**: Multi-Tenant, rollenbasierte Plattform für Organisationen zur Verwaltung von GDPR Data Subject Access Requests (DSAR).
**Repository**: Dee126/DSAR

### Tech-Stack

| Schicht | Technologie | Version |
|---|---|---|
| Framework | Next.js 14 (App Router) | ^14.2.0 |
| Sprache | TypeScript | ^5.4.5 |
| CSS | Tailwind CSS | ^3.4.4 |
| ORM | Prisma | ^5.22.0 |
| Datenbank | PostgreSQL 16 | (Docker: postgres:16-alpine) |
| Auth | NextAuth.js + custom HMAC-Token-System | ^4.24.0 |
| Validierung | Zod | ^3.23.0 |
| File Storage | Local FS / S3 (S3 ist Stub) | — |
| Email | Nodemailer | ^7.0.13 |
| Archivierung | archiver (ZIP-Export) | ^7.0.0 |
| Supabase | @supabase/supabase-js (optional) | ^2.96.0 |
| Unit Tests | Vitest | ^1.6.0 |
| E2E Tests | Playwright | ^1.44.0 |

### Deployment-Ziel
- **Vercel** (Serverless Functions + Edge Middleware)
- **Supabase PostgreSQL** (Connection Pooler auf Port 6543, Direct auf Port 5432)

---

## 2. Verzeichnisstruktur (vollständig)

```
DSAR/
├── prisma/
│   ├── schema.prisma              # Datenmodell (~90 Models, ~40 Enums)
│   ├── seed.ts                    # Demo-Daten Seeder
│   └── deploy.js                  # Deployment-Skript für Seeding
├── scripts/
│   ├── reset-test-user.ts
│   ├── seed-discovery.ts
│   └── seed_large_findings.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx             # Root-Layout (HTML, Providers)
│   │   ├── page.tsx               # Redirect → /dashboard
│   │   ├── globals.css            # Tailwind + Custom-Klassen
│   │   ├── login/page.tsx         # Login-Seite
│   │   ├── forgot-password/page.tsx
│   │   ├── reset-password/page.tsx
│   │   ├── verify/[token]/page.tsx
│   │   ├── demo/                  # Demo-Szenarien
│   │   │   ├── page.tsx
│   │   │   └── [scenario]/page.tsx
│   │   ├── (dashboard)/           # Route-Group für authentifizierte Seiten
│   │   │   ├── layout.tsx         # Dashboard-Shell (Sidebar + MobileNav + NotificationBell)
│   │   │   ├── dashboard/page.tsx # Übersichts-Statistiken
│   │   │   ├── cases/
│   │   │   │   ├── page.tsx       # Case-Liste mit Filtern + Suche
│   │   │   │   ├── new/page.tsx   # Neuen Case erstellen
│   │   │   │   └── [id]/page.tsx  # Case-Detailansicht (Tabs: Info, Tasks, Docs, Comments, etc.)
│   │   │   ├── tasks/page.tsx     # Cross-Case Task-Übersicht
│   │   │   ├── documents/page.tsx # Cross-Case Dokument-Übersicht
│   │   │   ├── copilot/page.tsx   # Privacy Copilot (KI-Runs)
│   │   │   ├── data-inventory/
│   │   │   │   ├── page.tsx       # System-Inventar-Liste
│   │   │   │   └── [id]/page.tsx  # System-Detail (Kategorien, Prozessoren, Discovery-Rules)
│   │   │   ├── integrations/
│   │   │   │   ├── page.tsx       # Integrationen verwalten
│   │   │   │   ├── [id]/page.tsx  # Integration-Detail
│   │   │   │   └── ConnectorsPanel.tsx
│   │   │   ├── governance/
│   │   │   │   ├── page.tsx       # Governance-Dashboard
│   │   │   │   ├── sla/page.tsx   # SLA-Konfiguration
│   │   │   │   ├── templates/page.tsx
│   │   │   │   ├── vendors/page.tsx
│   │   │   │   ├── vendors/[id]/page.tsx
│   │   │   │   ├── incidents/page.tsx
│   │   │   │   └── incidents/[id]/page.tsx
│   │   │   ├── heatmap/
│   │   │   │   ├── page.tsx       # Risiko-Heatmap
│   │   │   │   ├── finding/[id]/page.tsx
│   │   │   │   └── system/[systemId]/page.tsx
│   │   │   ├── executive/page.tsx # Executive KPI Dashboard
│   │   │   ├── findings/critical/page.tsx
│   │   │   └── settings/page.tsx  # Tenant-Konfiguration, User-Verwaltung
│   │   └── api/                   # ~115 REST API Routes (siehe Abschnitt 7)
│   ├── components/
│   │   ├── Providers.tsx          # Auth-Provider-Switch (Test vs. NextAuth)
│   │   ├── TestAuthProvider.tsx   # HMAC-Cookie-basierte Auth für Test-Modus
│   │   ├── NextAuthBridge.tsx     # NextAuth Session → AuthContext Bridge
│   │   ├── Sidebar.tsx            # Desktop-Navigation
│   │   ├── MobileNav.tsx          # Mobile Header, Drawer, Bottom-Nav
│   │   ├── NotificationBell.tsx
│   │   ├── Toast.tsx
│   │   ├── CopilotRunDialog.tsx
│   │   ├── DataAssetsPanel.tsx
│   │   ├── DeadlinePanel.tsx
│   │   ├── DsarAuditTrailPanel.tsx
│   │   ├── ExecutiveKpiWidget.tsx
│   │   ├── IdvPanel.tsx
│   │   ├── IncidentDashboardWidget.tsx
│   │   ├── IncidentPanel.tsx
│   │   ├── ResponsePanel.tsx
│   │   ├── VendorDashboardWidget.tsx
│   │   ├── VendorPanel.tsx
│   │   └── charts/
│   │       ├── BarChart.tsx
│   │       ├── DonutChart.tsx
│   │       ├── GaugeChart.tsx
│   │       ├── HeatmapChart.tsx
│   │       ├── LineChart.tsx
│   │       └── StackedBarChart.tsx
│   ├── hooks/
│   │   └── useAuth.ts             # AuthContext + useAuth() Hook
│   ├── lib/                       # Geschäftslogik & Utility-Module (~80 Dateien)
│   │   ├── prisma.ts              # Prisma-Client Singleton
│   │   ├── auth.ts                # requireAuth(), requireRole()
│   │   ├── auth-options.ts        # NextAuth-Konfiguration (Credentials Provider)
│   │   ├── test-auth.ts           # HMAC-Token createToken/verifyToken für Test-Modus
│   │   ├── rbac.ts                # Feingranulare Permissions + Legacy checkPermission()
│   │   ├── state-machine.ts       # DSAR Status-Übergänge
│   │   ├── errors.ts              # ApiError + handleApiError()
│   │   ├── validation.ts          # Alle Zod-Schemas
│   │   ├── audit.ts               # logAudit(), getClientInfo()
│   │   ├── storage.ts             # Local/S3 Datei-Storage
│   │   ├── utils.ts               # generateCaseNumber(), calculateDueDate(), getSlaIndicator()
│   │   ├── email.ts               # Nodemailer-Integration
│   │   ├── encryption.ts          # Verschlüsselung
│   │   ├── integration-crypto.ts  # Integration-Secrets Verschlüsselung
│   │   ├── secret-store.ts
│   │   ├── rate-limit.ts
│   │   ├── case-access.ts         # Case-Team-basierte Zugriffskontrolle
│   │   ├── deadline.ts            # SLA/Deadline-Berechnung
│   │   ├── discovery.ts           # System-Discovery-Engine
│   │   ├── risk.ts                # Risikobewertung
│   │   ├── confidence.ts          # Confidence-Scores
│   │   ├── query-spec.ts
│   │   ├── data-assembly.ts
│   │   ├── result-metadata.ts
│   │   ├── export-service.ts
│   │   ├── response-export.ts
│   │   ├── response-generator.ts
│   │   ├── response-templates.ts
│   │   ├── idv-token.ts           # Identity Verification Token
│   │   ├── idv-ai-review.ts
│   │   ├── incident-service.ts
│   │   ├── linkage-service.ts     # DSAR ↔ Incident Verknüpfung
│   │   ├── surge-service.ts       # Massen-DSAR bei Incidents
│   │   ├── authority-export-service.ts  # Behörden-Export
│   │   ├── vendor-service.ts
│   │   ├── vendor-request-service.ts
│   │   ├── vendor-derivation-service.ts
│   │   ├── kpi-service.ts
│   │   ├── forecast-service.ts
│   │   ├── trend-service.ts
│   │   ├── automation-metric-service.ts
│   │   ├── board-report-service.ts
│   │   ├── resolve-heatmap-scope.ts
│   │   ├── connector-runner.ts
│   │   ├── connectors/            # Connector-Framework
│   │   │   ├── types.ts
│   │   │   ├── registry.ts
│   │   │   ├── stubs.ts
│   │   │   ├── aws.ts
│   │   │   ├── m365.ts
│   │   │   ├── exchange-online.ts
│   │   │   ├── sharepoint.ts
│   │   │   └── onedrive.ts
│   │   ├── copilot/               # Privacy Copilot Engine
│   │   │   ├── detection.ts
│   │   │   ├── discovery.ts
│   │   │   ├── identity.ts
│   │   │   ├── redaction.ts
│   │   │   ├── explainability.ts
│   │   │   ├── export.ts
│   │   │   ├── summary.ts
│   │   │   ├── run-store.ts
│   │   │   ├── activity-log-store.ts
│   │   │   ├── governance.ts
│   │   │   ├── governance-report.ts
│   │   │   ├── governance-settings.ts
│   │   │   ├── legal-hold.ts
│   │   │   ├── synthetic/         # Test-Daten-Generator
│   │   │   │   ├── generator.ts
│   │   │   │   ├── persons.ts
│   │   │   │   ├── evidence.ts
│   │   │   │   ├── pii-injection.ts
│   │   │   │   ├── random.ts
│   │   │   │   └── detector-simulation.ts
│   │   │   └── performance/       # Performance-Tests
│   │   │       ├── index.ts
│   │   │       ├── types.ts
│   │   │       ├── metrics.ts
│   │   │       ├── parallel-runner.ts
│   │   │       ├── scalable-generator.ts
│   │   │       ├── concurrency-test.ts
│   │   │       ├── detection-load.ts
│   │   │       ├── enterprise-demo.ts
│   │   │       └── failure-simulation.ts
│   │   ├── demo/fixtures.ts
│   │   ├── demo-data/
│   │   │   ├── generators.ts
│   │   │   ├── populate.ts
│   │   │   └── reset.ts
│   │   ├── supabase/
│   │   │   ├── browser.ts
│   │   │   └── server.ts
│   │   └── ai/
│   │       └── aiScoringService.ts
│   ├── server/
│   │   ├── dashboard/
│   │   │   └── getDashboardMetrics.ts
│   │   └── repositories/          # Supabase-backed Repository-Layer
│   │       ├── index.ts           # Barrel-Export
│   │       ├── supabase-admin.ts
│   │       ├── tenant.repository.ts
│   │       ├── user.repository.ts
│   │       ├── data-subject.repository.ts
│   │       ├── case.repository.ts
│   │       ├── state-transition.repository.ts
│   │       ├── task.repository.ts
│   │       ├── document.repository.ts
│   │       ├── comment.repository.ts
│   │       ├── audit-log.repository.ts
│   │       └── system.repository.ts
│   ├── middleware.ts              # Route-Schutz (NextAuth oder HMAC-Token)
│   └── types/next-auth.d.ts      # Session-Type-Augmentation
├── tests/
│   ├── unit/state-machine.test.ts
│   └── e2e/dsar-workflow.spec.ts
├── docker-compose.yml             # PostgreSQL 16
├── next.config.mjs                # Supabase env-var Mapping + Prisma External Packages
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
└── .env.example
```

---

## 3. Authentifizierung & Auth-Architektur

### Zwei Auth-Modi (gesteuert über `NEXT_PUBLIC_AUTH_MODE`)

Die Plattform unterstützt **zwei parallele Auth-Systeme**. Dies ist eine zentrale Architekturentscheidung:

#### Modus 1: `test` (Standard für lokale Entwicklung)
- Verwendet **HMAC-SHA256 signierte httpOnly-Cookies** (`pp-auth-token`)
- Kein Database-Lookup für Auth nötig
- Token enthält: `{id, tenantId, email, name, role, iat, exp}`
- Signiert mit `AUTH_SECRET` Env-Var
- Expiry: 8 Stunden
- Login-Flow: `POST /api/auth/login` → Prisma DB-Lookup → HMAC-Token-Cookie setzen

**Relevante Dateien:**
- `src/lib/test-auth.ts` — `createToken()`, `verifyToken()`, `isTestAuth()`, `getTestUser()`
- `src/components/TestAuthProvider.tsx` — Client-seitiger Provider
- `src/app/api/auth/login/route.ts` — Login-Endpoint für Test-Modus

#### Modus 2: `supabase` (Produktion/Vercel)
- Verwendet **NextAuth.js v4** mit JWT-Strategie
- Credentials Provider: E-Mail + Passwort → Prisma DB-Lookup → bcryptjs-Vergleich
- JWT enthält: `{id, tenantId, role}` (via Callbacks)
- Session-Maximalzeit: 8 Stunden
- Login-Seite: `/login` (konfiguriert in NextAuth pages)

**Relevante Dateien:**
- `src/lib/auth-options.ts` — NextAuth-Konfiguration
- `src/components/NextAuthBridge.tsx` — Bridge von NextAuth Session → AuthContext
- `src/app/api/auth/[...nextauth]/route.ts` — NextAuth-Handler

#### Provider-Switch (src/components/Providers.tsx):
```typescript
const AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE || "test";

export default function Providers({ children }) {
  if (AUTH_MODE === "test") {
    return <TestAuthProvider>{children}</TestAuthProvider>;
  }
  return (
    <SessionProvider>
      <NextAuthBridge>{children}</NextAuthBridge>
    </SessionProvider>
  );
}
```

#### Server-seitige Auth (src/lib/auth.ts):
```typescript
export async function requireAuth(): Promise<AuthUser & { role: UserRole }> {
  // 1. DEV_AUTH_BYPASS → Fixed Demo-User (keine Auth)
  // 2. isTestAuth() → HMAC-Cookie aus cookies() lesen + verifizieren
  // 3. Sonst → getServerSession(authOptions) (NextAuth)
}
```

#### Middleware (src/middleware.ts):
- Prüft Auth-Modus
- Test-Modus: HMAC-Token aus Cookie verifizieren (Edge-kompatibel via Web Crypto API)
- Supabase-Modus: Delegiert an NextAuth `withAuth` Middleware
- Geschützte Routen-Matcher:
  ```
  /dashboard/*, /cases/*, /tasks/*, /documents/*, /settings/*,
  /copilot/*, /data-inventory/*, /integrations/*, /governance/*,
  /incidents/*, /vendors/*, /executive/*, /heatmap/*
  ```

#### Client-seitiger Auth-Hook (src/hooks/useAuth.ts):
```typescript
interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
}
```

#### Dritter Bypass-Modus: `DEV_AUTH_BYPASS=true`
- Überspringt alle Auth-Checks
- Gibt fixierten Demo-User zurück (TENANT_ADMIN Rolle)

---

## 4. Datenbank-Schema (Prisma)

### Datasource-Konfiguration
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```
- `DATABASE_URL`: Connection-Pooler (Port 6543 bei Supabase/Vercel)
- `DIRECT_URL`: Direkte Verbindung (Port 5432) — nur für Migrationen

### Prisma Client Singleton (src/lib/prisma.ts)
```typescript
// Mappt POSTGRES_PRISMA_URL → DATABASE_URL falls nötig (Supabase-Vercel-Integration)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };
export const prisma = globalForPrisma.prisma ?? new PrismaClient({...});
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### Enums (vollständig)

```
UserRole:           SUPER_ADMIN, TENANT_ADMIN, DPO, CASE_MANAGER, ANALYST, AUDITOR, CONTRIBUTOR, READ_ONLY
DSARType:           ACCESS, ERASURE, RECTIFICATION, RESTRICTION, PORTABILITY, OBJECTION
CaseStatus:         NEW, IDENTITY_VERIFICATION, INTAKE_TRIAGE, DATA_COLLECTION, REVIEW_LEGAL, RESPONSE_PREPARATION, RESPONSE_SENT, CLOSED, REJECTED
CasePriority:       LOW, MEDIUM, HIGH, CRITICAL
TaskStatus:         OPEN, IN_PROGRESS, BLOCKED, DONE
DocumentClassification: PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
CommunicationDirection: INBOUND, OUTBOUND
CommunicationChannel:   EMAIL, LETTER, PORTAL, PHONE
DataCollectionStatus:   PENDING, IN_PROGRESS, COMPLETED, FAILED, NOT_APPLICABLE
LegalReviewStatus:      PENDING, IN_REVIEW, APPROVED, REJECTED, CHANGES_REQUESTED
IntegrationProvider:    M365, EXCHANGE_ONLINE, SHAREPOINT, ONEDRIVE, GOOGLE_WORKSPACE, SALESFORCE, SERVICENOW, ATLASSIAN_JIRA, ATLASSIAN_CONFLUENCE, WORKDAY, SAP_SUCCESSFACTORS, OKTA, AWS, AZURE, GCP
IntegrationStatus:      ENABLED, DISABLED
CopilotRunStatus:       DRAFT, QUEUED, RUNNING, COMPLETED, FAILED, CANCELED
CopilotQueryStatus:     PENDING, RUNNING, COMPLETED, FAILED, SKIPPED
FindingSeverity:        INFO, WARNING, CRITICAL
FindingStatus:          OPEN, ACCEPTED, MITIGATING, MITIGATED
AiReviewStatus:         NOT_ANALYZED, ANALYZED, REVIEW_PENDING, REVIEWED
HumanDecision:          APPROVE_DELETE, REJECT_DELETE, NEEDS_LEGAL, APPROVE_RETAIN
DataCategory:           IDENTIFICATION, CONTACT, CONTRACT, PAYMENT, COMMUNICATION, HR, CREDITWORTHINESS, ONLINE_TECHNICAL, HEALTH, RELIGION, UNION, POLITICAL_OPINION, OTHER_SPECIAL_CATEGORY, OTHER
LegalApprovalStatus:    NOT_REQUIRED, REQUIRED, PENDING, APPROVED, REJECTED
QueryIntent:            DATA_LOCATION, DSAR_SUMMARY, CATEGORY_OVERVIEW, RISK_CHECK, EXPORT_PREP, OTHER
EvidenceItemType:       EMAIL, FILE, RECORD, CALENDAR, CONTACT, TICKET, OTHER
ContentHandling:        NONE, METADATA_ONLY, CONTENT_STORED
PrimaryIdentifierType:  EMAIL, UPN, OBJECT_ID, CUSTOMER_ID, EMPLOYEE_ID, PHONE, IBAN, OTHER
CopilotSummaryType:     LOCATION_OVERVIEW, CATEGORY_OVERVIEW, DSAR_DRAFT, RISK_SUMMARY
ExportType:             ZIP, DOCX, XLSX, PDF, JSON, CSV
ExportLegalGateStatus:  BLOCKED, ALLOWED
IntegrationHealthStatus: HEALTHY, DEGRADED, FAILED, NOT_CONFIGURED
RiskLevel:              GREEN, YELLOW, RED
EscalationSeverity:     YELLOW_WARNING, RED_ALERT, OVERDUE_BREACH
DeadlineEventType:      CREATED, RECALCULATED, EXTENDED, PAUSED, RESUMED, MILESTONE_COMPLETED, MILESTONE_MISSED
MilestoneType:          IDV_COMPLETE, COLLECTION_COMPLETE, DRAFT_READY, LEGAL_REVIEW_DONE, RESPONSE_SENT
NotificationType:       ESCALATION, DEADLINE_WARNING, EXTENSION_REQUEST, MILESTONE_DUE, OVERDUE, INFO
IdvRequestStatus:       NOT_STARTED, LINK_SENT, SUBMITTED, IN_REVIEW, APPROVED, REJECTED, NEED_MORE_INFO
IdvMethod:              EMAIL_OTP, DOC_UPLOAD, UTILITY_BILL, SELFIE_MATCH, KNOWLEDGE_BASED
IdvArtifactType:        ID_FRONT, ID_BACK, PASSPORT, DRIVERS_LICENSE, UTILITY_BILL, SELFIE, OTHER_DOCUMENT
IdvDecisionOutcome:     APPROVED, REJECTED, NEED_MORE_INFO
SystemCriticality:      LOW, MEDIUM, HIGH
SystemStatus:           ACTIVE, RETIRED
AutomationReadiness:    MANUAL, SEMI_AUTOMATED, API_AVAILABLE
ConnectorType:          NONE, MOCK, M365, GOOGLE, SALESFORCE, CUSTOM
LawfulBasis:            CONSENT, CONTRACT, LEGAL_OBLIGATION, VITAL_INTERESTS, PUBLIC_INTEREST, LEGITIMATE_INTERESTS
ProcessorRole:          PROCESSOR, SUBPROCESSOR
```

### Kern-Models (wichtigste Felder und Beziehungen)

#### Tenant
```
id, name, slaDefaultDays(30), dueSoonDays(7), retentionDays(365)
→ Hat: users[], cases[], tasks[], documents[], comments[], auditLogs[], systems[], integrations[], copilotRuns[], findings[], incidents[], vendors[], ...
```

#### User
```
id, tenantId, email, name, passwordHash, role(UserRole), lastLoginAt
@@unique([tenantId, email])
→ Gehört zu: Tenant
→ Hat: createdCases[], assignedCases[], assignedTasks[], uploadedDocuments[], comments[], ...
```

#### DSARCase
```
id, tenantId, caseNumber(unique per tenant), type(DSARType), status(CaseStatus=NEW),
priority(CasePriority=MEDIUM), lawfulBasis?, receivedAt, dueDate, extendedDueDate?,
extensionReason?, channel?, requesterType?, description?, identityVerified(false),
tags(Json?), deletedAt?, dataSubjectId, createdByUserId, assignedToUserId?
@@unique([tenantId, caseNumber])
→ Gehört zu: Tenant, DataSubject, User(createdBy), User?(assignedTo)
→ Hat: stateTransitions[], tasks[], documents[], comments[], communicationLogs[],
       dataCollectionItems[], legalReviews[], copilotRuns[], identityProfiles[],
       legalHolds[], teamMembers[], caseSystemLinks[], deadline?, milestones[],
       escalations[], idvRequest?, responseDocuments[], dsarIncidents[], vendorRequests[],
       dsarCaseItems[], dsarAuditEvents[]
```

#### DataSubject
```
id, tenantId, fullName, email?, phone?, address?, preferredLanguage("en"), identifiers(Json?), notes?
→ Hat: cases[]
```

#### DSARStateTransition
```
id, tenantId, caseId, fromStatus, toStatus, changedByUserId, changedAt, reason, metadata(Json?)
```

#### Task
```
id, tenantId, caseId, title, description?, status(TaskStatus=OPEN), dueDate?,
assigneeUserId?, systemId?, findingId?
```

#### Document
```
id, tenantId, caseId, filename, contentType, storageKey, size, hash,
classification(DocumentClassification=INTERNAL), tags(Json?), deletedAt?, uploadedByUserId
```

#### Comment
```
id, tenantId, caseId, authorUserId, body, createdAt
```

#### AuditLog
```
id, tenantId?, actorUserId?, action, entityType, entityId?, createdAt, ip?, userAgent?, details(Json?)
```

#### System (Data Inventory)
```
id, tenantId, name, description?, owner?, contactEmail?, tags(Json?),
ownerUserId?, criticality(MEDIUM), systemStatus(ACTIVE),
containsSpecialCategories(false), inScopeForDsar(true), notes?,
automationReadiness(MANUAL), connectorType(NONE), exportFormats[],
estimatedCollectionTimeMinutes?, dataResidencyPrimary?, processingRegions[],
thirdCountryTransfers(false), thirdCountryTransferDetails?, identifierTypes[]
→ Hat: tasks[], dataCollectionItems[], dataCategories[], processors[],
       discoveryRules[], caseSystemLinks[], findings[], dataAssets[], scanJobs[]
```

#### Integration
```
id, tenantId, provider(IntegrationProvider), name, status(DISABLED),
config(Json?), secretRef?, healthStatus(NOT_CONFIGURED),
lastHealthCheckAt?, lastSuccessAt?, lastError?, ownerUserId?
→ Hat: dataCollectionItems[], copilotQueries[], evidenceItems[], secrets[]
```

#### Weitere wichtige Models:
- **CommunicationLog** — Kommunikation mit Betroffenen (ein/ausgehend)
- **DataCollectionItem** — Datenerfassung pro System/Integration
- **LegalReview** — Rechtliche Prüfung eines Cases
- **CopilotRun** — KI-Copilot-Durchlauf
- **CopilotQuery** — Einzelne Queries innerhalb eines Runs
- **IdentityProfile** — Identitätsprofil eines Betroffenen
- **EvidenceItem** — Beweisstücke (Emails, Dateien, Records)
- **Finding** — Befunde aus Scans/Copilot
- **DetectorResult** — Ergebnisse einzelner PII-Detektoren
- **CopilotSummary** — KI-generierte Zusammenfassungen
- **ExportArtifact** — Export-Dateien
- **CopilotGovernanceSettings** — Tenant-weite Copilot-Einstellungen
- **LegalHold** — Rechtliche Sperren auf Cases
- **RedactionSuggestion** — Schwärzungsvorschläge
- **BreakGlassEvent** — Notfall-Zugriffe
- **ExportApproval** — Export-Genehmigungen (2-Person-Prinzip)
- **CaseTeamMember** — Fallteam-Zugehörigkeit
- **SystemDataCategory** — Datenkategorien pro System
- **SystemProcessor** — Auftragsverarbeiter pro System
- **DiscoveryRule** — Regeln für automatische System-Discovery
- **CaseSystemLink** — Verknüpfung Case ↔ System
- **TenantSlaConfig** — Tenant-SLA-Konfiguration
- **Holiday** — Feiertage für Geschäftstage-Berechnung
- **CaseDeadline** — Deadline-Tracking pro Case
- **DeadlineEvent** — Deadline-Events (Created, Extended, Paused, etc.)
- **CaseMilestone** — Meilensteine pro Case
- **Escalation** — Eskalationen
- **Notification** — Benachrichtigungen
- **IdvRequest, IdvArtifact, IdvCheck, IdvDecision, IdvRiskAssessment** — Identity Verification
- **IdvSettings** — IDV-Einstellungen pro Tenant
- **ResponseTemplate** — Antwort-Vorlagen
- **ResponseDocument** — Generierte Antwort-Dokumente
- **ResponseApproval** — Antwort-Genehmigungen
- **DeliveryRecord** — Zustellungsnachweise
- **RedactionEntry** — Schwärzungen in Antworten
- **Incident** — Datenschutz-Vorfälle
- **IncidentSource, IncidentSystem, IncidentContact, IncidentTimeline, IncidentCommunication** — Incident-Details
- **IncidentAssessment** — Risikobeurteilung Art. 33 DSGVO
- **IncidentRegulatorRecord** — Behördenmeldungen
- **DsarIncident** — Verknüpfung DSAR ↔ Incident
- **SurgeGroup, SurgeGroupMember** — Massen-DSARs bei Incidents
- **AuthorityExportRun** — Behörden-Exports
- **Vendor, VendorContact, VendorDpa** — Auftragsverarbeiter-Verwaltung
- **VendorRequestTemplate, VendorRequest, VendorRequestItem** — Anfragen an Auftragsverarbeiter
- **VendorResponse, VendorResponseArtifact** — Antworten von Auftragsverarbeitern
- **VendorSlaConfig, VendorEscalation** — Vendor-SLA und Eskalationen
- **PrivacyKpiSnapshot, PrivacyKpiConfig** — KPI-Metriken
- **AutomationMetric** — Automatisierungsmetriken
- **ExecutiveReport, ExecutiveReportRun** — Board-Reports
- **KpiThreshold** — KPI-Schwellenwerte
- **MaturityScore** — Reifegradmetriken
- **BoardExportRun** — Board-Export-Runs
- **ForecastModel** — Prognosemodelle
- **DsarCaseItem** — Vorgeschlagene/bestätigte Daten-Assets pro Case
- **DsarAuditEvent** — DSAR-spezifische Audit-Events
- **DataAsset** — Dateninventarisierung
- **ScanJob** — Scan-Aufträge
- **FindingAuditEvent** — Finding-spezifische Audit-Events
- **Connector, ConnectorRun** — Connector-Framework
- **PasswordResetToken** — Passwort-Reset-Tokens

---

## 5. DSAR Status State Machine

```
NEW → IDENTITY_VERIFICATION | INTAKE_TRIAGE | REJECTED
IDENTITY_VERIFICATION → INTAKE_TRIAGE | REJECTED
INTAKE_TRIAGE → DATA_COLLECTION | REJECTED
DATA_COLLECTION → REVIEW_LEGAL
REVIEW_LEGAL → RESPONSE_PREPARATION | DATA_COLLECTION (zurück)
RESPONSE_PREPARATION → RESPONSE_SENT
RESPONSE_SENT → CLOSED
REJECTED → CLOSED
CLOSED → (Terminal)
```

**Implementierung** (src/lib/state-machine.ts):
```typescript
const TRANSITION_MAP: Record<CaseStatus, CaseStatus[]> = {
  NEW: [CaseStatus.IDENTITY_VERIFICATION, CaseStatus.INTAKE_TRIAGE, CaseStatus.REJECTED],
  IDENTITY_VERIFICATION: [CaseStatus.INTAKE_TRIAGE, CaseStatus.REJECTED],
  INTAKE_TRIAGE: [CaseStatus.DATA_COLLECTION, CaseStatus.REJECTED],
  DATA_COLLECTION: [CaseStatus.REVIEW_LEGAL],
  REVIEW_LEGAL: [CaseStatus.RESPONSE_PREPARATION, CaseStatus.DATA_COLLECTION],
  RESPONSE_PREPARATION: [CaseStatus.RESPONSE_SENT],
  RESPONSE_SENT: [CaseStatus.CLOSED],
  CLOSED: [],
  REJECTED: [CaseStatus.CLOSED],
};

export function getAllowedTransitions(current: CaseStatus): CaseStatus[] { ... }
export function isValidTransition(from: CaseStatus, to: CaseStatus): boolean { ... }
```

Jeder Übergang:
1. Benötigt `reason` (Pflichtfeld)
2. Wird in `DSARStateTransition` gespeichert
3. Wird in `AuditLog` geloggt

---

## 6. RBAC (Rollenbasierte Zugriffskontrolle)

### Rollen-Hierarchie
```
SUPER_ADMIN > TENANT_ADMIN > DPO > CASE_MANAGER > ANALYST > AUDITOR > CONTRIBUTOR > READ_ONLY
```

### Permission-System (src/lib/rbac.ts)
**Zwei parallele Systeme:**

1. **Feingranulares System** — ~130 individuelle Permissions in Kategorien:
   - Governance, Copilot, Exports, Integrations, Documents, Admin, Cases/CRUD,
   - Data Inventory, Deadlines, IDV, Response, Incidents, Vendors, Executive, Findings

2. **Legacy-System** — Resource/Action-basiert (backward-compatible):
   ```typescript
   checkPermission(role, "cases", "read")  // Mappt intern auf feingranulare Permissions
   ```

### Wichtige Funktionen:
```typescript
has(role, permission): boolean           // Feingranular
enforce(role, permission): void          // Wirft ApiError(403)
checkPermission(role, resource, action)  // Legacy
hasGlobalCaseAccess(role): boolean       // SUPER_ADMIN, TENANT_ADMIN, DPO
isReadOnly(role): boolean                // AUDITOR, READ_ONLY
```

### Export-Gates:
- Art. 9 Special Category → Legal Approval erforderlich
- Aktiver Legal Hold → Export blockiert
- Export Approval Pending → Export blockiert
- Content Scan Gate → Prüft Rolle UND Tenant-Einstellungen

---

## 7. API-Routen (vollständig, ~115 Endpoints)

### Standard-Pattern jeder Route:
```typescript
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();                  // 401
    checkPermission(user.role, "resource", "action");  // 403
    // ... Logik mit tenantId-Filter
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);                      // Konsistente Fehler
  }
}
```

### Auth
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/auth/[...nextauth]` | * | NextAuth-Handler (nur supabase-Modus) |
| `/api/auth/login` | POST | Login (test-Modus) |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Aktueller User |
| `/api/auth/forgot-password` | POST | Passwort-Reset anfordern |
| `/api/auth/reset-password` | POST | Passwort zurücksetzen |

### Cases (Kern-CRUD)
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/cases` | GET, POST | Liste (mit Filter, Suche, Pagination) / Erstellen |
| `/api/cases/[id]` | GET, PATCH | Detail / Aktualisieren |
| `/api/cases/[id]/transitions` | GET, POST | Status-Übergänge |
| `/api/cases/[id]/tasks` | GET, POST | Tasks pro Case |
| `/api/cases/[id]/documents` | GET, POST | Dokumente pro Case |
| `/api/cases/[id]/comments` | GET, POST | Kommentare |
| `/api/cases/[id]/communications` | GET, POST | Kommunikationslog |
| `/api/cases/[id]/data-collection` | GET, POST, PATCH | Datenerfassung |
| `/api/cases/[id]/legal-review` | GET, POST, PATCH | Rechtliche Prüfung |
| `/api/cases/[id]/systems` | GET, POST, PATCH, DELETE | Case ↔ System-Links |
| `/api/cases/[id]/export` | GET | Case-Export |
| `/api/cases/[id]/evidence-pack` | GET | Evidence-Pack |
| `/api/cases/[id]/deadline` | GET, POST, PATCH | Deadline-Management |
| `/api/cases/[id]/audit-events` | GET | DSAR Audit-Trail |
| `/api/cases/[id]/proposed-items` | GET | Vorgeschlagene Daten-Assets |
| `/api/cases/[id]/proposed-items/[itemId]` | PATCH | Asset-Entscheidung |
| `/api/cases/[id]/incidents` | GET, POST, DELETE | Incident-Verknüpfungen |
| `/api/cases/[id]/vendors` | GET, POST | Vendor-Anfragen pro Case |

### Cases — Copilot
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/cases/[id]/copilot` | GET, POST | Copilot-Runs pro Case |
| `/api/cases/[id]/copilot/[runId]` | GET, PATCH | Run-Detail / Aktualisieren |
| `/api/cases/[id]/copilot/[runId]/evidence` | GET | Evidence pro Run |
| `/api/cases/[id]/copilot/[runId]/export` | GET, POST | Run-Export |
| `/api/cases/[id]/copilot/[runId]/summary` | GET, POST | Run-Zusammenfassung |

### Cases — IDV (Identity Verification)
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/cases/[id]/idv` | GET, POST, PATCH | IDV-Request |
| `/api/cases/[id]/idv/artifacts` | GET, POST | IDV-Artefakte |

### Cases — Response Generator
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/cases/[id]/response` | GET, POST, PATCH | Response-Dokument |
| `/api/cases/[id]/response/download` | GET | Response-Download |

### Cross-Case
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/tasks` | GET | Alle Tasks (tenant-weit) |
| `/api/tasks/[id]` | PATCH | Task aktualisieren |
| `/api/documents` | GET | Alle Dokumente |
| `/api/documents/[id]` | GET, DELETE | Dokument-Detail |
| `/api/documents/[id]/download` | GET | Dokument-Download |

### Data Inventory
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/data-inventory/systems` | GET, POST | Systeme |
| `/api/data-inventory/systems/[id]` | GET, PATCH, DELETE | System-Detail |
| `/api/data-inventory/systems/[id]/categories` | GET, POST, DELETE | Datenkategorien |
| `/api/data-inventory/systems/[id]/processors` | GET, POST, DELETE | Auftragsverarbeiter |
| `/api/data-inventory/discover` | POST | Discovery ausführen |
| `/api/data-inventory/discovery-rules` | GET, POST | Discovery-Regeln |
| `/api/data-inventory/discovery-rules/[id]` | PATCH, DELETE | Regel-Detail |

### Integrations & Connectors
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/integrations` | GET, POST | Integrationen |
| `/api/integrations/[id]` | GET, PATCH, DELETE | Integration-Detail |
| `/api/integrations/[id]/test` | POST | Verbindungstest |
| `/api/integrations/health` | GET | Health-Status aller Integrationen |
| `/api/connectors` | GET, POST | Connectors |
| `/api/connectors/[id]` | GET, PATCH, DELETE | Connector-Detail |
| `/api/connectors/[id]/credentials` | POST | Credentials speichern |
| `/api/connectors/[id]/run` | POST | Connector ausführen |
| `/api/connectors/[id]/runs` | GET | Run-Historie |

### Governance
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/governance/settings` | GET, PATCH | Copilot-Governance-Settings |
| `/api/governance/approval` | POST | Approval-Workflow |
| `/api/governance/activity-log` | GET | Aktivitätslog |
| `/api/governance/report-export` | GET, POST | Governance-Report |

### Copilot (global)
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/copilot/run` | POST | Neuen Copilot-Run starten |
| `/api/copilot/stats` | GET | Copilot-Statistiken |

### Findings & Heatmap
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/findings/[id]` | GET | Finding-Detail |
| `/api/findings/[id]/accept` | POST | Risiko akzeptieren |
| `/api/findings/[id]/mitigate` | POST | Mitigation starten |
| `/api/findings/[id]/resolve` | POST | Als behoben markieren |
| `/api/findings/[id]/actions` | GET | Finding-Aktionen |
| `/api/findings/[id]/audit` | GET | Finding-Audit-Trail |
| `/api/findings/[findingId]/decision` | POST | Finding-Entscheidung |
| `/api/findings/critical` | GET | Kritische Findings |
| `/api/findings/pending-decisions` | GET | Ausstehende Entscheidungen |
| `/api/heatmap` | GET | Risiko-Heatmap-Daten |
| `/api/heatmap/overview` | GET | Heatmap-Übersicht |
| `/api/heatmap/[systemId]` | GET | System-Heatmap |
| `/api/heatmap/finding` | GET | Finding-basierte Heatmap |
| `/api/heatmap/system` | GET | System-basierte Heatmap |

### Incidents
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/incidents` | GET, POST | Vorfälle |
| `/api/incidents/[id]` | GET, PATCH, DELETE | Vorfall-Detail |
| `/api/incidents/[id]/export` | GET | Vorfall-Export |
| `/api/incidents/[id]/surge` | GET, POST | Surge-Management |
| `/api/incidents/stats` | GET | Vorfall-Statistiken |

### Vendors
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/vendors` | GET, POST | Auftragsverarbeiter |
| `/api/vendors/[id]` | GET, PATCH, DELETE | Vendor-Detail |
| `/api/vendors/stats` | GET | Vendor-Statistiken |
| `/api/vendors/templates` | GET, POST | Request-Vorlagen |
| `/api/vendors/templates/[id]` | GET, PATCH, DELETE | Vorlage-Detail |

### Executive / KPI
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/executive/kpis` | GET | KPI-Dashboard |
| `/api/executive/trends` | GET | Trend-Daten |
| `/api/executive/forecasts` | GET | Prognosen |
| `/api/executive/automation` | GET | Automatisierungsmetriken |
| `/api/executive/maturity` | GET | Reifegrad |
| `/api/executive/config` | GET, PATCH | KPI-Konfiguration |
| `/api/executive/thresholds` | GET, POST | KPI-Schwellenwerte |
| `/api/executive/reports` | GET, POST | Reports |
| `/api/executive/reports/runs/[id]` | GET | Report-Run-Detail |
| `/api/executive/exports` | GET, POST | Board-Exports |
| `/api/executive/exports/[id]` | GET | Export-Detail |

### IDV (Identity Verification — Portal)
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/idv/portal/[token]` | GET, POST | Öffentliches Portal für Betroffene |
| `/api/idv/settings` | GET, PATCH | IDV-Einstellungen |
| `/api/idv/retention` | POST | Retention-Cleanup |

### Weitere
| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/users` | GET, POST | User-Verwaltung |
| `/api/users/[id]` | PATCH, DELETE | User-Detail |
| `/api/systems` | GET, POST | Legacy Systems-API |
| `/api/systems/[id]` | GET, PATCH, DELETE | System-Detail |
| `/api/data-subjects` | GET | Betroffenen-Suche |
| `/api/audit-logs` | GET | Audit-Logs |
| `/api/dashboard/metrics` | GET | Dashboard-Metriken |
| `/api/notifications` | GET, PATCH | Benachrichtigungen |
| `/api/escalations` | GET | Eskalationen |
| `/api/holidays` | GET, POST, DELETE | Feiertage |
| `/api/sla-config` | GET, PATCH | SLA-Konfiguration |
| `/api/sla-report` | GET | SLA-Report |
| `/api/response-templates` | GET, POST | Antwort-Vorlagen |
| `/api/response-stats` | GET | Response-Statistiken |
| `/api/reports` | GET, POST | Generische Reports |
| `/api/risk-recompute` | POST | Risiko-Neuberechnung |
| `/api/tenant` | GET | Tenant-Info |
| `/api/check-status` | GET | Health-Check |
| `/api/health/supabase` | GET | Supabase Health-Check |
| `/api/seed` | POST | Dev: Seed-Daten |
| `/api/demo-data/populate` | POST | Demo-Daten laden |
| `/api/demo-data/reset` | POST | Demo-Daten zurücksetzen |
| `/api/demo/whoami` | GET | Dev: Aktueller User |
| `/api/demo/seed-heatmap` | POST | Dev: Heatmap-Daten |
| `/api/demo/reset-heatmap` | POST | Dev: Heatmap-Reset |

---

## 8. Error-Handling

### ApiError (src/lib/errors.ts)
```typescript
export class ApiError extends Error {
  constructor(public statusCode: number, message: string, public details?: unknown) { ... }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError)    → { error: message, details } + statusCode
  if (error instanceof ZodError)    → { error: "Validation failed", details: [...] } + 400
  else                              → { error: "Internal server error" } + 500
}
```

---

## 9. Multi-Tenancy

**KRITISCH**: Jede Datenbank-Tabelle enthält `tenantId`. Jeder API-Query MUSS nach `tenantId` filtern, abgeleitet aus `session.user.tenantId`.

```typescript
// Korrekt:
const data = await prisma.dSARCase.findMany({
  where: { tenantId: user.tenantId, ... },
});

// FALSCH (Cross-Tenant Leak!):
const data = await prisma.dSARCase.findMany({
  where: { id: someId },  // ⚠️ Kein tenantId-Filter!
});
```

---

## 10. Validierung (Zod Schemas)

Alle API-Eingaben werden mit Zod validiert (src/lib/validation.ts). Wichtige Schemas:

- `loginSchema` — email + password
- `createCaseSchema` — type, priority, channel, dataSubject{fullName, email, ...}
- `updateCaseSchema` — priority, assignedToUserId, description, lawfulBasis
- `transitionSchema` — toStatus + reason (Pflicht!)
- `createTaskSchema` — title, description, assigneeUserId, dueDate, systemId
- `updateTaskSchema` — title, description, status, assigneeUserId, dueDate
- `createCommentSchema` — body
- `createUserSchema` — email, name, password(min 8), role
- `createSystemSchema` / `updateSystemSchema` — name, description, owner, contactEmail
- `createInventorySystemSchema` — Erweitert um criticality, systemStatus, automation, etc.
- `createDiscoveryRuleSchema` — name, dsarTypes, systemId, weight, conditions
- `extensionRequestSchema` — extensionDays(1-60), reason
- `initIdvRequestSchema` — allowedMethods
- `idvDecisionSchema` — outcome, rationale
- `generateResponseSchema` — templateId, language, aiAssisted
- `createIncidentSchema` — title, severity, status, detectedAt, etc.
- `createVendorSchema` — name, shortCode, status, website, etc.
- `createVendorRequestSchema` — vendorId, subject, bodyHtml, items[]
- `kpiDateRangeSchema` — startDate, endDate, period
- `createIntegrationSchema` — provider, name, config, secrets
- `createConnectorSchema` — name, category, config
- `findingAcceptSchema` / `findingMitigateSchema` / `findingResolveSchema`

---

## 11. File Storage (src/lib/storage.ts)

```typescript
interface StorageProvider {
  upload(buffer, filename, contentType): Promise<{storageKey, hash, size}>
  download(storageKey): Promise<Buffer>
  delete(storageKey): Promise<void>
}
```

- **LocalStorageProvider**: Speichert in `STORAGE_LOCAL_PATH` (default: `./uploads`)
- **S3StorageProvider**: **STUB** — fällt auf Local zurück (TODO: echte S3-Implementierung)
- Auswahl über `STORAGE_TYPE` Env-Var ("local" | "s3")
- Dateien bekommen UUID-basierte storageKeys

---

## 12. Audit-Logging (src/lib/audit.ts)

```typescript
await logAudit({
  tenantId, actorUserId, action, entityType, entityId,
  ip, userAgent, details
});
```

Geloggt werden: Login/Logout, Case CRUD, Status-Transitions, Dokument-Uploads/Downloads, Exports, User-Management-Änderungen.

Zusätzlich gibt es `DsarAuditEvent` (case-spezifisch) und `FindingAuditEvent` (finding-spezifisch).

---

## 13. Frontend-Architektur

### Root Layout (src/app/layout.tsx)
```tsx
<html lang="en">
  <body>
    <Providers>{children}</Providers>   // Auth-Provider-Switch
  </body>
</html>
```

### Dashboard Layout (src/app/(dashboard)/layout.tsx)
- Client Component (`"use client"`)
- Nutzt `useAuth()` Hook für Auth-Status
- Desktop: Feste Sidebar links (264px) + Main-Content rechts
- Mobile: Hamburger-Header + Drawer-Overlay + Bottom-Navigation
- Redirect zu `/login` wenn unauthenticated
- Loading-Spinner während Auth-Check

### Seiten:
| Route | Funktion |
|---|---|
| `/dashboard` | KPI-Karten, Status-Verteilung, offene Tasks, SLA-Übersicht |
| `/cases` | Tabelle mit Filter (Status, Typ, Assignee), Suche, Pagination |
| `/cases/new` | Formular: Typ, Priorität, Kanal, Betroffener (Name, E-Mail, etc.) |
| `/cases/[id]` | Tabs: Übersicht, Tasks, Dokumente, Kommentare, Kommunikation, Legal Review, Copilot, IDV, Response, Incidents, Vendors, Audit-Trail |
| `/tasks` | Cross-Case Task-Übersicht |
| `/documents` | Cross-Case Dokument-Übersicht |
| `/copilot` | Copilot-Runs starten, Verlauf ansehen |
| `/data-inventory` | System-Inventar mit Criticality, Automation-Status, Data Categories |
| `/data-inventory/[id]` | System-Detail mit Kategorien, Prozessoren, Discovery-Regeln |
| `/integrations` | Integrations-Liste, Connectors-Panel |
| `/governance` | Governance-Dashboard, Settings, Approvals |
| `/governance/sla` | SLA-Konfiguration, Feiertage |
| `/governance/vendors` | Vendor-Übersicht |
| `/governance/incidents` | Incident-Liste |
| `/heatmap` | Risiko-Heatmap (System × Kategorie) |
| `/executive` | Board-Level KPIs, Trends, Forecasts |
| `/settings` | Tenant-Konfiguration, User-Verwaltung |

### Komponenten:
- **Sidebar.tsx** — Desktop-Navigation mit NAV_ITEMS
- **MobileNav.tsx** — MobileHeader, MobileDrawer, BottomNav
- **NotificationBell.tsx** — Benachrichtigungs-Glocke
- **CopilotRunDialog.tsx** — Dialog für Copilot-Runs
- **DeadlinePanel.tsx** — Deadline-Anzeige/Management
- **IdvPanel.tsx** — Identity Verification Panel
- **ResponsePanel.tsx** — Response-Generator Panel
- **VendorPanel.tsx** — Vendor-Anfragen Panel
- **IncidentPanel.tsx** — Incident-Verknüpfung
- **DataAssetsPanel.tsx** — Vorgeschlagene Daten-Assets
- **DsarAuditTrailPanel.tsx** — DSAR-spezifischer Audit-Trail
- **charts/** — BarChart, DonutChart, GaugeChart, HeatmapChart, LineChart, StackedBarChart (alle custom, kein Chart-Library)

---

## 14. Repository-Layer (src/server/repositories/)

Optional Supabase-backed Repository-Pattern für einige Entitäten:
- TenantRepository, UserRepository, DataSubjectRepository
- CaseRepository, StateTransitionRepository
- TaskRepository, DocumentRepository, CommentRepository
- AuditLogRepository, SystemRepository

**Hinweis**: Die meisten API-Routes nutzen Prisma direkt, nicht die Repositories. Das Repository-Pattern ist parallel vorhanden, was zu Duplikation führen kann.

---

## 15. Connector-Framework (src/lib/connectors/)

```typescript
// src/lib/connectors/types.ts
interface ConnectorPlugin {
  id: string;
  name: string;
  category: string;
  execute(config, credentials, params): Promise<ConnectorResult>;
  testConnection(config, credentials): Promise<boolean>;
}
```

Registrierte Connectors:
- **aws.ts** — AWS (S3, IAM, CloudTrail)
- **m365.ts** — Microsoft 365 (Graph API)
- **exchange-online.ts** — Exchange Online Mailbox-Suche
- **sharepoint.ts** — SharePoint Online
- **onedrive.ts** — OneDrive for Business
- **stubs.ts** — Mock-Connectors für Tests

Runner: `src/lib/connector-runner.ts`

---

## 16. Environment-Variablen

```bash
# Datenbank
DATABASE_URL="postgresql://..."          # Pooled (Port 6543 auf Vercel)
DIRECT_URL="postgresql://..."            # Non-pooled (Port 5432, nur Migrationen)

# Auth-Modus
NEXT_PUBLIC_AUTH_MODE="test"             # "test" oder "supabase"

# Test-Modus Auth
AUTH_SECRET="..."                        # HMAC-Signing-Secret
TEST_USER_EMAIL="..."
TEST_USER_PASSWORD="..."

# NextAuth (supabase-Modus)
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"

# Dev-Bypass
DEV_AUTH_BYPASS="true"                   # Überspringt alle Auth
DEMO_TENANT_ID="83053683-..."

# Storage
STORAGE_TYPE="local"                     # "local" oder "s3"
STORAGE_LOCAL_PATH="./uploads"

# Verschlüsselung
INTEGRATION_ENCRYPTION_KEY=""            # 32 Bytes, base64
ENCRYPTION_KEY=""                        # Fallback auf INTEGRATION_ENCRYPTION_KEY

# E-Mail
SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

# SLA
DEFAULT_SLA_DAYS=30

# Supabase (optional)
USE_SUPABASE="false"
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
```

---

## 17. next.config.mjs

```javascript
// Supabase-Vercel env-var Mapping (zur Laufzeit):
// POSTGRES_PRISMA_URL → DATABASE_URL
// POSTGRES_URL_NON_POOLING → DIRECT_URL
// VERCEL_URL → NEXTAUTH_URL

const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};
```

---

## 18. Build & Deployment

### Scripts
```bash
npm run build            # prisma generate && next build
npm run build:with-db    # prisma generate && node prisma/deploy.js && next build
npm run dev              # next dev
npm run db:push          # prisma db push (Schema ohne Migration)
npm run db:migrate       # prisma migrate dev
npm run db:seed          # npx tsx prisma/seed.ts
```

### Vercel Build
- Build-Command: `prisma generate && next build`
- Vercel braucht nur: `DATABASE_URL` (pooled) + `NEXTAUTH_SECRET`
- **Keine Migrationen im Build** — nur lokal/CI

### Migrationen
```bash
export DIRECT_URL="postgresql://...:5432/..."
export DATABASE_URL="$DIRECT_URL"
npx prisma migrate deploy
```

---

## 19. Bekannte Architektur-Probleme & Risiken

1. **Zwei parallele Auth-Systeme** (test vs. supabase): Middleware, Server-Auth und Client-Auth haben alle Branching-Logik für beide Modi. Fehlerquelle bei Mismatch.

2. **Repository-Layer vs. direkte Prisma-Nutzung**: Einige API-Routes nutzen Repositories, die meisten Prisma direkt. Inkonsistente Abstraktion.

3. **S3 Storage ist ein Stub**: Fällt auf Local zurück. In Produktion problematisch bei Serverless (kein persistenter Filesystem).

4. **Sehr große Prisma-Schema (~90 Models)**: Kaltstarts der Prisma-Client-Generierung können langsam sein.

5. **Env-Var Mapping an mehreren Stellen**: `next.config.mjs` UND `src/lib/prisma.ts` mappen beide `POSTGRES_PRISMA_URL → DATABASE_URL`. Doppelte Logik.

6. **Feingranulares + Legacy RBAC parallel**: Zwei Permission-Systeme nebeneinander. Risiko, dass API-Routes verschiedene Systeme verwenden.

7. **`force-dynamic` Export auf vielen Routes**: Verhindert Static Optimization.

8. **Client Component Dashboard Layout**: Das gesamte Dashboard-Layout ist ein Client Component, obwohl es ein Server Component sein könnte (nur die Auth-Logik braucht Client).

---

## 20. Kommandos

```bash
# Entwicklung
npm run docker:up        # PostgreSQL starten
npm run db:push          # Schema in DB pushen
npm run db:seed          # Demo-Daten laden
npm run dev              # Dev-Server auf localhost:3000

# Tests
npm test                 # Unit Tests (vitest)
npm run test:e2e         # E2E Tests (playwright)

# Build
npm run build            # Produktions-Build
npm run lint             # ESLint

# Datenbank
npm run db:generate      # Prisma Client regenerieren
npm run db:migrate       # Migrationen ausführen
npm run db:push          # Schema pushen (ohne Migrations-Dateien)
```

---

*Dieses Dokument wurde am 2026-02-26 automatisch aus der Codebasis generiert.*
