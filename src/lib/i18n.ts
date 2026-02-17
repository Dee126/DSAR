/**
 * Minimal i18n system — DE/EN
 *
 * Usage:
 *   import { useT } from "@/lib/i18n";
 *   const t = useT();
 *   <h1>{t("cases.title")}</h1>
 *
 * Language is determined by:
 *   1. localStorage "lang" key
 *   2. navigator.language prefix
 *   3. Default: "en"
 */

export type Locale = "en" | "de";

export type TranslationKey = keyof typeof en;

const en = {
  // Common
  "common.loading": "Loading...",
  "common.error": "Something went wrong",
  "common.retry": "Retry",
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.delete": "Delete",
  "common.confirm": "Confirm",
  "common.search": "Search",
  "common.filter": "Filter",
  "common.clearFilters": "Clear filters",
  "common.noResults": "No results found",
  "common.showing": "Showing",
  "common.of": "of",
  "common.results": "results",
  "common.previous": "Previous",
  "common.next": "Next",
  "common.export": "Export",
  "common.download": "Download",
  "common.close": "Close",
  "common.actions": "Actions",
  "common.status": "Status",
  "common.priority": "Priority",
  "common.type": "Type",
  "common.assignee": "Assignee",
  "common.dueDate": "Due Date",
  "common.createdAt": "Created",
  "common.updatedAt": "Updated",
  "common.all": "All",

  // Auth
  "auth.sessionExpired": "Your session has expired. Please sign in again.",
  "auth.noPermission": "You don't have permission to perform this action.",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.welcome": "Welcome back",
  "dashboard.overview": "Here is an overview of your DSAR case activity.",
  "dashboard.totalCases": "Total Cases",
  "dashboard.openCases": "Open Cases",
  "dashboard.dueSoon": "Due Soon",
  "dashboard.overdue": "Overdue",
  "dashboard.assignedToMe": "Assigned to Me",
  "dashboard.recentCases": "Recent Cases",
  "dashboard.integrationHealth": "Integration Health",
  "dashboard.slaCompliance": "SLA Compliance",

  // Cases
  "cases.title": "Cases",
  "cases.subtitle": "Manage all data subject access requests",
  "cases.newCase": "New Case",
  "cases.noResults": "No cases found",
  "cases.noResultsHint": "Adjust your filters or create a new case.",
  "cases.allStatuses": "All Statuses",
  "cases.allTypes": "All Types",
  "cases.allAssignees": "All Assignees",
  "cases.caseNumber": "Case #",
  "cases.subject": "Subject",
  "cases.unassigned": "Unassigned",
  "cases.searchPlaceholder": "Case #, subject name, email...",

  // Case Detail
  "case.overview": "Overview",
  "case.tasks": "Tasks",
  "case.documents": "Documents",
  "case.comments": "Comments",
  "case.communications": "Communications",
  "case.dataCollection": "Data Collection",
  "case.legal": "Legal",

  // Tasks
  "tasks.title": "Tasks",
  "tasks.noTasks": "No tasks yet",
  "tasks.noTasksHint": "Tasks will appear when cases are in progress.",

  // Documents
  "documents.title": "Documents",
  "documents.noDocuments": "No documents yet",
  "documents.noDocumentsHint": "Upload documents from case detail pages.",

  // Export
  "export.button": "Export",
  "export.preparing": "Preparing export...",
  "export.ready": "Export ready",
  "export.failed": "Export failed",
  "export.download": "Download",
  "export.retryMessage": "Export failed. Click retry to try again.",

  // Notifications / Toasts
  "toast.saved": "Changes saved successfully.",
  "toast.deleted": "Item deleted.",
  "toast.error": "An error occurred. Please try again.",
  "toast.networkError": "Unable to connect. Please check your connection.",
  "toast.copied": "Copied to clipboard.",

  // Workflow gating
  "gate.idvRequired": "Identity verification must be completed before advancing.",
  "gate.redactionPending": "Documents must be redacted before response can be sent.",
  "gate.legalHold": "This case is under legal hold. Contact your DPO.",
  "gate.sodViolation": "Separation of duties: a different user must approve this step.",

  // Status labels
  "status.NEW": "New",
  "status.IDENTITY_VERIFICATION": "Identity Verification",
  "status.INTAKE_TRIAGE": "Intake & Triage",
  "status.DATA_COLLECTION": "Data Collection",
  "status.REVIEW_LEGAL": "Legal Review",
  "status.RESPONSE_PREPARATION": "Response Preparation",
  "status.RESPONSE_SENT": "Response Sent",
  "status.CLOSED": "Closed",
  "status.REJECTED": "Rejected",

  // Settings
  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.english": "English",
  "settings.german": "Deutsch",
} as const;

