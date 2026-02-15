import { describe, it, expect } from "vitest";
import {
  runDiscovery,
  type DiscoveryInput,
  type DiscoveryRule,
  type SystemInfo,
} from "@/lib/discovery";

function makeRule(overrides: Partial<DiscoveryRule> = {}): DiscoveryRule {
  return {
    id: "rule-1",
    systemId: "sys-1",
    dsarTypes: ["ACCESS"],
    dataSubjectTypes: [],
    identifierTypes: [],
    weight: 50,
    active: true,
    conditions: null,
    ...overrides,
  };
}

function makeSystem(overrides: Partial<SystemInfo> = {}): SystemInfo {
  return {
    id: "sys-1",
    name: "CRM System",
    inScopeForDsar: true,
    confidenceScore: 80,
    identifierTypes: ["email", "customerId"],
    ...overrides,
  };
}

describe("Discovery Engine", () => {
  describe("runDiscovery", () => {
    it("should return empty array when no rules provided", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: ["email"],
      };
      const result = runDiscovery(input, [], new Map());
      expect(result).toEqual([]);
    });

    it("should match a simple rule by DSAR type", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [makeRule()];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
      expect(result[0].systemId).toBe("sys-1");
      expect(result[0].systemName).toBe("CRM System");
    });

    it("should not match a rule with different DSAR type", () => {
      const input: DiscoveryInput = {
        dsarType: "ERASURE",
        identifierTypes: [],
      };
      const rules = [makeRule({ dsarTypes: ["ACCESS"] })];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(0);
    });

    it("should skip inactive rules", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [makeRule({ active: false })];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(0);
    });

    it("should filter by data subject type when rule specifies one", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        dataSubjectType: "employee",
        identifierTypes: [],
      };
      const rules = [makeRule({ dataSubjectTypes: ["customer"] })];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(0);
    });

    it("should match when data subject type matches", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        dataSubjectType: "customer",
        identifierTypes: [],
      };
      const rules = [makeRule({ dataSubjectTypes: ["customer", "visitor"] })];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
    });

    it("should match when rule has no data subject type restriction", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        dataSubjectType: "employee",
        identifierTypes: [],
      };
      const rules = [makeRule({ dataSubjectTypes: [] })];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
    });

    it("should add identifier boost (+15 per match, capped at 30)", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: ["email", "customerId", "phone"],
      };
      const rules = [makeRule({ weight: 50 })];
      const systems = new Map([
        ["sys-1", makeSystem({ identifierTypes: ["email", "customerId", "phone"] })],
      ]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
      // weight=50 + identifierBoost=30 (capped) + confidenceBoost=8 (80/10) = 88
      expect(result[0].score).toBe(88);
    });

    it("should add confidence boost proportional to confidence score", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [makeRule({ weight: 50 })];
      const systems = new Map([
        ["sys-1", makeSystem({ confidenceScore: 100 })],
      ]);

      const result = runDiscovery(input, rules, systems);
      // weight=50 + confidenceBoost=10 (100/10) = 60
      expect(result[0].score).toBe(60);
    });

    it("should apply out-of-scope penalty (-100)", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [makeRule({ weight: 50 })];
      const systems = new Map([
        ["sys-1", makeSystem({ inScopeForDsar: false, confidenceScore: 80 })],
      ]);

      const result = runDiscovery(input, rules, systems);
      // weight=50 + confidenceBoost=8 - 100 = -42 → clamped to 0 → excluded
      expect(result).toHaveLength(0);
    });

    it("should clamp score to 0-100 range", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: ["email", "phone"],
      };
      const rules = [makeRule({ weight: 90 })];
      const systems = new Map([
        ["sys-1", makeSystem({ confidenceScore: 100, identifierTypes: ["email", "phone"] })],
      ]);

      const result = runDiscovery(input, rules, systems);
      // weight=90 + identifierBoost=30 + confidenceBoost=10 = 130 → clamped to 100
      expect(result[0].score).toBe(100);
    });

    it("should rank multiple systems by score descending", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: ["email"],
      };
      const rules = [
        makeRule({ id: "r1", systemId: "sys-1", weight: 80 }),
        makeRule({ id: "r2", systemId: "sys-2", weight: 30 }),
        makeRule({ id: "r3", systemId: "sys-3", weight: 60 }),
      ];
      const systems = new Map([
        ["sys-1", makeSystem({ id: "sys-1", name: "CRM", confidenceScore: 80, identifierTypes: ["email"] })],
        ["sys-2", makeSystem({ id: "sys-2", name: "HR", confidenceScore: 60, identifierTypes: ["email"] })],
        ["sys-3", makeSystem({ id: "sys-3", name: "Analytics", confidenceScore: 70, identifierTypes: [] })],
      ]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(3);
      // sys-1: 80 + 15 + 8 = 100 (clamped)
      // sys-2: 30 + 15 + 6 = 51
      // sys-3: 60 + 0  + 7 = 67
      expect(result[0].systemId).toBe("sys-1");
      expect(result[1].systemId).toBe("sys-3");
      expect(result[2].systemId).toBe("sys-2");
    });

    it("should keep best score when multiple rules match same system", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [
        makeRule({ id: "r1", systemId: "sys-1", weight: 30 }),
        makeRule({ id: "r2", systemId: "sys-1", weight: 70 }),
      ];
      const systems = new Map([
        ["sys-1", makeSystem({ confidenceScore: 80 })],
      ]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
      // Best: weight=70 + confidenceBoost=8 = 78
      expect(result[0].score).toBe(78);
    });

    it("should skip rules with no matching system in map", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [makeRule({ systemId: "nonexistent" })];
      const systems = new Map([["sys-1", makeSystem()]]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(0);
    });

    it("should include reasons for scoring", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: ["email"],
      };
      const rules = [makeRule({ weight: 50 })];
      const systems = new Map([
        ["sys-1", makeSystem({ confidenceScore: 80, identifierTypes: ["email"] })],
      ]);

      const result = runDiscovery(input, rules, systems);
      expect(result[0].reasons).toEqual(
        expect.arrayContaining([
          expect.stringContaining("weight: 50"),
          expect.stringContaining("Identifier match"),
          expect.stringContaining("confidence"),
        ])
      );
    });

    it("should handle identifier match from rule identifierTypes", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: ["ssn"],
      };
      const rules = [makeRule({ identifierTypes: ["ssn", "email"] })];
      const systems = new Map([
        ["sys-1", makeSystem({ identifierTypes: [] })],
      ]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
      // ssn matches from rule.identifierTypes: weight=50 + 15 + 8 = 73
      expect(result[0].score).toBe(73);
    });

    it("should handle zero confidence score", () => {
      const input: DiscoveryInput = {
        dsarType: "ACCESS",
        identifierTypes: [],
      };
      const rules = [makeRule({ weight: 50 })];
      const systems = new Map([
        ["sys-1", makeSystem({ confidenceScore: 0 })],
      ]);

      const result = runDiscovery(input, rules, systems);
      expect(result).toHaveLength(1);
      // weight=50 + confidenceBoost=0 = 50
      expect(result[0].score).toBe(50);
    });
  });
});
