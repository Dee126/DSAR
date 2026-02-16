import { decrypt } from "@/lib/security/encryption";
import { createPendingResult, completeResult } from "@/lib/result-metadata";
import type { QuerySpec } from "@/lib/query-spec";
import type { ResultMetadata } from "@/lib/result-metadata";
import type {
  Connector,
  ConnectorConfig,
  HealthCheckResult,
  CollectionResult,
  ConfigField,
  QueryTemplate,
} from "./types";

/* ── Microsoft Graph API response types ──────────────────────────────── */

interface GraphUserProfile {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  givenName: string | null;
  surname: string | null;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  businessPhones: string[];
  companyName: string | null;
  employeeId: string | null;
  accountEnabled: boolean;
  createdDateTime: string | null;
  lastPasswordChangeDateTime: string | null;
}

interface GraphGroup {
  id: string;
  displayName: string;
  description: string | null;
  groupTypes: string[];
  mailEnabled: boolean;
  securityEnabled: boolean;
  mail: string | null;
}

interface GraphSignIn {
  id: string;
  createdDateTime: string;
  userDisplayName: string;
  userPrincipalName: string;
  appDisplayName: string;
  ipAddress: string | null;
  clientAppUsed: string | null;
  status: { errorCode: number; failureReason: string | null };
  location: {
    city: string | null;
    state: string | null;
    countryOrRegion: string | null;
  } | null;
  deviceDetail: {
    displayName: string | null;
    operatingSystem: string | null;
    browser: string | null;
  } | null;
}

interface GraphPagedResponse<T> {
  value: T[];
  "@odata.count"?: number;
  "@odata.nextLink"?: string;
}

/* ── M365 Entra scope type ───────────────────────────────────────────── */

type M365EntraLookupType = "user_profile" | "group_memberships" | "sign_in_logs" | "all";

/* ── Graph API select fields ─────────────────────────────────────────── */

const USER_PROFILE_SELECT = [
  "id",
  "displayName",
  "mail",
  "userPrincipalName",
  "givenName",
  "surname",
  "jobTitle",
  "department",
  "officeLocation",
  "mobilePhone",
  "businessPhones",
  "companyName",
  "employeeId",
  "accountEnabled",
  "createdDateTime",
  "lastPasswordChangeDateTime",
].join(",");

const SIGN_IN_SELECT = [
  "id",
  "createdDateTime",
  "userDisplayName",
  "userPrincipalName",
  "appDisplayName",
  "ipAddress",
  "clientAppUsed",
  "status",
  "location",
  "deviceDetail",
].join(",");

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const GRAPH_BETA_URL = "https://graph.microsoft.com/beta";

/**
 * Microsoft 365 / Entra ID Connector
 *
 * Focuses on Entra ID (Azure AD) user directory data:
 *   - User profile lookup
 *   - Group memberships
 *   - Sign-in logs (audit trail)
 *
 * Uses OAuth2 client credentials flow with Microsoft Graph API.
 * Config: { tenantId, clientId }
 * Secret: clientSecret (encrypted via SecretStore)
 *
 * Required Graph API permissions (application):
 *   - User.Read.All          (user profile)
 *   - GroupMember.Read.All   (group memberships)
 *   - AuditLog.Read.All      (sign-in logs)
 *   - Directory.Read.All     (health check / organization endpoint)
 */
export class M365Connector implements Connector {
  provider = "M365";

  /* ── Config fields (UI form generation) ──────────────────────────── */

