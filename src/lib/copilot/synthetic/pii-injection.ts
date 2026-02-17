/**
 * PII Injection Engine — Synthetic Data
 *
 * Injects realistic PII patterns into synthetic text content.
 * Used to create test data that exercises the Detection Engine.
 *
 * Categories:
 *   - Normal: email, phone, address, customer number, contract number, IP
 *   - Financial: IBAN, credit card-like, bank account
 *   - HR: salary, performance, disciplinary, vacation
 *   - Art. 9: health, religion, union, political keywords
 */

import type { SeededRandom } from "./random";
import type { SyntheticPerson } from "./persons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InjectedContent {
  text: string;
  injectedPiiTypes: string[];
  containsSpecialCategory: boolean;
  specialCategories: string[];
}

// ---------------------------------------------------------------------------
// Text templates
// ---------------------------------------------------------------------------

const EMAIL_TEMPLATES = [
  "Please contact {name} at {email} for further details.",
  "From: {email}\nTo: info@testcorp.local\nSubject: Follow-up on request\n\nDear Team,\nplease process the request for {name}.",
  "CC: {email}\nThe data subject {name} has requested access to their personal data.",
];

const PHONE_TEMPLATES = [
  "Phone: {phone}. Please call between 9:00 and 17:00.",
  "Erreichbar unter {phone} (Mobilnummer von {name}).",
  "Emergency contact number: {phone}",
];

const ADDRESS_TEMPLATES = [
  "Wohnort: {address}",
  "The data subject resides at {address}.",
  "Lieferadresse: {name}, {address}",
];

const CUSTOMER_TEMPLATES = [
  "Kundennummer: {customerId}",
  "Vertragsnummer: VTR-{contractId}\nKundennummer: {customerId}",
  "Referenz: {customerId} / Vertrag VTR-{contractId}",
];

const IP_TEMPLATES = [
  "Login from IP: {ip} at {timestamp}",
  "Last access: {ip}, User-Agent: Mozilla/5.0",
  "Server log: {ip} - GET /api/user/{userId} 200",
];

const FINANCIAL_TEMPLATES = [
  "Bankverbindung:\nIBAN: {iban}\nKontoinhaber: {name}",
  "Abbuchung von IBAN {iban}, Betrag: {amount} EUR",
  "Kreditkartenähnliche Referenz: {creditCard}\nKonto: {bankAccount}",
  "Gehaltskonto: {iban}\nMonatliche Überweisung: {amount} EUR",
];

const HR_TEMPLATES = [
  "Mitarbeiter: {name} ({employeeId})\nBruttogehalt: {salary} EUR/Monat\nPosition: {position}",
  "Performance Review 2024:\nMitarbeiter: {name}\nBewertung: {rating}/5\nKommentar: {comment}",
  "Disziplinarmaßnahme:\nBetrifft: {name} ({employeeId})\nGrund: {reason}\nDatum: {date}",
  "Urlaubsantrag: {name}\nResturlaub: {vacationDays} Tage\nBeantragt: {requestedDays} Tage",
];

const HEALTH_KEYWORDS_DE = [
  "Krankschreibung für {name} vom {date}. Diagnose: akute Bronchitis.",
  "Arztbericht: Patient {name}, Behandlung wegen chronischer Rückenschmerzen.",
  "Die Krankenkasse bestätigt den Aufenthalt von {name} zur stationären Behandlung.",
  "Medikamentenplan für Patient {name}: Ibuprofen 400mg, 3x täglich. Diagnose: Erkältung.",
  "Gesundheitszeugnis für Patient {name}: arbeitsfähig. Letzte Untersuchung am {date}.",
];

const RELIGION_KEYWORDS_DE = [
  "Kirchensteuer: {name} zahlt monatlich {amount} EUR an die katholische Kirche.",
  "Konfession: evangelisch. Kirchenmitgliedschaft seit {date}.",
  "Antrag auf Befreiung von der Kirchensteuer (Konfession: muslimisch).",
];

const UNION_KEYWORDS_DE = [
  "Gewerkschaftsmitgliedschaft: {name} ist Mitglied der IG Metall seit {date}.",
  "Betriebsratssitzung: Teilnehmer {name}. Tagesordnung: Tarifverhandlungen.",
  "ver.di Mitgliedsbeitrag: {amount} EUR/Monat.",
];

