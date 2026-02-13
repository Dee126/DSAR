import { retrieveSecret } from "../secret-store";
import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";

/**
 * SharePoint Connector
 *
 * Uses Microsoft Graph API to access SharePoint sites and drives.
 * Can share credentials with M365 (same app registration) or use separate ones.
 */
export class SharePointConnector implements Connector {
  provider = "SHAREPOINT";

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

  getQueryTemplates(): QueryTemplate[] {
    return [
      {
        id: "site_search",
        name: "Site File Search",
        description: "Search files within a SharePoint site or drive",
        fields: [
          {
            key: "siteId",
            label: "Site ID or URL",
            type: "text",
            required: true,
            placeholder: "site-id or https://company.sharepoint.com/sites/...",
          },
          {
            key: "drivePath",
            label: "Drive / Folder Path",
            type: "text",
            required: false,
            placeholder: "/Documents/HR/Personnel Files",
          },
          {
            key: "searchTerms",
            label: "Search Keywords",
            type: "text",
            required: false,
            placeholder: "keyword or filename",
          },
        ],
      },
      {
        id: "site_list",
        name: "List Sites",
        description: "List all accessible SharePoint sites",
        fields: [],
      },
    ];
  }

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

  async collectData(
    config: ConnectorConfig,
    secretRef: string | null,
    querySpec: Record<string, unknown>
  ): Promise<CollectionResult> {
    if (!secretRef) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "No credentials configured",
        resultMetadata: {},
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
          resultMetadata: {},
          error: "Token acquisition failed",
        };
      }

      const { access_token } = (await tokenResponse.json()) as { access_token: string };
      const templateId = querySpec.templateId as string;

      if (templateId === "site_list") {
        return await this.listSites(access_token);
      }

      if (templateId === "site_search") {
        return await this.searchSite(access_token, querySpec);
      }

      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "Unknown query template",
        resultMetadata: {},
        error: `Unknown template: ${templateId}`,
      };
    } catch (error) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Collection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        resultMetadata: {},
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async listSites(accessToken: string): Promise<CollectionResult> {
    const response = await fetch(
      "https://graph.microsoft.com/v1.0/sites?search=*&$top=100",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "Failed to list sites",
        resultMetadata: {},
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
      resultMetadata: {
        sites: sites.map((s) => ({
          name: s.displayName,
          url: s.webUrl,
          id: s.id,
        })),
      },
    };
  }

  private async searchSite(
    accessToken: string,
    querySpec: Record<string, unknown>
  ): Promise<CollectionResult> {
    const siteId = querySpec.siteId as string;
    const searchTerms = querySpec.searchTerms as string | undefined;
    const drivePath = querySpec.drivePath as string | undefined;

    let url = `https://graph.microsoft.com/v1.0/sites/${encodeURIComponent(siteId)}/drive`;

    if (drivePath) {
      url += `/root:${drivePath}:/children`;
    } else {
      url += "/root/children";
    }
    url += "?$top=100";

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Failed to access site: ${siteId}`,
        resultMetadata: {},
        error: `Graph API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      value: Array<{ name?: string; size?: number; webUrl?: string; file?: object }>;
    };
    let items = data.value ?? [];

    if (searchTerms) {
      const terms = searchTerms.toLowerCase();
      items = items.filter((item) =>
        item.name?.toLowerCase().includes(terms)
      );
    }

    return {
      success: true,
      recordsFound: items.length,
      findingsSummary: `Found ${items.length} item(s) in ${siteId}${drivePath ? ` at ${drivePath}` : ""}`,
      resultMetadata: {
        siteId,
        drivePath,
        searchTerms,
        items: items.slice(0, 20).map((i) => ({
          name: i.name,
          size: i.size,
          url: i.webUrl,
          isFile: !!i.file,
        })),
      },
    };
  }
}
