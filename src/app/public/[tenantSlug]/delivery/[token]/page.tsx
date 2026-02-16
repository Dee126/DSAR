"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

const TEXTS = {
  en: {
    title: "Secure Data Delivery",
    subtitle: "PrivacyPilot secure delivery portal",
    verifying: "Verifying link...",
    invalid: "This link is invalid or has expired.",
    expired: "This delivery link has expired.",
    otpTitle: "Verification Required",
    otpDesc: "A verification code will be sent to your email address.",
    otpSendBtn: "Send Verification Code",
    otpSending: "Sending...",
    otpSent: "Code sent to",
    otpEnter: "Enter verification code",
    otpPlaceholder: "000000",
    otpVerifyBtn: "Verify",
    otpVerifying: "Verifying...",
    downloadTitle: "Your Documents",
    downloadDesc: "The following documents are available for download.",
    downloadsRemaining: "downloads remaining",
    downloadBtn: "Download",
    downloading: "Downloading...",
    noDownloads: "No more downloads available.",
    disclaimer:
      "These documents contain personal data. Please handle them in accordance with applicable data protection laws.",
    support: "If you need assistance, contact the organization that sent you this link.",
    poweredBy: "Powered by PrivacyPilot",
    response: "DSAR Response",
    evidence: "Supporting Document",
    error: "An error occurred. Please try again.",
  },
  de: {
    title: "Sichere Datenbereitstellung",
    subtitle: "PrivacyPilot sicheres Bereitstellungsportal",
    verifying: "Link wird verifiziert...",
    invalid: "Dieser Link ist ungultig oder abgelaufen.",
    expired: "Dieser Bereitstellungs-Link ist abgelaufen.",
    otpTitle: "Verifizierung erforderlich",
    otpDesc: "Ein Verifizierungscode wird an Ihre E-Mail-Adresse gesendet.",
    otpSendBtn: "Verifizierungscode senden",
    otpSending: "Wird gesendet...",
    otpSent: "Code gesendet an",
    otpEnter: "Verifizierungscode eingeben",
    otpPlaceholder: "000000",
    otpVerifyBtn: "Verifizieren",
    otpVerifying: "Wird verifiziert...",
    downloadTitle: "Ihre Dokumente",
    downloadDesc: "Die folgenden Dokumente stehen zum Download bereit.",
    downloadsRemaining: "Downloads verbleibend",
    downloadBtn: "Herunterladen",
    downloading: "Wird heruntergeladen...",
    noDownloads: "Keine weiteren Downloads verfugbar.",
    disclaimer:
      "Diese Dokumente enthalten personenbezogene Daten. Bitte behandeln Sie diese gemass den geltenden Datenschutzgesetzen.",
    support:
      "Wenn Sie Hilfe benotigen, kontaktieren Sie die Organisation, die Ihnen diesen Link gesendet hat.",
    poweredBy: "Bereitgestellt von PrivacyPilot",
    response: "DSAR-Antwort",
    evidence: "Begleitdokument",
    error: "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
  },
};

type Step = "loading" | "invalid" | "otp_send" | "otp_verify" | "download";

interface FileItem {
  name: string;
  type: string;
  size?: number;
  source: string;
  id: string;
}