  getConfigFields(): ConfigField[] {
    return [
      {
        key: "tenantId",
        label: "Directory (Tenant) ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        description: "Azure AD / Entra ID tenant ID for your organization",
      },
      {
        key: "clientId",
        label: "Application (Client) ID",
        type: "text",
        required: true,
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        description: "App registration client ID with Directory.Read.All, User.Read.All, GroupMember.Read.All, and AuditLog.Read.All permissions",
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
        id: "m365_user_lookup",
        name: "Entra ID User Profile",
        description: "Look up user profile and directory data from Entra ID (Azure AD)",
        scopeFields: [
          {
            key: "lookupType",
            label: "Lookup Type",
            type: "select",
            required: true,
            description: "What directory data to retrieve",
            options: [
              { label: "User Profile", value: "user_profile" },
              { label: "All (Profile + Groups + Sign-ins)", value: "all" },
            ],
          },
        ],
        defaultScope: { lookupType: "user_profile" as M365EntraLookupType },
      },
      {
        id: "m365_group_memberships",
        name: "Entra ID Group Memberships",
        description: "Retrieve the user's group memberships from Entra ID",
        scopeFields: [
          {
            key: "lookupType",
            label: "Lookup Type",
            type: "select",
            required: true,
            description: "What directory data to retrieve",
            options: [
              { label: "Group Memberships", value: "group_memberships" },
            ],
          },
        ],
        defaultScope: { lookupType: "group_memberships" as M365EntraLookupType },
      },
      {
        id: "m365_sign_in_logs",
        name: "Entra ID Sign-in Logs",
        description: "Retrieve the user's sign-in history from Entra ID audit logs",
        scopeFields: [
          {
            key: "lookupType",
            label: "Lookup Type",
            type: "select",
            required: true,
            description: "What directory data to retrieve",
            options: [
              { label: "Sign-in Logs", value: "sign_in_logs" },
            ],
          },
        ],
        defaultScope: { lookupType: "sign_in_logs" as M365EntraLookupType },
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
      const accessToken = await this.acquireToken(tenantId, clientId, secretRef);

      // Verify token works by reading the organization endpoint
      const orgResponse = await fetch(
        `${GRAPH_BASE_URL}/organization`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
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
        message: "Connected to Microsoft Entra ID via Graph API successfully",
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
    const resultMeta = createPendingResult("M365", "entra_id");

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

    const tenantId = config.tenantId as string;
    const clientId = config.clientId as string;

    if (!tenantId || !clientId) {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: "Missing required configuration",
        resultMetadata: completeResult(resultMeta, {
          status: "failed",
          errorMessage: "Missing tenantId or clientId in connector configuration",
        }),
        error: "Missing tenantId or clientId",
      };
    }

    // Resolve subject identifier (email or UPN)
    const primary = querySpec.subjectIdentifiers.primary;
    if (primary.type !== "email" && primary.type !== "upn" && primary.type !== "objectId") {
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Unsupported identifier type: ${primary.type}. M365 Entra ID connector requires email, upn, or objectId.`,
        resultMetadata: completeResult(resultMeta, {
          status: "failed",
          errorMessage: `Unsupported identifier type: ${primary.type}`,
        }),
        error: `Unsupported identifier type: ${primary.type}`,
      };
    }

    const userIdentifier = primary.value;
    const lookupType = (querySpec.providerScope.lookupType as M365EntraLookupType) || "all";
    const maxItems = querySpec.outputOptions?.maxItems ?? 500;

    try {
      const accessToken = await this.acquireToken(tenantId, clientId, secretRef);

      let totalRecords = 0;
      const artifacts: ResultMetadata["artifacts"] = [];
      const summaryParts: string[] = [];

      // User Profile
      if (lookupType === "user_profile" || lookupType === "all") {
        const profileResult = await this.fetchUserProfile(accessToken, userIdentifier);
        if (profileResult.found) {
          totalRecords += 1;
          summaryParts.push(`User profile found: ${profileResult.displayName}`);
          artifacts.push({
            type: "metadata_json",
            filename: `entra_user_profile_${this.sanitizeFilename(userIdentifier)}.json`,
            mimeType: "application/json",
            description: `Entra ID user profile for ${userIdentifier}`,
          });
        } else {
          summaryParts.push(`No user found with identifier: ${userIdentifier}`);
        }
      }

      // Group Memberships
      if (lookupType === "group_memberships" || lookupType === "all") {
        const groupResult = await this.fetchGroupMemberships(accessToken, userIdentifier, maxItems);
        totalRecords += groupResult.count;
        summaryParts.push(`${groupResult.count} group membership(s) found`);
        if (groupResult.count > 0) {
          artifacts.push({
            type: "metadata_json",
            filename: `entra_groups_${this.sanitizeFilename(userIdentifier)}.json`,
            mimeType: "application/json",
            description: `Entra ID group memberships for ${userIdentifier} (${groupResult.count} groups)`,
          });
        }
      }

      // Sign-in Logs
      if (lookupType === "sign_in_logs" || lookupType === "all") {
        const signInResult = await this.fetchSignInLogs(
          accessToken,
          userIdentifier,
          maxItems,
          querySpec.timeRange?.from,
          querySpec.timeRange?.to
        );
        totalRecords += signInResult.count;
        summaryParts.push(`${signInResult.count} sign-in log(s) found`);
        if (signInResult.count > 0) {
          artifacts.push({
            type: "metadata_json",
            filename: `entra_sign_in_logs_${this.sanitizeFilename(userIdentifier)}.json`,
            mimeType: "application/json",
            description: `Entra ID sign-in logs for ${userIdentifier} (${signInResult.count} entries)`,
          });
        }
      }

      return {
        success: true,
        recordsFound: totalRecords,
        findingsSummary: summaryParts.join("; "),
        resultMetadata: completeResult(resultMeta, {
          counts: {
            matched: totalRecords,
            exported: totalRecords,
            attachments: 0,
            skipped: 0,
          },
          artifacts,
          notes: `Entra ID lookup (${lookupType}) for ${userIdentifier}`,
        }),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        recordsFound: 0,
        findingsSummary: `Collection failed: ${message}`,
        resultMetadata: completeResult(resultMeta, {
          status: "failed",
          errorMessage: message,
        }),
        error: message,
      };
    }
  }

  /* ── Private: OAuth2 client credentials token acquisition ────────── */

  private async acquireToken(
    tenantId: string,
    clientId: string,
    secretRef: string
  ): Promise<string> {
    const clientSecret = decrypt(secretRef);
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
      const description =
        (errorData as Record<string, string>).error_description ||
        tokenResponse.statusText;
      throw new Error(`Token acquisition failed (${tokenResponse.status}): ${description}`);
    }

    const tokenData = (await tokenResponse.json()) as { access_token: string };
    return tokenData.access_token;
  }

  /* ── Private: Fetch user profile from Entra ID ─────────────────── */

  private async fetchUserProfile(
    accessToken: string,
    userIdentifier: string
  ): Promise<{ found: boolean; displayName: string | null; profile: GraphUserProfile | null }> {
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(userIdentifier)}?$select=${USER_PROFILE_SELECT}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { found: false, displayName: null, profile: null };
      }
      throw new Error(`Graph API error fetching user profile: ${response.status} ${response.statusText}`);
    }

    const profile = (await response.json()) as GraphUserProfile;
    return { found: true, displayName: profile.displayName, profile };
  }

  /* ── Private: Fetch group memberships ──────────────────────────── */

  private async fetchGroupMemberships(
    accessToken: string,
    userIdentifier: string,
    maxItems: number
  ): Promise<{ count: number; groups: GraphGroup[] }> {
    const top = Math.min(maxItems, 999);
    const url = `${GRAPH_BASE_URL}/users/${encodeURIComponent(userIdentifier)}/memberOf?$top=${top}&$select=id,displayName,description,groupTypes,mailEnabled,securityEnabled,mail`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: "eventual",
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { count: 0, groups: [] };
      }
      throw new Error(`Graph API error fetching group memberships: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GraphPagedResponse<GraphGroup>;
    const groups = data.value ?? [];

    return { count: groups.length, groups };
  }

  /* ── Private: Fetch sign-in logs ───────────────────────────────── */

  private async fetchSignInLogs(
    accessToken: string,
    userIdentifier: string,
    maxItems: number,
    dateFrom?: string,
    dateTo?: string
  ): Promise<{ count: number; signIns: GraphSignIn[] }> {
    // Sign-in logs require the beta endpoint or the auditLogs/signIns v1.0 endpoint.
    // The userPrincipalName filter is used to scope to the subject.
    const top = Math.min(maxItems, 999);
    const filters: string[] = [
      `userPrincipalName eq '${userIdentifier}'`,
    ];

    if (dateFrom) {
      filters.push(`createdDateTime ge ${dateFrom}`);
    }
    if (dateTo) {
      filters.push(`createdDateTime le ${dateTo}`);
    }

    const filterStr = encodeURIComponent(filters.join(" and "));
    const url = `${GRAPH_BETA_URL}/auditLogs/signIns?$filter=${filterStr}&$top=${top}&$select=${SIGN_IN_SELECT}&$orderby=createdDateTime desc`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ConsistencyLevel: "eventual",
      },
    });

    if (!response.ok) {
      // Sign-in logs may not be available on all tenants or license tiers
      if (response.status === 403) {
        return { count: 0, signIns: [] };
      }
      if (response.status === 404) {
        return { count: 0, signIns: [] };
      }
      throw new Error(`Graph API error fetching sign-in logs: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as GraphPagedResponse<GraphSignIn>;
    const signIns = data.value ?? [];

    return { count: signIns.length, signIns };
  }

  /* ── Private: Sanitize identifier for use in filenames ─────────── */

  private sanitizeFilename(identifier: string): string {
    return identifier.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 100);
  }
}
