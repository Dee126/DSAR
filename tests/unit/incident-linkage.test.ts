import { describe, it, expect } from "vitest";
import {
  createIncidentSchema,
  createIncidentTimelineSchema,
  createIncidentAssessmentSchema,
  createRegulatorRecordSchema,
  linkDsarIncidentSchema,
  createSurgeGroupSchema,
  surgeGroupBulkActionSchema,
  createAuthorityExportSchema,
} from "@/lib/validation";
import { has, enforce } from "@/lib/rbac";

// ─── Validation Schema Tests ──────────────────────────────────────────────────

describe("Incident & Authority Linkage — Validation Schemas", () => {
  describe("createIncidentSchema", () => {
    it("should accept valid data with all fields", () => {
      const data = {
        title: "Data breach in CRM system",
        description: "Unauthorized access detected",
        severity: "HIGH",
        status: "OPEN",
        regulatorNotificationRequired: true,
        numberOfDataSubjectsEstimate: 500,
        categoriesOfDataAffected: ["CONTACT", "IDENTIFICATION"],
        crossBorder: true,
        tags: ["urgent", "crm"],
      };
      const result = createIncidentSchema.safeParse(data);
      expect(result.success).toBe(true);
    });

    it("should accept minimal valid data (title only)", () => {
      const result = createIncidentSchema.safeParse({ title: "Minor incident" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.severity).toBe("MEDIUM");
        expect(result.data.status).toBe("OPEN");
        expect(result.data.regulatorNotificationRequired).toBe(false);
        expect(result.data.crossBorder).toBe(false);
        expect(result.data.categoriesOfDataAffected).toEqual([]);
      }
    });

    it("should reject when title is missing", () => {
      const result = createIncidentSchema.safeParse({ description: "No title" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const titleError = result.error.issues.find((e) =>
          e.path.includes("title")
        );
        expect(titleError).toBeDefined();
      }
    });

    it("should reject when title is empty string", () => {
      const result = createIncidentSchema.safeParse({ title: "" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid severity value", () => {
      const result = createIncidentSchema.safeParse({
        title: "Test",
        severity: "EXTREME",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const severityError = result.error.issues.find((e) =>
          e.path.includes("severity")
        );
        expect(severityError).toBeDefined();
      }
    });

    it("should reject invalid status value", () => {
      const result = createIncidentSchema.safeParse({
        title: "Test",
        status: "ARCHIVED",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createIncidentTimelineSchema", () => {
    it("should accept valid timeline entry", () => {
      const result = createIncidentTimelineSchema.safeParse({
        eventType: "DETECTED",
        timestamp: "2026-02-10T14:30:00.000Z",
        description: "Anomalous login activity detected by SIEM",
      });
      expect(result.success).toBe(true);
    });

    it("should reject when eventType is missing", () => {
      const result = createIncidentTimelineSchema.safeParse({
        timestamp: "2026-02-10T14:30:00.000Z",
        description: "Something happened",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const eventTypeError = result.error.issues.find((e) =>
          e.path.includes("eventType")
        );
        expect(eventTypeError).toBeDefined();
      }
    });

    it("should reject invalid eventType value", () => {
      const result = createIncidentTimelineSchema.safeParse({
        eventType: "INVALID_EVENT",
        timestamp: "2026-02-10T14:30:00.000Z",
        description: "Bad event type",
      });
      expect(result.success).toBe(false);
    });

    it("should reject when description is missing", () => {
      const result = createIncidentTimelineSchema.safeParse({
        eventType: "TRIAGED",
        timestamp: "2026-02-10T14:30:00.000Z",
      });
      expect(result.success).toBe(false);
    });

    it("should accept all valid eventType values", () => {
      const validTypes = [
        "DETECTED", "TRIAGED", "CONTAINED", "NOTIFIED_AUTHORITY",
        "NOTIFIED_SUBJECTS", "REMEDIATION", "CLOSED", "OTHER",
      ];
      for (const eventType of validTypes) {
        const result = createIncidentTimelineSchema.safeParse({
          eventType,
          timestamp: "2026-02-10T14:30:00.000Z",
          description: `Event: ${eventType}`,
        });
        expect(result.success, `eventType ${eventType} should be valid`).toBe(true);
      }
    });
  });

  describe("createIncidentAssessmentSchema", () => {
    it("should accept valid empty data (all fields optional)", () => {
      const result = createIncidentAssessmentSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should accept fully populated assessment", () => {
      const result = createIncidentAssessmentSchema.safeParse({
        natureOfBreach: "Unauthorized access to customer database",
        categoriesAndApproxSubjects: "~500 customers",
        categoriesAndApproxRecords: "~2000 records",
        likelyConsequences: "Potential identity theft",
        measuresTakenOrProposed: "Password reset enforced, VPN patched",
        dpoContactDetails: "dpo@example.com",
        additionalNotes: "Coordinating with law enforcement",
      });
      expect(result.success).toBe(true);
    });

    it("should accept partial assessment data", () => {
      const result = createIncidentAssessmentSchema.safeParse({
        natureOfBreach: "Phishing attack",
        measuresTakenOrProposed: "Staff training",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("createRegulatorRecordSchema", () => {
    it("should accept valid data with required fields", () => {
      const result = createRegulatorRecordSchema.safeParse({
        authorityName: "BfDI",
        country: "DE",
        referenceNumber: "BfDI-2026-001",
        status: "SUBMITTED",
        notes: "Submitted within 72 hours",
      });
      expect(result.success).toBe(true);
    });

    it("should accept minimal data (authorityName only)", () => {
      const result = createRegulatorRecordSchema.safeParse({
        authorityName: "ICO",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("DRAFT");
      }
    });

    it("should reject when authorityName is missing", () => {
      const result = createRegulatorRecordSchema.safeParse({
        country: "UK",
        status: "DRAFT",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((e) =>
          e.path.includes("authorityName")
        );
        expect(nameError).toBeDefined();
      }
    });

    it("should reject when authorityName is empty string", () => {
      const result = createRegulatorRecordSchema.safeParse({
        authorityName: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid status value", () => {
      const result = createRegulatorRecordSchema.safeParse({
        authorityName: "CNIL",
        status: "PENDING",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("linkDsarIncidentSchema", () => {
    it("should accept valid link data", () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        linkReason: "Data subject affected by the breach",
        subjectInScope: "YES",
      });
      expect(result.success).toBe(true);
    });

    it("should accept minimal data (incidentId only)", () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectInScope).toBe("UNKNOWN");
      }
    });

    it("should reject invalid UUID for incidentId", () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "not-a-valid-uuid",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const idError = result.error.issues.find((e) =>
          e.path.includes("incidentId")
        );
        expect(idError).toBeDefined();
      }
    });

    it("should reject missing incidentId", () => {
      const result = linkDsarIncidentSchema.safeParse({
        linkReason: "Some reason",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createSurgeGroupSchema", () => {
    it("should accept valid surge group data", () => {
      const result = createSurgeGroupSchema.safeParse({
        name: "Breach Surge - Feb 2026",
        description: "Cases related to February breach",
        caseIds: [
          "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
          "11111111-2222-3333-4444-555555555555",
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should accept minimal data (name only)", () => {
      const result = createSurgeGroupSchema.safeParse({
        name: "Quick surge",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.caseIds).toEqual([]);
      }
    });

    it("should reject when name is missing", () => {
      const result = createSurgeGroupSchema.safeParse({
        description: "No name provided",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const nameError = result.error.issues.find((e) =>
          e.path.includes("name")
        );
        expect(nameError).toBeDefined();
      }
    });

    it("should reject when name is empty string", () => {
      const result = createSurgeGroupSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });

    it("should reject invalid UUIDs in caseIds", () => {
      const result = createSurgeGroupSchema.safeParse({
        name: "Test",
        caseIds: ["not-a-uuid"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("surgeGroupBulkActionSchema", () => {
    it("should accept valid apply_systems action", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        action: "apply_systems",
        systemIds: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid create_tasks action", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        action: "create_tasks",
        taskTitle: "Collect data from CRM",
        taskDescription: "Export and review CRM records",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid set_template action", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        action: "set_template",
        templateId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      });
      expect(result.success).toBe(true);
    });

    it("should accept valid create_extension_notices action", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        action: "create_extension_notices",
        extensionDays: 30,
        extensionReason: "Complex multi-system incident",
      });
      expect(result.success).toBe(true);
    });

    it("should reject unknown action type", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        action: "delete_all",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const actionError = result.error.issues.find((e) =>
          e.path.includes("action")
        );
        expect(actionError).toBeDefined();
      }
    });

    it("should reject missing action", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        systemIds: ["aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createAuthorityExportSchema", () => {
    it("should apply correct defaults when no fields provided", () => {
      const result = createAuthorityExportSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeTimeline).toBe(true);
        expect(result.data.includeDsarList).toBe(true);
        expect(result.data.includeEvidence).toBe(false);
        expect(result.data.includeResponses).toBe(false);
      }
    });

    it("should allow overriding defaults", () => {
      const result = createAuthorityExportSchema.safeParse({
        includeTimeline: false,
        includeDsarList: false,
        includeEvidence: true,
        includeResponses: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.includeTimeline).toBe(false);
        expect(result.data.includeDsarList).toBe(false);
        expect(result.data.includeEvidence).toBe(true);
        expect(result.data.includeResponses).toBe(true);
      }
    });
  });
});

// ─── RBAC Permission Tests ────────────────────────────────────────────────────

describe("Incident & Authority Linkage — RBAC Permissions", () => {
  describe("TENANT_ADMIN permissions", () => {
    const role = "TENANT_ADMIN";

    it("should have INCIDENT_VIEW", () => {
      expect(has(role, "INCIDENT_VIEW")).toBe(true);
    });

    it("should have INCIDENT_CREATE", () => {
      expect(has(role, "INCIDENT_CREATE")).toBe(true);
    });

    it("should have INCIDENT_UPDATE", () => {
      expect(has(role, "INCIDENT_UPDATE")).toBe(true);
    });

    it("should have INCIDENT_DELETE", () => {
      expect(has(role, "INCIDENT_DELETE")).toBe(true);
    });

    it("should have INCIDENT_LINK_DSAR", () => {
      expect(has(role, "INCIDENT_LINK_DSAR")).toBe(true);
    });

    it("should have INCIDENT_ASSESSMENT", () => {
      expect(has(role, "INCIDENT_ASSESSMENT")).toBe(true);
    });

    it("should have INCIDENT_AUTHORITY_EXPORT", () => {
      expect(has(role, "INCIDENT_AUTHORITY_EXPORT")).toBe(true);
    });

    it("should have INCIDENT_SURGE_MANAGE", () => {
      expect(has(role, "INCIDENT_SURGE_MANAGE")).toBe(true);
    });
  });

  describe("DPO permissions", () => {
    const role = "DPO";

    it("should have INCIDENT_VIEW", () => {
      expect(has(role, "INCIDENT_VIEW")).toBe(true);
    });

    it("should have INCIDENT_CREATE", () => {
      expect(has(role, "INCIDENT_CREATE")).toBe(true);
    });

    it("should have INCIDENT_UPDATE", () => {
      expect(has(role, "INCIDENT_UPDATE")).toBe(true);
    });

    it("should have INCIDENT_LINK_DSAR", () => {
      expect(has(role, "INCIDENT_LINK_DSAR")).toBe(true);
    });

    it("should have INCIDENT_ASSESSMENT", () => {
      expect(has(role, "INCIDENT_ASSESSMENT")).toBe(true);
    });

    it("should have INCIDENT_AUTHORITY_EXPORT", () => {
      expect(has(role, "INCIDENT_AUTHORITY_EXPORT")).toBe(true);
    });

    it("should have INCIDENT_SURGE_MANAGE", () => {
      expect(has(role, "INCIDENT_SURGE_MANAGE")).toBe(true);
    });

    it("should NOT have INCIDENT_DELETE", () => {
      expect(has(role, "INCIDENT_DELETE")).toBe(false);
    });
  });

  describe("CASE_MANAGER permissions", () => {
    const role = "CASE_MANAGER";

    it("should have INCIDENT_VIEW", () => {
      expect(has(role, "INCIDENT_VIEW")).toBe(true);
    });

    it("should have INCIDENT_LINK_DSAR", () => {
      expect(has(role, "INCIDENT_LINK_DSAR")).toBe(true);
    });

    it("should NOT have INCIDENT_CREATE", () => {
      expect(has(role, "INCIDENT_CREATE")).toBe(false);
    });

    it("should NOT have INCIDENT_UPDATE", () => {
      expect(has(role, "INCIDENT_UPDATE")).toBe(false);
    });

    it("should NOT have INCIDENT_DELETE", () => {
      expect(has(role, "INCIDENT_DELETE")).toBe(false);
    });

    it("should NOT have INCIDENT_AUTHORITY_EXPORT", () => {
      expect(has(role, "INCIDENT_AUTHORITY_EXPORT")).toBe(false);
    });

    it("should NOT have INCIDENT_ASSESSMENT", () => {
      expect(has(role, "INCIDENT_ASSESSMENT")).toBe(false);
    });

    it("should NOT have INCIDENT_SURGE_MANAGE", () => {
      expect(has(role, "INCIDENT_SURGE_MANAGE")).toBe(false);
    });
  });

  describe("AUDITOR permissions", () => {
    const role = "AUDITOR";

    it("should have INCIDENT_VIEW", () => {
      expect(has(role, "INCIDENT_VIEW")).toBe(true);
    });

    it("should NOT have INCIDENT_CREATE", () => {
      expect(has(role, "INCIDENT_CREATE")).toBe(false);
    });

    it("should NOT have INCIDENT_UPDATE", () => {
      expect(has(role, "INCIDENT_UPDATE")).toBe(false);
    });

    it("should NOT have INCIDENT_DELETE", () => {
      expect(has(role, "INCIDENT_DELETE")).toBe(false);
    });

    it("should NOT have INCIDENT_LINK_DSAR", () => {
      expect(has(role, "INCIDENT_LINK_DSAR")).toBe(false);
    });

    it("should NOT have INCIDENT_ASSESSMENT", () => {
      expect(has(role, "INCIDENT_ASSESSMENT")).toBe(false);
    });

    it("should NOT have INCIDENT_AUTHORITY_EXPORT", () => {
      expect(has(role, "INCIDENT_AUTHORITY_EXPORT")).toBe(false);
    });

    it("should NOT have INCIDENT_SURGE_MANAGE", () => {
      expect(has(role, "INCIDENT_SURGE_MANAGE")).toBe(false);
    });
  });

  describe("READ_ONLY permissions", () => {
    const role = "READ_ONLY";

    it("should NOT have INCIDENT_VIEW", () => {
      expect(has(role, "INCIDENT_VIEW")).toBe(false);
    });

    it("should NOT have INCIDENT_CREATE", () => {
      expect(has(role, "INCIDENT_CREATE")).toBe(false);
    });

    it("should NOT have INCIDENT_UPDATE", () => {
      expect(has(role, "INCIDENT_UPDATE")).toBe(false);
    });

    it("should NOT have INCIDENT_DELETE", () => {
      expect(has(role, "INCIDENT_DELETE")).toBe(false);
    });

    it("should NOT have INCIDENT_LINK_DSAR", () => {
      expect(has(role, "INCIDENT_LINK_DSAR")).toBe(false);
    });
  });

  describe("enforce throws for unauthorized roles", () => {
    it("should throw for READ_ONLY attempting INCIDENT_VIEW", () => {
      expect(() => enforce("READ_ONLY", "INCIDENT_VIEW")).toThrow(
        "Forbidden"
      );
    });

    it("should throw for AUDITOR attempting INCIDENT_CREATE", () => {
      expect(() => enforce("AUDITOR", "INCIDENT_CREATE")).toThrow(
        "Forbidden"
      );
    });

    it("should throw for CASE_MANAGER attempting INCIDENT_DELETE", () => {
      expect(() => enforce("CASE_MANAGER", "INCIDENT_DELETE")).toThrow(
        "Forbidden"
      );
    });

    it("should throw for DPO attempting INCIDENT_DELETE", () => {
      expect(() => enforce("DPO", "INCIDENT_DELETE")).toThrow("Forbidden");
    });

    it("should NOT throw for TENANT_ADMIN with INCIDENT_CREATE", () => {
      expect(() =>
        enforce("TENANT_ADMIN", "INCIDENT_CREATE")
      ).not.toThrow();
    });

    it("should NOT throw for DPO with INCIDENT_VIEW", () => {
      expect(() => enforce("DPO", "INCIDENT_VIEW")).not.toThrow();
    });
  });
});

// ─── Linkage Logic Tests ──────────────────────────────────────────────────────

describe("Incident & Authority Linkage — Linkage Logic", () => {
  describe("linkDsarIncidentSchema subjectInScope values", () => {
    it('should accept subjectInScope "YES"', () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        subjectInScope: "YES",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectInScope).toBe("YES");
      }
    });

    it('should accept subjectInScope "NO"', () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        subjectInScope: "NO",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectInScope).toBe("NO");
      }
    });

    it('should accept subjectInScope "UNKNOWN"', () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        subjectInScope: "UNKNOWN",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectInScope).toBe("UNKNOWN");
      }
    });

    it('should default subjectInScope to "UNKNOWN" when omitted', () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.subjectInScope).toBe("UNKNOWN");
      }
    });

    it("should reject invalid subjectInScope value", () => {
      const result = linkDsarIncidentSchema.safeParse({
        incidentId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        subjectInScope: "MAYBE",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("surgeGroupBulkActionSchema action types", () => {
    const validActions = [
      "apply_systems",
      "create_tasks",
      "set_template",
      "create_extension_notices",
    ] as const;

    for (const action of validActions) {
      it(`should accept action "${action}"`, () => {
        const result = surgeGroupBulkActionSchema.safeParse({ action });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.action).toBe(action);
        }
      });
    }

    it("should reject action not in the allowed set", () => {
      const result = surgeGroupBulkActionSchema.safeParse({
        action: "reassign_owner",
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty action", () => {
      const result = surgeGroupBulkActionSchema.safeParse({ action: "" });
      expect(result.success).toBe(false);
    });
  });
});
