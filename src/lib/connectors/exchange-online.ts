import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";
import { decrypt } from "@/lib/security/encryption";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import type { QuerySpec } from "@/lib/query-spec";

/* ── Graph API response types ──────────────────────────────────────────── */

interface GraphTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface GraphTokenError {
  error: string;
  error_description?: string;
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  toRecipients?: Array<{ emailAddress?: { address?: string } }>;
  receivedDateTime?: string;
  sentDateTime?: string;
  hasAttachments?: boolean;
  parentFolderId?: string;
  bodyPreview?: string;
}

interface GraphMessagesResponse {
  value: GraphMessage[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

/* ── Exchange Online scope shape ───────────────────────────────────────── */

interface ExchangeOnlineScope {
  mailboxes: string[];
  folderScope: "inbox" | "sent" | "drafts" | "all";
  includeAttachments: boolean;
}

/* ── Well-known folder name mapping ────────────────────────────────────── */

const FOLDER_FILTER_MAP: Record<string, string> = {
  inbox: "Inbox",
  sent: "SentItems",
  drafts: "Drafts",
};

/* ── Constants ─────────────────────────────────────────────────────────── */

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const TOKEN_URL_TEMPLATE =
  "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const MAX_PAGE_SIZE = 100;

/**
 * Exchange Online Connector
 *
 * Dedicated mailbox search connector using Microsoft Graph API.
 * Previously part of the M365 connector, now a standalone provider for
 * focused DSAR mailbox data collection.
 *
 * Config: { tenantId, clientId, clientSecret, allowedMailboxes? }
 * Secret: clientSecret (encrypted via SecretStore)
 */
export class ExchangeOnlineConnector implements Connector {
  provider = "EXCHANGE_ONLINE";

  getConfigFields(): ConfigField[] {
    return [
      {
        key: "tenantId",
        label: "Directory (Tenant) ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        description: "Azure AD tenant ID for your organization",
      },
      {
        key: "clientId",
        label: "Application (Client) ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        description: "App registration client ID with Mail.Read application permission",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        required: true,
        placeholder: "Enter client secret",
        description: "App registration client secret value",
        isSecret: true,
      },
      {
        key: "allowedMailboxes",
        label: "Allowed Mailboxes",
        type: "textarea",
        required: false,
        placeholder: "user1@company.com, user2@company.com",
        description:
          "Restrict which mailboxes can be searched (comma-separated). Leave empty to allow all mailboxes.",
      },
    ];
  }

  getQueryTemplates(): QueryTemplate[] {
    return [
      {
        id: "exchange_mailbox_search",
        name: "Search User Mailbox",
        description:
          "Search user mailbox for messages matching DSAR criteria. Covers Inbox and Sent items with optional attachment collection.",
        scopeFields: [
          {
            key: "mailboxes",
            label: "Mailboxes",
            type: "textarea",
            required: true,
            placeholder: "user@company.com (one per line or comma-separated)",
            description: "Email addresses of mailboxes to search",
          },
          {
            key: "folderScope",
            label: "Folder Scope",
            type: "select",
            required: true,
            description: "Which mail folders to include in the search",
            options: [
              { label: "All Folders", value: "all" },
              { label: "Inbox Only", value: "inbox" },
              { label: "Sent Items Only", value: "sent" },
              { label: "Drafts Only", value: "drafts" },
            ],
          },
          {
            key: "includeAttachments",
            label: "Include Attachments",
            type: "select",
            required: true,
            description: "Whether to collect message attachments",
            options: [
              { label: "No", value: "no" },
              { label: "Yes", value: "yes" },
            ],
          },
        ],
        defaultScope: {
          mailboxes: [],
          folderScope: "all",
          includeAttachments: false,
        },
      },
      {
        id: "exchange_inbox_sent",
        name: "Inbox & Sent Focused Search",
        description:
          "Focused search targeting only Inbox and Sent Items folders. Optimized for DSAR requests where only inbound and outbound correspondence is needed.",
        scopeFields: [
          {
            key: "mailboxes",
            label: "Mailboxes",
            type: "textarea",
            required: true,
            placeholder: "user@company.com (one per line or comma-separated)",
            description: "Email addresses of mailboxes to search",
          },
          {
            key: "folderScope",
            label: "Folder Scope",
            type: "select",
            required: false,
            description: "Pre-set to Inbox and Sent items",
            options: [
              { label: "Inbox Only", value: "inbox" },
              { label: "Sent Items Only", value: "sent" },
            ],
          },
          {
            key: "includeAttachments",
            label: "Include Attachments",
            type: "select",
            required: true,
            description: "Whether to collect message attachments",
            options: [
              { label: "No", value: "no" },
              { label: "Yes", value: "yes" },
            ],
          },
        ],
        defaultScope: {
          mailboxes: [],
          folderScope: "inbox",
          includeAttachments: false,
        },
      },
    ];
  }

  /* ── Health Check ──────────────────────────────────────────────────────── */

  async healthCheck(
    config: ConnectorConfig,
    secretRef: string | null
  ): Promise<HealthCheckResult> {
    const now = new Date();
    const tenantId = config.tenantId as string;
    const clientId = config.clientId as string;

    if (!tenantId || !clientId) {
      return {
        healthy: false,
        message: "Missing required configuration: tenantId and clientId",
        checkedAt: now,
      };
    }

    if (!secretRef) {
      return {
        healthy: false,
        message: "No client secret configured",
        checkedAt: now,
      };
    }

    try {
      const clientSecret = decrypt(secretRef);
      const accessToken = await this.acquireToken(tenantId, clientId, clientSecret);

      // Verify token works by calling the /organization endpoint
      const orgResponse = await fetch(`${GRAPH_BASE_URL}/organization`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!orgResponse.ok) {
        return {
          healthy: false,
          message: `Graph API verification failed: ${orgResponse.statusText}`,
          details: { statusCode: orgResponse.status },
          checkedAt: now,
        };
      }

      return {
        healthy: true,
        message: "Connected to Exchange Online via Microsoft Graph API successfully",
        details: {
          tokenAcquired: true,
          organizationAccessible: true,
          provider: this.provider,
        },
        checkedAt: now,
      };
    } catch (error) {
      return {
        healthy: false,
        message: `Connection error: ${error instanceof Error ? error.message : "Unknown error"}`,
        checkedAt: now,
      };
    }
  }

  /* ── Collect Data ──────────────────────────────────────────────────────── */

  async collectData(
    config: ConnectorConfig,
    secretRef: string | null,
    querySpec: QuerySpec
  ): Promise<CollectionResult> {
    const resultMeta = createPendingResult(this.provider, "mailbox_search");

    if (!secretRef) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "No credentials configured",
        resultMetadata: completeResult(resultMeta, {
          status: "failed",
          errorMessage: "Missing client secret",
        }),
        error: "Missing client secret",
      };
    }

    try {
      const clientSecret = decrypt(secretRef);
      const tenantId = config.tenantId as string;
      const clientId = config.clientId as string;

      if (!tenantId || !clientId) {
        return {
          success: false,
          recordsFound: 0,
          findingsSummary: "Missing required configuration: tenantId and clientId",
          resultMetadata: completeResult(resultMeta, {
            status: "failed",
            errorMessage: "Missing tenantId or clientId in connector config",
          }),
          error: "Missing tenantId or clientId",
        };
      }

      const accessToken = await this.acquireToken(tenantId, clientId, clientSecret);

      // Parse provider scope
      const scope = this.parseScope(querySpec.providerScope);
      const mailboxes = scope.mailboxes;

      if (mailboxes.length === 0) {
        return {
          success: false,
          recordsFound: 0,
          findingsSummary: "No mailboxes specified in providerScope",
          resultMetadata: completeResult(resultMeta, {
            status: "failed",
            errorMessage: "No mailboxes specified",
          }),
          error: "No mailboxes specified in providerScope.mailboxes",
        };
      }

      // Enforce allowed-mailbox restrictions from config
      const allowedMailboxes = this.parseAllowedMailboxes(
        config.allowedMailboxes as string | undefined
      );
      if (allowedMailboxes.length > 0) {
        const denied = mailboxes.filter(
          (mb) => !allowedMailboxes.includes(mb.toLowerCase())
        );
        if (denied.length > 0) {
          return {
            success: false,
            recordsFound: 0,
            findingsSummary: `Mailbox(es) not in allowed list: ${denied.join(", ")}`,
            resultMetadata: completeResult(resultMeta, {
              status: "failed",
              errorMessage: `Mailbox access denied: ${denied.join(", ")}`,
            }),
            error: `Mailbox(es) not in allowed list: ${denied.join(", ")}`,
          };
        }
      }

      // Build search filter from QuerySpec
      const filter = this.buildFilter(querySpec, scope);
      const maxItems = querySpec.outputOptions?.maxItems ?? 500;
      const includeAttachments =
        scope.includeAttachments || querySpec.outputOptions?.includeAttachments === true;

      // Search each mailbox
      let totalMatched = 0;
      let totalAttachments = 0;
      let totalSkipped = 0;
      const mailboxSummaries: Array<{
        mailbox: string;
        matched: number;
        attachments: number;
        error?: string;
      }> = [];
      let overallStatus: "success" | "partial" | "failed" = "success";

      for (const mailbox of mailboxes) {
        try {
          const mailboxResult = await this.searchMailbox(
            accessToken,
            mailbox,
            scope.folderScope,
            filter,
            maxItems - totalMatched,
            includeAttachments
          );

          totalMatched += mailboxResult.matched;
          totalAttachments += mailboxResult.attachments;
          totalSkipped += mailboxResult.skipped;

          mailboxSummaries.push({
            mailbox,
            matched: mailboxResult.matched,
            attachments: mailboxResult.attachments,
          });
        } catch (error) {
          overallStatus = "partial";
          mailboxSummaries.push({
            mailbox,
            matched: 0,
            attachments: 0,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }

        // Stop if we have reached maxItems
        if (totalMatched >= maxItems) {
          break;
        }
      }

      // If every mailbox failed, mark as failed overall
      if (
        mailboxSummaries.length > 0 &&
        mailboxSummaries.every((s) => s.error !== undefined)
      ) {
        overallStatus = "failed";
      }

      const exported =
        querySpec.outputOptions?.mode === "include_content" ? totalMatched : 0;

      const summary = mailboxSummaries
        .map(
          (s) =>
            `${s.mailbox}: ${s.matched} message(s)` +
            (s.attachments > 0 ? `, ${s.attachments} attachment(s)` : "") +
            (s.error ? ` [error: ${s.error}]` : "")
        )
        .join("; ");

      return {
        success: overallStatus !== "failed",
        recordsFound: totalMatched,
        findingsSummary: `Exchange Online search complete. ${summary}`,
        resultMetadata: completeResult(resultMeta, {
          status: overallStatus,
          counts: {
            matched: totalMatched,
            exported,
            attachments: totalAttachments,
            skipped: totalSkipped,
          },
          artifacts: [
            {
              type: "metadata_json",
              filename: `exchange-online-results-${Date.now()}.json`,
              mimeType: "application/json",
              description: `Mailbox search results across ${mailboxes.length} mailbox(es)`,
            },
          ],
          notes: `Folder scope: ${scope.folderScope}. Mailboxes searched: ${mailboxes.join(", ")}`,
        }),
      };
    } catch (error) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Exchange Online collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        resultMetadata: completeResult(resultMeta, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        }),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /* ── Private helpers ───────────────────────────────────────────────────── */

  /**
   * Acquire an OAuth2 access token using the client credentials flow.
   */
  private async acquireToken(
    tenantId: string,
    clientId: string,
    clientSecret: string
  ): Promise<string> {
    const tokenUrl = TOKEN_URL_TEMPLATE.replace("{tenantId}", tenantId);

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        scope: GRAPH_SCOPE,
        grant_type: "client_credentials",
      }),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as GraphTokenError;
      throw new Error(
        `Token acquisition failed: ${errorData.error_description || response.statusText}`
      );
    }

