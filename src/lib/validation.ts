import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export const createCaseSchema = z.object({
  type: z.enum(["ACCESS", "ERASURE", "RECTIFICATION", "RESTRICTION", "PORTABILITY", "OBJECTION"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional().default("MEDIUM"),
  channel: z.string().optional(),
  requesterType: z.string().optional(),
  description: z.string().optional(),
  lawfulBasis: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
  dataSubject: z.object({
    id: z.string().uuid().optional(),
    fullName: z.string().min(1, "Subject name is required"),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
});

export const updateCaseSchema = z.object({
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  assignedToUserId: z.string().uuid().nullable().optional(),
  description: z.string().optional(),
  lawfulBasis: z.string().optional(),
});

export const transitionSchema = z.object({
  toStatus: z.enum([
    "NEW", "IDENTITY_VERIFICATION", "INTAKE_TRIAGE", "DATA_COLLECTION",
    "REVIEW_LEGAL", "RESPONSE_PREPARATION", "RESPONSE_SENT", "CLOSED", "REJECTED",
  ]),
  reason: z.string().min(1, "Reason is required for status transitions"),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  assigneeUserId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
  systemId: z.string().uuid().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["OPEN", "IN_PROGRESS", "BLOCKED", "DONE"]).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export const createCommentSchema = z.object({
  body: z.string().min(1, "Comment body is required"),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"]),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(["TENANT_ADMIN", "DPO", "CASE_MANAGER", "CONTRIBUTOR", "READ_ONLY"]).optional(),
});

export const createSystemSchema = z.object({
  name: z.string().min(1, "System name is required"),
  description: z.string().optional(),
  owner: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

export const updateSystemSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
});

// ─── Data Inventory Schemas ─────────────────────────────────────────────────

const CRITICALITY_VALUES = ["LOW", "MEDIUM", "HIGH"] as const;
const SYSTEM_STATUS_VALUES = ["ACTIVE", "RETIRED"] as const;
const AUTOMATION_READINESS_VALUES = ["MANUAL", "SEMI_AUTOMATED", "API_AVAILABLE"] as const;
const CONNECTOR_TYPE_VALUES = ["NONE", "MOCK", "M365", "GOOGLE", "SALESFORCE", "CUSTOM"] as const;
const LAWFUL_BASIS_VALUES = ["CONSENT", "CONTRACT", "LEGAL_OBLIGATION", "VITAL_INTERESTS", "PUBLIC_INTEREST", "LEGITIMATE_INTERESTS"] as const;
const PROCESSOR_ROLE_VALUES = ["PROCESSOR", "SUBPROCESSOR"] as const;
const DATA_CATEGORY_VALUES = ["IDENTIFICATION", "CONTACT", "CONTRACT", "PAYMENT", "COMMUNICATION", "HR", "CREDITWORTHINESS", "ONLINE_TECHNICAL", "HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY", "OTHER"] as const;
const DSAR_TYPE_VALUES = ["ACCESS", "ERASURE", "RECTIFICATION", "RESTRICTION", "PORTABILITY", "OBJECTION"] as const;
const DC_STATUS_VALUES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"] as const;

export const createInventorySystemSchema = z.object({
  name: z.string().min(1, "System name is required"),
  description: z.string().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
  tags: z.array(z.string()).optional(),
  criticality: z.enum(CRITICALITY_VALUES).optional(),
  systemStatus: z.enum(SYSTEM_STATUS_VALUES).optional(),
  containsSpecialCategories: z.boolean().optional(),
  inScopeForDsar: z.boolean().optional(),
  notes: z.string().optional(),
  automationReadiness: z.enum(AUTOMATION_READINESS_VALUES).optional(),
  connectorType: z.enum(CONNECTOR_TYPE_VALUES).optional(),
  exportFormats: z.array(z.string()).optional(),
  estimatedCollectionTimeMinutes: z.number().int().min(0).nullable().optional(),
  dataResidencyPrimary: z.string().optional(),
  processingRegions: z.array(z.string()).optional(),
  thirdCountryTransfers: z.boolean().optional(),
  thirdCountryTransferDetails: z.string().optional(),
  identifierTypes: z.array(z.string()).optional(),
});

export const updateInventorySystemSchema = createInventorySystemSchema.partial();

export const createSystemDataCategorySchema = z.object({
  category: z.enum(DATA_CATEGORY_VALUES),
  customCategoryName: z.string().optional(),
  processingPurpose: z.string().optional(),
  lawfulBasis: z.enum(LAWFUL_BASIS_VALUES).optional(),
  retentionPeriod: z.string().optional(),
  retentionDays: z.number().int().min(0).nullable().optional(),
  dsarRelevanceAccess: z.boolean().optional(),
  dsarRelevanceErasure: z.boolean().optional(),
  dsarRelevanceRectification: z.boolean().optional(),
  dsarRelevancePortability: z.boolean().optional(),
  dsarRelevanceRestriction: z.boolean().optional(),
  dsarRelevanceObjection: z.boolean().optional(),
  notes: z.string().optional(),
});

export const createSystemProcessorSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  role: z.enum(PROCESSOR_ROLE_VALUES).optional(),
  contractReference: z.string().optional(),
  dpaOnFile: z.boolean().optional(),
  contactEmail: z.string().email().optional().or(z.literal("")),
});

export const createDiscoveryRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  dsarTypes: z.array(z.enum(DSAR_TYPE_VALUES)).min(1, "At least one DSAR type required"),
  dataSubjectTypes: z.array(z.string()).optional(),
  identifierTypes: z.array(z.string()).optional(),
  conditions: z.record(z.unknown()).nullable().optional(),
  systemId: z.string().uuid("Valid system ID is required"),
  weight: z.number().int().min(1).max(100).optional().default(50),
  active: z.boolean().optional(),
});

export const updateDiscoveryRuleSchema = createDiscoveryRuleSchema.partial();

export const runDiscoverySchema = z.object({
  dsarType: z.enum(DSAR_TYPE_VALUES),
  dataSubjectType: z.string().optional(),
  identifierTypes: z.array(z.string()).optional().default([]),
});

export const createCaseSystemLinkSchema = z.object({
  systemId: z.string().uuid("Valid system ID is required"),
  collectionStatus: z.enum(DC_STATUS_VALUES).optional(),
  suggestedByDiscovery: z.boolean().optional(),
  discoveryScore: z.number().min(0).max(100).optional(),
  discoveryReason: z.string().optional(),
  notes: z.string().optional(),
});

export const updateCaseSystemLinkSchema = z.object({
  collectionStatus: z.enum(DC_STATUS_VALUES).optional(),
  notes: z.string().optional(),
});

// ─── Deadline & Risk Schemas ──────────────────────────────────────────────────

export const extensionRequestSchema = z.object({
  extensionDays: z.number().int().min(1).max(60),
  reason: z.string().min(1, "Extension reason is required"),
  notificationRequired: z.boolean().optional().default(true),
});

export const pauseClockSchema = z.object({
  reason: z.string().min(1, "Pause reason is required"),
});

export const updateSlaConfigSchema = z.object({
  initialDeadlineDays: z.number().int().min(1).max(365).optional(),
  extensionMaxDays: z.number().int().min(0).max(365).optional(),
  useBusinessDays: z.boolean().optional(),
  timezone: z.string().optional(),
  yellowThresholdDays: z.number().int().min(1).max(90).optional(),
  redThresholdDays: z.number().int().min(1).max(90).optional(),
  milestoneIdvDays: z.number().int().min(1).max(90).optional(),
  milestoneCollectionDays: z.number().int().min(1).max(180).optional(),
  milestoneDraftDays: z.number().int().min(1).max(180).optional(),
  milestoneLegalDays: z.number().int().min(1).max(180).optional(),
  escalationYellowRoles: z.array(z.string()).optional(),
  escalationRedRoles: z.array(z.string()).optional(),
  escalationOverdueRoles: z.array(z.string()).optional(),
});

export const createHolidaySchema = z.object({
  date: z.string().min(1, "Date is required"),
  name: z.string().min(1, "Holiday name is required"),
  locale: z.string().optional().default("DE"),
});

export const markExtensionNotifiedSchema = z.object({
  sentAt: z.string().datetime().optional(),
});

// ─── Identity Verification Schemas ──────────────────────────────────────────

const IDV_METHOD_VALUES = ["EMAIL_OTP", "DOC_UPLOAD", "UTILITY_BILL", "SELFIE_MATCH", "KNOWLEDGE_BASED"] as const;
const IDV_ARTIFACT_TYPE_VALUES = ["ID_FRONT", "ID_BACK", "PASSPORT", "DRIVERS_LICENSE", "UTILITY_BILL", "SELFIE", "OTHER_DOCUMENT"] as const;
const IDV_DECISION_VALUES = ["APPROVED", "REJECTED", "NEED_MORE_INFO"] as const;

export const initIdvRequestSchema = z.object({
  allowedMethods: z.array(z.enum(IDV_METHOD_VALUES)).optional(),
});

export const idvDecisionSchema = z.object({
  outcome: z.enum(IDV_DECISION_VALUES),
  rationale: z.string().min(1, "Rationale is required for IDV decisions"),
});

export const idvPortalSubmitSchema = z.object({
  consentGiven: z.boolean().refine((v) => v === true, { message: "Consent is required to submit verification documents" }),
});

// ─── Response Generator Schemas ──────────────────────────────────────────────

const DELIVERY_METHOD_VALUES = ["EMAIL", "POSTAL", "PORTAL", "API"] as const;

export const generateResponseSchema = z.object({
  templateId: z.string().uuid().optional(),
  language: z.string().min(2).max(5).optional().default("en"),
  aiAssisted: z.boolean().optional().default(false),
});

export const updateResponseDocSchema = z.object({
  sections: z.array(z.object({
    key: z.string(),
    title: z.string(),
    renderedHtml: z.string(),
  })).optional(),
  fullHtml: z.string().optional(),
});

export const responseApprovalSchema = z.object({
  action: z.enum(["approve", "request_changes"]),
  comments: z.string().optional(),
});

export const createDeliveryRecordSchema = z.object({
  method: z.enum(DELIVERY_METHOD_VALUES),
  recipientRef: z.string().optional(),
  notes: z.string().optional(),
});

export const createRedactionEntrySchema = z.object({
  sectionKey: z.string().optional(),
  documentRef: z.string().optional(),
  redactedContent: z.string().optional(),
  reason: z.string().min(1, "Redaction reason is required"),
});

export const createResponseTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  language: z.string().min(2).max(5).optional().default("en"),
  jurisdiction: z.string().optional().default("GDPR"),
  dsarTypes: z.array(z.enum(DSAR_TYPE_VALUES)).min(1, "At least one DSAR type required"),
  subjectTypes: z.array(z.string()).optional().default([]),
  sections: z.array(z.object({
    key: z.string(),
    title: z.string(),
    body: z.string(),
  })).min(1, "At least one section is required"),
  placeholders: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  conditionals: z.array(z.object({
    condition: z.string(),
    sectionKey: z.string(),
    show: z.boolean(),
  })).optional(),
  disclaimerText: z.string().optional(),
  clonedFromId: z.string().uuid().optional(),
});

