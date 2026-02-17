import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------
import {
  createSeededRandom,
  generateSyntheticPersons,
  generateAllEvidence,
  generateExchangeEvidence,
  generateSharePointEvidence,
  generateOneDriveEvidence,
  injectPII,
  injectSinglePII,
  simulateDetection,
  simulateFindings,
  simulateCopilotRun,
  simulateGovernanceScenarios,
  generateSyntheticDataset,
  validateSyntheticMode,
  validateResetAllowed,
  getResetTargets,
} from "@/lib/copilot/synthetic/generator";
import type {
  SeededRandom,
  SyntheticPerson,
  SyntheticDataConfig,
  SyntheticEvidenceItem,
} from "@/lib/copilot/synthetic/generator";

// Detection engine for validation
import {
  runAllDetectors,
  hasSpecialCategory,
  getSpecialCategories,
  classifyFindings,
} from "@/lib/copilot/detection";

// =========================================================================
// 1. Seeded PRNG
// =========================================================================
describe("Seeded PRNG", () => {
  it("should produce deterministic results with same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);

    const seq1 = Array.from({ length: 10 }, () => rng1.next());
    const seq2 = Array.from({ length: 10 }, () => rng2.next());

    expect(seq1).toEqual(seq2);
  });

  it("should produce different results with different seeds", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(123);

    const val1 = rng1.next();
    const val2 = rng2.next();

    expect(val1).not.toBe(val2);
  });

  it("next() should return values in [0, 1)", () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("int() should return integers within range", () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(5, 15);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThanOrEqual(15);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it("pick() should return elements from array", () => {
    const rng = createSeededRandom(42);
    const arr = ["a", "b", "c", "d"];
    for (let i = 0; i < 50; i++) {
      expect(arr).toContain(rng.pick(arr));
    }
  });

  it("shuffle() should return array with same elements", () => {
    const rng = createSeededRandom(42);
    const arr = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(arr);
    expect(shuffled.sort()).toEqual([1, 2, 3, 4, 5]);
    expect(shuffled.length).toBe(5);
  });

  it("shuffle() should not mutate original array", () => {
    const rng = createSeededRandom(42);
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    rng.shuffle(arr);
    expect(arr).toEqual(original);
  });

  it("chance() should respect probability", () => {
    const rng = createSeededRandom(42);
    let trueCount = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.3)) trueCount++;
    }
    // Should be roughly 30% (with tolerance)
    expect(trueCount / trials).toBeGreaterThan(0.25);
    expect(trueCount / trials).toBeLessThan(0.35);
  });

  it("sample() should return requested number of elements", () => {
    const rng = createSeededRandom(42);
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const sampled = rng.sample(arr, 3);
    expect(sampled.length).toBe(3);
    for (const s of sampled) {
      expect(arr).toContain(s);
    }
  });

  it("float() should return values within range", () => {
    const rng = createSeededRandom(42);
    for (let i = 0; i < 100; i++) {
      const v = rng.float(1.5, 3.5);
      expect(v).toBeGreaterThanOrEqual(1.5);
      expect(v).toBeLessThan(3.5);
    }
  });

  it("seed property should be accessible", () => {
    const rng = createSeededRandom(42);
    expect(rng.seed).toBe(42);
  });
});

