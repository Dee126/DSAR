import type { Connector, ConnectorConfig, HealthCheckResult, CollectionResult, ConfigField, QueryTemplate } from "./types";
import { retrieveSecret } from "@/lib/secret-store";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import type { QuerySpec } from "@/lib/query-spec";

/**
 * SharePoint Connector
 *
 * Uses Microsoft Graph API to access SharePoint sites and drives.
 * Can share credentials with M365 (same app registration) or use separate ones.
 *
 * Reads provider-specific scope from QuerySpec.providerScope:
 *   - siteIds: string[]       SharePoint site IDs to search
 *   - drivePath?: string      Optional path within a drive
 *   - fileTypes?: string[]    Optional file type filter (e.g., ["docx", "pdf"])
 */
export class SharePointConnector implements Connector {
  provider = "SHAREPOINT";

  /* ── Config fields (for integration setup UI) ────────────────────────── */

  getConfigFields(): ConfigField[] {
    return [
      {
        key: "tenantId",
        label: "Directory (Tenant) ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        description: "Azure AD tenant ID",
      },
      {
        key: "clientId",
        label: "Application (Client) ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        description: "App registration client ID (can be same as M365)",
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        required: true,
        placeholder: "Enter client secret",
        description: "App registration client secret",
        isSecret: true,
      },
      {
        key: "allowedSiteIds",
        label: "Allowed Site IDs / URLs",
        type: "textarea",
        required: false,
        placeholder: "site-id-1, https://company.sharepoint.com/sites/finance",
        description: "Restrict to specific SharePoint sites (leave empty for all)",
      },
    ];
  }

  /* ── Query templates (new shape with scopeFields / defaultScope) ────── */

  getQueryTemplates(): QueryTemplate[] {
    return [
      {
        id: "sharepoint_site_search",
        name: "Search files in a SharePoint site",
        description: "Search files within one or more SharePoint sites, optionally filtered by path and file type",
        scopeFields: [
          {
            key: "siteIds",
            label: "Site IDs",
            type: "textarea",
            required: true,
            placeholder: "site-id-1\nsite-id-2",
            description: "SharePoint site IDs to search (one per line or comma-separated)",
          },
          {
            key: "drivePath",
            label: "Drive / Folder Path",
            type: "text",
            required: false,
            placeholder: "/Documents/HR/Personnel Files",
            description: "Optional path within the default document library",
          },
          {
            key: "fileTypes",
            label: "File Types",
            type: "textarea",
            required: false,
            placeholder: "docx\npdf\nxlsx",
            description: "Limit to specific file extensions (one per line or comma-separated)",
          },
        ],
        defaultScope: { siteIds: [], fileTypes: [] },
      },
      {
        id: "sharepoint_site_list",
        name: "List all accessible SharePoint sites",
        description: "Enumerate SharePoint sites the integration has access to",
        scopeFields: [],
        defaultScope: { siteIds: [] },
      },
    ];
  }