export const updateResponseTemplateSchema = createResponseTemplateSchema.partial();

export const updateIdvSettingsSchema = z.object({
  allowedMethods: z.array(z.enum(IDV_METHOD_VALUES)).optional(),
  selfieEnabled: z.boolean().optional(),
  knowledgeBasedEnabled: z.boolean().optional(),
  emailOtpEnabled: z.boolean().optional(),
  retentionDays: z.number().int().min(7).max(365).optional(),
  portalTokenExpiryDays: z.number().int().min(1).max(90).optional(),
  maxSubmissionsPerToken: z.number().int().min(1).max(10).optional(),
  bypassForSsoEmail: z.boolean().optional(),
  bypassForRepeatRequester: z.boolean().optional(),
  repeatRequesterMonths: z.number().int().min(1).max(24).optional(),
  autoTransitionOnApproval: z.boolean().optional(),
  storeDob: z.boolean().optional(),
});

// ─── Incident & Authority Linkage Schemas ────────────────────────────────────

const INCIDENT_SEVERITY_VALUES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const INCIDENT_STATUS_VALUES = ["OPEN", "CONTAINED", "RESOLVED"] as const;
const INCIDENT_TIMELINE_EVENT_VALUES = ["DETECTED", "TRIAGED", "CONTAINED", "NOTIFIED_AUTHORITY", "NOTIFIED_SUBJECTS", "REMEDIATION", "CLOSED", "OTHER"] as const;
const REGULATOR_STATUS_VALUES = ["DRAFT", "SUBMITTED", "INQUIRY", "CLOSED"] as const;
const INCIDENT_SOURCE_VALUES = ["MANUAL", "IMPORT_JIRA", "IMPORT_SERVICENOW", "IMPORT_SIEM", "IMPORT_OTHER"] as const;
const DSAR_INCIDENT_SUBJECT_VALUES = ["UNKNOWN", "YES", "NO"] as const;