const POLITICAL_KEYWORDS_DE = [
  "Politische Meinung: Notiz aus Personalgespräch, Mitglied der Partei seit {date}.",
  "Parteienzugehörigkeit: {name} ist aktives Mitglied einer politischen Partei.",
];

// ---------------------------------------------------------------------------
// Generator helpers
// ---------------------------------------------------------------------------

function generateSyntheticIP(rng: SeededRandom): string {
  return `${rng.int(10, 192)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
}

function generateTimestamp(rng: SeededRandom): string {
  const year = rng.int(2022, 2025);
  const month = String(rng.int(1, 12)).padStart(2, "0");
  const day = String(rng.int(1, 28)).padStart(2, "0");
  const hour = String(rng.int(0, 23)).padStart(2, "0");
  const min = String(rng.int(0, 59)).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${min}:00Z`;
}

function generateDate(rng: SeededRandom): string {
  const year = rng.int(2020, 2025);
  const month = String(rng.int(1, 12)).padStart(2, "0");
  const day = String(rng.int(1, 28)).padStart(2, "0");
  return `${day}.${month}.${year}`;
}

function generateSyntheticCreditCard(rng: SeededRandom): string {
  // Generate a 16-digit number starting with 4 (Visa-like) — NOT Luhn-valid
  const digits = `4${rng.int(100, 999)}${rng.int(1000, 9999)}${rng.int(1000, 9999)}${rng.int(1000, 9999)}`;
  return digits.slice(0, 16);
}

function generateSyntheticBankAccount(rng: SeededRandom): string {
  return String(rng.int(1000000000, 9999999999));
}

const POSITIONS = ["Software Engineer", "Marketing Manager", "Sales Representative", "HR Specialist", "Accountant", "Product Manager"];
const RATINGS = ["3", "4", "5", "2", "1"];
const HR_COMMENTS = ["Exceeds expectations", "Meets expectations", "Needs improvement", "Outstanding performance"];
const DISCIPLINARY_REASONS = ["Wiederholte Verspätung", "Verstoß gegen IT-Richtlinien", "Unangemessenes Verhalten"];

// ---------------------------------------------------------------------------
// Main injection function
// ---------------------------------------------------------------------------

/**
 * Generate injected content for a synthetic person.
 * Returns text with embedded PII patterns that the Detection Engine can find.
 */
export function injectPII(
  person: SyntheticPerson,
  rng: SeededRandom,
  options: {
    includeFinancial?: boolean;
    includeHR?: boolean;
    includeArt9?: boolean;
    art9Categories?: string[];
  } = {},
): InjectedContent {
  const parts: string[] = [];
  const injectedTypes: string[] = [];
  const specialCategories: string[] = [];

  // --- Normal PII ---
  // Email
  const emailTemplate = rng.pick(EMAIL_TEMPLATES);
  parts.push(fillTemplate(emailTemplate, person, rng));
  injectedTypes.push("EMAIL_ADDRESS");

  // Phone
  if (rng.chance(0.7)) {
    const phoneTemplate = rng.pick(PHONE_TEMPLATES);
    parts.push(fillTemplate(phoneTemplate, person, rng));
    injectedTypes.push("PHONE");
  }

  // Address
  if (rng.chance(0.6)) {
    const addressTemplate = rng.pick(ADDRESS_TEMPLATES);
    parts.push(fillTemplate(addressTemplate, person, rng));
    injectedTypes.push("ADDRESS");
  }

  // Customer/contract number
  if (rng.chance(0.5)) {
    const custTemplate = rng.pick(CUSTOMER_TEMPLATES);
    parts.push(fillTemplate(custTemplate, person, rng));
    injectedTypes.push("CUSTOMER_NUMBER");
  }

  // IP address
  if (rng.chance(0.4)) {
    const ipTemplate = rng.pick(IP_TEMPLATES);
    parts.push(fillTemplate(ipTemplate, person, rng));
    injectedTypes.push("IP_ADDRESS");
  }

  // --- Financial PII ---
  if (options.includeFinancial ?? person.includeFinancial) {
    const finTemplate = rng.pick(FINANCIAL_TEMPLATES);
    parts.push(fillTemplate(finTemplate, person, rng));
    injectedTypes.push("IBAN", "CREDIT_CARD", "BANK_ACCOUNT");
  }

  // --- HR PII ---
  if (options.includeHR ?? person.includeHR) {
    const hrTemplate = rng.pick(HR_TEMPLATES);
    parts.push(fillTemplate(hrTemplate, person, rng));
    injectedTypes.push("EMPLOYEE_ID", "SALARY", "HR_DATA");
  }

  // --- Art. 9 PII ---
  const art9Cats = options.art9Categories ?? person.art9Categories;
  const includeArt9 = (options.includeArt9 ?? person.includeArt9) && art9Cats.length > 0;

  if (includeArt9) {
    for (const category of art9Cats) {
      const templates = getArt9Templates(category);
      if (templates.length > 0) {
        const template = rng.pick(templates);
        parts.push(fillTemplate(template, person, rng));
        specialCategories.push(category);
        injectedTypes.push(`ART9_${category}`);
      }
    }
  }

  return {
    text: parts.join("\n\n"),
    injectedPiiTypes: injectedTypes,
    containsSpecialCategory: specialCategories.length > 0,
    specialCategories,
  };
}

