/**
 * Synthetic Person Generator — Privacy Copilot
 *
 * Generates realistic but 100% synthetic identity profiles.
 * All names, emails, IBANs, phone numbers etc. are fictional.
 * Uses a seeded PRNG for reproducibility.
 */

import type { SeededRandom } from "./random";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyntheticPerson {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  upn: string;
  employeeId: string;
  customerId: string;
  phone: string;
  iban: string;
  address: string;
  dateOfBirth: string | null;
  confidenceScore: number;
  /** Data category flags */
  includeFinancial: boolean;
  includeHR: boolean;
  includeArt9: boolean;
  /** Specific Art. 9 categories for this person */
  art9Categories: string[];
}

// ---------------------------------------------------------------------------
// Name pools (synthetic, DE + EN mix)
// ---------------------------------------------------------------------------

const FIRST_NAMES_DE = [
  "Lukas", "Anna", "Felix", "Marie", "Maximilian", "Sophie", "Jonas",
  "Emma", "Leon", "Mia", "Elias", "Hannah", "Noah", "Lea", "Paul",
  "Lena", "Ben", "Laura", "Finn", "Clara", "Moritz", "Sophia",
  "Niklas", "Emilia", "Tim", "Amelie", "David", "Julia", "Jan",
  "Sarah", "Tom", "Katharina", "Tobias", "Lina", "Alexander",
];

const FIRST_NAMES_EN = [
  "James", "Emily", "Oliver", "Charlotte", "William", "Amelia",
  "Henry", "Sophia", "Benjamin", "Isabella", "Lucas", "Mia",
  "Mason", "Harper", "Ethan", "Evelyn", "Daniel", "Abigail",
  "Jack", "Elizabeth", "Michael", "Grace", "Thomas", "Victoria",
  "Robert", "Alice", "George", "Emma", "Andrew", "Catherine",
];

const LAST_NAMES = [
  "Mueller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer",
  "Wagner", "Becker", "Schulz", "Hoffmann", "Schaefer", "Koch",
  "Bauer", "Richter", "Klein", "Wolf", "Schroeder", "Neumann",
  "Schwarz", "Zimmermann", "Braun", "Hartmann", "Krueger", "Werner",
  "Lange", "Schmitt", "Meier", "Huber", "Kaiser", "Fuchs",
  "Peters", "Lang", "Scholz", "Moeller", "Weiss", "Jung",
  "Hahn", "Schubert", "Vogel", "Friedrich", "Keller", "Guenther",
  "Frank", "Berger", "Winkler", "Roth", "Beck", "Lorenz",
  "Baumann", "Franke",
];

const STREETS_DE = [
  "Hauptstrasse", "Bahnhofstrasse", "Schulstrasse", "Gartenstrasse",
  "Dorfstrasse", "Berliner Strasse", "Muenchner Weg", "Am Markt",
  "Lindenallee", "Kirchweg", "Rosenweg", "Waldstrasse",
  "Brunnenweg", "Parkstrasse", "Schillerstrasse", "Goetheweg",
];

const CITIES_DE = [
  "Berlin", "Hamburg", "Muenchen", "Koeln", "Frankfurt am Main",
  "Stuttgart", "Duesseldorf", "Leipzig", "Dortmund", "Essen",
  "Bremen", "Dresden", "Hannover", "Nuernberg", "Duisburg",
  "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Muenster",
];

const ART9_CATEGORY_POOL = ["HEALTH", "RELIGION", "UNION", "POLITICAL_OPINION", "OTHER_SPECIAL_CATEGORY"];

// ---------------------------------------------------------------------------
// IBAN generation (synthetisch, NICHT real existierend)
// ---------------------------------------------------------------------------

/**
 * Generate a synthetisch IBAN that looks realistic but is NOT real.
 * Uses DE prefix with random digits. Does NOT pass real checksum validation
 * on purpose — these are test IBANs.
 */
function generateSyntheticIBAN(rng: SeededRandom): string {
  const checkDigits = String(rng.int(10, 99));
  const bankCode = String(rng.int(10000000, 99999999));
  const accountNumber = String(rng.int(1000000000, 9999999999));
  return `DE${checkDigits}${bankCode}${accountNumber}`;
}

/**
 * Generate a synthetic phone number.
 */
function generateSyntheticPhone(rng: SeededRandom): string {
  const prefix = rng.pick(["+49 170", "+49 171", "+49 172", "+49 176", "+49 177", "+49 178", "+49 151", "+49 152"]);
  const number = String(rng.int(1000000, 9999999));
  return `${prefix} ${number}`;
}

/**
 * Generate a synthetic German postal code.
 */
function generatePostalCode(rng: SeededRandom): string {
  return String(rng.int(10000, 99999));
}

// ---------------------------------------------------------------------------
// Person generator
// ---------------------------------------------------------------------------

/**
 * Generate a batch of synthetic persons.
 *
 * Distribution rules:
 *   - 20% include Financial Data
 *   - 15% include HR-sensitive data
 *   - 10% include Art. 9 data
 *   - 5% include multiple categories
 */
export function generateSyntheticPersons(
  count: number,
  rng: SeededRandom,
  options: {
    includeSpecialCategory?: boolean;
    includeFinancial?: boolean;
    includeHR?: boolean;
  } = {},
): SyntheticPerson[] {
  const persons: SyntheticPerson[] = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < count; i++) {
    // Mix DE and EN names
    const useGerman = rng.chance(0.6);
    const firstName = useGerman
      ? rng.pick(FIRST_NAMES_DE)
      : rng.pick(FIRST_NAMES_EN);
    const lastName = rng.pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;

    // Generate unique email
    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@testcorp.local`;
    let counter = 1;
    while (usedEmails.has(email)) {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${counter}@testcorp.local`;
      counter++;
    }
    usedEmails.add(email);

    const upn = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@testcorp.onmicrosoft.com`;
    const employeeId = `EMP-${String(rng.int(100000, 999999))}`;
    const customerId = `KNR-${String(rng.int(100000, 999999))}`;
    const phone = generateSyntheticPhone(rng);
    const iban = generateSyntheticIBAN(rng);

    const houseNumber = rng.int(1, 200);
    const street = rng.pick(STREETS_DE);
    const postalCode = generatePostalCode(rng);
    const city = rng.pick(CITIES_DE);
    const address = `${street} ${houseNumber}, ${postalCode} ${city}`;

    const dateOfBirth = rng.chance(0.7)
      ? `${rng.int(1960, 2000)}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`
      : null;

    const confidenceScore = rng.int(80, 100);

    // Category assignment
    const fraction = i / count;
    let includeFinancial = options.includeFinancial !== false && rng.chance(0.20);
    let includeHR = options.includeHR !== false && rng.chance(0.15);
    let includeArt9 = options.includeSpecialCategory !== false && rng.chance(0.10);

    // 5% multi-category
    if (rng.chance(0.05)) {
      includeFinancial = true;
      includeHR = true;
      includeArt9 = options.includeSpecialCategory !== false;
    }

    // Art. 9 categories
    const art9Categories: string[] = [];
    if (includeArt9) {
      const numCategories = rng.int(1, 2);
      const shuffled = rng.shuffle(ART9_CATEGORY_POOL);
      for (let j = 0; j < numCategories; j++) {
        art9Categories.push(shuffled[j]);
      }
    }

    persons.push({
      firstName,
      lastName,
      fullName,
      email,
      upn,
      employeeId,
      customerId,
      phone,
      iban,
      address,
      dateOfBirth,
      confidenceScore,
      includeFinancial,
      includeHR,
      includeArt9,
      art9Categories,
    });
  }

  return persons;
}
