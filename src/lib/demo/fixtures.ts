/**
 * Demo scenario fixtures — 100% client-side synthetic data.
 * No database calls, no auth required.
 */

export type DemoScenarioId = "access" | "erasure" | "objection";

export interface DemoStep {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
}

export const DEMO_STEPS: DemoStep[] = [
  {
    id: "intake",
    label: "Intake & Triage",
    shortLabel: "Intake",
    description:
      "Review the incoming DSAR and verify the data subject's identity",
  },
  {
    id: "discovery",
    label: "Data Discovery",
    shortLabel: "Discovery",
    description: "Scan connected systems for personal data",
  },
  {
    id: "findings",
    label: "Findings & PII",
    shortLabel: "Findings",
    description: "Review detected personal data categories and evidence",
  },
  {
    id: "legal",
    label: "Legal Gate",
    shortLabel: "Legal",
    description: "Check for Art. 9 special categories and legal holds",
  },
  {
    id: "export",
    label: "Export Package",
    shortLabel: "Export",
    description: "Generate the response package for the data subject",
  },
  {
    id: "audit",
    label: "Audit Trail",
    shortLabel: "Audit",
    description: "Review the complete audit log of all actions",
  },
];

/* ─── Sub-types ────────────────────────────────────────────────────────────── */

export interface DemoDataSubject {
  fullName: string;
  email: string;
  phone: string;
  employeeId?: string;
  department?: string;
}

export interface DemoCaseInfo {
  caseNumber: string;
  type: string;
  typeLabel: string;
  priority: string;
  status: string;
  receivedAt: string;
  dueDate: string;
  channel: string;
  description: string;
  dataSubject: DemoDataSubject;
  assignedTo: string;
}

export interface DemoEvidenceItem {
  id: string;
  provider: string;
  workload: string;
  itemType: string;
  location: string;
  title: string;
  createdAt: string;
  sensitivityScore: number;
  piiCategories: string[];
}

export interface DemoFinding {
  id: string;
  category: string;
  categoryLabel: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  confidence: number;
  summary: string;
  evidenceCount: number;
  containsSpecialCategory: boolean;
  requiresLegalReview: boolean;
}

export interface DemoDiscoverySystem {
  provider: string;
  label: string;
  itemsFound: number;
  duration: number;
}

export interface DemoLegalReview {
  hasSpecialCategory: boolean;
  specialCategories: string[];
  legalGateStatus: "ALLOWED" | "BLOCKED";
  issues: string[];
  exemptions: string[];
  reviewerNote: string;
}

export interface DemoExportArtifact {
  filename: string;
  type: string;
  size: string;
  status: string;
  legalGateStatus: "ALLOWED" | "BLOCKED";
  redactedFields: number;
}

export interface DemoAuditEvent {
  timestamp: string;
  action: string;
  actor: string;
  details: string;
}

export interface DemoScenarioData {
  id: DemoScenarioId;
  title: string;
  subtitle: string;
  description: string;
  highlights: string[];
  caseInfo: DemoCaseInfo;
  discoverySystems: DemoDiscoverySystem[];
  evidence: DemoEvidenceItem[];
  findings: DemoFinding[];
  legalReview: DemoLegalReview;
  exports: DemoExportArtifact[];
  auditTimeline: DemoAuditEvent[];
}

/* ─── Scenario 1: Access Request (Art. 15) ─────────────────────────────────── */

