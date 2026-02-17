import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";
import { retrieveSecret } from "@/lib/secret-store";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import type { QuerySpec } from "@/lib/query-spec";

/* ── Microsoft Graph response types ──────────────────────────────────── */

interface GraphTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface GraphTokenError {
  error: string;
  error_description?: string;
}

interface DriveItem {
  id: string;
  name: string;
  size?: number;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  file?: { mimeType?: string };
  folder?: { childCount?: number };
  createdBy?: { user?: { displayName?: string; email?: string } };
  lastModifiedBy?: { user?: { displayName?: string; email?: string } };
}

interface DriveItemsResponse {
  value: DriveItem[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

/* ── Constants ───────────────────────────────────────────────────────── */

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const TOKEN_URL_TEMPLATE = "https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token";
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const MAX_PAGE_SIZE = 200;

/**
 * OneDrive for Business Connector
 *
 * Uses Microsoft Graph API to access user OneDrive data for DSAR purposes.
 * Supports listing files, searching by name/content, and filtering by folder path.
 *
 * Required Graph API permissions (application):
 *   - Files.Read.All (read all users' OneDrive files)
 *   - User.Read.All (resolve user identifiers)
 */
export class OneDriveConnector implements Connector {
  provider = "ONEDRIVE";

  /* ── Config fields ───────────────────────────────────────────────── */

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
        description: "App registration client ID with Files.Read.All permission",
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
    ];
  }

  /* ── Query templates ─────────────────────────────────────────────── */

  getQueryTemplates(): QueryTemplate[] {
    return [
      {
        id: "onedrive_user_drive",
        name: "OneDrive User Drive Search",
        description:
          "Search a user's OneDrive for Business files. Returns file metadata including name, size, last modified date, and web URL.",
        scopeFields: [
          {
            key: "folderPath",
            label: "Folder Path",
            type: "text",
            required: false,
            placeholder: "/Documents/Projects",
            description:
              "Optional folder path to limit search scope (e.g. /Documents/HR). Leave empty to search entire drive.",
          },
        ],
        defaultScope: {
          userDrive: true,
        },
      },
    ];
  }

  /* ── Health check ────────────────────────────────────────────────── */

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
      const clientSecret = await retrieveSecret(secretRef);
      const tokenResult = await this.acquireToken(tenantId, clientId, clientSecret);

      if (!tokenResult.success) {
        return {
          healthy: false,
          message: `Token acquisition failed: ${tokenResult.error}`,
          details: { statusCode: tokenResult.statusCode ?? 0 },
          checkedAt: now,
        };
      }

      const { accessToken } = tokenResult;

      // Verify token works by calling the /organization endpoint
      const orgResponse = await fetch(`${GRAPH_BASE_URL}/organization`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!orgResponse.ok) {
        return {
          healthy: false,
          message: `Graph API call failed: ${orgResponse.statusText}`,
          details: { statusCode: orgResponse.status },
          checkedAt: now,
        };
      }

      return {
        healthy: true,
        message: "Connected to OneDrive via Microsoft Graph API successfully",
        details: { tokenAcquired: true, organizationAccessible: true },
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

  /* ── Data collection ─────────────────────────────────────────────── */

  async collectData(
    config: ConnectorConfig,
    secretRef: string | null,
    querySpec: QuerySpec
  ): Promise<CollectionResult> {
    const result = createPendingResult("ONEDRIVE", "user_drive");

    if (!secretRef) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "No credentials configured",
        resultMetadata: completeResult(result, {
          status: "failed",
          errorMessage: "Missing client secret",
        }),
        error: "Missing client secret",
      };
    }

    const tenantId = config.tenantId as string;
    const clientId = config.clientId as string;