export const createIncidentSchema = z.object({
  title: z.string().min(1, "Incident title is required"),
  description: z.string().optional(),
  severity: z.enum(INCIDENT_SEVERITY_VALUES).optional().default("MEDIUM"),
  status: z.enum(INCIDENT_STATUS_VALUES).optional().default("OPEN"),
  detectedAt: z.string().datetime().optional(),
  containedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
  regulatorNotificationRequired: z.boolean().optional().default(false),
  numberOfDataSubjectsEstimate: z.number().int().min(0).nullable().optional(),
  categoriesOfDataAffected: z.array(z.string()).optional().default([]),
  crossBorder: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional(),
});

export const updateIncidentSchema = createIncidentSchema.partial();

export const createIncidentTimelineSchema = z.object({
  eventType: z.enum(INCIDENT_TIMELINE_EVENT_VALUES),
  timestamp: z.string().datetime(),
  description: z.string().min(1, "Description is required"),
});

export const createIncidentAssessmentSchema = z.object({
  natureOfBreach: z.string().optional(),
  categoriesAndApproxSubjects: z.string().optional(),
  categoriesAndApproxRecords: z.string().optional(),
  likelyConsequences: z.string().optional(),
  measuresTakenOrProposed: z.string().optional(),
  dpoContactDetails: z.string().optional(),
  additionalNotes: z.string().optional(),
});