const accessScenario: DemoScenarioData = {
  id: "access",
  title: "Access Request",
  subtitle: "GDPR Art. 15 — Right of Access",
  description:
    "A customer requests a complete copy of all personal data held about them. Follow the full lifecycle from intake through data discovery, review, and secure export.",
  highlights: [
    "Full M365 data discovery across 4 workloads",
    "PII detection with masked previews",
    "Automated export package generation",
    "Complete audit trail",
  ],
  caseInfo: {
    caseNumber: "DSAR-2026-0042",
    type: "ACCESS",
    typeLabel: "Access Request (Art. 15)",
    priority: "HIGH",
    status: "DATA_COLLECTION",
    receivedAt: "2026-02-10T09:30:00Z",
    dueDate: "2026-03-12T23:59:59Z",
    channel: "Email",
    description:
      "Data subject requests a full copy of all personal data processed by the organization, including email correspondence, HR records, and any shared documents.",
    dataSubject: {
      fullName: "Maria Schmidt",
      email: "maria.schmidt@example.com",
      phone: "+49 170 1234567",
      employeeId: "EMP-4821",
      department: "Marketing",
    },
    assignedTo: "Anna Becker (DPO)",
  },
  discoverySystems: [
    { provider: "EXCHANGE_ONLINE", label: "Exchange Online", itemsFound: 847, duration: 3200 },
    { provider: "SHAREPOINT", label: "SharePoint Online", itemsFound: 156, duration: 2800 },
    { provider: "ONEDRIVE", label: "OneDrive for Business", itemsFound: 93, duration: 1900 },
    { provider: "M365", label: "Entra ID / User Profile", itemsFound: 12, duration: 800 },
  ],
  evidence: [
    { id: "ev-1", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "EMAIL", location: "Mailbox:maria.schmidt@acme.com/Inbox", title: "Re: Q4 Marketing Budget Approval", createdAt: "2026-01-15T14:22:00Z", sensitivityScore: 35, piiCategories: ["CONTACT", "CONTRACT"] },
    { id: "ev-2", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "EMAIL", location: "Mailbox:maria.schmidt@acme.com/Sent Items", title: "Vendor Contract — NDA Review", createdAt: "2026-01-20T10:05:00Z", sensitivityScore: 62, piiCategories: ["CONTACT", "CONTRACT", "PAYMENT"] },
    { id: "ev-3", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "CALENDAR", location: "Mailbox:maria.schmidt@acme.com/Calendar", title: "Performance Review Meeting", createdAt: "2026-02-01T09:00:00Z", sensitivityScore: 45, piiCategories: ["HR", "IDENTIFICATION"] },
    { id: "ev-4", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:Marketing Team Site/Shared Documents", title: "Campaign-Analysis-Q4-2025.xlsx", createdAt: "2025-12-18T16:30:00Z", sensitivityScore: 28, piiCategories: ["CONTRACT"] },
    { id: "ev-5", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:HR Portal/Employee Records", title: "Schmidt_Maria_Employment_Contract.pdf", createdAt: "2023-03-01T08:00:00Z", sensitivityScore: 85, piiCategories: ["IDENTIFICATION", "HR", "PAYMENT", "CONTACT"] },
    { id: "ev-6", provider: "ONEDRIVE", workload: "OneDrive", itemType: "FILE", location: "OneDrive:maria.schmidt/Documents/Personal", title: "Expense-Report-Jan2026.pdf", createdAt: "2026-02-02T11:45:00Z", sensitivityScore: 55, piiCategories: ["PAYMENT", "IDENTIFICATION"] },
    { id: "ev-7", provider: "ONEDRIVE", workload: "OneDrive", itemType: "FILE", location: "OneDrive:maria.schmidt/Documents/Projects", title: "Social-Media-Strategy-Draft.docx", createdAt: "2026-01-28T14:10:00Z", sensitivityScore: 15, piiCategories: ["CONTRACT"] },
    { id: "ev-8", provider: "M365", workload: "Entra ID", itemType: "RECORD", location: "Entra ID:User Profile", title: "User Profile — Maria Schmidt", createdAt: "2023-03-01T08:00:00Z", sensitivityScore: 72, piiCategories: ["IDENTIFICATION", "CONTACT", "HR"] },
  ],
  findings: [
    { id: "f-1", category: "CONTACT", categoryLabel: "Contact Data", severity: "INFO", confidence: 0.95, summary: "Email addresses (work + personal), phone numbers, and office address found across 312 emails and user profile.", evidenceCount: 314, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-2", category: "IDENTIFICATION", categoryLabel: "Identification Data", severity: "INFO", confidence: 0.98, summary: "Full name, employee ID, date of birth, and profile photo found in Entra ID and HR documents.", evidenceCount: 15, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-3", category: "HR", categoryLabel: "HR & Employment", severity: "WARNING", confidence: 0.92, summary: "Employment contract, salary data, performance reviews, and vacation records found in SharePoint HR portal.", evidenceCount: 8, containsSpecialCategory: false, requiresLegalReview: true },
    { id: "f-4", category: "PAYMENT", categoryLabel: "Payment & Financial", severity: "WARNING", confidence: 0.88, summary: "IBAN (DE** **** **** **** **89), expense reports, and reimbursement records detected.", evidenceCount: 12, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-5", category: "COMMUNICATION", categoryLabel: "Communication Data", severity: "INFO", confidence: 0.97, summary: "847 email messages (sent/received), 23 calendar entries, and 4 Teams chat threads.", evidenceCount: 874, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-6", category: "ONLINE_TECHNICAL", categoryLabel: "Online & Technical", severity: "INFO", confidence: 0.85, summary: "Login timestamps, IP addresses, device IDs, and browser user agents from audit logs.", evidenceCount: 42, containsSpecialCategory: false, requiresLegalReview: false },
  ],
  legalReview: {
    hasSpecialCategory: false,
    specialCategories: [],
    legalGateStatus: "ALLOWED",
    issues: [
      "Third-party email addresses present in correspondence — redaction required",
      "HR salary data included — confirm scope with data subject",
    ],
    exemptions: [],
    reviewerNote:
      "No Art. 9 special categories detected. Standard access response applicable. Third-party PII must be redacted before export.",
  },
  exports: [
    { filename: "DSAR-2026-0042_access_response.zip", type: "ZIP", size: "14.2 MB", status: "COMPLETED", legalGateStatus: "ALLOWED", redactedFields: 156 },
    { filename: "DSAR-2026-0042_evidence_index.xlsx", type: "XLSX", size: "842 KB", status: "COMPLETED", legalGateStatus: "ALLOWED", redactedFields: 0 },
    { filename: "DSAR-2026-0042_summary.pdf", type: "PDF", size: "128 KB", status: "COMPLETED", legalGateStatus: "ALLOWED", redactedFields: 0 },
  ],
  auditTimeline: [
    { timestamp: "2026-02-10T09:30:00Z", action: "CASE_CREATED", actor: "System (auto-intake)", details: "DSAR case DSAR-2026-0042 created from email request" },
    { timestamp: "2026-02-10T09:31:00Z", action: "CASE_ASSIGNED", actor: "System", details: "Auto-assigned to Anna Becker (DPO) based on routing rules" },
    { timestamp: "2026-02-10T10:15:00Z", action: "STATUS_CHANGE", actor: "Anna Becker", details: "Status: NEW -> IDENTITY_VERIFICATION" },
    { timestamp: "2026-02-10T10:45:00Z", action: "IDENTITY_VERIFIED", actor: "Anna Becker", details: "Identity verified via employee ID match + email confirmation" },
    { timestamp: "2026-02-10T10:46:00Z", action: "STATUS_CHANGE", actor: "Anna Becker", details: "Status: IDENTITY_VERIFICATION -> INTAKE_TRIAGE" },
    { timestamp: "2026-02-10T11:00:00Z", action: "STATUS_CHANGE", actor: "Anna Becker", details: "Status: INTAKE_TRIAGE -> DATA_COLLECTION" },
    { timestamp: "2026-02-10T11:01:00Z", action: "COPILOT_RUN_STARTED", actor: "Anna Becker", details: "Privacy Copilot run started — scanning M365 workloads" },
    { timestamp: "2026-02-10T11:04:00Z", action: "COPILOT_RUN_COMPLETED", actor: "System", details: "Discovery complete: 1,108 items found across 4 systems" },
    { timestamp: "2026-02-10T11:05:00Z", action: "FINDINGS_GENERATED", actor: "System", details: "6 data categories identified, 2 require review" },
    { timestamp: "2026-02-11T09:00:00Z", action: "LEGAL_REVIEW_STARTED", actor: "Dr. Thomas Weber", details: "Legal review initiated for HR and payment data" },
    { timestamp: "2026-02-11T14:30:00Z", action: "LEGAL_REVIEW_APPROVED", actor: "Dr. Thomas Weber", details: "Approved with redaction requirements for third-party PII" },
    { timestamp: "2026-02-11T15:00:00Z", action: "EXPORT_GENERATED", actor: "Anna Becker", details: "Export package generated: 3 files, 156 redacted fields" },
  ],
};

/* ─── Scenario 2: Erasure Request (Art. 17) ────────────────────────────────── */

const erasureScenario: DemoScenarioData = {
  id: "erasure",
  title: "Erasure Request",
  subtitle: "GDPR Art. 17 — Right to Erasure",
  description:
    "A former customer requests deletion of all personal data. See how PrivacyPilot locates data across systems, checks for legal retention obligations, and coordinates the deletion process.",
  highlights: [
    "Cross-system data location mapping",
    "Retention period conflict detection",
    "Deletion confirmation workflow",
    "Legal exemption handling (tax records)",
  ],
  caseInfo: {
    caseNumber: "DSAR-2026-0058",
    type: "ERASURE",
    typeLabel: "Erasure Request (Art. 17)",
    priority: "MEDIUM",
    status: "DATA_COLLECTION",
    receivedAt: "2026-02-12T14:00:00Z",
    dueDate: "2026-03-14T23:59:59Z",
    channel: "Web Portal",
    description:
      "Former customer requests complete deletion of all personal data. Account was closed on 2025-12-31. Subject specifically mentions emails, invoices, and support tickets.",
    dataSubject: {
      fullName: "Lukas Weber",
      email: "lukas.weber@mailbox.org",
      phone: "+49 151 9876543",
    },
    assignedTo: "Jan Mueller (Case Manager)",
  },
  discoverySystems: [
    { provider: "EXCHANGE_ONLINE", label: "Exchange Online", itemsFound: 234, duration: 2400 },
    { provider: "SHAREPOINT", label: "SharePoint Online", itemsFound: 47, duration: 2100 },
    { provider: "ONEDRIVE", label: "OneDrive for Business", itemsFound: 0, duration: 900 },
    { provider: "M365", label: "Entra ID / User Profile", itemsFound: 3, duration: 600 },
  ],
  evidence: [
    { id: "ev-e1", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "EMAIL", location: "Mailbox:support@acme.com/Customer Inquiries", title: "Re: Order #ORD-78291 Shipping Delay", createdAt: "2025-11-05T10:20:00Z", sensitivityScore: 30, piiCategories: ["CONTACT", "CONTRACT"] },
    { id: "ev-e2", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "EMAIL", location: "Mailbox:billing@acme.com/Invoices", title: "Invoice INV-2025-4471 — Annual Subscription", createdAt: "2025-06-15T08:00:00Z", sensitivityScore: 70, piiCategories: ["PAYMENT", "IDENTIFICATION", "CONTACT"] },
    { id: "ev-e3", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:Finance/Invoices/2025", title: "INV-2025-4471_Weber_Lukas.pdf", createdAt: "2025-06-15T08:01:00Z", sensitivityScore: 75, piiCategories: ["PAYMENT", "IDENTIFICATION"] },
    { id: "ev-e4", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:CRM Export/Customer Profiles", title: "Weber_Lukas_CustomerProfile.json", createdAt: "2025-01-10T12:00:00Z", sensitivityScore: 55, piiCategories: ["IDENTIFICATION", "CONTACT", "CONTRACT"] },
    { id: "ev-e5", provider: "M365", workload: "Entra ID", itemType: "RECORD", location: "Entra ID:Guest Users", title: "Guest Account — lukas.weber@mailbox.org", createdAt: "2024-09-01T09:00:00Z", sensitivityScore: 40, piiCategories: ["IDENTIFICATION", "CONTACT"] },
  ],
  findings: [
    { id: "f-e1", category: "CONTACT", categoryLabel: "Contact Data", severity: "INFO", confidence: 0.96, summary: "Email address, phone number, and mailing address found across 89 emails and CRM profile.", evidenceCount: 91, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-e2", category: "IDENTIFICATION", categoryLabel: "Identification Data", severity: "INFO", confidence: 0.94, summary: "Full name, customer ID (CUS-78291), and guest account in Entra ID.", evidenceCount: 5, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-e3", category: "PAYMENT", categoryLabel: "Payment & Financial", severity: "CRITICAL", confidence: 0.99, summary: "Invoices with IBAN (DE** **** **** **** **34), credit card last-4, and billing address. Tax retention period (10 years) may apply.", evidenceCount: 8, containsSpecialCategory: false, requiresLegalReview: true },
    { id: "f-e4", category: "CONTRACT", categoryLabel: "Contract & Account", severity: "WARNING", confidence: 0.91, summary: "Subscription agreement, order history, and support ticket references.", evidenceCount: 14, containsSpecialCategory: false, requiresLegalReview: true },
  ],
  legalReview: {
    hasSpecialCategory: false,
    specialCategories: [],
    legalGateStatus: "ALLOWED",
    issues: [
      "Invoices subject to 10-year tax retention (GoBD / AO) — cannot delete until 2035-12-31",
      "Support tickets may contain third-party data — manual review required",
    ],
    exemptions: [
      "Art. 17(3)(b): Compliance with legal obligation — invoices retained for tax purposes",
    ],
    reviewerNote:
      "Erasure approved for all data except financial/invoice records subject to statutory retention. Guest account in Entra ID can be deleted immediately. Email correspondence can be purged after confirming no pending legal matters.",
  },
  exports: [
    { filename: "DSAR-2026-0058_erasure_confirmation.pdf", type: "PDF", size: "64 KB", status: "COMPLETED", legalGateStatus: "ALLOWED", redactedFields: 0 },
    { filename: "DSAR-2026-0058_data_map.xlsx", type: "XLSX", size: "156 KB", status: "COMPLETED", legalGateStatus: "ALLOWED", redactedFields: 0 },
    { filename: "DSAR-2026-0058_retention_exceptions.pdf", type: "PDF", size: "42 KB", status: "COMPLETED", legalGateStatus: "ALLOWED", redactedFields: 0 },
  ],
  auditTimeline: [
    { timestamp: "2026-02-12T14:00:00Z", action: "CASE_CREATED", actor: "System (web portal)", details: "Erasure request received via self-service portal" },
    { timestamp: "2026-02-12T14:05:00Z", action: "CASE_ASSIGNED", actor: "System", details: "Assigned to Jan Mueller (Case Manager)" },
    { timestamp: "2026-02-12T14:30:00Z", action: "STATUS_CHANGE", actor: "Jan Mueller", details: "Status: NEW -> IDENTITY_VERIFICATION" },
    { timestamp: "2026-02-12T15:00:00Z", action: "IDENTITY_VERIFIED", actor: "Jan Mueller", details: "Verified via email challenge-response" },
    { timestamp: "2026-02-12T15:01:00Z", action: "STATUS_CHANGE", actor: "Jan Mueller", details: "Status: IDENTITY_VERIFICATION -> INTAKE_TRIAGE" },
    { timestamp: "2026-02-12T15:15:00Z", action: "STATUS_CHANGE", actor: "Jan Mueller", details: "Status: INTAKE_TRIAGE -> DATA_COLLECTION" },
    { timestamp: "2026-02-12T15:16:00Z", action: "COPILOT_RUN_STARTED", actor: "Jan Mueller", details: "Discovery scan initiated across 4 M365 workloads" },
    { timestamp: "2026-02-12T15:19:00Z", action: "COPILOT_RUN_COMPLETED", actor: "System", details: "284 items found — retention conflict detected on invoices" },
    { timestamp: "2026-02-12T15:20:00Z", action: "FINDINGS_GENERATED", actor: "System", details: "4 categories identified, PAYMENT flagged as CRITICAL (retention)" },
    { timestamp: "2026-02-13T10:00:00Z", action: "LEGAL_REVIEW_STARTED", actor: "Dr. Thomas Weber", details: "Reviewing retention obligations for financial records" },
    { timestamp: "2026-02-13T16:00:00Z", action: "LEGAL_REVIEW_APPROVED", actor: "Dr. Thomas Weber", details: "Partial erasure approved — invoices exempt under Art. 17(3)(b)" },
    { timestamp: "2026-02-14T09:00:00Z", action: "ERASURE_EXECUTED", actor: "Jan Mueller", details: "Deleted: 234 emails, guest account, CRM profile. Retained: 8 invoices" },
  ],
};

/* ─── Scenario 3: Objection Request (Art. 21) with Art. 9 ──────────────────── */

const objectionScenario: DemoScenarioData = {
  id: "objection",
  title: "Objection Request",
  subtitle: "GDPR Art. 21 — Right to Object (with Art. 9 data)",
  description:
    "An employee objects to profiling-based processing. This scenario demonstrates how Art. 9 special category data (health records) triggers the legal gate and blocks export until legal approval is granted.",
  highlights: [
    "Art. 9 special category detection (health data)",
    "Legal gate BLOCKS export automatically",
    "Two-person approval workflow",
    "Compliance-first approach demonstrated",
  ],
  caseInfo: {
    caseNumber: "DSAR-2026-0071",
    type: "OBJECTION",
    typeLabel: "Objection (Art. 21)",
    priority: "CRITICAL",
    status: "REVIEW_LEGAL",
    receivedAt: "2026-02-08T08:00:00Z",
    dueDate: "2026-03-10T23:59:59Z",
    channel: "Letter",
    description:
      "Employee objects to automated profiling used in performance management system. Also requests disclosure of all health-related data processed (sick leave records, occupational health assessments).",
    dataSubject: {
      fullName: "Fatima Al-Rashid",
      email: "fatima.alrashid@acme.com",
      phone: "+49 160 5551234",
      employeeId: "EMP-2917",
      department: "Engineering",
    },
    assignedTo: "Anna Becker (DPO)",
  },
  discoverySystems: [
    { provider: "EXCHANGE_ONLINE", label: "Exchange Online", itemsFound: 1203, duration: 4100 },
    { provider: "SHAREPOINT", label: "SharePoint Online", itemsFound: 289, duration: 3400 },
    { provider: "ONEDRIVE", label: "OneDrive for Business", itemsFound: 178, duration: 2200 },
    { provider: "M365", label: "Entra ID / User Profile", itemsFound: 18, duration: 900 },
  ],
  evidence: [
    { id: "ev-o1", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "EMAIL", location: "Mailbox:fatima.alrashid@acme.com/Inbox", title: "Re: Sprint Planning Q1 2026", createdAt: "2026-01-10T09:30:00Z", sensitivityScore: 20, piiCategories: ["CONTACT"] },
    { id: "ev-o2", provider: "EXCHANGE_ONLINE", workload: "Exchange", itemType: "EMAIL", location: "Mailbox:hr@acme.com/Sick Leave", title: "Sick Leave Notification — Al-Rashid, Fatima", createdAt: "2025-11-15T07:00:00Z", sensitivityScore: 92, piiCategories: ["HEALTH", "HR", "IDENTIFICATION"] },
    { id: "ev-o3", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:HR Portal/Occupational Health", title: "AlRashid_Fatima_OccHealth_Assessment_2025.pdf", createdAt: "2025-09-20T14:00:00Z", sensitivityScore: 98, piiCategories: ["HEALTH", "IDENTIFICATION"] },
    { id: "ev-o4", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:HR Portal/Performance Reviews", title: "AlRashid_Fatima_PerfReview_H2_2025.pdf", createdAt: "2025-12-15T10:00:00Z", sensitivityScore: 78, piiCategories: ["HR", "IDENTIFICATION"] },
    { id: "ev-o5", provider: "SHAREPOINT", workload: "SharePoint", itemType: "FILE", location: "SharePoint:HR Portal/Employment Contracts", title: "AlRashid_Fatima_Contract_Amendment_2025.pdf", createdAt: "2025-06-01T08:00:00Z", sensitivityScore: 82, piiCategories: ["HR", "PAYMENT", "IDENTIFICATION"] },
    { id: "ev-o6", provider: "ONEDRIVE", workload: "OneDrive", itemType: "FILE", location: "OneDrive:fatima.alrashid/Documents/HR", title: "Accommodation_Request_Standing_Desk.docx", createdAt: "2025-10-05T11:00:00Z", sensitivityScore: 88, piiCategories: ["HEALTH", "IDENTIFICATION"] },
    { id: "ev-o7", provider: "M365", workload: "Entra ID", itemType: "RECORD", location: "Entra ID:User Profile", title: "User Profile — Fatima Al-Rashid", createdAt: "2022-08-15T08:00:00Z", sensitivityScore: 65, piiCategories: ["IDENTIFICATION", "CONTACT", "HR"] },
    { id: "ev-o8", provider: "M365", workload: "Entra ID", itemType: "RECORD", location: "Entra ID:Group Memberships", title: "Group: Engineering-Accessibility-Program", createdAt: "2025-10-10T09:00:00Z", sensitivityScore: 45, piiCategories: ["HR"] },
  ],
  findings: [
    { id: "f-o1", category: "HEALTH", categoryLabel: "Health Data (Art. 9)", severity: "CRITICAL", confidence: 0.97, summary: "Sick leave records, occupational health assessment, and accommodation request referencing medical condition detected.", evidenceCount: 4, containsSpecialCategory: true, requiresLegalReview: true },
    { id: "f-o2", category: "HR", categoryLabel: "HR & Employment", severity: "WARNING", confidence: 0.95, summary: "Performance reviews with automated scoring, employment contract, salary data, and group memberships.", evidenceCount: 6, containsSpecialCategory: false, requiresLegalReview: true },
    { id: "f-o3", category: "IDENTIFICATION", categoryLabel: "Identification Data", severity: "INFO", confidence: 0.98, summary: "Full name, employee ID, date of birth, profile photo, and department assignment.", evidenceCount: 10, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-o4", category: "CONTACT", categoryLabel: "Contact Data", severity: "INFO", confidence: 0.96, summary: "Work email, personal phone, and office location across 1,203 emails.", evidenceCount: 1205, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-o5", category: "COMMUNICATION", categoryLabel: "Communication Data", severity: "INFO", confidence: 0.94, summary: "1,203 emails, 45 calendar events, and 12 Teams messages.", evidenceCount: 1260, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-o6", category: "ONLINE_TECHNICAL", categoryLabel: "Online & Technical", severity: "INFO", confidence: 0.82, summary: "Login logs, device IDs, VPN session records from IT audit logs.", evidenceCount: 67, containsSpecialCategory: false, requiresLegalReview: false },
    { id: "f-o7", category: "PAYMENT", categoryLabel: "Payment & Financial", severity: "WARNING", confidence: 0.90, summary: "Salary information, IBAN (DE** **** **** **** **56), and expense claims.", evidenceCount: 5, containsSpecialCategory: false, requiresLegalReview: true },
  ],
  legalReview: {
    hasSpecialCategory: true,
    specialCategories: ["HEALTH"],
    legalGateStatus: "BLOCKED",
    issues: [
      "Art. 9 special category data (HEALTH) detected — export BLOCKED pending legal approval",
      "Automated profiling in performance reviews requires Art. 22 assessment",
      "Occupational health records may be subject to separate legal basis (occupational safety law)",
      "Accommodation request contains sensitive health information — redaction required",
    ],
    exemptions: [],
    reviewerNote:
      "BLOCKED: Art. 9 health data detected. Export cannot proceed until DPO and legal counsel review. Automated profiling claims need separate Art. 22 analysis. Recommend two-person approval before any data is released.",
  },
  exports: [
    { filename: "DSAR-2026-0071_objection_response.zip", type: "ZIP", size: "—", status: "BLOCKED", legalGateStatus: "BLOCKED", redactedFields: 0 },
    { filename: "DSAR-2026-0071_art9_review_required.pdf", type: "PDF", size: "—", status: "BLOCKED", legalGateStatus: "BLOCKED", redactedFields: 0 },
  ],
  auditTimeline: [
    { timestamp: "2026-02-08T08:00:00Z", action: "CASE_CREATED", actor: "Anna Becker", details: "Objection request received via registered letter — manually entered" },
    { timestamp: "2026-02-08T08:15:00Z", action: "CASE_ASSIGNED", actor: "Anna Becker", details: "Self-assigned due to CRITICAL priority and Art. 9 suspicion" },
    { timestamp: "2026-02-08T09:00:00Z", action: "STATUS_CHANGE", actor: "Anna Becker", details: "Status: NEW -> IDENTITY_VERIFICATION" },
    { timestamp: "2026-02-08T10:30:00Z", action: "IDENTITY_VERIFIED", actor: "Anna Becker", details: "Verified via employee badge photo + HR system cross-check" },
    { timestamp: "2026-02-08T10:31:00Z", action: "STATUS_CHANGE", actor: "Anna Becker", details: "Status: IDENTITY_VERIFICATION -> INTAKE_TRIAGE" },
    { timestamp: "2026-02-08T11:00:00Z", action: "STATUS_CHANGE", actor: "Anna Becker", details: "Status: INTAKE_TRIAGE -> DATA_COLLECTION" },
    { timestamp: "2026-02-08T11:01:00Z", action: "COPILOT_RUN_STARTED", actor: "Anna Becker", details: "Full M365 scan with special category detection enabled" },
    { timestamp: "2026-02-08T11:06:00Z", action: "COPILOT_RUN_COMPLETED", actor: "System", details: "1,688 items found — HEALTH data detected (Art. 9)" },
    { timestamp: "2026-02-08T11:07:00Z", action: "ART9_ALERT", actor: "System", details: "Art. 9 special category (HEALTH) auto-detected — legal gate BLOCKED" },
    { timestamp: "2026-02-08T11:08:00Z", action: "STATUS_CHANGE", actor: "System", details: "Status: DATA_COLLECTION -> REVIEW_LEGAL (auto-escalated)" },
    { timestamp: "2026-02-09T09:00:00Z", action: "LEGAL_REVIEW_STARTED", actor: "Dr. Thomas Weber", details: "Legal review initiated — Art. 9 and Art. 22 assessment required" },
    { timestamp: "2026-02-09T09:01:00Z", action: "EXPORT_BLOCKED", actor: "System", details: "All export artifacts blocked until legal approval is granted" },
  ],
};

/* ─── Scenario map ─────────────────────────────────────────────────────────── */

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioData> = {
  access: accessScenario,
  erasure: erasureScenario,
  objection: objectionScenario,
};

export function isDemoScenarioId(val: string): val is DemoScenarioId {
  return val === "access" || val === "erasure" || val === "objection";
}