export default function DeliveryPortalPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<Step>("loading");
  const [lang, setLang] = useState<"en" | "de">("en");
  const t = TEXTS[lang];

  const [linkId, setLinkId] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [contactMasked, setContactMasked] = useState("");
  const [downloadsRemaining, setDownloadsRemaining] = useState(0);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpSentFlag, setOtpSentFlag] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Validate token on mount
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch("/api/delivery/public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "validate", token }),
        });
        if (!res.ok) {
          setStep("invalid");
          return;
        }
        const data = await res.json();
        setLinkId(data.linkId);
        setOtpRequired(data.otpRequired);
        setContactMasked(data.subjectContact || "");
        setDownloadsRemaining(data.maxDownloads - data.usedDownloads);
        if (data.language === "de") setLang("de");

        if (data.otpRequired && !data.otpVerified) {
          setStep("otp_send");
        } else {
          // Load package
          await loadPackage();
        }
      } catch {
        setStep("invalid");
      }
    }
    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function loadPackage() {
    try {
      const res = await fetch("/api/delivery/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_package", token }),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || t.error);
        setStep("invalid");
        return;
      }
      const data = await res.json();
      setFiles(data.files || []);
      setDownloadsRemaining(data.downloadsRemaining);
      setStep("download");
    } catch {
      setStep("invalid");
    }
  }

  async function handleSendOtp() {
    setError("");
    setOtpSending(true);
    try {
      const res = await fetch("/api/delivery/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_otp", token }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.error);
      }
      setOtpSentFlag(true);
      setStep("otp_verify");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOtpSending(false);
    }
  }

  async function handleVerifyOtp() {
    setError("");
    setOtpVerifying(true);
    try {
      const res = await fetch("/api/delivery/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_otp", token, otp }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.error);
      }
      // OTP verified — load package
      await loadPackage();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setOtpVerifying(false);
    }
  }

  async function handleDownload(file: FileItem) {
    setError("");
    setDownloadingId(file.id);
    try {
      const res = await fetch("/api/delivery/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "download",
          token,
          fileId: file.id,
          fileSource: file.source,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || t.error);
      }
      const data = await res.json();
      setDownloadsRemaining((prev) => Math.max(0, prev - 1));

      // In a real implementation, this would trigger an actual file download
      // via a signed URL or streaming endpoint. For now, show success.
      alert(
        `Download registered for: ${file.name}\nStorage key: ${data.file?.storageKey || data.file?.storageKeyPdf || "HTML content"}`
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDownloadingId(null);
    }
  }

  // ─── Render ──────────────────────────────────────────────────

  if (step === "loading") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-6 w-6 animate-spin text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
        <p className="text-sm text-gray-500">{t.verifying}</p>
      </div>
    );
  }

  if (step === "invalid") {
    return (
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{t.invalid}</h1>
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        <p className="mt-4 text-sm text-gray-500">{t.support}</p>
        <p className="mt-8 text-xs text-gray-400">{t.poweredBy}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
          <svg
            className="h-6 w-6 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900">{t.title}</h1>
        <p className="mt-1 text-sm text-gray-500">{t.subtitle}</p>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* OTP Send Step */}
      {step === "otp_send" && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">{t.otpTitle}</h2>
          <p className="mt-2 text-sm text-gray-600">{t.otpDesc}</p>
          {contactMasked && (
            <p className="mt-1 text-sm text-gray-500">
              {contactMasked}
            </p>
          )}
          <button
            onClick={handleSendOtp}
            disabled={otpSending}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {otpSending ? t.otpSending : t.otpSendBtn}
          </button>
        </div>
      )}

      {/* OTP Verify Step */}
      {step === "otp_verify" && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="text-lg font-semibold text-gray-900">{t.otpTitle}</h2>
          {otpSentFlag && contactMasked && (
            <p className="mt-2 text-sm text-green-600">
              {t.otpSent} {contactMasked}
            </p>
          )}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">
              {t.otpEnter}
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                setOtp(val);
              }}
              maxLength={6}
              placeholder={t.otpPlaceholder}
              className="mt-1 block w-full rounded-md border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <button
            onClick={handleVerifyOtp}
            disabled={otp.length !== 6 || otpVerifying}
            className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {otpVerifying ? t.otpVerifying : t.otpVerifyBtn}
          </button>
          <button
            onClick={handleSendOtp}
            disabled={otpSending}
            className="mt-2 w-full text-center text-sm text-blue-600 hover:underline disabled:opacity-50"
          >
            {t.otpSendBtn}
          </button>
        </div>
      )}

      {/* Download Step */}
      {step === "download" && (
        <div className="space-y-4">
          <div className="rounded-lg bg-white p-6 shadow">
            <h2 className="text-lg font-semibold text-gray-900">
              {t.downloadTitle}
            </h2>
            <p className="mt-1 text-sm text-gray-600">{t.downloadDesc}</p>
            <p className="mt-1 text-xs text-gray-500">
              {downloadsRemaining} {t.downloadsRemaining}
            </p>

            {downloadsRemaining <= 0 ? (
              <div className="mt-4 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
                {t.noDownloads}
              </div>
            ) : (
              <div className="mt-4 divide-y divide-gray-100">
                {files.map((file) => (
                  <div
                    key={`${file.source}-${file.id}`}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {file.source === "response" ? t.response : t.evidence}
                        {file.size
                          ? ` — ${(file.size / 1024).toFixed(0)} KB`
                          : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={
                        downloadingId === file.id || downloadsRemaining <= 0
                      }
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {downloadingId === file.id
                        ? t.downloading
                        : t.downloadBtn}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Disclaimers */}
          <div className="rounded-md bg-yellow-50 p-4 text-xs text-yellow-800">
            {t.disclaimer}
          </div>
          <p className="text-center text-xs text-gray-400">{t.support}</p>
        </div>
      )}

      <p className="mt-8 text-center text-xs text-gray-400">{t.poweredBy}</p>
    </div>
  );
}
