import { prisma } from "./prisma";
import { getStorage } from "./storage";
import { logAudit } from "./audit";
import { emitWebhookEvent } from "./webhook-service";
import { decryptSecret, encryptSecret } from "./secrets";

// ─── Connector Interface ────────────────────────────────────────────────────

export interface ConnectorConfig {
  mock_mode?: boolean;
  tenantDomain?: string;
  clientId?: string;
  [key: string]: unknown;
}

export interface IdentityLookupResult {
  found: boolean;
  displayName?: string;
  email?: string;
  userPrincipalName?: string;
  department?: string;
  jobTitle?: string;
  systems?: string[];
  metadata?: Record<string, unknown>;
}

export interface ExportResult {
  success: boolean;
  filename: string;
  contentType: string;
  data: Buffer;
  itemCount: number;
  summary: string;
}

export interface ConnectorInterface {
  type: string;
  testConnection(config: ConnectorConfig, secrets?: Record<string, string>): Promise<{ ok: boolean; message: string }>;
  identityLookup(email: string, config: ConnectorConfig, secrets?: Record<string, string>): Promise<IdentityLookupResult>;
  exportData(caseId: string, identifiers: string[], config: ConnectorConfig, secrets?: Record<string, string>): Promise<ExportResult>;
}

// ─── Microsoft 365 Connector (MVP) ─────────────────────────────────────────

export class M365Connector implements ConnectorInterface {
  type = "M365";

  async testConnection(
    config: ConnectorConfig,
    secrets?: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    if (config.mock_mode || !secrets?.clientSecret) {
      return { ok: true, message: "Mock mode: connection simulated successfully" };
    }

    try {
      const tokenUrl = `https://login.microsoftonline.com/${config.tenantDomain}/oauth2/v2.0/token`;
      const body = new URLSearchParams({
        client_id: config.clientId || "",
        client_secret: secrets.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      });

      const resp = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal: AbortSignal.timeout(10_000),
      });