  /* ── Health check ───────────────────────────────────────────────────── */

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

      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }),
        }
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        return {
          healthy: false,
          message: `Token acquisition failed: ${(errorData as Record<string, string>).error_description || tokenResponse.statusText}`,
          checkedAt: now,
        };
      }

      const { access_token } = (await tokenResponse.json()) as { access_token: string };

      // Verify SharePoint access by listing sites
      const sitesResponse = await fetch(
        "https://graph.microsoft.com/v1.0/sites?search=*&$top=1",
        { headers: { Authorization: `Bearer ${access_token}` } }
      );

      if (!sitesResponse.ok) {
        return {
          healthy: false,
          message: `SharePoint sites not accessible: ${sitesResponse.statusText}`,
          details: { statusCode: sitesResponse.status },
          checkedAt: now,
        };
      }

      return {
        healthy: true,
        message: "Connected to SharePoint via Microsoft Graph successfully",
        details: { tokenAcquired: true, sitesAccessible: true },
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

  /* ── Data collection (uses QuerySpec) ──────────────────────────────── */

  async collectData(
    config: ConnectorConfig,
    secretRef: string | null,
    querySpec: QuerySpec
  ): Promise<CollectionResult> {
    const workload = querySpec.templateId ?? "sharepoint_site_search";
    const result = createPendingResult(this.provider, workload);

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

    try {
      const clientSecret = await retrieveSecret(secretRef);
      const tenantId = config.tenantId as string;
      const clientId = config.clientId as string;

      const tokenResponse = await fetch(
        `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
        {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
          }),
        }
      );

      if (!tokenResponse.ok) {
        return {
          success: false,
          recordsFound: 0,
          findingsSummary: "Authentication failed",
          resultMetadata: completeResult(result, {
            status: "failed",
            errorMessage: "Token acquisition failed",
          }),
          error: "Token acquisition failed",
        };
      }

      const { access_token } = (await tokenResponse.json()) as { access_token: string };
      const templateId = querySpec.templateId;

      if (templateId === "sharepoint_site_list") {
        return await this.listSites(access_token, result);
      }

      // Default to site search (covers "sharepoint_site_search" and unset templateId)
      return await this.searchSites(access_token, querySpec, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Collection failed: ${message}`,
        resultMetadata: completeResult(result, {
          status: "failed",
          errorMessage: message,
        }),
        error: message,
      };
    }
  }

  /* ── Private: list all accessible sites ────────────────────────────── */

  private async listSites(
    accessToken: string,
    pendingResult: ReturnType<typeof createPendingResult>
  ): Promise<CollectionResult> {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/sites?search=*&$top=100",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "Failed to list sites",
        resultMetadata: completeResult(pendingResult, {
          status: "failed",
          errorMessage: `Graph API error: ${response.status}`,
        }),
        error: `Graph API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      value: Array<{ displayName?: string; webUrl?: string; id?: string }>;
    };
    const sites = data.value ?? [];

    return {
      success: true,
      recordsFound: sites.length,
      findingsSummary: `Found ${sites.length} SharePoint site(s)`,
      resultMetadata: completeResult(pendingResult, {
        counts: { matched: sites.length, exported: sites.length, attachments: 0, skipped: 0 },
        artifacts: [
          {
            type: "metadata_json",
            filename: "sharepoint_sites.json",
            mimeType: "application/json",
            description: `Index of ${sites.length} SharePoint site(s)`,
          },
        ],
        notes: sites
          .slice(0, 10)
          .map((s) => `${s.displayName ?? "(unnamed)"} — ${s.id ?? ""}`)
          .join("; "),
      }),
    };
  }

  /* ── Private: search files across one or more sites ────────────────── */

  private async searchSites(
    accessToken: string,
    querySpec: QuerySpec,
    pendingResult: ReturnType<typeof createPendingResult>
  ): Promise<CollectionResult> {
    // Extract scope from providerScope
    const scope = querySpec.providerScope as {
      siteIds?: string[];
      drivePath?: string;
      fileTypes?: string[];
    };
    const siteIds = scope.siteIds ?? [];
    const drivePath = scope.drivePath;
    const fileTypes = scope.fileTypes ?? [];

    if (siteIds.length === 0) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "No site IDs provided in providerScope",
        resultMetadata: completeResult(pendingResult, {
          status: "failed",
          errorMessage: "providerScope.siteIds must contain at least one site ID",
        }),
        error: "providerScope.siteIds must contain at least one site ID",
      };
    }

    // Build search term filter from QuerySpec.searchTerms
    const searchFilter = this.buildSearchFilter(querySpec);

    // Build date filter from QuerySpec.timeRange
    const dateFilter = this.buildDateFilter(querySpec);

    // Respect output options
    const maxItems = querySpec.outputOptions?.maxItems ?? 500;

    let totalMatched = 0;
    let totalExported = 0;
    let totalSkipped = 0;
    const allItems: Array<{ name?: string; size?: number; url?: string; isFile: boolean; siteId: string }> = [];
    const errors: string[] = [];

    for (const siteId of siteIds) {
      try {
        const siteItems = await this.fetchSiteItems(
          accessToken,
          siteId,
          drivePath,
          searchFilter,
          dateFilter,
          fileTypes,
          maxItems - totalExported
        );
        totalMatched += siteItems.matched;
        totalExported += siteItems.items.length;
        totalSkipped += siteItems.skipped;
        allItems.push(
          ...siteItems.items.map((item) => ({ ...item, siteId }))
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Site ${siteId}: ${message}`);
      }

      // Stop collecting once we have reached maxItems
      if (totalExported >= maxItems) {
        break;
      }
    }

    const hasErrors = errors.length > 0;
    const status = hasErrors && totalExported === 0 ? "failed" : hasErrors ? "partial" : "success";

    const summaryParts = [
      `Found ${totalMatched} item(s) across ${siteIds.length} site(s)`,
      totalExported !== totalMatched ? `exported ${totalExported}` : null,
      totalSkipped > 0 ? `skipped ${totalSkipped}` : null,
      drivePath ? `path: ${drivePath}` : null,
    ].filter(Boolean);

    const artifacts: Array<{
      type: "index_csv" | "export_zip" | "document" | "log" | "metadata_json";
      filename: string;
      mimeType?: string;
      description?: string;
    }> = [
      {
        type: "metadata_json",
        filename: "sharepoint_search_results.json",
        mimeType: "application/json",
        description: `Search results index with ${totalExported} item(s)`,
      },
    ];

    if (hasErrors) {
      artifacts.push({
        type: "log",
        filename: "sharepoint_errors.log",
        mimeType: "text/plain",
        description: `${errors.length} error(s) during collection`,
      });
    }

    return {
      success: status !== "failed",
      recordsFound: totalMatched,
      findingsSummary: summaryParts.join(", "),
      resultMetadata: completeResult(pendingResult, {
        status,
        counts: {
          matched: totalMatched,
          exported: totalExported,
          attachments: 0,
          skipped: totalSkipped,
        },
        artifacts,
        notes: errors.length > 0 ? errors.join("; ") : undefined,
        errorMessage: status === "failed" ? errors.join("; ") : undefined,
      }),
    };
  }

  /* ── Private: fetch items from a single site ───────────────────────── */

  private async fetchSiteItems(
    accessToken: string,
    siteId: string,
    drivePath: string | undefined,
    searchFilter: string | undefined,
    dateFilter: { from?: string; to?: string } | undefined,
    fileTypes: string[],
    limit: number
  ): Promise<{
    matched: number;
    skipped: number;
    items: Array<{ name?: string; size?: number; url?: string; isFile: boolean }>;
  }> {
    const top = Math.min(Math.max(limit, 1), 200);

    // If we have search terms, use the Graph search endpoint for the site's drive
    if (searchFilter) {
      return this.searchSiteDrive(accessToken, siteId, searchFilter, dateFilter, fileTypes, top);
    }

    // Otherwise list drive children at the given path
    let url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drive`;
    if (drivePath) {
      url += `/root:${drivePath}:/children`;
    } else {
      url += "/root/children";
    }
    url += `?$top=${top}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Graph API error ${response.status} for site ${siteId}`);
    }

    const data = (await response.json()) as {
      value: Array<{
        name?: string;
        size?: number;
        webUrl?: string;
        file?: { mimeType?: string };
        lastModifiedDateTime?: string;
      }>;
    };

    let items = data.value ?? [];

    // Apply date filter client-side for listing (Graph doesn't support $filter on children easily)
    if (dateFilter) {
      items = items.filter((item) => {
        if (!item.lastModifiedDateTime) return true;
        const modified = new Date(item.lastModifiedDateTime);
        if (dateFilter.from && modified < new Date(dateFilter.from)) return false;
        if (dateFilter.to && modified > new Date(dateFilter.to)) return false;
        return true;
      });
    }

    // Apply file type filter
    if (fileTypes.length > 0) {
      const extensions = new Set(fileTypes.map((ft) => ft.toLowerCase().replace(/^\./, "")));
      items = items.filter((item) => {
        if (!item.file || !item.name) return false;
        const ext = item.name.split(".").pop()?.toLowerCase();
        return ext ? extensions.has(ext) : false;
      });
    }

    const matched = items.length;

    return {
      matched,
      skipped: 0,
      items: items.map((i) => ({
        name: i.name,
        size: i.size,
        url: i.webUrl,
        isFile: !!i.file,
      })),
    };
  }

  /* ── Private: search a site's drive using Graph search ─────────────── */

  private async searchSiteDrive(
    accessToken: string,
    siteId: string,
    searchFilter: string,
    dateFilter: { from?: string; to?: string } | undefined,
    fileTypes: string[],
    top: number
  ): Promise<{
    matched: number;
    skipped: number;
    items: Array<{ name?: string; size?: number; url?: string; isFile: boolean }>;
  }> {
    const url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drive/root/search(q='${encodeURIComponent(searchFilter)}')?$top=${top}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new Error(`Graph search error ${response.status} for site ${siteId}`);
    }

    const data = (await response.json()) as {
      value: Array<{
        name?: string;
        size?: number;
        webUrl?: string;
        file?: { mimeType?: string };
        lastModifiedDateTime?: string;
      }>;
    };

    let items = data.value ?? [];
    const totalBeforeFilters = items.length;

    // Apply date filter
    if (dateFilter) {
      items = items.filter((item) => {
        if (!item.lastModifiedDateTime) return true;
        const modified = new Date(item.lastModifiedDateTime);
        if (dateFilter.from && modified < new Date(dateFilter.from)) return false;
        if (dateFilter.to && modified > new Date(dateFilter.to)) return false;
        return true;
      });
    }

    // Apply file type filter
    if (fileTypes.length > 0) {
      const extensions = new Set(fileTypes.map((ft) => ft.toLowerCase().replace(/^\./, "")));
      items = items.filter((item) => {
        if (!item.name) return false;
        const ext = item.name.split(".").pop()?.toLowerCase();
        return ext ? extensions.has(ext) : false;
      });
    }

    const skipped = totalBeforeFilters - items.length;

    return {
      matched: items.length,
      skipped,
      items: items.map((i) => ({
        name: i.name,
        size: i.size,
        url: i.webUrl,
        isFile: !!i.file,
      })),
    };
  }

  /* ── Private: build a search string from QuerySpec.searchTerms ─────── */

  private buildSearchFilter(querySpec: QuerySpec): string | undefined {
    if (!querySpec.searchTerms) return undefined;

    const { terms, matchType } = querySpec.searchTerms;
    if (!terms || terms.length === 0) return undefined;

    // Graph drive search uses a simple query string; exact/fuzzy distinction
    // is best-effort — Graph's search is always somewhat fuzzy.
    switch (matchType) {
      case "exact":
        // Wrap each term in quotes for exact matching
        return terms.map((t) => `"${t}"`).join(" ");
      case "fuzzy":
      case "contains":
      default:
        return terms.join(" ");
    }
  }

  /* ── Private: extract date filter from QuerySpec.timeRange ─────────── */

  private buildDateFilter(
    querySpec: QuerySpec
  ): { from?: string; to?: string } | undefined {
    if (!querySpec.timeRange) return undefined;

    const { from, to } = querySpec.timeRange;
    if (!from && !to) return undefined;

    return { from, to };
  }
}