// =========================================================================
// 2. Synthetic Person Generation
// =========================================================================
describe("Synthetic Person Generation", () => {
  it("should generate the requested number of persons", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(10, rng);
    expect(persons.length).toBe(10);
  });

  it("each person should have all required fields", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(5, rng);
    for (const p of persons) {
      expect(p.firstName).toBeTruthy();
      expect(p.lastName).toBeTruthy();
      expect(p.fullName).toBe(`${p.firstName} ${p.lastName}`);
      expect(p.email).toContain("@testcorp.local");
      expect(p.upn).toContain("@testcorp.onmicrosoft.com");
      expect(p.employeeId).toMatch(/^EMP-\d+$/);
      expect(p.customerId).toMatch(/^KNR-\d+$/);
      expect(p.phone).toMatch(/^\+49/);
      expect(p.iban).toMatch(/^DE\d+$/);
      expect(p.address).toBeTruthy();
      expect(p.confidenceScore).toBeGreaterThanOrEqual(80);
      expect(p.confidenceScore).toBeLessThanOrEqual(100);
    }
  });

  it("should have unique emails", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(50, rng);
    const emails = persons.map((p) => p.email);
    const uniqueEmails = new Set(emails);
    expect(uniqueEmails.size).toBe(emails.length);
  });

  it("should follow 20/15/10/5 distribution (approximate)", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(100, rng);

    const financial = persons.filter((p) => p.includeFinancial).length;
    const hr = persons.filter((p) => p.includeHR).length;
    const art9 = persons.filter((p) => p.includeArt9).length;

    // Allow wide tolerance for randomness
    expect(financial).toBeGreaterThan(5);
    expect(financial).toBeLessThan(45);
    expect(hr).toBeGreaterThan(3);
    expect(hr).toBeLessThan(40);
    expect(art9).toBeGreaterThan(2);
    expect(art9).toBeLessThan(30);
  });

  it("Art. 9 persons should have art9Categories populated", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(100, rng);
    const art9Persons = persons.filter((p) => p.includeArt9);

    for (const p of art9Persons) {
      expect(p.art9Categories.length).toBeGreaterThan(0);
    }
  });

  it("should be reproducible with same seed", () => {
    const rng1 = createSeededRandom(42);
    const rng2 = createSeededRandom(42);
    const persons1 = generateSyntheticPersons(10, rng1);
    const persons2 = generateSyntheticPersons(10, rng2);

    for (let i = 0; i < 10; i++) {
      expect(persons1[i].fullName).toBe(persons2[i].fullName);
      expect(persons1[i].email).toBe(persons2[i].email);
      expect(persons1[i].iban).toBe(persons2[i].iban);
    }
  });

  it("should respect options to disable categories", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(50, rng, {
      includeSpecialCategory: false,
    });

    const art9Persons = persons.filter((p) => p.includeArt9);
    expect(art9Persons.length).toBe(0);
  });
});

