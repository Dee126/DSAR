/**
 * Synthetic Evidence Generator — Mock Integration Mode
 *
 * Generates synthetic EvidenceItems simulating data from:
 *   - M365 / Exchange (emails)
 *   - SharePoint (files)
 *   - OneDrive (personal files)
 *
 * Each evidence item includes realistic metadata, titles, and locations.
 * Content is generated via the PII Injection Engine.
 */

import type { SeededRandom } from "./random";
import type { SyntheticPerson } from "./persons";
import { injectPII, injectSinglePII } from "./pii-injection";
import type { InjectedContent } from "./pii-injection";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyntheticEvidenceItem {
  provider: string;
  workload: string;
  itemType: string;
  location: string;
  title: string;
  contentHandling: string;
  createdAtSource: Date;
  modifiedAtSource: Date;
  metadata: Record<string, unknown>;
  /** Injected text content for detection engine testing */
  injectedContent: InjectedContent;
  sensitivityScore: number;
}

export interface SyntheticCaseEvidence {
  person: SyntheticPerson;
  exchangeItems: SyntheticEvidenceItem[];
  sharePointItems: SyntheticEvidenceItem[];
  oneDriveItems: SyntheticEvidenceItem[];
  allItems: SyntheticEvidenceItem[];
}

// ---------------------------------------------------------------------------
// Email subject pools
// ---------------------------------------------------------------------------

const EMAIL_SUBJECTS_NORMAL = [
  "Re: Quarterly report Q{quarter} {year}",
  "Meeting notes - Team Sync {date}",
  "Invoice #{invoiceNum} - {month} {year}",
  "Your order confirmation #{orderId}",
  "Weekly status update",
  "Re: Project timeline discussion",
  "Feedback on presentation",
  "Holiday planning {year}",
  "Re: Offboarding checklist",
  "System access request for {name}",
];

const EMAIL_SUBJECTS_SENSITIVE = [
  "Krankmeldung {name} - {date}",
  "Gehaltsabrechnung {month} {year}",
  "Vertraulich: Disziplinarmaßnahme {name}",
  "Arztbericht - Vertraulich",
  "Bankverbindung Aktualisierung",
  "Kirchensteuer Bescheinigung {year}",
  "Betriebsratssitzung Protokoll {date}",
  "Performance Review {name} - Q{quarter}",
];

// ---------------------------------------------------------------------------
// SharePoint file pools
// ---------------------------------------------------------------------------

const SP_FILES_HR = [
  { name: "Payroll_{year}_{name}.pdf", path: "/HR/Payroll/" },
  { name: "Employment_Contract_{name}.pdf", path: "/HR/Contracts/" },
  { name: "Performance_Review_{name}_{year}.docx", path: "/HR/Reviews/" },
  { name: "Onboarding_Checklist_{name}.xlsx", path: "/HR/Onboarding/" },
  { name: "Disciplinary_Note_{name}_{date}.pdf", path: "/HR/Disciplinary/" },
];

const SP_FILES_FINANCE = [
  { name: "Invoice_{invoiceNum}_{name}.pdf", path: "/Finance/Invoices/" },
  { name: "Expense_Report_{name}_{month}_{year}.xlsx", path: "/Finance/Expenses/" },
  { name: "Bank_Details_{name}.pdf", path: "/Finance/Banking/" },
  { name: "Tax_Certificate_{name}_{year}.pdf", path: "/Finance/Tax/" },
];

const SP_FILES_SALES = [
  { name: "Contract_{customerId}_{name}.docx", path: "/Sales/Contracts/" },
  { name: "CRM_Export_{name}.csv", path: "/Sales/CRM/" },
  { name: "Proposal_{customerId}.pdf", path: "/Sales/Proposals/" },
];

const SP_FILES_GENERAL = [
  { name: "Meeting_Notes_{date}.docx", path: "/General/Meetings/" },
  { name: "Project_Plan_{year}.xlsx", path: "/General/Projects/" },
  { name: "Policy_Document_v{version}.pdf", path: "/General/Policies/" },
];

// ---------------------------------------------------------------------------
// OneDrive file pools
// ---------------------------------------------------------------------------

