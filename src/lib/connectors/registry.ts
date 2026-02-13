/**
 * Connector registry — maps IntegrationProvider → Connector instance
 * and exposes phase-grouped provider metadata for UI rendering.
 */

import type { Connector, ProviderInfo } from "./types";
import { M365Connector } from "./m365";
import { ExchangeOnlineConnector } from "./exchange-online";
import { SharePointConnector } from "./sharepoint";
import { OneDriveConnector } from "./onedrive";
import {
  GoogleWorkspaceConnector,
  SalesforceConnector,
  ServiceNowConnector,
  AtlassianJiraConnector,
  AtlassianConfluenceConnector,
  WorkdayConnector,
  SAPSuccessFactorsConnector,
  OktaConnector,
  AWSConnector,
  AzureConnector,
  GCPConnector,
} from "./stubs";

/* ── Connector instances ──────────────────────────────────────────────── */

const connectors: Record<string, Connector> = {
  // Phase 1 — Microsoft
  M365: new M365Connector(),
  EXCHANGE_ONLINE: new ExchangeOnlineConnector(),
  SHAREPOINT: new SharePointConnector(),
  ONEDRIVE: new OneDriveConnector(),
  // Phase 2
  GOOGLE_WORKSPACE: GoogleWorkspaceConnector,
  SALESFORCE: SalesforceConnector,
  SERVICENOW: ServiceNowConnector,
  // Phase 3
  ATLASSIAN_JIRA: AtlassianJiraConnector,
  ATLASSIAN_CONFLUENCE: AtlassianConfluenceConnector,
  WORKDAY: WorkdayConnector,
  SAP_SUCCESSFACTORS: SAPSuccessFactorsConnector,
  OKTA: OktaConnector,
  // Phase 4
  AWS: AWSConnector,
  AZURE: AzureConnector,
  GCP: GCPConnector,
};

export function getConnector(provider: string): Connector | null {
  return connectors[provider] ?? null;
}

/* ── Provider metadata (ordered by phase → alphabetical) ──────────────── */

export const PROVIDER_INFO: ProviderInfo[] = [
  // ── Phase 1: Microsoft ─────────────────────────────────
  {
    provider: "M365",
    name: "Microsoft 365 / Entra ID",
    description: "User profiles, directory data, group memberships, sign-in logs",
    icon: "M365",
    phase: 1,
    available: true,
  },
  {
    provider: "EXCHANGE_ONLINE",
    name: "Exchange Online",
    description: "Mailbox search (Inbox, Sent, Drafts) via Microsoft Graph",
    icon: "EXCHANGE",
    phase: 1,
    available: true,
  },
  {
    provider: "SHAREPOINT",
    name: "SharePoint Online",
    description: "Sites, document libraries, and lists",
    icon: "SHAREPOINT",
    phase: 1,
    available: true,
  },
  {
    provider: "ONEDRIVE",
    name: "OneDrive for Business",
    description: "User personal drive files and folders",
    icon: "ONEDRIVE",
    phase: 1,
    available: true,
  },

  // ── Phase 2: High Business Value ───────────────────────
  {
    provider: "GOOGLE_WORKSPACE",
    name: "Google Workspace",
    description: "Gmail, Google Drive, Admin Directory",
    icon: "GOOGLE_WORKSPACE",
    phase: 2,
    available: false,
    comingSoon: true,
  },
  {
    provider: "SALESFORCE",
    name: "Salesforce",
    description: "Contacts, Leads, Cases, Attachments",
    icon: "SALESFORCE",
    phase: 2,
    available: false,
    comingSoon: true,
  },
  {
    provider: "SERVICENOW",
    name: "ServiceNow",
    description: "Incidents, HR Cases, Knowledge articles",
    icon: "SERVICENOW",
    phase: 2,
    available: false,
    comingSoon: true,
  },

  // ── Phase 3: Customer-Dependent ────────────────────────
  {
    provider: "ATLASSIAN_JIRA",
    name: "Atlassian Jira",
    description: "Issues, comments, and attachments",
    icon: "JIRA",
    phase: 3,
    available: false,
    comingSoon: true,
  },
  {
    provider: "ATLASSIAN_CONFLUENCE",
    name: "Atlassian Confluence",
    description: "Pages, blog posts, and spaces",
    icon: "CONFLUENCE",
    phase: 3,
    available: false,
    comingSoon: true,
  },
  {
    provider: "WORKDAY",
    name: "Workday",
    description: "Worker profiles, compensation, personal data",
    icon: "WORKDAY",
    phase: 3,
    available: false,
    comingSoon: true,
  },
  {
    provider: "SAP_SUCCESSFACTORS",
    name: "SAP SuccessFactors",
    description: "Employee data, employment history",
    icon: "SAP",
    phase: 3,
    available: false,
    comingSoon: true,
  },
  {
    provider: "OKTA",
    name: "Okta",
    description: "User profiles, app assignments, sign-in activity",
    icon: "OKTA",
    phase: 3,
    available: false,
    comingSoon: true,
  },

  // ── Phase 4: Cloud Providers ───────────────────────────
  {
    provider: "AWS",
    name: "Amazon Web Services",
    description: "S3, DynamoDB — only if PII resides in storage/logs",
    icon: "AWS",
    phase: 4,
    available: false,
    comingSoon: true,
  },
  {
    provider: "AZURE",
    name: "Microsoft Azure",
    description: "Blob Storage, SQL — only if PII resides in storage/logs",
    icon: "AZURE",
    phase: 4,
    available: false,
    comingSoon: true,
  },
  {
    provider: "GCP",
    name: "Google Cloud Platform",
    description: "Cloud Storage, BigQuery — only if PII resides in storage/logs",
    icon: "GCP",
    phase: 4,
    available: false,
    comingSoon: true,
  },
];

/* ── Helpers ──────────────────────────────────────────────────────────── */

/** Group providers by phase for UI rendering */
export function getProvidersByPhase(): Record<number, ProviderInfo[]> {
  const grouped: Record<number, ProviderInfo[]> = { 1: [], 2: [], 3: [], 4: [] };
  for (const info of PROVIDER_INFO) {
    grouped[info.phase].push(info);
  }
  return grouped;
}

/** Phase labels for UI headings */
export const PHASE_LABELS: Record<number, string> = {
  1: "Microsoft (Phase 1 — Production Ready)",
  2: "Business Applications (Phase 2 — Coming Soon)",
  3: "Collaboration & HR (Phase 3 — Planned)",
  4: "Cloud Infrastructure (Phase 4 — Planned)",
};