// =========================================================================
// 3. PII Injection Engine
// =========================================================================
describe("PII Injection Engine", () => {
  let person: SyntheticPerson;
  let rng: SeededRandom;

  function createTestPerson(overrides?: Partial<SyntheticPerson>): SyntheticPerson {
    return {
      firstName: "Test",
      lastName: "Person",
      fullName: "Test Person",
      email: "test.person@testcorp.local",
      upn: "test.person@testcorp.onmicrosoft.com",
      employeeId: "EMP-123456",
      customerId: "KNR-654321",
      phone: "+49 170 1234567",
      iban: "DE12345678901234567890",
      address: "Hauptstrasse 1, 10115 Berlin",
      dateOfBirth: "1990-01-15",
      confidenceScore: 90,
      includeFinancial: false,
      includeHR: false,
      includeArt9: false,
      art9Categories: [],
      ...overrides,
    };
  }

  it("should inject email into text", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson();
    const result = injectPII(p, rng);
    expect(result.text).toContain("test.person@testcorp.local");
    expect(result.injectedPiiTypes).toContain("EMAIL_ADDRESS");
  });

  it("should include financial data when flagged", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson({ includeFinancial: true });
    const result = injectPII(p, rng, { includeFinancial: true });
    expect(result.text).toContain(p.iban);
    expect(result.injectedPiiTypes).toContain("IBAN");
  });

  it("should include HR data when flagged", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson({ includeHR: true, employeeId: "EMP-999999" });
    const result = injectPII(p, rng, { includeHR: true });
    // HR templates vary — some include employeeId, others salary/vacation/performance
    const hrKeywords = ["Mitarbeiter", "Performance Review", "Disziplinarmaßnahme", "Urlaubsantrag", "Bruttogehalt", "EMP-999999"];
    const hasHRContent = hrKeywords.some((k) => result.text.includes(k));
    expect(hasHRContent).toBe(true);
    expect(result.injectedPiiTypes).toContain("EMPLOYEE_ID");
  });

  it("should inject HEALTH keywords when Art. 9 health enabled", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson({ includeArt9: true, art9Categories: ["HEALTH"] });
    const result = injectPII(p, rng, {
      includeArt9: true,
      art9Categories: ["HEALTH"],
    });
    expect(result.containsSpecialCategory).toBe(true);
    expect(result.specialCategories).toContain("HEALTH");
    // Text should contain health-related German keywords
    const healthKeywords = ["Krankschreibung", "Diagnose", "Behandlung", "Arztbericht", "Krankenkasse", "Medikamentenplan", "Gesundheitszeugnis"];
    const hasHealthKeyword = healthKeywords.some((k) => result.text.includes(k));
    expect(hasHealthKeyword).toBe(true);
  });

  it("should inject RELIGION keywords when Art. 9 religion enabled", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson({ includeArt9: true, art9Categories: ["RELIGION"] });
    const result = injectPII(p, rng, {
      includeArt9: true,
      art9Categories: ["RELIGION"],
    });
    expect(result.containsSpecialCategory).toBe(true);
    expect(result.specialCategories).toContain("RELIGION");
    const religionKeywords = ["Kirchensteuer", "Konfession", "katholisch", "evangelisch", "muslimisch"];
    const hasKeyword = religionKeywords.some((k) => result.text.includes(k));
    expect(hasKeyword).toBe(true);
  });

  it("should inject UNION keywords", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson({ includeArt9: true, art9Categories: ["UNION"] });
    const result = injectPII(p, rng, {
      includeArt9: true,
      art9Categories: ["UNION"],
    });
    expect(result.specialCategories).toContain("UNION");
    const unionKeywords = ["Gewerkschaft", "Betriebsrat", "ver.di", "IG Metall"];
    const hasKeyword = unionKeywords.some((k) => result.text.includes(k));
    expect(hasKeyword).toBe(true);
  });

  it("should not contain special category when disabled", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson();
    const result = injectPII(p, rng);
    expect(result.containsSpecialCategory).toBe(false);
    expect(result.specialCategories).toHaveLength(0);
  });

  it("injectSinglePII should generate type-specific snippets", () => {
    const rng = createSeededRandom(42);
    const p = createTestPerson();
    expect(injectSinglePII(p, "EMAIL", rng)).toContain(p.email);
    expect(injectSinglePII(p, "PHONE", rng)).toContain(p.phone);
    expect(injectSinglePII(p, "IBAN", rng)).toContain(p.iban);
    expect(injectSinglePII(p, "EMPLOYEE_ID", rng)).toContain(p.employeeId);
    expect(injectSinglePII(p, "CUSTOMER_NUMBER", rng)).toContain(p.customerId);
  });
});