    const tokenData = (await response.json()) as GraphTokenResponse;
    return tokenData.access_token;
  }

  /**
   * Parse and normalize the Exchange Online provider scope from the QuerySpec.
   */
  private parseScope(
    providerScope: Record<string, unknown>
  ): ExchangeOnlineScope {
    const rawMailboxes = providerScope.mailboxes;
    let mailboxes: string[] = [];

    if (Array.isArray(rawMailboxes)) {
      mailboxes = rawMailboxes
        .map((m) => String(m).trim().toLowerCase())
        .filter((m) => m.length > 0);
    } else if (typeof rawMailboxes === "string") {
      mailboxes = rawMailboxes
        .split(/[,\n]+/)
        .map((m) => m.trim().toLowerCase())
        .filter((m) => m.length > 0);
    }

    const folderScope =
      (providerScope.folderScope as ExchangeOnlineScope["folderScope"]) ?? "all";
    const includeAttachments = providerScope.includeAttachments === true;

    return { mailboxes, folderScope, includeAttachments };
  }

  /**
   * Parse the allowedMailboxes config field (comma-separated string) into a
   * normalized array of lowercase email addresses.
   */
  private parseAllowedMailboxes(raw: string | undefined): string[] {
    if (!raw || raw.trim().length === 0) return [];
    return raw
      .split(/[,\n]+/)
      .map((m) => m.trim().toLowerCase())
      .filter((m) => m.length > 0);
  }

  /**
   * Build an OData $filter string from the QuerySpec's timeRange and
   * searchTerms, combined with folder scope.
   */
  private buildFilter(
    querySpec: QuerySpec,
    scope: ExchangeOnlineScope
  ): { filter?: string; search?: string } {
    const filterParts: string[] = [];

    // Time range
    if (querySpec.timeRange) {
      if (querySpec.timeRange.from) {
        filterParts.push(`receivedDateTime ge ${querySpec.timeRange.from}`);
      }
      if (querySpec.timeRange.to) {
        filterParts.push(`receivedDateTime le ${querySpec.timeRange.to}`);
      }
    }

    // Search terms — Graph API $search uses KQL syntax
    let search: string | undefined;
    if (querySpec.searchTerms && querySpec.searchTerms.terms.length > 0) {
      const terms = querySpec.searchTerms.terms;
      const matchType = querySpec.searchTerms.matchType;

      if (matchType === "exact") {
        // Wrap each term in quotes for exact match in KQL
        search = terms.map((t) => `"${t}"`).join(" OR ");
      } else {
        // contains / fuzzy — use plain KQL terms
        search = terms.join(" OR ");
      }
    }

    // Subject identifier — search for messages from/to the data subject
    const primaryId = querySpec.subjectIdentifiers.primary;
    if (primaryId.type === "email" || primaryId.type === "upn") {
      // Include messages where the subject is sender or recipient
      const emailVal = primaryId.value;
      const subjectFilter =
        `(from/emailAddress/address eq '${emailVal}' or ` +
        `toRecipients/any(r: r/emailAddress/address eq '${emailVal}'))`;
      filterParts.push(subjectFilter);
    }

    return {
      filter: filterParts.length > 0 ? filterParts.join(" and ") : undefined,
      search,
    };
  }

  /**
   * Search a single mailbox, optionally scoped to specific folders.
   * Returns counts of matched messages, attachments, and skipped items.
   */
  private async searchMailbox(
    accessToken: string,
    mailbox: string,
    folderScope: ExchangeOnlineScope["folderScope"],
    filterSpec: { filter?: string; search?: string },
    maxItems: number,
    includeAttachments: boolean
  ): Promise<{ matched: number; attachments: number; skipped: number }> {
    // Determine which folder endpoints to query
    const folderEndpoints = this.buildFolderEndpoints(mailbox, folderScope);

    let totalMatched = 0;
    let totalAttachments = 0;
    let totalSkipped = 0;

    for (const endpoint of folderEndpoints) {
      if (totalMatched >= maxItems) break;

      const remaining = maxItems - totalMatched;
      const pageSize = Math.min(remaining, MAX_PAGE_SIZE);
      const result = await this.fetchMessages(
        accessToken,
        endpoint,
        filterSpec,
        pageSize,
        remaining,
        includeAttachments
      );

      totalMatched += result.matched;
      totalAttachments += result.attachments;
      totalSkipped += result.skipped;
    }

    return {
      matched: totalMatched,
      attachments: totalAttachments,
      skipped: totalSkipped,
    };
  }

  /**
   * Build Graph API endpoint paths based on the folder scope.
   * For "all", use the top-level messages endpoint.
   * For specific folders, use the well-known folder name.
   */
  private buildFolderEndpoints(
    mailbox: string,
    folderScope: ExchangeOnlineScope["folderScope"]
  ): string[] {
    const encodedMailbox = encodeURIComponent(mailbox);

    if (folderScope === "all") {
      return [`${GRAPH_BASE_URL}/users/${encodedMailbox}/messages`];
    }

    const wellKnownName = FOLDER_FILTER_MAP[folderScope];
    if (wellKnownName) {
      return [
        `${GRAPH_BASE_URL}/users/${encodedMailbox}/mailFolders/${wellKnownName}/messages`,
      ];
    }

    // Fallback to all messages if scope is not recognized
    return [`${GRAPH_BASE_URL}/users/${encodedMailbox}/messages`];
  }

  /**
   * Fetch messages from a Graph API endpoint, handling pagination up to
   * the specified limit.
   */
  private async fetchMessages(
    accessToken: string,
    baseUrl: string,
    filterSpec: { filter?: string; search?: string },
    pageSize: number,
    maxItems: number,
    includeAttachments: boolean
  ): Promise<{ matched: number; attachments: number; skipped: number }> {
    let matched = 0;
    let attachments = 0;
    let skipped = 0;

    // Build initial URL with query parameters
    const params = new URLSearchParams();
    params.set("$top", String(pageSize));
    params.set("$count", "true");
    params.set(
      "$select",
      "id,subject,from,toRecipients,receivedDateTime,sentDateTime,hasAttachments,bodyPreview"
    );
    params.set("$orderby", "receivedDateTime desc");

    if (filterSpec.filter) {
      params.set("$filter", filterSpec.filter);
    }

    if (filterSpec.search) {
      params.set("$search", `"${filterSpec.search}"`);
    }

    let url: string | null = `${baseUrl}?${params.toString()}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      ConsistencyLevel: "eventual",
    };

    while (url && matched < maxItems) {
      const response = await fetch(url, { headers });

      if (!response.ok) {
        const statusCode = response.status;
        if (statusCode === 404) {
          // Mailbox or folder not found — skip gracefully
          skipped++;
          break;
        }
        throw new Error(
          `Graph API error ${statusCode}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as GraphMessagesResponse;
      const messages = data.value ?? [];

      for (const message of messages) {
        if (matched >= maxItems) {
          skipped += messages.length - messages.indexOf(message);
          break;
        }

        matched++;

        if (includeAttachments && message.hasAttachments) {
          attachments++;
        }
      }

      // Follow pagination link if present and we need more items
      url = matched < maxItems ? (data["@odata.nextLink"] ?? null) : null;
    }

    return { matched, attachments, skipped };
  }
}