export const createRegulatorRecordSchema = z.object({
  authorityName: z.string().min(1, "Authority name is required"),
  country: z.string().optional(),
  referenceNumber: z.string().optional(),
  status: z.enum(REGULATOR_STATUS_VALUES).optional().default("DRAFT"),
  notes: z.string().optional(),
});

export const updateRegulatorRecordSchema = createRegulatorRecordSchema.partial();

export const linkDsarIncidentSchema = z.object({
  incidentId: z.string().uuid("Valid incident ID required"),
  linkReason: z.string().optional(),
  subjectInScope: z.enum(DSAR_INCIDENT_SUBJECT_VALUES).optional().default("UNKNOWN"),
});

export const createSurgeGroupSchema = z.object({
  name: z.string().min(1, "Surge group name is required"),
  description: z.string().optional(),
  caseIds: z.array(z.string().uuid()).optional().default([]),
});

export const surgeGroupBulkActionSchema = z.object({
  action: z.enum(["apply_systems", "create_tasks", "set_template", "create_extension_notices"]),
  systemIds: z.array(z.string().uuid()).optional(),
  taskTitle: z.string().optional(),
  taskDescription: z.string().optional(),
  templateId: z.string().uuid().optional(),
  extensionDays: z.number().int().min(1).max(60).optional(),
  extensionReason: z.string().optional(),
});

export const createAuthorityExportSchema = z.object({
  includeTimeline: z.boolean().optional().default(true),
  includeDsarList: z.boolean().optional().default(true),
  includeEvidence: z.boolean().optional().default(false),
  includeResponses: z.boolean().optional().default(false),
});

export const incidentContactSchema = z.object({
  role: z.string().min(1, "Contact role is required"),
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  notes: z.string().optional(),
});

export const incidentSourceSchema = z.object({
  sourceType: z.enum(INCIDENT_SOURCE_VALUES).optional().default("MANUAL"),
  externalId: z.string().optional(),
  externalUrl: z.string().optional(),
  systemName: z.string().optional(),
});

export const incidentSystemSchema = z.object({
  systemId: z.string().uuid("Valid system ID required"),
  notes: z.string().optional(),
});

export const incidentCommunicationSchema = z.object({
  direction: z.enum(["INBOUND", "OUTBOUND"]),
  channel: z.enum(["EMAIL", "LETTER", "PHONE", "PORTAL"]),
  recipient: z.string().optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  documentRef: z.string().optional(),
  sentAt: z.string().datetime().optional(),
});

// ─── Vendor / Processor Tracking Schemas ─────────────────────────────────────