// =========================================================================
// 4. Evidence Generation (Mock Integrations)
// =========================================================================
describe("Evidence Generation", () => {
  function createTestPerson(): SyntheticPerson {
    return {
      firstName: "Max", lastName: "Mustermann", fullName: "Max Mustermann",
      email: "max.mustermann@testcorp.local",
      upn: "max.mustermann@testcorp.onmicrosoft.com",
      employeeId: "EMP-100001", customerId: "KNR-200001",
      phone: "+49 170 5551234", iban: "DE12345678901234567890",
      address: "Hauptstrasse 10, 10115 Berlin",
      dateOfBirth: "1985-06-15", confidenceScore: 95,
      includeFinancial: true, includeHR: true,
      includeArt9: false, art9Categories: [],
    };
  }

  describe("Exchange (Email) evidence", () => {
    it("should generate 5-20 emails per person", () => {
      const rng = createSeededRandom(42);
      const items = generateExchangeEvidence(createTestPerson(), rng);
      expect(items.length).toBeGreaterThanOrEqual(5);
      expect(items.length).toBeLessThanOrEqual(20);
    });

    it("all items should have provider EXCHANGE_ONLINE", () => {
      const rng = createSeededRandom(42);
      const items = generateExchangeEvidence(createTestPerson(), rng);
      for (const item of items) {
        expect(item.provider).toBe("EXCHANGE_ONLINE");
        expect(item.workload).toBe("EXCHANGE");
        expect(item.itemType).toBe("EMAIL");
      }
    });

    it("items should have valid metadata", () => {
      const rng = createSeededRandom(42);
      const items = generateExchangeEvidence(createTestPerson(), rng);
      for (const item of items) {
        expect(item.title).toBeTruthy();
        expect(item.location).toContain("EXCHANGE_ONLINE:Mailbox:");
        expect(item.metadata.synthetic).toBe(true);
        expect(item.createdAtSource).toBeInstanceOf(Date);
        expect(item.modifiedAtSource).toBeInstanceOf(Date);
      }
    });

    it("items should have injected content for detection", () => {
      const rng = createSeededRandom(42);
      const items = generateExchangeEvidence(createTestPerson(), rng);
      for (const item of items) {
        expect(item.injectedContent.text.length).toBeGreaterThan(0);
        expect(item.injectedContent.injectedPiiTypes.length).toBeGreaterThan(0);
      }
    });
  });

  describe("SharePoint evidence", () => {
    it("should generate 3-10 files per person", () => {
      const rng = createSeededRandom(42);
      const items = generateSharePointEvidence(createTestPerson(), rng);
      expect(items.length).toBeGreaterThanOrEqual(3);
      expect(items.length).toBeLessThanOrEqual(10);
    });

    it("all items should have provider SHAREPOINT", () => {
      const rng = createSeededRandom(42);
      const items = generateSharePointEvidence(createTestPerson(), rng);
      for (const item of items) {
        expect(item.provider).toBe("SHAREPOINT");
        expect(item.itemType).toBe("FILE");
      }
    });

    it("file paths should include HR/Finance/Sales/General", () => {
      const rng = createSeededRandom(42);
      const person = createTestPerson();
      // Generate many to cover all categories
      let allPaths: string[] = [];
      for (let i = 0; i < 5; i++) {
        const items = generateSharePointEvidence(person, createSeededRandom(i));
        allPaths = allPaths.concat(items.map((item) => item.location));
      }
      // Should have at least some variety
      expect(allPaths.some((p) => p.includes("/HR/") || p.includes("/Finance/") || p.includes("/Sales/") || p.includes("/General/"))).toBe(true);
    });
  });

  describe("OneDrive evidence", () => {
    it("should generate 2-6 files per person", () => {
      const rng = createSeededRandom(42);
      const items = generateOneDriveEvidence(createTestPerson(), rng);
      expect(items.length).toBeGreaterThanOrEqual(2);
      expect(items.length).toBeLessThanOrEqual(6);
    });

    it("all items should have provider ONEDRIVE", () => {
      const rng = createSeededRandom(42);
      const items = generateOneDriveEvidence(createTestPerson(), rng);
      for (const item of items) {
        expect(item.provider).toBe("ONEDRIVE");
      }
    });
  });

  describe("Combined evidence generation", () => {
    it("should generate evidence from all providers when mock integrations enabled", () => {
      const rng = createSeededRandom(42);
      const evidence = generateAllEvidence(createTestPerson(), rng, true);
      expect(evidence.exchangeItems.length).toBeGreaterThan(0);
      expect(evidence.sharePointItems.length).toBeGreaterThan(0);
      expect(evidence.oneDriveItems.length).toBeGreaterThan(0);
      expect(evidence.allItems.length).toBe(
        evidence.exchangeItems.length +
        evidence.sharePointItems.length +
        evidence.oneDriveItems.length,
      );
    });

    it("should generate empty evidence when mock integrations disabled", () => {
      const rng = createSeededRandom(42);
      const evidence = generateAllEvidence(createTestPerson(), rng, false);
      expect(evidence.allItems.length).toBe(0);
      expect(evidence.exchangeItems.length).toBe(0);
    });
  });
});

