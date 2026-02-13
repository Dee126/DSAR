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
 * Microsoft 365 Connector
 *
 * Uses OAuth2 client credentials flow with Microsoft Graph API.
 * Config: { tenantId, clientId, allowedScopes?, allowedMailboxes? }
 * Secret: clientSecret (encrypted via SecretStore)
 */
export class M365Connector implements Connector {
  provider = "M365";

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
        description: "App registration client ID",
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
        key: "allowedScopes",
        label: "Scopes",
        type: "textarea",
        required: false,
        placeholder: "Mail.Read, User.Read.All",
        description: "Comma-separated list of admin-consented Graph API scopes",
      },
      {
        key: "allowedMailboxes",
        label: "Allowed Mailboxes",
        type: "textarea",
        required: false,
        placeholder: "user1@company.com, user2@company.com",
        description: "Restrict to specific mailboxes (leave empty for all)",
      },
    ];
  }

  getQueryTemplates(): QueryTemplate[] {
    return [
      {
        id: "mailbox_search",
        name: "Mailbox Search",
        description: "Search user mailbox for messages matching criteria",
        fields: [
          {
            key: "mailbox",
            label: "Mailbox",
            type: "text",
            required: true,
            placeholder: "user@company.com",
          },
          {
            key: "searchTerms",
            label: "Search Terms",
            type: "text",
            required: false,
            placeholder: "e.g., subject:DSAR OR from:user@example.com",
          },
          {
            key: "dateFrom",
            label: "From Date",
            type: "text",
            required: false,
            placeholder: "YYYY-MM-DD",
          },
          {
            key: "dateTo",
            label: "To Date",
            type: "text",
            required: false,
            placeholder: "YYYY-MM-DD",
          },
        ],
      },
      {
        id: "user_lookup",
        name: "User Profile Lookup",
        description: "Look up user profile and directory data",
        fields: [
          {
            key: "userIdentifier",
            label: "User Email or ID",
            type: "text",
            required: true,
            placeholder: "user@company.com",
          },
        ],
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
      const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

      const tokenResponse = await fetch(tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json().catch(() => ({}));
        return {
          healthy: false,
          message: `Token acquisition failed: ${(errorData as Record<string, string>).error_description || tokenResponse.statusText}`,
          details: { statusCode: tokenResponse.status },
          checkedAt: now,
        };
      }

      const tokenData = (await tokenResponse.json()) as { access_token: string };

      // Verify token works with a simple call
      const orgResponse = await fetch(
        "https://graph.microsoft.com/v1.0/organization",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );

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
        message: "Connected to Microsoft 365 Graph API successfully",
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

      // Acquire token
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
          findingsSummary: "Failed to authenticate with Microsoft 365",
          resultMetadata: {},
          error: "Token acquisition failed",
        };
      }

      const { access_token } = (await tokenResponse.json()) as { access_token: string };
      const templateId = querySpec.templateId as string;

      if (templateId === "user_lookup") {
        return await this.collectUserData(access_token, querySpec);
      }

      if (templateId === "mailbox_search") {
        return await this.collectMailboxData(access_token, querySpec);
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

  private async collectUserData(
    accessToken: string,
    querySpec: Record<string, unknown>
  ): Promise<CollectionResult> {
    const userIdentifier = querySpec.userIdentifier as string;
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userIdentifier)}?$select=displayName,mail,userPrincipalName,jobTitle,department,officeLocation,mobilePhone,businessPhones`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: true,
          recordsFound: 0,
          findingsSummary: `No user found with identifier: ${userIdentifier}`,
          resultMetadata: { userIdentifier, found: false },
        };
      }
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "Failed to query user data",
        resultMetadata: {},
        error: `Graph API error: ${response.status}`,
      };
    }

    const userData = await response.json();
    return {
      success: true,
      recordsFound: 1,
      findingsSummary: `User profile found: ${(userData as Record<string, string>).displayName}`,
      resultMetadata: {
        userIdentifier,
        found: true,
        fields: Object.keys(userData as object),
      },
    };
  }

  private async collectMailboxData(
    accessToken: string,
    querySpec: Record<string, unknown>
  ): Promise<CollectionResult> {
    const mailbox = querySpec.mailbox as string;
    const searchTerms = querySpec.searchTerms as string | undefined;
    let url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/messages?$top=100&$count=true`;

    if (searchTerms) {
      url += `&$search="${encodeURIComponent(searchTerms)}"`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: "eventual",
      },
    });

    if (!response.ok) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Failed to search mailbox: ${mailbox}`,
        resultMetadata: {},
        error: `Graph API error: ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      value: unknown[];
      "@odata.count"?: number;
    };
    const count = data["@odata.count"] ?? data.value?.length ?? 0;

    return {
      success: true,
      recordsFound: count,
      findingsSummary: `Found ${count} message(s) in mailbox ${mailbox}`,
      resultMetadata: {
        mailbox,
        searchTerms,
        messageCount: count,
        sampleSubjects: (data.value as Array<{ subject?: string }>)
          ?.slice(0, 5)
          .map((m) => m.subject),
      },
    };
  }
}
