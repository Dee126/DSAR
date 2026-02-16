/**
 * Vendor Service
 *
 * CRUD operations for the vendor registry, vendor contacts,
 * DPA records, and SLA configuration.
 *
 * Multi-tenant safe: all operations scoped by tenantId.
 */

import { prisma } from "./prisma";
import type { VendorStatus } from "@prisma/client";

export interface CreateVendorInput {
  name: string;
  shortCode?: string;
  status?: VendorStatus;
  website?: string;
  headquartersCountry?: string;
  dpaOnFile?: boolean;
  dpaExpiresAt?: string;
  contractReference?: string;
  notes?: string;
  tags?: string[];
}

export async function createVendor(tenantId: string, input: CreateVendorInput) {
  return prisma.vendor.create({
    data: {
      tenantId,
      name: input.name,
      shortCode: input.shortCode,
      status: input.status || "ACTIVE",
      website: input.website,
      headquartersCountry: input.headquartersCountry,
      dpaOnFile: input.dpaOnFile ?? false,
      dpaExpiresAt: input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null,
      contractReference: input.contractReference,
      notes: input.notes,
      tags: input.tags || [],
    },
    include: {
      contacts: true,
      _count: { select: { requests: true, systemProcessors: true } },
    },
  });
}

export async function updateVendor(
  tenantId: string,
  vendorId: string,
  input: Partial<CreateVendorInput>,
) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.shortCode !== undefined) data.shortCode = input.shortCode;
  if (input.status !== undefined) data.status = input.status;
  if (input.website !== undefined) data.website = input.website;
  if (input.headquartersCountry !== undefined) data.headquartersCountry = input.headquartersCountry;
  if (input.dpaOnFile !== undefined) data.dpaOnFile = input.dpaOnFile;
  if (input.dpaExpiresAt !== undefined) data.dpaExpiresAt = input.dpaExpiresAt ? new Date(input.dpaExpiresAt) : null;
  if (input.contractReference !== undefined) data.contractReference = input.contractReference;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.tags !== undefined) data.tags = input.tags;

  return prisma.vendor.update({
    where: { id: vendorId },
    data,
    include: {
      contacts: true,
      _count: { select: { requests: true, systemProcessors: true } },
    },
  });
}

export async function getVendor(tenantId: string, vendorId: string) {
  return prisma.vendor.findFirst({
    where: { id: vendorId, tenantId },
    include: {
      contacts: { orderBy: { isPrimary: "desc" } },
      dpas: { orderBy: { createdAt: "desc" } },
      slaConfig: true,
      systemProcessors: {
        include: { system: { select: { id: true, name: true, criticality: true } } },
      },
      escalations: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { requests: true, systemProcessors: true } },
    },
  });
}

export async function listVendors(
  tenantId: string,
  filters?: {
    status?: VendorStatus;
    search?: string;
    hasDpa?: boolean;
  },
) {
  const where: Record<string, unknown> = { tenantId };

  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { shortCode: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters?.hasDpa !== undefined) {
    where.dpaOnFile = filters.hasDpa;
  }

  return prisma.vendor.findMany({
    where,
    include: {
      contacts: { where: { isPrimary: true }, take: 1 },
      _count: { select: { requests: true, systemProcessors: true, escalations: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function addVendorContact(
  tenantId: string,
  vendorId: string,
  input: { name: string; email: string; phone?: string; role?: string; isPrimary?: boolean; notes?: string },
) {
  return prisma.vendorContact.create({
    data: { tenantId, vendorId, ...input },
  });
}

export async function removeVendorContact(tenantId: string, contactId: string) {
  return prisma.vendorContact.deleteMany({
    where: { id: contactId, tenantId },
  });
}

export async function addVendorDpa(
  tenantId: string,
  vendorId: string,
  input: {
    title: string;
    signedAt?: string;
    expiresAt?: string;
    storageKey?: string;
    sccsIncluded?: boolean;
    subprocessorListUrl?: string;
    notes?: string;
  },
) {
  return prisma.vendorDpa.create({
    data: {
      tenantId,
      vendorId,
      title: input.title,
      signedAt: input.signedAt ? new Date(input.signedAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      storageKey: input.storageKey,
      sccsIncluded: input.sccsIncluded ?? false,
      subprocessorListUrl: input.subprocessorListUrl,
      notes: input.notes,
    },
  });
}

export async function upsertVendorSlaConfig(
  tenantId: string,
  vendorId: string,
  input: {
    defaultDueDays?: number;
    reminderAfterDays?: number;
    escalationAfterDays?: number;
    maxReminders?: number;
    autoEscalate?: boolean;
  },
) {
  return prisma.vendorSlaConfig.upsert({
    where: { vendorId },
    update: { ...input },
    create: {
      tenantId,
      vendorId,
      defaultDueDays: input.defaultDueDays ?? 14,
      reminderAfterDays: input.reminderAfterDays ?? 7,
      escalationAfterDays: input.escalationAfterDays ?? 14,
      maxReminders: input.maxReminders ?? 3,
      autoEscalate: input.autoEscalate ?? true,
    },
  });
}

/**
 * Get vendor dashboard stats.
 */
export async function getVendorDashboardStats(tenantId: string) {
  const [
    totalVendors,
    activeVendors,
    dpaExpiringSoon,
    openRequests,
    overdueRequests,
    escalationCount,
  ] = await Promise.all([
    prisma.vendor.count({ where: { tenantId } }),
    prisma.vendor.count({ where: { tenantId, status: "ACTIVE" } }),
    prisma.vendor.count({
      where: {
        tenantId,
        dpaOnFile: true,
        dpaExpiresAt: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.vendorRequest.count({
      where: { tenantId, status: { in: ["DRAFT", "SENT", "ACKNOWLEDGED", "PARTIALLY_RESPONDED"] } },
    }),
    prisma.vendorRequest.count({
      where: {
        tenantId,
        status: { in: ["SENT", "ACKNOWLEDGED"] },
        dueAt: { lt: new Date() },
      },
    }),
    prisma.vendorEscalation.count({
      where: { tenantId, acknowledged: false },
    }),
  ]);

  return {
    totalVendors,
    activeVendors,
    dpaExpiringSoon,
    openRequests,
    overdueRequests,
    unacknowledgedEscalations: escalationCount,
  };
}
