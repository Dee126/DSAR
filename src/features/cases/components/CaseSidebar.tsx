"use client";

import type { DSARCaseDetail } from "../types";
import { getInitials } from "../services";

interface Props {
  caseData: DSARCaseDetail;
}

export function CaseSidebar({ caseData }: Props) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Data Subject</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
              {getInitials(caseData.dataSubject.fullName)}
            </div>
            <p className="text-sm font-medium text-gray-900">{caseData.dataSubject.fullName}</p>
          </div>
          <dl className="space-y-2 text-sm">
            {caseData.dataSubject.email && <div><dt className="text-xs font-medium text-gray-500">Email</dt><dd className="text-gray-900">{caseData.dataSubject.email}</dd></div>}
            {caseData.dataSubject.phone && <div><dt className="text-xs font-medium text-gray-500">Phone</dt><dd className="text-gray-900">{caseData.dataSubject.phone}</dd></div>}
            {caseData.dataSubject.address && <div><dt className="text-xs font-medium text-gray-500">Address</dt><dd className="text-gray-900">{caseData.dataSubject.address}</dd></div>}
          </dl>
        </div>
      </div>
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Details</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div><dt className="text-xs font-medium text-gray-500">Type</dt><dd className="text-gray-900">{caseData.type}</dd></div>
          <div><dt className="text-xs font-medium text-gray-500">Created By</dt><dd className="text-gray-900">{caseData.createdBy.name}</dd></div>
          <div><dt className="text-xs font-medium text-gray-500">Assignee</dt><dd className="text-gray-900">{caseData.assignedTo?.name || <span className="text-gray-400">Unassigned</span>}</dd></div>
          <div><dt className="text-xs font-medium text-gray-500">Created At</dt><dd className="text-gray-900">{new Date(caseData.createdAt).toLocaleString()}</dd></div>
          <div><dt className="text-xs font-medium text-gray-500">Last Updated</dt><dd className="text-gray-900">{new Date(caseData.updatedAt).toLocaleString()}</dd></div>
          <div><dt className="text-xs font-medium text-gray-500">Tasks</dt><dd className="text-gray-900">{caseData.tasks.filter((t) => t.status === "DONE").length}/{caseData.tasks.length} completed</dd></div>
          <div><dt className="text-xs font-medium text-gray-500">Documents</dt><dd className="text-gray-900">{caseData.documents.length}</dd></div>
        </dl>
      </div>
    </div>
  );
}
