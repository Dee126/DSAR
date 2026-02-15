"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

/* ── Types ────────────────────────────────────────────────────────────── */

interface PortalData {
  status: string;
  caseReference?: string;
  requestType?: string;
  subjectName?: string;
  allowedMethods?: string[];
  selfieEnabled?: boolean;
  remainingSubmissions?: number;
  message?: string;
}

const ARTIFACT_LABELS: Record<string, string> = {
  ID_FRONT: "ID Card (Front)",
  ID_BACK: "ID Card (Back)",
  PASSPORT: "Passport",
  DRIVERS_LICENSE: "Driver's License",
  UTILITY_BILL: "Utility Bill",
  SELFIE: "Selfie Photo",
};

/* ── Component ────────────────────────────────────────────────────────── */

export default function VerifyPage() {
  const params = useParams();
  const token = params.token as string;

  const [step, setStep] = useState<"loading" | "confirm" | "upload" | "submitting" | "done" | "error">("loading");
  const [portalData, setPortalData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");

  // Upload state
  const [files, setFiles] = useState<Array<{ file: File; type: string }>>([]);
  const [consent, setConsent] = useState(false);
  const [selfieConsent, setSelfieConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [addDocType, setAddDocType] = useState("ID_FRONT");

  const fetchPortal = useCallback(async () => {
    try {
      const res = await fetch(`/api/idv/portal/${token}`);
      const data = await res.json();
      if (res.ok) {
        setPortalData(data);
        if (data.status === "completed" || data.status === "limit_reached") {
          setStep("done");
        } else {
          setStep("confirm");
        }
      } else {
        setError(data.error ?? "This verification link is invalid or has expired.");
        setStep("error");
      }
    } catch {
      setError("Unable to connect. Please try again later.");
      setStep("error");
    }
  }, [token]);

  useEffect(() => {
    fetchPortal();
  }, [fetchPortal]);

  function handleAddFile() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setFiles([...files, { file, type: addDocType }]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemoveFile(index: number) {
    setFiles(files.filter((_, i) => i !== index));
  }

  async function handleSubmit() {
    if (files.length === 0) return;
    if (!consent) return;

    const hasSelfie = files.some((f) => f.type === "SELFIE");
    if (hasSelfie && !selfieConsent) return;

    setStep("submitting");
    setError("");

    try {
      const formData = new FormData();
      formData.append("consentGiven", "true");
      formData.append("artifactTypes", JSON.stringify(files.map((f) => f.type)));
      files.forEach((f, i) => formData.append(`file${i}`, f.file));

      const res = await fetch(`/api/idv/portal/${token}`, {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setStep("done");
        setPortalData({ ...portalData!, status: "submitted" });
      } else {
        const data = await res.json();
        setError(data.error ?? "Submission failed. Please try again.");
        setStep("upload");
      }
    } catch {
      setError("Network error. Please try again.");
      setStep("upload");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white font-bold text-xl">P</div>
          <h1 className="mt-3 text-xl font-bold text-gray-900">Identity Verification</h1>
          <p className="mt-1 text-sm text-gray-500">Secure document verification portal</p>
        </div>

        {/* Loading */}
        {step === "loading" && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">Validating your verification link...</p>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">Verification Unavailable</h2>
            <p className="mt-2 text-sm text-gray-500">{error}</p>
            <p className="mt-4 text-xs text-gray-400">If you believe this is an error, please contact the organization that sent you this link.</p>
          </div>
        )}

        {/* Step 1: Confirm */}
        {step === "confirm" && portalData && (
          <div className="rounded-xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Confirm Your Request</h2>
            <p className="mt-2 text-sm text-gray-500">
              Please verify the following information before proceeding.
            </p>

            <div className="mt-4 space-y-3 rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Reference</span>
                <span className="font-medium text-gray-900">{portalData.caseReference}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Request Type</span>
                <span className="font-medium text-gray-900 capitalize">{portalData.requestType?.toLowerCase()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Name</span>
                <span className="font-medium text-gray-900">{portalData.subjectName}</span>
              </div>
            </div>

            <div className="mt-6">
              <button onClick={() => setStep("upload")}
                className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700">
                Yes, this is my request — Continue
              </button>
              <p className="mt-3 text-center text-xs text-gray-400">
                If this does not match your request, please contact the organization directly.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Upload documents */}
        {step === "upload" && portalData && (
          <div className="rounded-xl bg-white p-8 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-900">Upload Verification Documents</h2>
            <p className="mt-2 text-sm text-gray-500">
              Please upload the required documents to verify your identity.
              {portalData.remainingSubmissions !== undefined && (
                <span className="block mt-1 text-xs text-gray-400">
                  {portalData.remainingSubmissions} submission(s) remaining.
                </span>
              )}
            </p>

            {error && <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

            {/* Add document */}
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Document Type</label>
                <select value={addDocType} onChange={(e) => setAddDocType(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm">
                  {Object.entries(ARTIFACT_LABELS)
                    .filter(([key]) => key !== "SELFIE" || portalData.selfieEnabled)
                    .map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">File</label>
                <div className="mt-1 flex gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*,application/pdf"
                    className="flex-1 text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" />
                  <button onClick={handleAddFile}
                    className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
                    Add
                  </button>
                </div>
              </div>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-gray-600">Documents to submit ({files.length})</p>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2">
                    <div>
                      <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                        {ARTIFACT_LABELS[f.type] ?? f.type}
                      </span>
                      <span className="ml-2 text-sm text-gray-700">{f.file.name}</span>
                      <span className="ml-1 text-xs text-gray-400">({(f.file.size / 1024).toFixed(1)}KB)</span>
                    </div>
                    <button onClick={() => handleRemoveFile(i)} className="text-xs text-red-600 hover:text-red-700">Remove</button>
                  </div>
                ))}
              </div>
            )}

            {/* Selfie consent */}
            {files.some((f) => f.type === "SELFIE") && (
              <label className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                <input type="checkbox" checked={selfieConsent} onChange={(e) => setSelfieConsent(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300" />
                <span className="text-xs text-amber-800">
                  I explicitly consent to the collection of my biometric data (facial image) for identity verification purposes.
                  This data will only be used to verify my identity and will be deleted according to the organization&apos;s retention policy.
                </span>
              </label>
            )}

            {/* General consent */}
            <label className="mt-4 flex items-start gap-2">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 rounded border-gray-300" />
              <span className="text-xs text-gray-600">
                I confirm that these documents are authentic and submitted for the purpose of verifying my identity
                in relation to my data subject access request. I understand that this data will be processed according
                to applicable data protection laws and the organization&apos;s privacy policy.
              </span>
            </label>

            <div className="mt-6 flex gap-3">
              <button onClick={() => setStep("confirm")}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Back
              </button>
              <button onClick={handleSubmit}
                disabled={files.length === 0 || !consent || (files.some((f) => f.type === "SELFIE") && !selfieConsent)}
                className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                Submit Verification
              </button>
            </div>
          </div>
        )}

        {/* Submitting */}
        {step === "submitting" && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
            <p className="mt-4 text-sm text-gray-500">Uploading your documents securely...</p>
          </div>
        )}

        {/* Done */}
        {step === "done" && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mt-4 text-lg font-semibold text-gray-900">
              {portalData?.status === "completed" ? "Verification Complete" :
               portalData?.status === "limit_reached" ? "Submission Limit Reached" :
               "Documents Received"}
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              {portalData?.message ?? "Thank you. Your verification documents have been received. You will be notified of the outcome."}
            </p>
            <p className="mt-4 text-xs text-gray-400">You can close this page safely.</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-[10px] text-gray-400">
            This is a secure verification portal. Your data is encrypted in transit and stored according to GDPR requirements.
          </p>
        </div>
      </div>
    </div>
  );
}
