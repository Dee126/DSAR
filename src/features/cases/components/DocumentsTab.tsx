"use client";

import type { DSARCaseDetail, Document } from "../types";
import { DOC_CLASSIFICATIONS } from "../constants";
import { formatBytes } from "../services";

interface Props {
  caseData: DSARCaseDetail;
  canManage: boolean;
  docFile: File | null;
  setDocFile: (f: File | null) => void;
  docClassification: string;
  setDocClassification: (c: string) => void;
  uploading: boolean;
  onUpload: (e: React.FormEvent) => void;
  viewingDoc: Document | null;
  setViewingDoc: (d: Document | null) => void;
}

export function DocumentsTab({
  caseData, canManage, docFile, setDocFile,
  docClassification, setDocClassification,
  uploading, onUpload, viewingDoc, setViewingDoc,
}: Props) {
  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900">Documents ({caseData.documents.length})</h2>
      {canManage && (
        <form onSubmit={onUpload} className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
          <div className="flex-1"><label className="label">File</label><input type="file" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-500 file:mr-4 file:rounded-md file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100" /></div>
          <div><label className="label">Classification</label><select value={docClassification} onChange={(e) => setDocClassification(e.target.value)} className="input-field">{DOC_CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <button type="submit" data-testid="upload-document" disabled={!docFile || uploading} className="btn-primary text-sm">{uploading ? "Uploading..." : "Upload"}</button>
        </form>
      )}
      {caseData.documents.length === 0 ? <p className="mt-4 text-sm text-gray-500" data-testid="documents-list">No documents uploaded yet.</p> : (
        <div className="mt-4 overflow-x-auto" data-testid="documents-list">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wider text-gray-500"><th className="pb-2 pr-4">Filename</th><th className="pb-2 pr-4">Classification</th><th className="pb-2 pr-4">Size</th><th className="pb-2 pr-4">Uploaded By</th><th className="pb-2 pr-4">Date</th><th className="pb-2">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {caseData.documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="py-2.5 pr-4 font-medium text-gray-900">{doc.filename}</td>
                  <td className="py-2.5 pr-4"><span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{doc.classification}</span></td>
                  <td className="py-2.5 pr-4 text-gray-500">{formatBytes(doc.size)}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{doc.uploadedBy.name}</td>
                  <td className="py-2.5 pr-4 text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</td>
                  <td className="py-2.5">
                    <div className="flex gap-2">
                      <a href={`/api/documents/${doc.id}/download`} download={doc.filename} className="text-brand-600 hover:text-brand-700">Download</a>
                      {(doc.contentType.startsWith("image/") || doc.contentType === "application/pdf") && <button onClick={() => setViewingDoc(doc)} className="text-brand-600 hover:text-brand-700">View</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4"><h3 className="text-lg font-semibold text-gray-900">{viewingDoc.filename}</h3><button onClick={() => setViewingDoc(null)} className="text-gray-400 hover:text-gray-600"><svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button></div>
            <div className="overflow-auto p-6" style={{ maxHeight: "calc(90vh - 80px)" }}>
              {viewingDoc.contentType === "application/pdf" ? <iframe src={`/api/documents/${viewingDoc.id}/download`} className="h-[70vh] w-full rounded border border-gray-200" title={viewingDoc.filename} /> : viewingDoc.contentType.startsWith("image/") ? <img src={`/api/documents/${viewingDoc.id}/download`} alt={viewingDoc.filename} className="mx-auto max-h-[70vh] rounded-lg object-contain" /> : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
