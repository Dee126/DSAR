import { prisma } from "@/lib/prisma";
import { ConnectorCategory } from "@prisma/client";

/**
 * Stub connector runner for Phase 1.
 *
 * Runs inline (no queue) and generates realistic-looking discovery results:
 * - DataAsset records representing discovered data locations
 * - Updates the ConnectorRun record with stats
 *
 * In production this would be an async job dispatched to a worker queue.
 */

interface StubAsset {
  name: string;
  path: string;
  dataCategory: "IDENTIFICATION" | "CONTACT" | "COMMUNICATION" | "HR" | "PAYMENT" | "ONLINE_TECHNICAL" | "OTHER";
  sensitivityScore: number;
  personalData: boolean;
  specialCategory: boolean;
}

const STUB_ASSETS: Record<ConnectorCategory, StubAsset[]> = {
  M365: [
    { name: "User Directory Export", path: "/tenants/acme/users.json", dataCategory: "IDENTIFICATION", sensitivityScore: 75, personalData: true, specialCategory: false },
    { name: "Teams Chat Logs", path: "/tenants/acme/teams/chats", dataCategory: "COMMUNICATION", sensitivityScore: 60, personalData: true, specialCategory: false },
    { name: "OneDrive Personal Files", path: "/tenants/acme/onedrive/personal", dataCategory: "OTHER", sensitivityScore: 40, personalData: false, specialCategory: false },
  ],
  EXCHANGE: [
    { name: "Mailbox - HR Dept", path: "/exchange/mailboxes/hr@acme.com", dataCategory: "HR", sensitivityScore: 85, personalData: true, specialCategory: false },
    { name: "Mailbox - Finance", path: "/exchange/mailboxes/finance@acme.com", dataCategory: "PAYMENT", sensitivityScore: 80, personalData: true, specialCategory: false },
    { name: "Calendar Data", path: "/exchange/calendars/shared", dataCategory: "CONTACT", sensitivityScore: 30, personalData: true, specialCategory: false },
  ],
  SHAREPOINT: [
    { name: "HR Policy Documents", path: "/sites/hr/documents/policies", dataCategory: "HR", sensitivityScore: 70, personalData: true, specialCategory: false },
    { name: "Finance Reports", path: "/sites/finance/reports/2024", dataCategory: "PAYMENT", sensitivityScore: 90, personalData: true, specialCategory: false },
    { name: "Employee Records", path: "/sites/hr/lists/employees", dataCategory: "IDENTIFICATION", sensitivityScore: 85, personalData: true, specialCategory: false },
    { name: "Public Wiki", path: "/sites/wiki/pages", dataCategory: "OTHER", sensitivityScore: 10, personalData: false, specialCategory: false },
  ],
  FILESERVER: [
    { name: "Shared Drive - HR", path: "\\\\fs01\\HR\\employee-records", dataCategory: "HR", sensitivityScore: 90, personalData: true, specialCategory: false },
    { name: "Shared Drive - Legal", path: "\\\\fs01\\Legal\\contracts", dataCategory: "OTHER", sensitivityScore: 65, personalData: true, specialCategory: false },
    { name: "Scanned Documents", path: "\\\\fs01\\Scans\\2024", dataCategory: "IDENTIFICATION", sensitivityScore: 50, personalData: true, specialCategory: false },
  ],
  CRM: [
    { name: "Customer Contacts", path: "/crm/contacts", dataCategory: "CONTACT", sensitivityScore: 70, personalData: true, specialCategory: false },
    { name: "Support Tickets", path: "/crm/tickets", dataCategory: "COMMUNICATION", sensitivityScore: 55, personalData: true, specialCategory: false },
    { name: "Lead Database", path: "/crm/leads", dataCategory: "IDENTIFICATION", sensitivityScore: 65, personalData: true, specialCategory: false },
  ],
};

/**
 * Execute a stub connector run.
 * Creates DataAsset records for the connector's category and updates the run.
 */
export async function executeConnectorRun(
  runId: string,
  connectorId: string,
  tenantId: string,
  category: ConnectorCategory,
): Promise<void> {
  // Mark run as RUNNING
  await prisma.connectorRun.update({
    where: { id: runId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    // Find or create a System to associate the assets with
    let system = await prisma.system.findFirst({
      where: {
        tenantId,
        name: `${category} Connector System`,
      },
    });

    if (!system) {
      system = await prisma.system.create({
        data: {
          tenantId,
          name: `${category} Connector System`,
          description: `Auto-created system for ${category} connector data assets`,
          inScopeForDsar: true,
        },
      });
    }

    // Generate stub assets
    const stubAssets = STUB_ASSETS[category] || STUB_ASSETS.M365;
    const createdAssets = [];

    for (const asset of stubAssets) {
      const created = await prisma.dataAsset.create({
        data: {
          tenantId,
          systemId: system.id,
          name: asset.name,
          path: asset.path,
          dataCategory: asset.dataCategory,
          sensitivityScore: asset.sensitivityScore,
          personalData: asset.personalData,
          specialCategory: asset.specialCategory,
          lastScannedAt: new Date(),
          metadata: {
            source: "connector",
            connectorId,
            runId,
            category,
          },
        },
      });
      createdAssets.push(created);
    }

    // Build stats
    const stats = {
      filesScanned: stubAssets.length + Math.floor(Math.random() * 50),
      assetsDiscovered: createdAssets.length,
      personalDataAssets: createdAssets.filter((a) => a.personalData).length,
      specialCategoryAssets: createdAssets.filter((a) => a.specialCategory).length,
      avgSensitivityScore: Math.round(
        createdAssets.reduce((sum, a) => sum + a.sensitivityScore, 0) /
          createdAssets.length,
      ),
    };

    // Mark run as COMPLETED
    await prisma.connectorRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        finishedAt: new Date(),
        assetsFound: createdAssets.length,
        findingsCount: createdAssets.filter((a) => a.sensitivityScore >= 70).length,
        stats,
      },
    });

    // Update connector's lastRunAt
    await prisma.connector.update({
      where: { id: connectorId },
      data: { lastRunAt: new Date(), lastError: null },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    await prisma.connectorRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        errorMessage,
      },
    });

    await prisma.connector.update({
      where: { id: connectorId },
      data: { lastError: errorMessage },
    });

    throw error;
  }
}
