/**
 * Synthetic data generators for DSAR demo evidence.
 * All data is fictional — no real PII is generated.
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
function uid(): string {
  _seq++;
  return `demo-${Date.now().toString(36)}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

// ── Synthetic Name / PII Pools (all fictional) ───────────────────────────────

const FIRST_NAMES = ["Max", "Anna", "Lukas", "Sophie", "Leon", "Laura", "Felix", "Marie", "Jonas", "Clara"];
const LAST_NAMES = ["Mueller", "Fischer", "Weber", "Schmidt", "Schneider", "Wagner", "Becker", "Koch", "Richter", "Klein"];
const DEPARTMENTS = ["Engineering", "Sales", "Marketing", "HR", "Finance", "Legal", "Support", "Product", "Operations", "Research"];
const CITIES = ["Berlin", "Munich", "Hamburg", "Frankfurt", "Cologne", "Stuttgart", "Dusseldorf", "Dresden", "Leipzig", "Nuremberg"];

function syntheticName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
}

function syntheticEmail(name: string): string {
  return `${name.toLowerCase().replace(/ /g, ".")}@example-corp.test`;
}

function maskedEmail(name: string): string {
  const parts = name.toLowerCase().split(" ");
  return `${parts[0][0]}***@example.test`;
}

function maskedIBAN(): string {
  return `DE** **** **** **** **${randInt(10, 99)}`;
}

function maskedPhone(): string {
  return `+49 ****${randInt(100, 999)}`;
}

function syntheticIP(): string {
  return `192.168.${randInt(1, 254)}.${randInt(1, 254)}`;
}

// ── Evidence Templates ───────────────────────────────────────────────────────

export interface EvidenceTemplate {
  provider: string;
  workload: string;
  itemType: "EMAIL" | "FILE" | "RECORD" | "CALENDAR" | "CONTACT" | "TICKET" | "OTHER";
  titleTemplate: string;
  locationTemplate: string;
  sensitivityRange: [number, number];
  metadataGen: (subjectEmail: string, subjectName: string) => Record<string, unknown>;
}

const EMAIL_SUBJECTS = [
  "RE: Account setup confirmation",
  "Your invoice #INV-{n}",
  "Weekly team update — {dept}",
  "Contract renewal notice",
  "Meeting notes: Q{q} review",
  "Welcome aboard — onboarding checklist",
  "Support ticket #{n} resolved",
  "Your subscription confirmation",
  "RE: Data export request",
  "Reminder: compliance training due",
  "Performance review feedback",
  "Travel expense report — {month}",
  "System access request approved",
  "Newsletter: product updates {month}",
  "RE: Customer feedback follow-up",
  "Annual leave request confirmation",
  "Payslip notification — {month}",
  "Security alert: new login from {city}",
  "RE: Partner onboarding documents",
  "Project handover notes",
];

const SP_FILES = [
  { name: "Employee_Handbook_v3.2.pdf", path: "/HR/Policies" },
  { name: "Customer_Contract_{n}.docx", path: "/Legal/Contracts" },
  { name: "Q{q}_Revenue_Report.xlsx", path: "/Finance/Reports" },
  { name: "Onboarding_Checklist.docx", path: "/HR/Onboarding" },
  { name: "Invoice_INV-{n}.pdf", path: "/Finance/Invoices" },
  { name: "Meeting_Minutes_{month}.docx", path: "/Projects/Minutes" },
  { name: "Performance_Review_{year}.pdf", path: "/HR/Reviews" },
  { name: "Data_Processing_Agreement.pdf", path: "/Legal/DPA" },
  { name: "Support_Escalation_Log.xlsx", path: "/Support/Logs" },
  { name: "Marketing_Campaign_Results.xlsx", path: "/Marketing/Analytics" },
];

const OD_FILES = [
  { name: "Personal_Notes_{month}.docx", ext: "docx" },
  { name: "Todo_List.txt", ext: "txt" },
  { name: "Travel_Receipts_{month}.pdf", ext: "pdf" },
  { name: "Profile_Photo.jpg", ext: "jpg" },
  { name: "CV_Updated_{year}.docx", ext: "docx" },
  { name: "Tax_Documents_{year}.pdf", ext: "pdf" },
  { name: "Benefits_Summary.pdf", ext: "pdf" },
  { name: "Project_Proposal_Draft.docx", ext: "docx" },
];

function fillTemplate(t: string): string {
  return t
    .replace("{n}", String(randInt(1000, 9999)))
    .replace("{q}", String(randInt(1, 4)))
    .replace("{dept}", pick(DEPARTMENTS))
    .replace("{month}", pick(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]))
    .replace("{year}", String(2025))
    .replace("{city}", pick(CITIES));
}

// ── Evidence Generators Per Provider ─────────────────────────────────────────

export function generateExchangeEvidence(
  subjectEmail: string,
  subjectName: string,
  count: number,
): EvidenceTemplate[] {
  const items: EvidenceTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const subject = fillTemplate(pick(EMAIL_SUBJECTS));
    items.push({
      provider: "EXCHANGE_ONLINE",
      workload: "EXCHANGE",
      itemType: "EMAIL",
      titleTemplate: subject,
      locationTemplate: `Mailbox:${subjectEmail}/${pick(["Inbox", "Sent Items", "Drafts", "Archive"])}`,
      sensitivityRange: [20, 60],
      metadataGen: () => ({
        messageSubject: subject,
        sender: pick([subjectEmail, syntheticEmail(syntheticName())]),
        recipients: [subjectEmail, syntheticEmail(syntheticName())],
        hasAttachments: Math.random() > 0.7,
        folderPath: pick(["Inbox", "Sent Items", "Archive"]),
        messageCount: 1,
      }),
    });
  }
  return items;
}

export function generateSharePointEvidence(
  subjectEmail: string,
  subjectName: string,
  count: number,
): EvidenceTemplate[] {
  const items: EvidenceTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const file = pick(SP_FILES);
    const filename = fillTemplate(file.name);
    items.push({
      provider: "SHAREPOINT",
      workload: "SHAREPOINT_ONLINE",
      itemType: "FILE",
      titleTemplate: filename,
      locationTemplate: `SharePoint:${file.path}/${filename}`,
      sensitivityRange: [25, 70],
      metadataGen: () => ({
        filename,
        siteName: pick(["Finance Site", "HR Site", "Legal Site", "General"]),
        libraryPath: file.path,
        fileSize: randInt(10240, 5242880),
        contentType: filename.endsWith(".pdf") ? "application/pdf" : filename.endsWith(".xlsx") ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        lastModifiedBy: pick([subjectEmail, syntheticEmail(syntheticName())]),
      }),
    });
  }
  return items;
}

export function generateOneDriveEvidence(
  subjectEmail: string,
  subjectName: string,
  count: number,
): EvidenceTemplate[] {
  const items: EvidenceTemplate[] = [];
  for (let i = 0; i < count; i++) {
    const file = pick(OD_FILES);
    const filename = fillTemplate(file.name);
    items.push({
      provider: "ONEDRIVE",
      workload: "ONEDRIVE_BUSINESS",
      itemType: "FILE",
      titleTemplate: filename,
      locationTemplate: `OneDrive:${subjectEmail}/Documents/${filename}`,
      sensitivityRange: [15, 55],
      metadataGen: () => ({
        filename,
        drivePath: `/Documents/${filename}`,
        fileSize: randInt(1024, 2097152),
        owner: subjectEmail,
      }),
    });
  }
  return items;
}

export function generateM365Evidence(
  subjectEmail: string,
  subjectName: string,
): EvidenceTemplate {
  return {
    provider: "M365",
    workload: "ENTRA_ID",
    itemType: "RECORD",
    titleTemplate: `Entra ID user profile — ${subjectName}`,
    locationTemplate: `EntraID:UserProfile:${subjectEmail}`,
    sensitivityRange: [30, 45],
    metadataGen: () => ({
      userPrincipalName: subjectEmail,
      department: pick(DEPARTMENTS),
      jobTitle: pick(["Manager", "Engineer", "Analyst", "Coordinator", "Specialist", "Director"]),
      displayName: subjectName,
      mail: subjectEmail,
      city: pick(CITIES),
    }),
  };
}

// ── Detector Result Templates ────────────────────────────────────────────────

export interface DetectorTemplate {
  detectorType: "REGEX" | "PDF_METADATA" | "OCR" | "LLM_CLASSIFIER";
  detectedElements: Array<{
    elementType: string;
    confidence: number;
    snippetPreview: string;
  }>;
  detectedCategories: Array<{
    category: string;
    confidence: number;
  }>;
  containsSpecialCategorySuspected: boolean;
}

const PII_DETECTORS = {
  EMAIL: { elementType: "EMAIL_ADDRESS", snippet: () => maskedEmail(syntheticName()), category: "CONTACT" },
  PHONE: { elementType: "PHONE_EU_INTERNATIONAL", snippet: maskedPhone, category: "CONTACT" },
  IBAN: { elementType: "IBAN_DE", snippet: maskedIBAN, category: "PAYMENT" },
  ADDRESS: { elementType: "POSTAL_ADDRESS", snippet: () => `${pick(CITIES)}, *****`, category: "CONTACT" },
  CUSTOMER_ID: { elementType: "CUSTOMER_ID", snippet: () => `CUST-****${randInt(10, 99)}`, category: "IDENTIFICATION" },
  CONTRACT_ID: { elementType: "CONTRACT_ID", snippet: () => `CTR-${randInt(2020, 2026)}-****`, category: "CONTRACT" },
  IP_ADDRESS: { elementType: "IP_ADDRESS", snippet: syntheticIP, category: "ONLINE_TECHNICAL" },
  USER_AGENT: { elementType: "USER_AGENT_STRING", snippet: () => "Mozilla/5.0 (***)", category: "ONLINE_TECHNICAL" },
};

const SPECIAL_CAT_DETECTORS = {
  MEDICAL: { elementType: "MEDICAL_KEYWORD", snippet: () => "medical_note_ref: MN-****", category: "HEALTH" },
  SICK_LEAVE: { elementType: "SICK_LEAVE_REFERENCE", snippet: () => "sick_leave_period: ****-****", category: "HEALTH" },
  UNION: { elementType: "UNION_MEMBERSHIP", snippet: () => "union_member: [REDACTED]", category: "UNION" },
};

export function generateDetectors(
  evidenceType: string,
  includeSpecialCategory: boolean,
): DetectorTemplate {
  const elements: DetectorTemplate["detectedElements"] = [];
  const categories = new Set<string>();

  // Always include email
  elements.push({ elementType: PII_DETECTORS.EMAIL.elementType, confidence: 0.85 + Math.random() * 0.1, snippetPreview: PII_DETECTORS.EMAIL.snippet() });
  categories.add("CONTACT");

  // Type-specific detectors
  if (evidenceType === "EMAIL") {
    elements.push({ elementType: PII_DETECTORS.PHONE.elementType, confidence: 0.7 + Math.random() * 0.15, snippetPreview: PII_DETECTORS.PHONE.snippet() });
    if (Math.random() > 0.5) {
      elements.push({ elementType: PII_DETECTORS.IP_ADDRESS.elementType, confidence: 0.6, snippetPreview: PII_DETECTORS.IP_ADDRESS.snippet() });
      categories.add("ONLINE_TECHNICAL");
    }
    categories.add("COMMUNICATION");
  } else if (evidenceType === "FILE") {
    if (Math.random() > 0.4) {
      elements.push({ elementType: PII_DETECTORS.IBAN.elementType, confidence: 0.8, snippetPreview: PII_DETECTORS.IBAN.snippet() });
      categories.add("PAYMENT");
    }
    if (Math.random() > 0.5) {
      elements.push({ elementType: PII_DETECTORS.CONTRACT_ID.elementType, confidence: 0.75, snippetPreview: PII_DETECTORS.CONTRACT_ID.snippet() });
      categories.add("CONTRACT");
    }
    categories.add("IDENTIFICATION");
  } else {
    elements.push({ elementType: PII_DETECTORS.CUSTOMER_ID.elementType, confidence: 0.9, snippetPreview: PII_DETECTORS.CUSTOMER_ID.snippet() });
    categories.add("IDENTIFICATION");
  }

  let specialCat = false;
  if (includeSpecialCategory && Math.random() > 0.6) {
    const detector = pick([SPECIAL_CAT_DETECTORS.MEDICAL, SPECIAL_CAT_DETECTORS.SICK_LEAVE]);
    elements.push({ elementType: detector.elementType, confidence: 0.65, snippetPreview: detector.snippet() });
    categories.add(detector.category);
    specialCat = true;
  }

  return {
    detectorType: pick(["REGEX", "PDF_METADATA", "REGEX", "REGEX"]) as DetectorTemplate["detectorType"],
    detectedElements: elements.map((e) => ({ ...e, offsets: { start: randInt(0, 500), end: randInt(501, 1000) } })) as DetectorTemplate["detectedElements"],
    detectedCategories: Array.from(categories).map((c) => ({ category: c, confidence: 0.7 + Math.random() * 0.2 })),
    containsSpecialCategorySuspected: specialCat,
  };
}

// ── Finding Templates ────────────────────────────────────────────────────────

export type DataCategoryKey =
  | "IDENTIFICATION" | "CONTACT" | "CONTRACT" | "PAYMENT"
  | "COMMUNICATION" | "HR" | "CREDITWORTHINESS" | "ONLINE_TECHNICAL"
  | "HEALTH" | "RELIGION" | "UNION" | "POLITICAL_OPINION"
  | "OTHER_SPECIAL_CATEGORY" | "OTHER";

export type SeverityKey = "INFO" | "WARNING" | "CRITICAL";

export interface FindingTemplate {
  dataCategory: DataCategoryKey;
  severity: SeverityKey;
  confidence: number;
  summary: string;
  containsSpecialCategory: boolean;
  containsThirdPartyDataSuspected: boolean;
  requiresLegalReview: boolean;
}

const FINDING_SUMMARIES: Record<string, string[]> = {
  IDENTIFICATION: [
    "User profile containing display name, email address, and department affiliation.",
    "Account registration data with name, email, and creation timestamp.",
    "Identity record with display name and unique identifier found in directory service.",
  ],
  CONTACT: [
    "Contact information including email, phone number, and mailing address.",
    "Address and phone data found in CRM contact record.",
    "Multiple contact entries with email and phone across connected systems.",
  ],
  CONTRACT: [
    "Active service agreement referencing the data subject's name and account details.",
    "Contract documents with subject's signature and billing terms.",
    "Subscription agreement with renewal dates and payment terms.",
  ],
  PAYMENT: [
    "Bank account details (IBAN) found in payment processing records.",
    "Invoice records with payment references linked to the data subject.",
    "Financial transaction history including payment method details.",
  ],
  COMMUNICATION: [
    "Email correspondence containing personal identifiers and discussion content.",
    "Internal and external email threads referencing the data subject.",
    "Support ticket communications with personal contact details.",
  ],
  HR: [
    "Employment records including compensation details and performance reviews.",
    "Payroll data with salary information and tax references.",
    "Leave management records with absence history.",
  ],
  ONLINE_TECHNICAL: [
    "Login activity logs with IP addresses and user agent strings.",
    "Authentication records with session timestamps and device fingerprints.",
    "Application usage metrics linked to user account.",
  ],
  HEALTH: [
    "Medical certificate reference found in HR file attachment.",
    "Sick leave documentation containing health-related keywords.",
  ],
};

export function generateFindings(
  caseType: string,
  includeSpecialCategory: boolean,
  intensity: "small" | "medium" | "large",
): FindingTemplate[] {
  const counts = { small: [5, 7], medium: [7, 10], large: [10, 14] };
  const [min, max] = counts[intensity];
  const count = randInt(min, max);

  // Base categories by case type
  const categorySets: Record<string, DataCategoryKey[]> = {
    ACCESS: ["IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT", "COMMUNICATION", "HR", "ONLINE_TECHNICAL"],
    ERASURE: ["IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT", "COMMUNICATION"],
    RECTIFICATION: ["IDENTIFICATION", "CONTACT"],
    PORTABILITY: ["IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT"],
    OBJECTION: ["COMMUNICATION", "CONTACT", "ONLINE_TECHNICAL"],
    RESTRICTION: ["IDENTIFICATION", "CONTACT", "CONTRACT"],
  };

  const baseCategories = categorySets[caseType] ?? categorySets.ACCESS;
  const findings: FindingTemplate[] = [];

  // Always include core findings
  for (const cat of baseCategories.slice(0, Math.min(count, baseCategories.length))) {
    const summaries = FINDING_SUMMARIES[cat] ?? FINDING_SUMMARIES.IDENTIFICATION;
    const isHR = cat === "HR";
    const isPayment = cat === "PAYMENT";
    findings.push({
      dataCategory: cat,
      severity: isHR ? "CRITICAL" : isPayment ? "WARNING" : "INFO",
      confidence: 0.7 + Math.random() * 0.25,
      summary: pick(summaries),
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: cat === "COMMUNICATION" && Math.random() > 0.5,
      requiresLegalReview: isHR,
    });
  }

  // Fill remaining with varied categories
  while (findings.length < count) {
    const cat = pick(baseCategories);
    const summaries = FINDING_SUMMARIES[cat] ?? [`Data records in category ${cat} found across connected systems.`];
    findings.push({
      dataCategory: cat,
      severity: pick(["INFO", "INFO", "WARNING"]),
      confidence: 0.6 + Math.random() * 0.3,
      summary: pick(summaries),
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: Math.random() > 0.7,
      requiresLegalReview: false,
    });
  }

  // Special case-type findings
  if (caseType === "ERASURE") {
    findings.push({
      dataCategory: "CONTRACT",
      severity: "WARNING",
      confidence: 0.85,
      summary: "Retention conflict: Invoice records subject to 7-year tax retention obligation cannot be immediately erased (Art. 17(3)(b) — legal obligation).",
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: false,
      requiresLegalReview: true,
    });
  }

  if (caseType === "OBJECTION") {
    findings.push({
      dataCategory: "COMMUNICATION",
      severity: "INFO",
      confidence: 0.9,
      summary: "Subject found on 3 marketing mailing lists. Suppression list entry should be created upon objection approval.",
      containsSpecialCategory: false,
      containsThirdPartyDataSuspected: false,
      requiresLegalReview: false,
    });
  }

  // Art. 9 injection
  if (includeSpecialCategory) {
    findings.push({
      dataCategory: "HEALTH",
      severity: "CRITICAL",
      confidence: 0.7,
      summary: "Suspected special category data (Art. 9): Medical certificate / sick leave reference detected in HR file attachment. Legal review required before further processing.",
      containsSpecialCategory: true,
      containsThirdPartyDataSuspected: false,
      requiresLegalReview: true,
    });
  }

  return findings;
}

// ── Summary Generator ────────────────────────────────────────────────────────

export function generateLocationSummary(
  subjectName: string,
  evidenceCount: number,
  findingCount: number,
  providers: string[],
  specialCat: boolean,
): string {
  const providerLines = providers.map((p) => {
    switch (p) {
      case "M365": return "- **M365 (Entra ID)**: User profile with display name, email, department";
      case "EXCHANGE_ONLINE": return "- **Exchange Online**: Email correspondence containing personal identifiers";
      case "SHAREPOINT": return "- **SharePoint**: Documents referencing the data subject";
      case "ONEDRIVE": return "- **OneDrive**: Personal files in user drive";
      default: return `- **${p}**: Records found`;
    }
  });

  return [
    `## Data Location Overview for ${subjectName}`,
    "",
    `**Evidence items**: ${evidenceCount} | **Findings**: ${findingCount}`,
    `**Sources**: ${providers.join(", ")}`,
    "",
    "### Discovered Data Locations",
    ...providerLines,
    "",
    "### Special Category (Art. 9)",
    specialCat
      ? "**WARNING**: Suspected special category data detected. Legal review required before export."
      : "No special category data detected.",
    "",
    "### Disclaimer",
    "*Based on collected evidence from: " + providers.join(", ") + ".*",
    "*No evidence does not guarantee absence of data. This summary was generated from evidence metadata only.*",
  ].join("\n");
}

export function generateCategorySummary(
  subjectName: string,
  findings: FindingTemplate[],
): string {
  const catCounts: Record<string, number> = {};
  for (const f of findings) {
    catCounts[f.dataCategory] = (catCounts[f.dataCategory] ?? 0) + 1;
  }

  const catLines = Object.entries(catCounts).map(
    ([cat, count]) => `- **${cat.replace(/_/g, " ")}**: ${count} finding(s)`,
  );

  const specialFindings = findings.filter((f) => f.containsSpecialCategory);
  const legalFindings = findings.filter((f) => f.requiresLegalReview);

  return [
    `## Category Overview for ${subjectName}`,
    "",
    `**Total findings**: ${findings.length}`,
    "",
    "### Data Categories",
    ...catLines,
    "",
    specialFindings.length > 0
      ? `### Art. 9 Alerts\n${specialFindings.length} finding(s) flagged as potential special category data.`
      : "### Art. 9 Alerts\nNone detected.",
    "",
    legalFindings.length > 0
      ? `### Legal Review Required\n${legalFindings.length} finding(s) require legal review before further processing.`
      : "### Legal Review Required\nNo findings require additional legal review.",
    "",
    "*Based on collected evidence from: M365, Exchange Online, SharePoint, OneDrive.*",
    "*No evidence does not guarantee absence of data.*",
  ].join("\n");
}

// ── Data Collection Generators ───────────────────────────────────────────────

export interface DataCollectionTemplate {
  systemLabel: string;
  provider: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  findingsSummary: string | null;
  recordsFound: number;
  resultMetadata: Record<string, unknown> | null;
}

export function generateDataCollections(
  caseType: string,
  caseStatus: string,
  subjectEmail: string,
): DataCollectionTemplate[] {
  const isCompleted = ["REVIEW_LEGAL", "RESPONSE_PREPARATION", "RESPONSE_SENT", "CLOSED"].includes(caseStatus);
  const isInProgress = caseStatus === "DATA_COLLECTION";

  const collections: DataCollectionTemplate[] = [
    {
      systemLabel: "Exchange Online — Mailbox Search",
      provider: "EXCHANGE_ONLINE",
      status: isCompleted ? "COMPLETED" : isInProgress ? pick(["IN_PROGRESS", "COMPLETED"]) : "PENDING",
      findingsSummary: "Email messages containing personal identifiers discovered",
      recordsFound: randInt(5, 25),
      resultMetadata: {
        provider: "EXCHANGE_ONLINE",
        workload: "mailbox_search",
        counts: { matched: randInt(5, 25), exported: randInt(3, 15) },
        runInfo: { status: "success", durationMs: randInt(800, 5000) },
      },
    },
    {
      systemLabel: "SharePoint — Site Search",
      provider: "SHAREPOINT",
      status: isCompleted ? "COMPLETED" : isInProgress ? pick(["PENDING", "IN_PROGRESS", "COMPLETED"]) : "PENDING",
      findingsSummary: "Documents referencing data subject found on team sites",
      recordsFound: randInt(2, 12),
      resultMetadata: {
        provider: "SHAREPOINT",
        workload: "site_search",
        counts: { matched: randInt(2, 12), exported: randInt(1, 8) },
        runInfo: { status: "success", durationMs: randInt(1500, 6000) },
      },
    },
    {
      systemLabel: "OneDrive — User Drive",
      provider: "ONEDRIVE",
      status: isCompleted ? "COMPLETED" : isInProgress ? pick(["PENDING", "COMPLETED"]) : "PENDING",
      findingsSummary: "Personal files found in user's cloud drive",
      recordsFound: randInt(1, 10),
      resultMetadata: {
        provider: "ONEDRIVE",
        workload: "user_drive",
        counts: { matched: randInt(1, 10), exported: randInt(1, 6) },
        runInfo: { status: "success", durationMs: randInt(600, 3000) },
      },
    },
  ];

  // Portability cases get a "structured export" collection
  if (caseType === "PORTABILITY") {
    collections.push({
      systemLabel: "CRM — Structured Data Export",
      provider: "CRM",
      status: isCompleted ? "COMPLETED" : "IN_PROGRESS",
      findingsSummary: "Structured customer records exported in machine-readable format",
      recordsFound: randInt(10, 50),
      resultMetadata: null,
    });
  }

  // Only set metadata for completed items
  for (const c of collections) {
    if (c.status !== "COMPLETED") {
      c.findingsSummary = null;
      c.recordsFound = 0;
      c.resultMetadata = null;
    }
  }

  return collections;
}

// ── Task Generators ──────────────────────────────────────────────────────────

export interface TaskTemplate {
  title: string;
  description: string;
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "BLOCKED";
  dueDaysFromNow: number;
}

export function generateTasks(
  caseType: string,
  caseStatus: string,
  specialCategory: boolean,
): TaskTemplate[] {
  const tasks: TaskTemplate[] = [];

  // Standard data collection task
  if (["DATA_COLLECTION", "REVIEW_LEGAL", "RESPONSE_PREPARATION", "RESPONSE_SENT", "CLOSED"].includes(caseStatus)) {
    tasks.push({
      title: "Collect personal data from connected systems",
      description: "Execute automated discovery across M365, Exchange, SharePoint, and OneDrive to locate all personal data.",
      status: caseStatus === "DATA_COLLECTION" ? "IN_PROGRESS" : "DONE",
      dueDaysFromNow: caseStatus === "DATA_COLLECTION" ? 5 : -3,
    });
  }

  // Legal review task
  if (specialCategory) {
    tasks.push({
      title: "Legal review required — Special category data (Art. 9) suspected",
      description: "Medical / health-related keywords detected in evidence. DPO must review before data can be exported or further processed.",
      status: caseStatus === "REVIEW_LEGAL" ? "IN_PROGRESS" : "OPEN",
      dueDaysFromNow: 3,
    });
  }

  // Case-type-specific tasks
  switch (caseType) {
    case "ERASURE":
      tasks.push({
        title: "Verify retention obligations before erasure",
        description: "Check all discovered data against legal retention requirements. Financial records may require 7-year retention under tax regulations.",
        status: caseStatus === "REVIEW_LEGAL" ? "IN_PROGRESS" : "OPEN",
        dueDaysFromNow: 4,
      });
      break;
    case "RECTIFICATION":
      tasks.push({
        title: "Verify corrected data across all systems",
        description: "After rectification, verify that updated data is consistent across all connected systems.",
        status: "OPEN",
        dueDaysFromNow: 7,
      });
      break;
    case "PORTABILITY":
      tasks.push({
        title: "Prepare machine-readable data export",
        description: "Generate structured data export in JSON/CSV format for data portability response.",
        status: caseStatus === "RESPONSE_SENT" ? "DONE" : "OPEN",
        dueDaysFromNow: 5,
      });
      break;
    case "OBJECTION":
      tasks.push({
        title: "Add to suppression list",
        description: "If objection is valid, add data subject to marketing suppression list across all channels.",
        status: "OPEN",
        dueDaysFromNow: 3,
      });
      break;
  }

  // Review evidence task
  tasks.push({
    title: "Review Copilot discovery results",
    description: "Review the automated discovery findings and verify completeness before proceeding.",
    status: ["DATA_COLLECTION", "NEW", "INTAKE_TRIAGE"].includes(caseStatus) ? "OPEN" : "DONE",
    dueDaysFromNow: 5,
  });

  return tasks;
}

// ── Evidence Count By Case Type + Intensity ──────────────────────────────────

export interface EvidenceCounts {
  exchange: number;
  sharepoint: number;
  onedrive: number;
}

export function getEvidenceCounts(caseType: string, intensity: "small" | "medium" | "large"): EvidenceCounts {
  const base: Record<string, EvidenceCounts> = {
    ACCESS: { exchange: 10, sharepoint: 6, onedrive: 4 },
    ERASURE: { exchange: 8, sharepoint: 5, onedrive: 3 },
    RECTIFICATION: { exchange: 3, sharepoint: 2, onedrive: 1 },
    PORTABILITY: { exchange: 5, sharepoint: 4, onedrive: 3 },
    OBJECTION: { exchange: 6, sharepoint: 2, onedrive: 2 },
    RESTRICTION: { exchange: 5, sharepoint: 3, onedrive: 2 },
  };

  const multiplier = { small: 0.5, medium: 1, large: 2 };
  const counts = base[caseType] ?? base.ACCESS;
  const m = multiplier[intensity];

  return {
    exchange: Math.max(2, Math.round(counts.exchange * m)),
    sharepoint: Math.max(1, Math.round(counts.sharepoint * m)),
    onedrive: Math.max(1, Math.round(counts.onedrive * m)),
  };
}