/**
 * Generate a simple PII text snippet for a specific category.
 */
export function injectSinglePII(
  person: SyntheticPerson,
  piiType: string,
  rng: SeededRandom,
): string {
  switch (piiType) {
    case "EMAIL":
      return `Contact: ${person.email}`;
    case "PHONE":
      return `Tel: ${person.phone}`;
    case "IBAN":
      return `IBAN: ${person.iban}`;
    case "ADDRESS":
      return `Adresse: ${person.address}`;
    case "EMPLOYEE_ID":
      return `Mitarbeiter-Nr: ${person.employeeId}`;
    case "CUSTOMER_NUMBER":
      return `Kundennummer: ${person.customerId}`;
    case "IP_ADDRESS":
      return `IP: ${generateSyntheticIP(rng)}`;
    default:
      return `Data for ${person.fullName}`;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getArt9Templates(category: string): string[] {
  switch (category) {
    case "HEALTH":
      return HEALTH_KEYWORDS_DE;
    case "RELIGION":
      return RELIGION_KEYWORDS_DE;
    case "UNION":
      return UNION_KEYWORDS_DE;
    case "POLITICAL_OPINION":
      return POLITICAL_KEYWORDS_DE;
    default:
      return HEALTH_KEYWORDS_DE; // fallback
  }
}

function fillTemplate(template: string, person: SyntheticPerson, rng: SeededRandom): string {
  return template
    .replace(/\{name\}/g, person.fullName)
    .replace(/\{email\}/g, person.email)
    .replace(/\{phone\}/g, person.phone)
    .replace(/\{address\}/g, person.address)
    .replace(/\{customerId\}/g, person.customerId)
    .replace(/\{employeeId\}/g, person.employeeId)
    .replace(/\{iban\}/g, person.iban)
    .replace(/\{upn\}/g, person.upn)
    .replace(/\{contractId\}/g, String(rng.int(100000, 999999)))
    .replace(/\{ip\}/g, generateSyntheticIP(rng))
    .replace(/\{timestamp\}/g, generateTimestamp(rng))
    .replace(/\{date\}/g, generateDate(rng))
    .replace(/\{amount\}/g, String(rng.int(50, 8000)))
    .replace(/\{salary\}/g, String(rng.int(2500, 12000)))
    .replace(/\{creditCard\}/g, generateSyntheticCreditCard(rng))
    .replace(/\{bankAccount\}/g, generateSyntheticBankAccount(rng))
    .replace(/\{position\}/g, rng.pick(POSITIONS))
    .replace(/\{rating\}/g, rng.pick(RATINGS))
    .replace(/\{comment\}/g, rng.pick(HR_COMMENTS))
    .replace(/\{reason\}/g, rng.pick(DISCIPLINARY_REASONS))
    .replace(/\{vacationDays\}/g, String(rng.int(5, 30)))
    .replace(/\{requestedDays\}/g, String(rng.int(1, 14)))
    .replace(/\{userId\}/g, String(rng.int(1000, 9999)));
}