// =========================================================================
// 5. Detector Simulation
// =========================================================================
describe("Detector Simulation", () => {
  function createEvidenceItem(text: string): SyntheticEvidenceItem {
    return {
      provider: "EXCHANGE_ONLINE",
      workload: "EXCHANGE",
      itemType: "EMAIL",
      location: "EXCHANGE_ONLINE:Mailbox:test@test.local/Inbox",
      title: "Test email",
      contentHandling: "METADATA_ONLY",
      createdAtSource: new Date(),
      modifiedAtSource: new Date(),
      metadata: { synthetic: true },
      injectedContent: {
        text,
        injectedPiiTypes: ["EMAIL_ADDRESS"],
        containsSpecialCategory: false,
        specialCategories: [],
      },
      sensitivityScore: 50,
    };
  }

  it("should detect PII in injected content", () => {
    const item = createEvidenceItem("Contact: test@example.com, IBAN: DE89370400440532013000");
    const results = simulateDetection(item);
    expect(results.length).toBeGreaterThan(0);
    const allCats = results.flatMap((r) => r.detectedCategories.map((c) => c.category));
    expect(allCats).toContain("CONTACT");
    expect(allCats).toContain("PAYMENT");
  });

  it("should detect Art. 9 keywords", () => {
    const item = createEvidenceItem("Der Patient wurde wegen Diabetes behandelt. Diagnose bestätigt.");
    const results = simulateDetection(item);
    const hasSpecial = results.some((r) => r.containsSpecialCategorySuspected);
    expect(hasSpecial).toBe(true);
  });

  it("should return empty for empty text", () => {
    const item = createEvidenceItem("");
    const results = simulateDetection(item);
    expect(results.length).toBe(0);
  });

  describe("Findings simulation", () => {
    it("should group detector results into findings", () => {
      const item = createEvidenceItem("Email: test@example.com. IBAN: DE89370400440532013000. Patient Diagnose.");
      const detectorResults = simulateDetection(item);
      const findings = simulateFindings(detectorResults, ["ev-1"]);
      expect(findings.length).toBeGreaterThan(0);
      const categories = findings.map((f) => f.dataCategory);
      expect(categories).toContain("CONTACT");
      expect(categories).toContain("PAYMENT");
    });

    it("should mark special category findings correctly", () => {
      const item = createEvidenceItem("Patient Diagnose Behandlung Krankschreibung.");
      const detectorResults = simulateDetection(item);
      const findings = simulateFindings(detectorResults, ["ev-1"]);
      const specialFindings = findings.filter((f) => f.containsSpecialCategory);
      expect(specialFindings.length).toBeGreaterThan(0);
      expect(specialFindings[0].requiresLegalReview).toBe(true);
      expect(specialFindings[0].severity).toBe("CRITICAL");
    });
  });
});

// =========================================================================
// 6. CopilotRun Simulation
// =========================================================================
describe("CopilotRun Simulation", () => {
  function createPerson(): SyntheticPerson {
    return {
      firstName: "Max", lastName: "Mustermann", fullName: "Max Mustermann",
      email: "max@testcorp.local", upn: "max@testcorp.onmicrosoft.com",
      employeeId: "EMP-100001", customerId: "KNR-200001",
      phone: "+49 170 5551234", iban: "DE12345678901234567890",
      address: "Hauptstrasse 10, 10115 Berlin", dateOfBirth: "1985-06-15",
      confidenceScore: 95, includeFinancial: true, includeHR: true,
      includeArt9: false, art9Categories: [],
    };
  }

  function createItems(person: SyntheticPerson): SyntheticEvidenceItem[] {
    const rng = createSeededRandom(42);
    return generateExchangeEvidence(person, rng).slice(0, 3);
  }

  it("should create COMPLETED run", () => {
    const person = createPerson();
    const items = createItems(person);
    const rng = createSeededRandom(42);
    const run = simulateCopilotRun(items, person, rng, "completed");
    expect(run.status).toBe("COMPLETED");
    expect(run.justification).toContain("Art. 15");
    expect(run.totalEvidenceItems).toBe(items.length);
  });

  it("should create FAILED run", () => {
    const person = createPerson();
    const items = createItems(person);
    const rng = createSeededRandom(42);
    const run = simulateCopilotRun(items, person, rng, "failed");
    expect(run.status).toBe("FAILED");
    expect(run.errorDetails).toBeTruthy();
  });

  it("should create special_category run with REQUIRED approval", () => {
    const person = createPerson();
    const items = createItems(person);
    const rng = createSeededRandom(42);
    const run = simulateCopilotRun(items, person, rng, "special_category");
    expect(run.containsSpecialCategory).toBe(true);
    expect(run.legalApprovalStatus).toBe("REQUIRED");
  });

  it("should create approved run", () => {
    const person = createPerson();
    const items = createItems(person);
    const rng = createSeededRandom(42);
    const run = simulateCopilotRun(items, person, rng, "approved");
    expect(run.legalApprovalStatus).toBe("APPROVED");
  });
});