const VENDOR_STATUS_VALUES = ["ACTIVE", "INACTIVE", "UNDER_REVIEW"] as const;
const VENDOR_REQUEST_STATUS_VALUES = ["DRAFT", "SENT", "ACKNOWLEDGED", "PARTIALLY_RESPONDED", "RESPONDED", "OVERDUE", "ESCALATED", "CLOSED"] as const;
const VENDOR_REQUEST_ITEM_STATUS_VALUES = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "NOT_APPLICABLE"] as const;
const VENDOR_RESPONSE_TYPE_VALUES = ["DATA_EXTRACT", "CONFIRMATION", "PARTIAL", "REJECTION", "QUESTION"] as const;
const VENDOR_ESCALATION_SEVERITY_VALUES = ["WARNING", "CRITICAL", "BREACH"] as const;

export const createVendorSchema = z.object({
  name: z.string().min(1, "Vendor name is required"),
  shortCode: z.string().max(10).optional(),
  status: z.enum(VENDOR_STATUS_VALUES).optional().default("ACTIVE"),
  website: z.string().url().optional().or(z.literal("")),
  headquartersCountry: z.string().optional(),
  dpaOnFile: z.boolean().optional().default(false),
  dpaExpiresAt: z.string().datetime().optional(),
  contractReference: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const updateVendorSchema = createVendorSchema.partial();

export const createVendorContactSchema = z.object({
  name: z.string().min(1, "Contact name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().optional(),
  role: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const createVendorDpaSchema = z.object({
  title: z.string().min(1, "DPA title is required"),
  signedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  sccsIncluded: z.boolean().optional().default(false),
  subprocessorListUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const createVendorRequestTemplateSchema = z.object({
  vendorId: z.string().uuid().optional(),
  name: z.string().min(1, "Template name is required"),
  language: z.string().min(2).max(5).optional().default("en"),
  dsarTypes: z.array(z.enum(DSAR_TYPE_VALUES)).min(1, "At least one DSAR type required"),
  subject: z.string().min(1, "Subject template is required"),
  bodyHtml: z.string().min(1, "Body template is required"),
  placeholders: z.array(z.object({
    key: z.string(),
    label: z.string(),
    description: z.string().optional(),
  })).optional(),
  isDefault: z.boolean().optional().default(false),
});

export const updateVendorRequestTemplateSchema = createVendorRequestTemplateSchema.partial();

export const createVendorRequestSchema = z.object({
  vendorId: z.string().uuid("Valid vendor ID required"),
  systemId: z.string().uuid().optional(),
  templateId: z.string().uuid().optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyHtml: z.string().min(1, "Body is required"),
  dueAt: z.string().datetime().optional(),
  items: z.array(z.object({
    systemId: z.string().uuid().optional(),
    description: z.string().min(1, "Item description is required"),
  })).optional().default([]),
});

export const updateVendorRequestSchema = z.object({
  status: z.enum(VENDOR_REQUEST_STATUS_VALUES).optional(),
  subject: z.string().optional(),
  bodyHtml: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  closedReason: z.string().optional(),
});

export const sendVendorRequestSchema = z.object({
  recipientEmail: z.string().email().optional(),
});

export const createVendorResponseSchema = z.object({
  requestId: z.string().uuid("Valid request ID required"),
  responseType: z.enum(VENDOR_RESPONSE_TYPE_VALUES).optional().default("DATA_EXTRACT"),
  receivedAt: z.string().datetime().optional(),
  summary: z.string().optional(),
  notes: z.string().optional(),
});

export const updateVendorRequestItemSchema = z.object({
  status: z.enum(VENDOR_REQUEST_ITEM_STATUS_VALUES),
  notes: z.string().optional(),
});

export const createVendorSlaConfigSchema = z.object({
  defaultDueDays: z.number().int().min(1).max(90).optional().default(14),
  reminderAfterDays: z.number().int().min(1).max(60).optional().default(7),
  escalationAfterDays: z.number().int().min(1).max(90).optional().default(14),
  maxReminders: z.number().int().min(0).max(10).optional().default(3),
  autoEscalate: z.boolean().optional().default(true),
});

export const createVendorEscalationSchema = z.object({
  vendorId: z.string().uuid("Valid vendor ID required"),
  requestId: z.string().uuid().optional(),
  severity: z.enum(VENDOR_ESCALATION_SEVERITY_VALUES),
  reason: z.string().min(1, "Reason is required"),
});

// ─── Executive KPI & Board Reporting Schemas ─────────────────────────────────

const KPI_PERIOD_VALUES = ["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"] as const;
const REPORT_FORMAT_VALUES = ["PDF", "CSV", "JSON", "PPT_JSON"] as const;
const MATURITY_DOMAIN_VALUES = ["DOCUMENTATION", "AUTOMATION", "SLA_COMPLIANCE", "INCIDENT_INTEGRATION", "VENDOR_COORDINATION"] as const;

export const kpiDateRangeSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  snapshotDate: z.string().optional(),
  period: z.enum(KPI_PERIOD_VALUES).optional(),
});

export const updateKpiConfigSchema = z.object({
  estimatedCostPerDsar: z.number().min(0).optional(),
  estimatedMinutesManual: z.number().min(0).optional(),
  estimatedMinutesAutomated: z.number().min(0).optional(),
  maturityWeights: z.object({
    documentation: z.number().min(0).max(1),
    automation: z.number().min(0).max(1),
    sla_compliance: z.number().min(0).max(1),
    incident_integration: z.number().min(0).max(1),
    vendor_coordination: z.number().min(0).max(1),
  }).optional(),
  snapshotCron: z.string().optional(),
});

export const generateReportSchema = z.object({
  title: z.string().optional(),
  format: z.enum(REPORT_FORMAT_VALUES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sections: z.array(z.string()).optional(),
});

export const createKpiThresholdSchema = z.object({
  kpiKey: z.string().min(1, "KPI key is required"),
  greenMax: z.number().optional(),
  yellowMax: z.number().optional(),
  redMin: z.number().optional(),
  direction: z.enum(["lower_is_better", "higher_is_better"]).optional().default("lower_is_better"),
});

// ─── Intake Portal Schemas (Module 8.1) ──────────────────────────────────────

const INTAKE_CHANNEL_VALUES = ["WEB", "EMAIL", "MANUAL"] as const;
const INTAKE_STATUS_VALUES = ["NEW", "PROCESSED", "REJECTED", "SPAM"] as const;
const DATA_SUBJECT_TYPE_VALUES = ["CUSTOMER", "EMPLOYEE", "APPLICANT", "VISITOR", "OTHER"] as const;
const INTAKE_JURISDICTION_VALUES = ["GDPR", "CCPA", "LGPD", "POPIA", "UNKNOWN"] as const;

export const intakeSubmissionSchema = z.object({
  preferredLanguage: z.enum(["en", "de"]).optional().default("en"),
  requestTypes: z.array(z.enum(DSAR_TYPE_VALUES)).min(1, "At least one request type required"),
  subjectType: z.enum(DATA_SUBJECT_TYPE_VALUES).optional(),
  subjectEmail: z.string().email().optional().or(z.literal("")),
  subjectPhone: z.string().optional(),
  subjectName: z.string().optional(),
  subjectAddress: z.string().optional(),
  customerId: z.string().optional(),
  employeeId: z.string().optional(),
  requestDetails: z.string().optional(),
  consentGiven: z.boolean().refine((v) => v === true, { message: "Consent is required" }),
  honeypot: z.string().optional(), // must be empty
});

export const emailIngestSchema = z.object({
  from: z.string().min(1, "From address is required"),
  subject: z.string().optional(),
  body: z.string().optional(),
  bodyHtml: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
  tenantSlug: z.string().min(1, "Tenant slug is required"),
  attachments: z.array(z.object({
    filename: z.string(),
    contentType: z.string(),
    base64: z.string(),
  })).optional(),
});

export const clarificationRequestSchema = z.object({
  questions: z.array(z.string().min(1)).min(1, "At least one question is required"),
  templateBody: z.string().optional(),
});

export const resolveClarificationSchema = z.object({
  resolvedNote: z.string().optional(),
});

export const dedupeLinkSchema = z.object({
  candidateId: z.string().uuid("Valid candidate ID required"),
  action: z.enum(["link", "merge", "dismiss"]),
});

export const updateIntakeSettingsSchema = z.object({
  autoCreateCase: z.boolean().optional(),
  dedupeWindowDays: z.number().int().min(1).max(365).optional(),
  clarificationPausesClock: z.boolean().optional(),
  maxAttachments: z.number().int().min(1).max(20).optional(),
  maxAttachmentSizeMb: z.number().int().min(1).max(50).optional(),
  rateLimitPerMinute: z.number().int().min(1).max(60).optional(),
  rateLimitPerHour: z.number().int().min(1).max(500).optional(),
  enabledLanguages: z.array(z.string()).optional(),
  requiredFields: z.array(z.string()).optional(),
  privacyNoticeUrl: z.string().url().optional().or(z.literal("")),
  portalWelcomeText: z.record(z.string()).optional(),
});

// ─── Module 8.2: Delivery Portal Schemas ────────────────────────────────────

export const createDeliveryPackageSchema = z.object({
  responseDocIds: z.array(z.string().uuid()).min(1, "At least one response document is required"),
  documentIds: z.array(z.string().uuid()).optional().default([]),
});

export const createDeliveryLinkSchema = z.object({
  packageId: z.string().uuid("Valid package ID required"),
  recipientEmail: z.string().email("Valid recipient email required"),
  expiresDays: z.number().int().min(1).max(90).optional(),
  otpRequired: z.boolean().optional(),
  maxDownloads: z.number().int().min(1).max(100).optional(),
  language: z.string().min(2).max(5).optional().default("en"),
});

export const revokeDeliveryLinkSchema = z.object({
  reason: z.string().min(1, "Revocation reason is required"),
});

export const verifyDeliveryOtpSchema = z.object({
  otp: z.string().length(6, "OTP must be 6 digits").regex(/^\d{6}$/, "OTP must be numeric"),
});

export const updateDeliverySettingsSchema = z.object({
  defaultExpiresDays: z.number().int().min(1).max(90).optional(),
  otpRequiredDefault: z.boolean().optional(),
  maxDownloadsDefault: z.number().int().min(1).max(100).optional(),
  logRetentionDays: z.number().int().min(30).max(3650).optional(),
  allowOneTimeLinks: z.boolean().optional(),
  otpMaxAttempts: z.number().int().min(3).max(10).optional(),
  otpLockoutMinutes: z.number().int().min(5).max(60).optional(),
  otpExpiryMinutes: z.number().int().min(5).max(30).optional(),
});

// ─── Integration Schemas ─────────────────────────────────────────────────────

const INTEGRATION_PROVIDER_VALUES = [
  "M365", "EXCHANGE_ONLINE", "SHAREPOINT", "ONEDRIVE",
  "GOOGLE_WORKSPACE", "SALESFORCE", "SERVICENOW",
  "ATLASSIAN_JIRA", "ATLASSIAN_CONFLUENCE", "WORKDAY", "SAP_SUCCESSFACTORS", "OKTA",
  "AWS", "AZURE", "GCP",
] as const;

export const createIntegrationSchema = z.object({
  provider: z.enum(INTEGRATION_PROVIDER_VALUES),
  name: z.string().min(1, "Integration name is required").max(200),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(["ENABLED", "DISABLED"]).optional(),
  config: z.record(z.unknown()).optional(),
  secrets: z.record(z.string()).optional(),
});

/**
 * Validates the decrypted AWS secrets payload structure.
 * Used after decryption to ensure the JSON content is well-formed.
 */
export const awsSecretsPayloadSchema = z.object({
  authType: z.enum(["access_keys", "assume_role"]).default("access_keys"),
  accessKeyId: z.string().min(1, "Access Key ID is required"),
  secretAccessKey: z.string().min(1, "Secret Access Key is required"),
  sessionToken: z.string().optional(),
  region: z.string().min(1, "AWS region is required"),
  roleArn: z.string().optional(),
  externalId: z.string().optional(),
}).refine(
  (data) => data.authType !== "assume_role" || !!data.roleArn,
  { message: "Role ARN is required when authType is assume_role", path: ["roleArn"] }
);

/**
 * Validates the POST /api/integrations/aws request body.
 * Accepts a flat structure with name + region + auth fields.
 */
export const createAwsIntegrationSchema = z.object({
  name: z.string().min(1, "Integration name is required").max(200),
  region: z.string().min(1, "AWS region is required"),
  authType: z.enum(["access_keys", "assume_role"]).default("access_keys"),
  accessKeyId: z.string().min(1, "Access Key ID is required"),
  secretAccessKey: z.string().min(1, "Secret Access Key is required"),
  sessionToken: z.string().optional(),
  roleArn: z.string().optional(),
  externalId: z.string().optional(),
}).refine(
  (data) => data.authType !== "assume_role" || !!data.roleArn,
  { message: "Role ARN is required when authType is assume_role", path: ["roleArn"] }
);
