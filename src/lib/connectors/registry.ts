import type { Connector, ProviderInfo } from "./types";
import { M365Connector } from "./m365";
import { SharePointConnector } from "./sharepoint";
import {
  GoogleWorkspaceConnector,
  SalesforceConnector,
  ServiceNowConnector,
  AWSConnector,
  AzureConnector,
  GCPConnector,
} from "./stubs";

const connectors: Record<string, Connector> = {
  M365: new M365Connector(),
  SHAREPOINT: new SharePointConnector(),
  GOOGLE_WORKSPACE: GoogleWorkspaceConnector,
  SALESFORCE: SalesforceConnector,
  SERVICENOW: ServiceNowConnector,
  AWS: AWSConnector,
  AZURE: AzureConnector,
  GCP: GCPConnector,
};

export function getConnector(provider: string): Connector | null {
  return connectors[provider] ?? null;
}

export const PROVIDER_INFO: ProviderInfo[] = [
  {
    provider: "M365",
    name: "Microsoft 365",
    description: "Exchange Online, OneDrive, Teams via Microsoft Graph API",
    icon: "M365",
    available: true,
  },
  {
    provider: "SHAREPOINT",
    name: "SharePoint",
    description: "SharePoint Online sites, document libraries, and lists",
    icon: "SHAREPOINT",
    available: true,
  },
  {
    provider: "GOOGLE_WORKSPACE",
    name: "Google Workspace",
    description: "Gmail, Google Drive, Admin Directory",
    icon: "GOOGLE_WORKSPACE",
    available: false,
    comingSoon: true,
  },
  {
    provider: "SALESFORCE",
    name: "Salesforce",
    description: "Salesforce CRM objects and data",
    icon: "SALESFORCE",
    available: false,
    comingSoon: true,
  },
  {
    provider: "SERVICENOW",
    name: "ServiceNow",
    description: "ServiceNow ITSM tables and records",
    icon: "SERVICENOW",
    available: false,
    comingSoon: true,
  },
  {
    provider: "AWS",
    name: "Amazon Web Services",
    description: "S3, DynamoDB, and other AWS data stores",
    icon: "AWS",
    available: false,
    comingSoon: true,
  },
  {
    provider: "AZURE",
    name: "Microsoft Azure",
    description: "Azure Blob Storage, Cosmos DB, SQL Database",
    icon: "AZURE",
    available: false,
    comingSoon: true,
  },
  {
    provider: "GCP",
    name: "Google Cloud Platform",
    description: "Cloud Storage, BigQuery, Firestore",
    icon: "GCP",
    available: false,
    comingSoon: true,
  },
];
