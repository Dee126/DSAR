"use client";

import type { DSARCaseDetail } from "../types";
import { LR_STATUS_COLORS, LR_STATUSES } from "../constants";

interface Props {
  caseData: DSARCaseDetail;
  canManage: boolean;
  // eslint-disable-next-line
  lr: any;
}

export function LegalReviewTab({ caseData, canManage, lr }: Props) {
  return (
    <div className="space-y-6">
      {canManage && (
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900">Create Legal Review</h2>
          <form onSubmit={lr.handleAddLegalReview} className="mt-4 space-y-3">
            <div><label className="label">Issues / Concerns</label><textarea value={lr.lrIssues} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => lr.setLrIssues(e.target.value)} rows={3} className="input-field resize-y" placeholder="Document legal issues, exemptions to consider..." /></div>
            <div><label className="label">Notes</label><textarea value={lr.lrNotes} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => lr.setLrNotes(e.target.value)} rows={2} className="input-field resize-y" placeholder="Additional notes..." /></div>
            <div className="flex justify-end"><button type="submit" disabled={lr.addingLr} className="btn-primary text-sm">{lr.addingLr ? "Creating..." : "Create Review"}</button></div>
          </form>
        </div>
      )}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Legal Reviews ({caseData.legalReviews?.length ?? 0})</h2>
        {!caseData.legalReviews?.length ? <p className="mt-4 text-sm text-gray-500">No legal reviews yet.</p> : (
          <div className="mt-4 space-y-4">
            {caseData.legalReviews.map((review) => (
              <div key={review.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${LR_STATUS_COLORS[review.status] ?? "bg-gray-100 text-gray-700"}`}>{review.status.replace(/_/g, " ")}</span>
                    {review.reviewer && <span className="text-sm text-gray-600">by {review.reviewer.name}</span>}
                    <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleString()}</span>
                  </div>
                  {canManage && <select value={review.status} onChange={(e) => lr.handleUpdateLrStatus(review.id, e.target.value)} className="ml-4 rounded-md border border-gray-300 py-1 pl-2 pr-7 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">{LR_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}</select>}
                </div>
                {review.issues && <div className="mt-3"><dt className="text-xs font-medium text-gray-500">Issues</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{review.issues}</dd></div>}
                {review.redactions && <div className="mt-2"><dt className="text-xs font-medium text-gray-500">Redactions</dt><dd className="mt-1 text-sm text-gray-700">{review.redactions}</dd></div>}
                {review.notes && <div className="mt-2"><dt className="text-xs font-medium text-gray-500">Notes</dt><dd className="mt-1 text-sm text-gray-700">{review.notes}</dd></div>}
                {review.approvedAt && <p className="mt-2 text-xs text-green-600">Approved: {new Date(review.approvedAt).toLocaleString()}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