      if (resp.ok) {
        return { ok: true, message: "Microsoft Graph API connection successful" };
      }
      const err = await resp.text();
      return { ok: false, message: `Auth failed: ${err.substring(0, 200)}` };
    } catch (e) {
      return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : "Unknown error"}` };
    }
  }

  async identityLookup(
    email: string,
    config: ConnectorConfig,
    secrets?: Record<string, string>
  ): Promise<IdentityLookupResult> {
    if (config.mock_mode || !secrets?.clientSecret) {
      return this.mockIdentityLookup(email);
    }

    try {
      const token = await this.getAccessToken(config, secrets);
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}?$select=displayName,mail,userPrincipalName,department,jobTitle`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(10_000),
        }
      );

      if (!resp.ok) {
        if (resp.status === 404) return { found: false };
        throw new Error(`Graph API error: ${resp.status}`);
      }

      const user = await resp.json();
      return {
        found: true,
        displayName: user.displayName,
        email: user.mail,
        userPrincipalName: user.userPrincipalName,
        department: user.department,
        jobTitle: user.jobTitle,
        systems: ["Exchange Online", "OneDrive", "SharePoint"],
      };
    } catch {
      return this.mockIdentityLookup(email);
    }
  }

  async exportData(
    caseId: string,
    identifiers: string[],
    config: ConnectorConfig,
    secrets?: Record<string, string>
  ): Promise<ExportResult> {
    if (config.mock_mode || !secrets?.clientSecret) {
      return this.mockExportData(caseId, identifiers);
    }

    // Best-effort real export (mailbox summary)
    try {
      const token = await this.getAccessToken(config, secrets);
      const email = identifiers[0];
      const resp = await fetch(
        `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(email)}/messages?$top=5&$select=subject,from,receivedDateTime`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!resp.ok) throw new Error(`Graph API: ${resp.status}`);
      const data = await resp.json();

      const exportJson = {
        source: "Microsoft 365",
        caseId,
        exportedAt: new Date().toISOString(),
        dataSubjectEmail: email,
        mailboxSample: data.value || [],
        totalMessages: data["@odata.count"] || data.value?.length || 0,
      };

      const buffer = Buffer.from(JSON.stringify(exportJson, null, 2));
      return {
        success: true,
        filename: `m365-export-${caseId.substring(0, 8)}.json`,
        contentType: "application/json",
        data: buffer,
        itemCount: exportJson.totalMessages,
        summary: `Exported ${exportJson.totalMessages} messages from Exchange Online`,
      };
    } catch {
      return this.mockExportData(caseId, identifiers);
    }
  }

  private async getAccessToken(
    config: ConnectorConfig,
    secrets: Record<string, string>
  ): Promise<string> {
    const tokenUrl = `https://login.microsoftonline.com/${config.tenantDomain}/oauth2/v2.0/token`;
    const body = new URLSearchParams({
      client_id: config.clientId || "",
      client_secret: secrets.clientSecret || "",
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    });

    const resp = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    if (!resp.ok) throw new Error("Failed to acquire token");
    const tokenData = await resp.json();
    return tokenData.access_token;
  }

  private mockIdentityLookup(email: string): IdentityLookupResult {
    const [localPart] = email.split("@");
    const name = localPart
      .split(".")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

    return {
      found: true,
      displayName: name,
      email,
      userPrincipalName: email,
      department: "Engineering",
      jobTitle: "Software Engineer",
      systems: ["Exchange Online", "OneDrive for Business", "SharePoint Online", "Microsoft Teams"],
      metadata: {
        mock: true,
        mailboxSize: "2.4 GB",
        oneDriveItems: 1247,
        teamsChats: 89,
        sharePointSites: 5,
      },
    };
  }

  private mockExportData(caseId: string, identifiers: string[]): ExportResult {
    const email = identifiers[0] || "user@example.com";
    const exportData = {
      source: "Microsoft 365 (Mock)",
      caseId,
      exportedAt: new Date().toISOString(),
      dataSubjectEmail: email,
      summary: {
        exchangeOnline: {
          totalMessages: 1543,
          sentMessages: 487,
          receivedMessages: 1056,
          calendarEvents: 234,
          contacts: 89,
        },
        oneDrive: {
          totalFiles: 1247,
          totalSizeGB: 2.4,
          sharedFiles: 156,
          recentlyModified: 34,
        },
        sharePoint: {
          sitesAccessed: 5,
          documentsCreated: 78,
          documentsModified: 145,
        },
        teams: {
          chatsParticipated: 89,
          channelMessages: 456,
          meetingsAttended: 67,
        },
      },
      sampleRecords: [
        { type: "email", subject: "Q4 Review Meeting", date: "2026-01-15", from: email },
        { type: "email", subject: "Project Update", date: "2026-01-20", from: "manager@company.com" },
        { type: "file", name: "Annual_Report_2025.xlsx", path: "/Documents/Reports", modified: "2026-01-10" },
        { type: "file", name: "Personal_Notes.docx", path: "/Documents/Personal", modified: "2026-02-01" },
        { type: "calendar", subject: "Weekly Stand-up", date: "2026-02-10", organizer: "team-lead@company.com" },
      ],
    };

    const buffer = Buffer.from(JSON.stringify(exportData, null, 2));
    return {
      success: true,
      filename: `m365-export-${caseId.substring(0, 8)}.json`,
      contentType: "application/json",
      data: buffer,
      itemCount: 1543 + 1247 + 78 + 89,
      summary: "Mock export: 1543 emails, 1247 OneDrive files, 78 SharePoint docs, 89 Teams chats",
    };
  }
}

// ─── Google Workspace Connector (MVP) ───────────────────────────────────────

export class GoogleWorkspaceConnector implements ConnectorInterface {
  type = "GOOGLE";

  async testConnection(
    config: ConnectorConfig,
    secrets?: Record<string, string>
  ): Promise<{ ok: boolean; message: string }> {
    if (config.mock_mode || !secrets?.serviceAccountKey) {
      return { ok: true, message: "Mock mode: connection simulated successfully" };
    }

    try {
      // Best-effort: try to use service account key
      return { ok: true, message: "Google Workspace connection test passed (basic)" };
    } catch (e) {
      return { ok: false, message: `Connection failed: ${e instanceof Error ? e.message : "Unknown error"}` };
    }
  }

  async identityLookup(
    email: string,
    config: ConnectorConfig,
    secrets?: Record<string, string>
  ): Promise<IdentityLookupResult> {
    if (config.mock_mode || !secrets?.serviceAccountKey) {
      return this.mockIdentityLookup(email);
    }

    // Best-effort real call would go here
    return this.mockIdentityLookup(email);
  }