// =========================================================================
// 7. Governance Test Scenarios
// =========================================================================
describe("Governance Test Scenarios", () => {
  it("should generate 4 governance scenarios", () => {
    const rng = createSeededRandom(42);
    const scenarios = simulateGovernanceScenarios(rng);
    expect(scenarios.length).toBe(4);
  });

  it("should include missing_justification scenario", () => {
    const rng = createSeededRandom(42);
    const scenarios = simulateGovernanceScenarios(rng);
    const missing = scenarios.find((s) => s.scenarioName === "missing_justification");
    expect(missing).toBeDefined();
    expect(missing!.status).toBe("FAILED");
    expect(missing!.justification).toBe("");
  });

  it("should include rate_limit_exceeded scenario", () => {
    const rng = createSeededRandom(42);
    const scenarios = simulateGovernanceScenarios(rng);
    const rl = scenarios.find((s) => s.scenarioName === "rate_limit_exceeded");
    expect(rl).toBeDefined();
    expect(rl!.status).toBe("FAILED");
  });

  it("should include export_blocked_art9 scenario", () => {
    const rng = createSeededRandom(42);
    const scenarios = simulateGovernanceScenarios(rng);
    const blocked = scenarios.find((s) => s.scenarioName === "export_blocked_art9");
    expect(blocked).toBeDefined();
    expect(blocked!.legalApprovalStatus).toBe("REQUIRED");
    expect(blocked!.containsSpecialCategory).toBe(true);
  });

  it("should include export_approved_by_dpo scenario", () => {
    const rng = createSeededRandom(42);
    const scenarios = simulateGovernanceScenarios(rng);
    const approved = scenarios.find((s) => s.scenarioName === "export_approved_by_dpo");
    expect(approved).toBeDefined();
    expect(approved!.legalApprovalStatus).toBe("APPROVED");
  });
});