const OD_FILES = [
  { name: "Bewerbung_{name}.pdf", sensitive: false },
  { name: "Lebenslauf_{name}.docx", sensitive: false },
  { name: "Krankmeldung_{year}.pdf", sensitive: true },
  { name: "Bankverbindung.txt", sensitive: true },
  { name: "Steuerbescheid_{year}.pdf", sensitive: true },
  { name: "Arbeitszeugnis.pdf", sensitive: false },
  { name: "Gehaltsnachweis_{month}_{year}.pdf", sensitive: true },
  { name: "Privatfotos_{year}.zip", sensitive: false },
  { name: "Versicherungskarte.jpg", sensitive: true },
  { name: "Notizen_Arztbesuch.txt", sensitive: true },
];

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function fillTitle(template: string, person: SyntheticPerson, rng: SeededRandom): string {
  const year = String(rng.int(2022, 2025));
  const quarter = String(rng.int(1, 4));
  const month = rng.pick(["Januar", "Februar", "Maerz", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"]);
  const day = String(rng.int(1, 28)).padStart(2, "0");
  const monthNum = String(rng.int(1, 12)).padStart(2, "0");
  const date = `${day}.${monthNum}.${year}`;

  return template
    .replace(/\{name\}/g, person.lastName)
    .replace(/\{year\}/g, year)
    .replace(/\{quarter\}/g, quarter)
    .replace(/\{month\}/g, month)
    .replace(/\{date\}/g, date)
    .replace(/\{invoiceNum\}/g, String(rng.int(10000, 99999)))
    .replace(/\{orderId\}/g, String(rng.int(100000, 999999)))
    .replace(/\{customerId\}/g, person.customerId)
    .replace(/\{version\}/g, `${rng.int(1, 5)}.${rng.int(0, 9)}`);
}

function generateSourceDate(rng: SeededRandom): Date {
  const year = rng.int(2022, 2025);
  const month = rng.int(0, 11);
  const day = rng.int(1, 28);
  const hour = rng.int(6, 22);
  const min = rng.int(0, 59);
  return new Date(year, month, day, hour, min);
}

// ---------------------------------------------------------------------------
// Exchange (Email) evidence generator
// ---------------------------------------------------------------------------

export function generateExchangeEvidence(
  person: SyntheticPerson,
  rng: SeededRandom,
): SyntheticEvidenceItem[] {
  const count = rng.int(5, 20);
  const items: SyntheticEvidenceItem[] = [];

  for (let i = 0; i < count; i++) {
    const isSensitive = rng.chance(0.3);
    const subjects = isSensitive ? EMAIL_SUBJECTS_SENSITIVE : EMAIL_SUBJECTS_NORMAL;
    const subject = fillTitle(rng.pick(subjects), person, rng);

    const createdAt = generateSourceDate(rng);
    const modifiedAt = new Date(createdAt.getTime() + rng.int(0, 86400000));

    const hasAttachment = rng.chance(0.3);
    const attachmentType = hasAttachment ? rng.pick(["PDF", "DOCX", "XLSX"]) : null;

    const content = injectPII(person, rng, {
      includeFinancial: isSensitive && person.includeFinancial,
      includeHR: isSensitive && person.includeHR,
      includeArt9: isSensitive && person.includeArt9,
      art9Categories: person.art9Categories,
    });

    items.push({
      provider: "EXCHANGE_ONLINE",
      workload: "EXCHANGE",
      itemType: "EMAIL",
      location: `EXCHANGE_ONLINE:Mailbox:${person.email}/Inbox`,
      title: subject,
      contentHandling: "METADATA_ONLY",
      createdAtSource: createdAt,
      modifiedAtSource: modifiedAt,
      metadata: {
        from: person.email,
        to: "dsar-team@testcorp.local",
        subject,
        hasAttachments: hasAttachment,
        attachmentType,
        importance: rng.pick(["low", "normal", "high"]),
        synthetic: true,
      },
      injectedContent: content,
      sensitivityScore: isSensitive ? rng.int(60, 95) : rng.int(10, 40),
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// SharePoint evidence generator
// ---------------------------------------------------------------------------

export function generateSharePointEvidence(
  person: SyntheticPerson,
  rng: SeededRandom,
): SyntheticEvidenceItem[] {
  const count = rng.int(3, 10);
  const items: SyntheticEvidenceItem[] = [];

  const filePools: Array<{ name: string; path: string }[]> = [SP_FILES_GENERAL];
  if (person.includeHR) filePools.push(SP_FILES_HR);
  if (person.includeFinancial) filePools.push(SP_FILES_FINANCE);
  filePools.push(SP_FILES_SALES);

  const allFiles = filePools.flat();

  for (let i = 0; i < count; i++) {
    const fileTemplate = rng.pick(allFiles);
    const fileName = fillTitle(fileTemplate.name, person, rng);
    const filePath = fileTemplate.path;

    const createdAt = generateSourceDate(rng);
    const modifiedAt = new Date(createdAt.getTime() + rng.int(0, 86400000 * 30));

    const isHRFile = filePath.startsWith("/HR/");
    const isFinanceFile = filePath.startsWith("/Finance/");

    const content = injectPII(person, rng, {
      includeFinancial: isFinanceFile || person.includeFinancial,
      includeHR: isHRFile || person.includeHR,
      includeArt9: isHRFile && person.includeArt9,
      art9Categories: person.art9Categories,
    });

    const ext = fileName.split(".").pop() ?? "pdf";
    const contentType =
      ext === "pdf" ? "application/pdf" :
      ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
      ext === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :
      ext === "csv" ? "text/csv" :
      "application/octet-stream";

    items.push({
      provider: "SHAREPOINT",
      workload: "SHAREPOINT",
      itemType: "FILE",
      location: `SHAREPOINT:sites/testcorp${filePath}${fileName}`,
      title: fileName,
      contentHandling: "METADATA_ONLY",
      createdAtSource: createdAt,
      modifiedAtSource: modifiedAt,
      metadata: {
        fileName,
        filePath,
        contentType,
        sizeBytes: rng.int(10240, 5242880),
        createdBy: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@testcorp.local`,
        modifiedBy: rng.pick([
          `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase()}@testcorp.local`,
          "admin@testcorp.local",
          "hr-system@testcorp.local",
        ]),
        synthetic: true,
      },
      injectedContent: content,
      sensitivityScore: isHRFile || isFinanceFile
        ? rng.int(50, 90)
        : rng.int(5, 35),
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// OneDrive evidence generator
// ---------------------------------------------------------------------------

export function generateOneDriveEvidence(
  person: SyntheticPerson,
  rng: SeededRandom,
): SyntheticEvidenceItem[] {
  const count = rng.int(2, 6);
  const items: SyntheticEvidenceItem[] = [];
  const selectedFiles = rng.sample(OD_FILES, count);

  for (const fileTemplate of selectedFiles) {
    const fileName = fillTitle(fileTemplate.name, person, rng);
    const createdAt = generateSourceDate(rng);
    const modifiedAt = new Date(createdAt.getTime() + rng.int(0, 86400000 * 7));

    const content = injectPII(person, rng, {
      includeFinancial: fileTemplate.sensitive && person.includeFinancial,
      includeHR: fileTemplate.sensitive && person.includeHR,
      includeArt9: fileTemplate.sensitive && person.includeArt9,
      art9Categories: person.art9Categories,
    });

    items.push({
      provider: "ONEDRIVE",
      workload: "ONEDRIVE",
      itemType: "FILE",
      location: `ONEDRIVE:personal/${person.upn}/Documents/${fileName}`,
      title: fileName,
      contentHandling: "METADATA_ONLY",
      createdAtSource: createdAt,
      modifiedAtSource: modifiedAt,
      metadata: {
        fileName,
        owner: person.email,
        sizeBytes: rng.int(5120, 2097152),
        synthetic: true,
      },
      injectedContent: content,
      sensitivityScore: fileTemplate.sensitive
        ? rng.int(50, 85)
        : rng.int(5, 30),
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Combined evidence generator for a person
// ---------------------------------------------------------------------------

export function generateAllEvidence(
  person: SyntheticPerson,
  rng: SeededRandom,
  includeMockIntegrations: boolean = true,
): SyntheticCaseEvidence {
  if (!includeMockIntegrations) {
    return {
      person,
      exchangeItems: [],
      sharePointItems: [],
      oneDriveItems: [],
      allItems: [],
    };
  }

  const exchangeItems = generateExchangeEvidence(person, rng);
  const sharePointItems = generateSharePointEvidence(person, rng);
  const oneDriveItems = generateOneDriveEvidence(person, rng);

  return {
    person,
    exchangeItems,
    sharePointItems,
    oneDriveItems,
    allItems: [...exchangeItems, ...sharePointItems, ...oneDriveItems],
  };
}