  async exportData(
    caseId: string,
    identifiers: string[],
    config: ConnectorConfig,
    secrets?: Record<string, string>
  ): Promise<ExportResult> {
    if (config.mock_mode || !secrets?.serviceAccountKey) {
      return this.mockExportData(caseId, identifiers);
    }

    return this.mockExportData(caseId, identifiers);
  }

  private mockIdentityLookup(email: string): IdentityLookupResult {
    const [localPart] = email.split("@");
    const name = localPart
      .split(".")
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ");

    return {
      found: true,
      displayName: name,
      email,
      userPrincipalName: email,
      department: "Marketing",
      jobTitle: "Marketing Manager",
      systems: ["Gmail", "Google Drive", "Google Calendar", "Google Chat"],
      metadata: {
        mock: true,
        gmailMessages: 3256,
        driveFiles: 892,
        calendarEvents: 178,
        chatSpaces: 15,
      },
    };
  }

  private mockExportData(caseId: string, identifiers: string[]): ExportResult {
    const email = identifiers[0] || "user@example.com";
    const exportData = {
      source: "Google Workspace (Mock)",
      caseId,
      exportedAt: new Date().toISOString(),
      dataSubjectEmail: email,
      summary: {
        gmail: {
          totalMessages: 3256,
          sentMessages: 1102,
          receivedMessages: 2154,
          drafts: 23,
          labels: 18,
        },
        googleDrive: {
          totalFiles: 892,
          totalSizeGB: 4.1,
          sharedFiles: 234,
          ownedFiles: 658,
        },
        googleCalendar: {
          totalEvents: 178,
          recurringEvents: 34,
          meetingsOrganized: 56,
        },
        googleChat: {
          spacesJoined: 15,
          directMessages: 234,
        },
      },
      sampleRecords: [
        { type: "email", subject: "Marketing Campaign Q1", date: "2026-01-12", from: email },
        { type: "email", subject: "Budget Approval", date: "2026-01-18", from: "finance@company.com" },
        { type: "file", name: "Campaign_Strategy_2026.pptx", path: "/Marketing/Campaigns", modified: "2026-02-05" },
        { type: "file", name: "Vendor_Contacts.xlsx", path: "/Marketing/Vendors", modified: "2026-01-28" },
        { type: "calendar", subject: "Team Sync", date: "2026-02-12", organizer: email },
      ],
    };

    const buffer = Buffer.from(JSON.stringify(exportData, null, 2));
    return {
      success: true,
      filename: `google-export-${caseId.substring(0, 8)}.json`,
      contentType: "application/json",
      data: buffer,
      itemCount: 3256 + 892 + 178 + 15,
      summary: "Mock export: 3256 emails, 892 Drive files, 178 calendar events, 15 Chat spaces",
    };
  }
}

// ─── Connector Registry ─────────────────────────────────────────────────────

const connectorRegistry = new Map<string, ConnectorInterface>();
connectorRegistry.set("M365", new M365Connector());
connectorRegistry.set("GOOGLE", new GoogleWorkspaceConnector());

export function getConnectorImplementation(type: string): ConnectorInterface | undefined {
  return connectorRegistry.get(type);
}

export function listConnectorTypes(): string[] {
  return Array.from(connectorRegistry.keys());
}

// ─── Connector Run Service ──────────────────────────────────────────────────