// =========================================================================
// 8. Full Dataset Generation
// =========================================================================
describe("Full Dataset Generation", () => {
  describe("Small dataset (5 persons)", () => {
    const config: SyntheticDataConfig = {
      size: "small",
      seed: 42,
      includeSpecialCategory: true,
      includeFinancial: true,
      includeHR: true,
      includeOcrImages: false,
      includeMockIntegrations: true,
    };

    it("should generate 5 persons", () => {
      const dataset = generateSyntheticDataset(config);
      expect(dataset.persons.length).toBe(5);
      expect(dataset.cases.length).toBe(5);
    });

    it("should be reproducible", () => {
      const ds1 = generateSyntheticDataset(config);
      const ds2 = generateSyntheticDataset(config);
      expect(ds1.persons.map((p) => p.fullName)).toEqual(
        ds2.persons.map((p) => p.fullName),
      );
    });

    it("should have complete stats", () => {
      const dataset = generateSyntheticDataset(config);
      expect(dataset.stats.totalPersons).toBe(5);
      expect(dataset.stats.totalCases).toBe(5);
      expect(dataset.stats.totalEvidenceItems).toBeGreaterThan(0);
      expect(dataset.stats.governanceScenarioCount).toBe(4);
    });
  });

  describe("Medium dataset (25 persons)", () => {
    it("should generate 25 persons", () => {
      const dataset = generateSyntheticDataset({
        size: "medium",
        seed: 42,
        includeSpecialCategory: true,
        includeFinancial: true,
        includeHR: true,
        includeOcrImages: false,
        includeMockIntegrations: true,
      });
      expect(dataset.persons.length).toBe(25);
      expect(dataset.cases.length).toBe(25);
    });
  });

  describe("Case type distribution", () => {
    it("should have mostly ACCESS cases", () => {
      const dataset = generateSyntheticDataset({
        size: "large",
        seed: 42,
        includeSpecialCategory: true,
        includeFinancial: true,
        includeHR: true,
        includeOcrImages: false,
        includeMockIntegrations: true,
      });

      const accessCount = dataset.stats.casesByType["ACCESS"] ?? 0;
      expect(accessCount).toBeGreaterThan(dataset.cases.length * 0.5);
    });

    it("should have some ERASURE cases", () => {
      const dataset = generateSyntheticDataset({
        size: "large",
        seed: 42,
        includeSpecialCategory: true,
        includeFinancial: true,
        includeHR: true,
        includeOcrImages: false,
        includeMockIntegrations: true,
      });

      const erasureCount = dataset.stats.casesByType["ERASURE"] ?? 0;
      expect(erasureCount).toBeGreaterThan(0);
    });
  });

  describe("Evidence distribution", () => {
    it("should have evidence from all 3 providers", () => {
      const dataset = generateSyntheticDataset({
        size: "medium",
        seed: 42,
        includeSpecialCategory: true,
        includeFinancial: true,
        includeHR: true,
        includeOcrImages: false,
        includeMockIntegrations: true,
      });

      expect(dataset.stats.evidenceByProvider["EXCHANGE_ONLINE"]).toBeGreaterThan(0);
      expect(dataset.stats.evidenceByProvider["SHAREPOINT"]).toBeGreaterThan(0);
      expect(dataset.stats.evidenceByProvider["ONEDRIVE"]).toBeGreaterThan(0);
    });

    it("should have no evidence when mock integrations disabled", () => {
      const dataset = generateSyntheticDataset({
        size: "small",
        seed: 42,
        includeSpecialCategory: true,
        includeFinancial: true,
        includeHR: true,
        includeOcrImages: false,
        includeMockIntegrations: false,
      });

      expect(dataset.stats.totalEvidenceItems).toBe(0);
    });
  });

  describe("CopilotRun assignment", () => {
    it("should assign runs to approximately 30% of cases", () => {
      const dataset = generateSyntheticDataset({
        size: "large",
        seed: 42,
        includeSpecialCategory: true,
        includeFinancial: true,
        includeHR: true,
        includeOcrImages: false,
        includeMockIntegrations: true,
      });

      const withRuns = dataset.cases.filter((c) => c.copilotRun !== null).length;
      expect(withRuns).toBeGreaterThan(0);
      expect(withRuns).toBeLessThan(dataset.cases.length * 0.6);
    });
  });
});

// =========================================================================
// 9. Safety Mode Validation
// =========================================================================
describe("Safety Mode Validation", () => {
  it("should allow in development mode", () => {
    expect(validateSyntheticMode("development")).toBeNull();
  });

  it("should allow for demo tenant", () => {
    expect(validateSyntheticMode("demo_tenant", true)).toBeNull();
  });

  it("should allow with explicit setting", () => {
    expect(validateSyntheticMode("explicit_setting", false, true)).toBeNull();
  });

  it("should reject without proper environment", () => {
    expect(validateSyntheticMode(null)).not.toBeNull();
  });

  it("should reject demo_tenant when isDemoTenant is false", () => {
    expect(validateSyntheticMode("demo_tenant", false)).not.toBeNull();
  });

  it("should reject explicit_setting when not enabled", () => {
    expect(validateSyntheticMode("explicit_setting", false, false)).not.toBeNull();
  });
});

// =========================================================================
// 10. Reset Validation
// =========================================================================
describe("Reset Validation", () => {
  it("should allow reset in development mode", () => {
    expect(validateResetAllowed("development")).toBeNull();
  });

  it("should allow reset for demo tenant", () => {
    expect(validateResetAllowed("demo_tenant", true)).toBeNull();
  });

  it("should reject reset in production", () => {
    expect(validateResetAllowed(null)).not.toBeNull();
  });

  it("should reject reset for non-demo tenant", () => {
    expect(validateResetAllowed("demo_tenant", false)).not.toBeNull();
  });

  it("getResetTargets should list all entity types", () => {
    const targets = getResetTargets();
    expect(targets.length).toBeGreaterThan(10);
    expect(targets).toContain("DSARCase");
    expect(targets).toContain("DataSubject");
    expect(targets).toContain("CopilotRun");
    expect(targets).toContain("EvidenceItem");
    expect(targets).toContain("DetectorResult");
    expect(targets).toContain("Finding");
  });
});