const de: Record<keyof typeof en, string> = {
  // Common
  "common.loading": "Laden...",
  "common.error": "Etwas ist schiefgelaufen",
  "common.retry": "Erneut versuchen",
  "common.cancel": "Abbrechen",
  "common.save": "Speichern",
  "common.delete": "Löschen",
  "common.confirm": "Bestätigen",
  "common.search": "Suchen",
  "common.filter": "Filtern",
  "common.clearFilters": "Filter zurücksetzen",
  "common.noResults": "Keine Ergebnisse gefunden",
  "common.showing": "Anzeige",
  "common.of": "von",
  "common.results": "Ergebnisse",
  "common.previous": "Zurück",
  "common.next": "Weiter",
  "common.export": "Exportieren",
  "common.download": "Herunterladen",
  "common.close": "Schließen",
  "common.actions": "Aktionen",
  "common.status": "Status",
  "common.priority": "Priorität",
  "common.type": "Typ",
  "common.assignee": "Zugewiesen an",
  "common.dueDate": "Fälligkeitsdatum",
  "common.createdAt": "Erstellt",
  "common.updatedAt": "Aktualisiert",
  "common.all": "Alle",

  // Auth
  "auth.sessionExpired": "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  "auth.noPermission": "Sie haben keine Berechtigung für diese Aktion.",

  // Dashboard
  "dashboard.title": "Dashboard",
  "dashboard.welcome": "Willkommen zurück",
  "dashboard.overview": "Hier ist eine Übersicht Ihrer DSAR-Fallaktivitäten.",
  "dashboard.totalCases": "Gesamtfälle",
  "dashboard.openCases": "Offene Fälle",
  "dashboard.dueSoon": "Bald fällig",
  "dashboard.overdue": "Überfällig",
  "dashboard.assignedToMe": "Mir zugewiesen",
  "dashboard.recentCases": "Aktuelle Fälle",
  "dashboard.integrationHealth": "Integrationsstatus",
  "dashboard.slaCompliance": "SLA-Einhaltung",

  // Cases
  "cases.title": "Fälle",
  "cases.subtitle": "Alle Betroffenenanfragen verwalten",
  "cases.newCase": "Neuer Fall",
  "cases.noResults": "Keine Fälle gefunden",
  "cases.noResultsHint": "Passen Sie Ihre Filter an oder erstellen Sie einen neuen Fall.",
  "cases.allStatuses": "Alle Status",
  "cases.allTypes": "Alle Typen",
  "cases.allAssignees": "Alle Zuweisungen",
  "cases.caseNumber": "Fall-Nr.",
  "cases.subject": "Betroffener",
  "cases.unassigned": "Nicht zugewiesen",
  "cases.searchPlaceholder": "Fall-Nr., Name, E-Mail...",

  // Case Detail
  "case.overview": "Übersicht",
  "case.tasks": "Aufgaben",
  "case.documents": "Dokumente",
  "case.comments": "Kommentare",
  "case.communications": "Kommunikation",
  "case.dataCollection": "Datenerhebung",
  "case.legal": "Recht",

  // Tasks
  "tasks.title": "Aufgaben",
  "tasks.noTasks": "Noch keine Aufgaben",
  "tasks.noTasksHint": "Aufgaben erscheinen, wenn Fälle in Bearbeitung sind.",

  // Documents
  "documents.title": "Dokumente",
  "documents.noDocuments": "Noch keine Dokumente",
  "documents.noDocumentsHint": "Laden Sie Dokumente über die Falldetailseiten hoch.",

  // Export
  "export.button": "Exportieren",
  "export.preparing": "Export wird vorbereitet...",
  "export.ready": "Export bereit",
  "export.failed": "Export fehlgeschlagen",
  "export.download": "Herunterladen",
  "export.retryMessage": "Export fehlgeschlagen. Klicken Sie auf Erneut versuchen.",

  // Toasts
  "toast.saved": "Änderungen erfolgreich gespeichert.",
  "toast.deleted": "Element gelöscht.",
  "toast.error": "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  "toast.networkError": "Keine Verbindung. Bitte überprüfen Sie Ihre Netzwerkverbindung.",
  "toast.copied": "In die Zwischenablage kopiert.",

  // Workflow gating
  "gate.idvRequired": "Die Identitätsprüfung muss abgeschlossen sein, bevor Sie fortfahren können.",
  "gate.redactionPending": "Dokumente müssen geschwärzt werden, bevor eine Antwort gesendet werden kann.",
  "gate.legalHold": "Dieser Fall unterliegt einer rechtlichen Sperre. Kontaktieren Sie Ihren DSB.",
  "gate.sodViolation": "Funktionstrennung: Ein anderer Benutzer muss diesen Schritt genehmigen.",

  // Status labels
  "status.NEW": "Neu",
  "status.IDENTITY_VERIFICATION": "Identitätsprüfung",
  "status.INTAKE_TRIAGE": "Eingang & Sichtung",
  "status.DATA_COLLECTION": "Datenerhebung",
  "status.REVIEW_LEGAL": "Rechtliche Prüfung",
  "status.RESPONSE_PREPARATION": "Antwortvorbereitung",
  "status.RESPONSE_SENT": "Antwort gesendet",
  "status.CLOSED": "Geschlossen",
  "status.REJECTED": "Abgelehnt",

  // Settings
  "settings.title": "Einstellungen",
  "settings.language": "Sprache",
  "settings.english": "English",
  "settings.german": "Deutsch",
};

const translations: Record<Locale, Record<string, string>> = { en, de };

let currentLocale: Locale = "en";

/**
 * Detect initial locale from localStorage or browser.
 * Called once on client side.
 */
export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("lang");
  if (stored === "de" || stored === "en") return stored;
  const browserLang = navigator.language?.slice(0, 2);
  return browserLang === "de" ? "de" : "en";
}

export function getLocale(): Locale {
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== "undefined") {
    localStorage.setItem("lang", locale);
  }
}

/**
 * Translation function.
 * Returns the translated string for the given key, or the key itself as fallback.
 */
export function t(key: TranslationKey): string {
  return translations[currentLocale]?.[key] ?? translations.en[key] ?? key;
}

/**
 * React hook for translations.
 * Returns the t() function bound to current locale.
 *
 * Note: This is a simple implementation. Components will re-render
 * on locale change only if parent triggers re-render (e.g., via state).
 */
export function useT(): (key: TranslationKey) => string {
  return t;
}

// Initialize on import (client-side only)
if (typeof window !== "undefined") {
  currentLocale = detectLocale();
}