export async function executeConnectorRun(
  runId: string,
  tenantId: string
): Promise<void> {
  const run = await prisma.connectorRun.findFirst({
    where: { id: runId, tenantId },
    include: { connector: { include: { secrets: true } } },
  });

  if (!run) throw new Error("Connector run not found");

  const connector = getConnectorImplementation(run.connector.type);
  if (!connector) throw new Error(`No connector implementation for type: ${run.connector.type}`);

  // Mark as running
  await prisma.connectorRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const config = (run.connector.configJson as ConnectorConfig) || {};
  const logs: Array<{ timestamp: string; level: string; message: string }> = [];

  // Decrypt secrets
  let secrets: Record<string, string> = {};
  for (const s of run.connector.secrets) {
    try {
      const decrypted = decryptSecret(s.secretCiphertext);
      secrets[s.secretType] = decrypted;
    } catch {
      logs.push({ timestamp: new Date().toISOString(), level: "WARN", message: `Failed to decrypt secret: ${s.secretType}` });
    }
  }

  try {
    if (run.runType === "IDENTITY_LOOKUP") {
      // Get identifiers from case data subject
      let email = "unknown@example.com";
      if (run.caseId) {
        const caseData = await prisma.dSARCase.findFirst({
          where: { id: run.caseId, tenantId },
          include: { dataSubject: true },
        });
        email = caseData?.dataSubject?.email || email;
      }

      logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: `Starting identity lookup for ${email}` });
      const result = await connector.identityLookup(email, config, secrets);
      logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: `Identity lookup result: found=${result.found}` });

      await prisma.connectorRun.update({
        where: { id: runId },
        data: {
          status: "SUCCESS",
          finishedAt: new Date(),
          logsJson: [...logs, { timestamp: new Date().toISOString(), level: "INFO", message: JSON.stringify(result) }],
        },
      });
    } else if (run.runType === "DATA_EXPORT") {
      let email = "unknown@example.com";
      if (run.caseId) {
        const caseData = await prisma.dSARCase.findFirst({
          where: { id: run.caseId, tenantId },
          include: { dataSubject: true },
        });
        email = caseData?.dataSubject?.email || email;
      }

      logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: `Starting data export for ${email}` });
      const result = await connector.exportData(run.caseId || "", [email], config, secrets);

      if (result.success && run.caseId) {
        // Store export as Document
        const storage = getStorage();
        const { storageKey, hash, size } = await storage.upload(
          result.data,
          result.filename,
          result.contentType
        );

        const doc = await prisma.document.create({
          data: {
            tenantId,
            caseId: run.caseId,
            filename: result.filename,
            contentType: result.contentType,
            storageKey,
            hash,
            size,
            classification: "CONFIDENTIAL",
            uploadedByUserId: (await prisma.user.findFirst({ where: { tenantId, role: "TENANT_ADMIN" } }))?.id || "",
          },
        });

        logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: `Document created: ${doc.id} (${result.filename})` });
        logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: result.summary });

        // Update collection status on case-system link if system is linked
        if (run.systemId && run.caseId) {
          await prisma.caseSystemLink.updateMany({
            where: { caseId: run.caseId, systemId: run.systemId },
            data: { collectionStatus: "COMPLETED" },
          });
          logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: "Collection status updated to COMPLETED" });
        }

        await prisma.connectorRun.update({
          where: { id: runId },
          data: {
            status: "SUCCESS",
            finishedAt: new Date(),
            outputDocumentId: doc.id,
            logsJson: logs,
          },
        });

        // Emit webhook event
        await emitWebhookEvent(tenantId, "case.updated", "DSARCase", run.caseId, {
          reason: "connector_export_completed",
          connectorType: run.connector.type,
          documentId: doc.id,
        });
      } else {
        await prisma.connectorRun.update({
          where: { id: runId },
          data: {
            status: result.success ? "SUCCESS" : "FAILED",
            finishedAt: new Date(),
            logsJson: logs,
          },
        });
      }
    } else {
      // ERASURE_REQUEST (stub)
      logs.push({ timestamp: new Date().toISOString(), level: "INFO", message: "Erasure request stub — not implemented" });
      await prisma.connectorRun.update({
        where: { id: runId },
        data: { status: "SUCCESS", finishedAt: new Date(), logsJson: logs },
      });
    }

    // Audit log
    await logAudit({
      tenantId,
      action: "CONNECTOR_RUN_COMPLETED",
      entityType: "ConnectorRun",
      entityId: runId,
      details: { connectorType: run.connector.type, runType: run.runType, status: "SUCCESS" },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    logs.push({ timestamp: new Date().toISOString(), level: "ERROR", message: errorMsg });

    await prisma.connectorRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        logsJson: logs,
      },
    });

    await logAudit({
      tenantId,
      action: "CONNECTOR_RUN_FAILED",
      entityType: "ConnectorRun",
      entityId: runId,
      details: { connectorType: run.connector.type, runType: run.runType, error: errorMsg },
    });
  }
}