// =========================================================================
// 11. Detection Engine Integration (end-to-end)
// =========================================================================
describe("Detection Engine Integration", () => {
  it("injected email should be detected by detection engine", () => {
    const rng = createSeededRandom(42);
    const persons = generateSyntheticPersons(1, rng);
    const evidence = generateAllEvidence(persons[0], rng, true);
    const firstItem = evidence.allItems[0];

    // Run actual detection on injected text
    const results = runAllDetectors(firstItem.injectedContent.text);
    const categories = classifyFindings(results);
    expect(categories).toContain("CONTACT");
  });

  it("injected Art. 9 keywords should trigger special category detection", () => {
    const person: SyntheticPerson = {
      firstName: "Test", lastName: "Person", fullName: "Test Person",
      email: "test@testcorp.local", upn: "test@testcorp.onmicrosoft.com",
      employeeId: "EMP-100001", customerId: "KNR-200001",
      phone: "+49 170 5551234", iban: "DE12345678901234567890",
      address: "Hauptstrasse 10, 10115 Berlin", dateOfBirth: "1985-06-15",
      confidenceScore: 95, includeFinancial: false, includeHR: false,
      includeArt9: true, art9Categories: ["HEALTH"],
    };

    const rng = createSeededRandom(42);
    const content = injectPII(person, rng, {
      includeArt9: true,
      art9Categories: ["HEALTH"],
    });

    const results = runAllDetectors(content.text);
    expect(hasSpecialCategory(results)).toBe(true);
    const specCats = getSpecialCategories(results);
    expect(specCats).toContain("HEALTH");
  });

  it("full dataset detection should work without errors", () => {
    const dataset = generateSyntheticDataset({
      size: "small",
      seed: 42,
      includeSpecialCategory: true,
      includeFinancial: true,
      includeHR: true,
      includeOcrImages: false,
      includeMockIntegrations: true,
    });

    let totalDetections = 0;
    for (const c of dataset.cases) {
      for (const item of c.evidence.allItems) {
        const results = runAllDetectors(item.injectedContent.text);
        totalDetections += results.length;
      }
    }

    expect(totalDetections).toBeGreaterThan(0);
  });
});

// =========================================================================
// 12. All Synthetic Data is 100% Synthetic
// =========================================================================
describe("Data Authenticity Checks", () => {
  it("no real IBAN should be generated", () => {
    const dataset = generateSyntheticDataset({
      size: "medium", seed: 42,
      includeSpecialCategory: true, includeFinancial: true,
      includeHR: true, includeOcrImages: false, includeMockIntegrations: true,
    });

    // Known real IBANs that must NOT appear
    const realIbans = ["DE89370400440532013000", "DE02120300000000202051", "DE02100500000024290661"];
    for (const person of dataset.persons) {
      expect(realIbans).not.toContain(person.iban);
    }
  });

  it("all emails should use @testcorp.local domain", () => {
    const dataset = generateSyntheticDataset({
      size: "medium", seed: 42,
      includeSpecialCategory: true, includeFinancial: true,
      includeHR: true, includeOcrImages: false, includeMockIntegrations: true,
    });

    for (const person of dataset.persons) {
      expect(person.email).toContain("@testcorp.local");
    }
  });

  it("all UPNs should use @testcorp.onmicrosoft.com domain", () => {
    const dataset = generateSyntheticDataset({
      size: "small", seed: 42,
      includeSpecialCategory: true, includeFinancial: true,
      includeHR: true, includeOcrImages: false, includeMockIntegrations: true,
    });

    for (const person of dataset.persons) {
      expect(person.upn).toContain("@testcorp.onmicrosoft.com");
    }
  });

  it("all evidence items should be marked as synthetic", () => {
    const dataset = generateSyntheticDataset({
      size: "small", seed: 42,
      includeSpecialCategory: true, includeFinancial: true,
      includeHR: true, includeOcrImages: false, includeMockIntegrations: true,
    });

    for (const c of dataset.cases) {
      for (const item of c.evidence.allItems) {
        expect((item.metadata as any).synthetic).toBe(true);
      }
    }
  });
});