    if (!tenantId || !clientId) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "Missing required configuration: tenantId and clientId",
        resultMetadata: completeResult(result, {
          status: "failed",
          errorMessage: "Missing tenantId or clientId",
        }),
        error: "Missing tenantId or clientId",
      };
    }

    try {
      const clientSecret = await retrieveSecret(secretRef);
      const tokenResult = await this.acquireToken(tenantId, clientId, clientSecret);

      if (!tokenResult.success) {
        const tokenError = tokenResult.error;
        return {
          success: false,
          recordsFound: 0,
          findingsSummary: "Failed to authenticate with Microsoft Graph",
          resultMetadata: completeResult(result, {
            status: "failed",
            errorMessage: `Token acquisition failed: ${tokenError}`,
          }),
          error: `Token acquisition failed: ${tokenError}`,
        };
      }

      const { accessToken } = tokenResult;

      // Resolve user identifier
      const userIdentifier = this.resolveUserIdentifier(querySpec);
      if (!userIdentifier) {
        return {
          success: false,
          recordsFound: 0,
          findingsSummary: "No valid user identifier found in query spec",
          resultMetadata: completeResult(result, {
            status: "failed",
            errorMessage:
              "Subject identifier must be email, upn, or objectId to query OneDrive",
          }),
          error: "No valid user identifier for OneDrive lookup",
        };
      }

      // Extract scope options
      const scope = querySpec.providerScope as {
        userDrive?: boolean;
        folderPath?: string;
      };
      const folderPath = scope?.folderPath ?? null;
      const maxItems = querySpec.outputOptions?.maxItems ?? 500;
      const searchTerms = querySpec.searchTerms?.terms ?? [];

      // Collect files from user's OneDrive
      let allItems: DriveItem[];

      if (searchTerms.length > 0) {
        allItems = await this.searchDriveFiles(
          accessToken,
          userIdentifier,
          searchTerms,
          querySpec.searchTerms?.matchType ?? "contains",
          maxItems
        );
      } else {
        allItems = await this.listDriveFiles(
          accessToken,
          userIdentifier,
          folderPath,
          maxItems
        );
      }

      // Apply time range filter if specified
      const filteredItems = this.applyTimeRangeFilter(
        allItems,
        querySpec.timeRange
      );

      const skippedCount = allItems.length - filteredItems.length;

      // Build file metadata list for the result
      const fileMetadata = filteredItems.map((item) => ({
        name: item.name,
        size: item.size ?? 0,
        lastModified: item.lastModifiedDateTime ?? null,
        webUrl: item.webUrl ?? null,
        mimeType: item.file?.mimeType ?? (item.folder ? "folder" : "unknown"),
        isFolder: !!item.folder,
        createdAt: item.createdDateTime ?? null,
        modifiedBy: item.lastModifiedBy?.user?.displayName ?? null,
      }));

      // Build artifacts
      const artifacts = [
        {
          type: "metadata_json" as const,
          filename: `onedrive_${userIdentifier.replace(/[^a-zA-Z0-9]/g, "_")}_files.json`,
          mimeType: "application/json",
          size: JSON.stringify(fileMetadata).length,
          description: `OneDrive file listing for ${userIdentifier} (${filteredItems.length} items)`,
        },
      ];

      const completedResult = completeResult(result, {
        status: filteredItems.length > 0 ? "success" : "success",
        counts: {
          matched: filteredItems.length,
          exported: filteredItems.length,
          attachments: 0,
          skipped: skippedCount,
        },
        artifacts,
        notes: folderPath
          ? `Scoped to folder: ${folderPath}`
          : "Searched entire user drive",
      });

      return {
        success: true,
        recordsFound: filteredItems.length,
        findingsSummary: this.buildSummary(
          userIdentifier,
          filteredItems.length,
          folderPath,
          searchTerms,
          skippedCount
        ),
        resultMetadata: completedResult,
      };
    } catch (error) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        resultMetadata: completeResult(result, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        }),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /* ── Private helpers ─────────────────────────────────────────────── */

  /**
   * Acquire an OAuth2 access token using client credentials flow.
   */
  private async acquireToken(
    tenantId: string,
    clientId: string,
    clientSecret: string
  ): Promise<
    | { success: true; accessToken: string }
    | { success: false; error: string; statusCode?: number }
  > {
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
      return {
        success: false,
        error: errorData.error_description || response.statusText,
        statusCode: response.status,
      };
    }

    const tokenData = (await response.json()) as GraphTokenResponse;
    return { success: true, accessToken: tokenData.access_token };
  }

  /**
   * Resolve the user identifier from the QuerySpec subject identifiers.
   * OneDrive Graph API accepts email, UPN, or object ID.
   */
  private resolveUserIdentifier(querySpec: QuerySpec): string | null {
    const primary = querySpec.subjectIdentifiers.primary;
    const validTypes = ["email", "upn", "objectId"];

    if (validTypes.includes(primary.type)) {
      return primary.value;
    }

    // Check alternative identifiers for a usable type
    const alternatives = querySpec.subjectIdentifiers.alternatives ?? [];
    for (const alt of alternatives) {
      if (validTypes.includes(alt.type)) {
        return alt.value;
      }
    }

    return null;
  }

  /**
   * List files in a user's OneDrive, optionally scoped to a folder path.
   * Paginates through results up to maxItems.
   */
  private async listDriveFiles(
    accessToken: string,
    userIdentifier: string,
    folderPath: string | null,
    maxItems: number
  ): Promise<DriveItem[]> {
    const encodedUser = encodeURIComponent(userIdentifier);
    let url: string;

    if (folderPath) {
      // Normalize path: ensure leading slash, remove trailing slash
      const normalizedPath = folderPath.startsWith("/")
        ? folderPath
        : `/${folderPath}`;
      const cleanPath = normalizedPath.replace(/\/+$/, "");
      url =
        `${GRAPH_BASE_URL}/users/${encodedUser}/drive/root:${cleanPath}:/children` +
        `?$top=${Math.min(maxItems, MAX_PAGE_SIZE)}` +
        `&$select=id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,folder,createdBy,lastModifiedBy`;
    } else {
      url =
        `${GRAPH_BASE_URL}/users/${encodedUser}/drive/root/children` +
        `?$top=${Math.min(maxItems, MAX_PAGE_SIZE)}` +
        `&$select=id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,folder,createdBy,lastModifiedBy`;
    }

    return this.fetchAllPages(accessToken, url, maxItems);
  }

  /**
   * Search a user's OneDrive files using the Microsoft Graph search API.
   */
  private async searchDriveFiles(
    accessToken: string,
    userIdentifier: string,
    terms: string[],
    matchType: "exact" | "fuzzy" | "contains",
    maxItems: number
  ): Promise<DriveItem[]> {
    const encodedUser = encodeURIComponent(userIdentifier);

    // Build the search query string based on match type
    let searchQuery: string;
    switch (matchType) {
      case "exact":
        searchQuery = terms.map((t) => `"${t}"`).join(" ");
        break;
      case "fuzzy":
        searchQuery = terms.join(" ");
        break;
      case "contains":
      default:
        searchQuery = terms.join(" ");
        break;
    }

    // Use the Graph search endpoint on the user's drive
    const searchUrl =
      `${GRAPH_BASE_URL}/users/${encodedUser}/drive/root/search(q='${encodeURIComponent(searchQuery)}')` +
      `?$top=${Math.min(maxItems, MAX_PAGE_SIZE)}` +
      `&$select=id,name,size,webUrl,createdDateTime,lastModifiedDateTime,file,folder,createdBy,lastModifiedBy`;

    return this.fetchAllPages(accessToken, searchUrl, maxItems);
  }

  /**
   * Fetch all pages of a Graph API list endpoint up to maxItems.
   */
  private async fetchAllPages(
    accessToken: string,
    initialUrl: string,
    maxItems: number
  ): Promise<DriveItem[]> {
    const allItems: DriveItem[] = [];
    let nextUrl: string | null = initialUrl;

    while (nextUrl && allItems.length < maxItems) {
      const response = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        // If user or drive not found, return empty rather than throwing
        if (response.status === 404) {
          return [];
        }
        throw new Error(
          `Graph API returned ${response.status}: ${response.statusText}`
        );
      }

      const data = (await response.json()) as DriveItemsResponse;
      const items = data.value ?? [];
      allItems.push(...items);

      // Follow pagination if more results exist
      nextUrl = data["@odata.nextLink"] ?? null;

      // Stop if we have enough items
      if (allItems.length >= maxItems) {
        break;
      }
    }

    // Trim to maxItems
    return allItems.slice(0, maxItems);
  }

  /**
   * Filter items by the time range specified in the QuerySpec.
   * Compares against lastModifiedDateTime.
   */
  private applyTimeRangeFilter(
    items: DriveItem[],
    timeRange?: { from?: string; to?: string }
  ): DriveItem[] {
    if (!timeRange) {
      return items;
    }

    const fromDate = timeRange.from ? new Date(timeRange.from) : null;
    const toDate = timeRange.to ? new Date(timeRange.to) : null;

    return items.filter((item) => {
      if (!item.lastModifiedDateTime) {
        // If no modification date, include the item (err on the side of disclosure)
        return true;
      }

      const modified = new Date(item.lastModifiedDateTime);

      if (fromDate && modified < fromDate) {
        return false;
      }
      if (toDate && modified > toDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Build a human-readable summary of the collection results.
   */
  private buildSummary(
    userIdentifier: string,
    matchedCount: number,
    folderPath: string | null,
    searchTerms: string[],
    skippedCount: number
  ): string {
    const parts: string[] = [];

    parts.push(
      `Found ${matchedCount} file(s) in OneDrive for ${userIdentifier}`
    );

    if (folderPath) {
      parts.push(`scoped to folder: ${folderPath}`);
    }

    if (searchTerms.length > 0) {
      parts.push(`matching search: "${searchTerms.join(", ")}"`);
    }

    if (skippedCount > 0) {
      parts.push(`(${skippedCount} item(s) excluded by time range filter)`);
    }

    return parts.join(" ");
  }
}
