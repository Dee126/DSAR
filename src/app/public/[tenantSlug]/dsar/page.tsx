"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

const TEXTS = {
  en: {
    title: "Data Subject Access Request",
    subtitle: "Submit your privacy request securely",
    language: "Preferred language",
    requestTypes: "Request type(s)",
    requestTypesHint: "Select all that apply",
    subjectType: "You are a...",
    email: "Email address",
    phone: "Phone number",
    name: "Full name",
    address: "Postal address",
    customerId: "Customer ID",
    employeeId: "Employee ID",
    details: "Request details",
    detailsHint: "Please describe your request in detail",
    attachments: "Attachments",
    attachmentsHint: "Optional supporting documents (max 5 files, 10MB each)",
    consent: "I confirm that I am the data subject or authorized representative, and the information provided is accurate.",
    privacyNotice: "Privacy Notice",
    submit: "Submit Request",
    submitting: "Submitting...",
    required: "Required",
    optional: "Optional",
    ACCESS: "Access (Right to know)",
    ERASURE: "Erasure (Right to be forgotten)",
    RECTIFICATION: "Rectification (Correct my data)",
    RESTRICTION: "Restriction of processing",
    PORTABILITY: "Data portability",
    OBJECTION: "Object to processing",
    CUSTOMER: "Customer",
    EMPLOYEE: "Employee",
    APPLICANT: "Job applicant",
    VISITOR: "Website visitor",
    OTHER: "Other",
  },
  de: {
    title: "Betroffenenrechte-Anfrage (DSAR)",
    subtitle: "Stellen Sie Ihre Datenschutzanfrage sicher",
    language: "Bevorzugte Sprache",
    requestTypes: "Art der Anfrage",
    requestTypesHint: "Alle zutreffenden auswählen",
    subjectType: "Ich bin...",
    email: "E-Mail-Adresse",
    phone: "Telefonnummer",
    name: "Vollständiger Name",
    address: "Postanschrift",
    customerId: "Kundennummer",
    employeeId: "Mitarbeiternummer",
    details: "Anfrage-Details",
    detailsHint: "Bitte beschreiben Sie Ihre Anfrage im Detail",
    attachments: "Anhänge",
    attachmentsHint: "Optionale Nachweise (max. 5 Dateien, je 10MB)",
    consent: "Ich bestätige, dass ich die betroffene Person oder ein autorisierter Vertreter bin und die angegebenen Informationen korrekt sind.",
    privacyNotice: "Datenschutzhinweis",
    submit: "Anfrage absenden",
    submitting: "Wird gesendet...",
    required: "Pflichtfeld",
    optional: "Optional",
    ACCESS: "Auskunft (Recht auf Zugang)",
    ERASURE: "Löschung (Recht auf Vergessenwerden)",
    RECTIFICATION: "Berichtigung",
    RESTRICTION: "Einschränkung der Verarbeitung",
    PORTABILITY: "Datenübertragbarkeit",
    OBJECTION: "Widerspruch gegen Verarbeitung",
    CUSTOMER: "Kunde/Kundin",
    EMPLOYEE: "Mitarbeiter/in",
    APPLICANT: "Bewerber/in",
    VISITOR: "Website-Besucher/in",
    OTHER: "Sonstiges",
  },
};

const REQUEST_TYPES = ["ACCESS", "ERASURE", "RECTIFICATION", "RESTRICTION", "PORTABILITY", "OBJECTION"] as const;
const SUBJECT_TYPES = ["CUSTOMER", "EMPLOYEE", "APPLICANT", "VISITOR", "OTHER"] as const;

export default function PublicIntakeForm() {
  const params = useParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [lang, setLang] = useState<"en" | "de">("en");
  const t = TEXTS[lang];

  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [subjectType, setSubjectType] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [details, setDetails] = useState("");
  const [consent, setConsent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (selected.length + files.length > 5) {
      setError(lang === "de" ? "Maximal 5 Dateien erlaubt" : "Maximum 5 files allowed");
      return;
    }
    setFiles((prev) => [...prev, ...selected].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (selectedTypes.length === 0) {
      setError(lang === "de" ? "Bitte mindestens eine Anfrageart auswählen" : "Please select at least one request type");
      return;
    }
    if (!consent) {
      setError(lang === "de" ? "Bitte Einwilligung bestätigen" : "Please confirm consent");
      return;
    }

    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("preferredLanguage", lang);
      formData.append("requestTypes", JSON.stringify(selectedTypes));
      if (subjectType) formData.append("subjectType", subjectType);
      if (email) formData.append("subjectEmail", email);
      if (phone) formData.append("subjectPhone", phone);
      if (name) formData.append("subjectName", name);
      if (address) formData.append("subjectAddress", address);
      if (customerId) formData.append("customerId", customerId);
      if (employeeId) formData.append("employeeId", employeeId);
      if (details) formData.append("requestDetails", details);
      formData.append("consentGiven", "true");
      // Honeypot - the hidden field value
      const honeypotField = document.getElementById("website_url") as HTMLInputElement;
      if (honeypotField?.value) {
        formData.append("website_url", honeypotField.value);
      }

      for (const file of files) {
        formData.append("attachments", file);
      }

      const res = await fetch(`/api/intake/submit?tenantSlug=${encodeURIComponent(tenantSlug)}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Submission failed");
      }

      const result = await res.json();
      router.push(`/public/${tenantSlug}/dsar/confirm?ref=${encodeURIComponent(result.reference)}`);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 rounded-lg bg-white p-6 shadow">
        {/* Language selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t.language}</label>
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value as "en" | "de")}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        {/* Request Types (multi-select) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.requestTypes} <span className="text-red-500">*</span>
          </label>
          <p className="mb-2 text-xs text-gray-500">{t.requestTypesHint}</p>
          <div className="space-y-2">
            {REQUEST_TYPES.map((type) => (
              <label key={type} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{t[type]}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Subject Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t.subjectType}</label>
          <select
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">--</option>
            {SUBJECT_TYPES.map((st) => (
              <option key={st} value={st}>{t[st]}</option>
            ))}
          </select>
        </div>

        {/* Identifiers */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.email} <span className="text-xs text-gray-400">({t.optional})</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.phone} <span className="text-xs text-gray-400">({t.optional})</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.name} <span className="text-xs text-gray-400">({t.optional})</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t.address} <span className="text-xs text-gray-400">({t.optional})</span>
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.customerId} <span className="text-xs text-gray-400">({t.optional})</span>
            </label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              {t.employeeId} <span className="text-xs text-gray-400">({t.optional})</span>
            </label>
            <input
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Request Details */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t.details}</label>
          <p className="mb-1 text-xs text-gray-500">{t.detailsHint}</p>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="block text-sm font-medium text-gray-700">{t.attachments}</label>
          <p className="mb-2 text-xs text-gray-500">{t.attachmentsHint}</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {files.length > 0 && (
            <ul className="mt-2 space-y-1">
              {files.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{f.name} ({(f.size / 1024).toFixed(0)} KB)</span>
                  <button type="button" onClick={() => removeFile(i)} className="text-red-500 hover:text-red-700">&times;</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Honeypot (hidden) */}
        <div style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
          <label htmlFor="website_url">Website</label>
          <input type="text" id="website_url" name="website_url" tabIndex={-1} autoComplete="off" />
        </div>

        {/* Consent */}
        <div>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {t.consent} <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {submitting ? t.submitting : t.submit}
        </button>
      </form>

      <p className="mt-4 text-center text-xs text-gray-400">
        Powered by PrivacyPilot
      </p>
    </div>
  );
}
