"use client";

import type { DSARCaseDetail, CaseUser } from "../types";
import { getInitials } from "../services";

interface Props {
  caseData: DSARCaseDetail;
  users: CaseUser[];
  canManage: boolean;
  /* eslint-disable @typescript-eslint/no-explicit-any */
  ov: any;
}

export function OverviewTab({ caseData, users, canManage, ov }: Props) {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Overview</h2>
          {canManage && !ov.editing && <button onClick={ov.startEditing} className="text-sm font-medium text-brand-600 hover:text-brand-700">Edit</button>}
          {ov.editing && (
            <div className="flex gap-2">
              <button onClick={() => ov.setEditing(false)} className="btn-secondary text-sm">Cancel</button>
              <button onClick={ov.handleSaveEdit} disabled={ov.saving} className="btn-primary text-sm">{ov.saving ? "Saving..." : "Save"}</button>
            </div>
          )}
        </div>
        {ov.editing ? (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><label className="label">Priority</label><select value={ov.editPriority} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => ov.setEditPriority(e.target.value)} className="input-field">{["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
              <div><label className="label">Assignee</label><select value={ov.editAssignee} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => ov.setEditAssignee(e.target.value)} className="input-field"><option value="">Unassigned</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
            </div>
            <div><label className="label">Lawful Basis</label><input type="text" value={ov.editLawfulBasis} onChange={(e: React.ChangeEvent<HTMLInputElement>) => ov.setEditLawfulBasis(e.target.value)} className="input-field" placeholder="e.g., GDPR Article 6(1)(b)" /></div>
            <div><label className="label">Description</label><textarea value={ov.editDescription} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => ov.setEditDescription(e.target.value)} rows={4} className="input-field resize-y" /></div>
          </div>
        ) : (
          <div className="mt-4">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <div><dt className="font-medium text-gray-500">Type</dt><dd className="mt-1 text-gray-900">{caseData.type}</dd></div>
              <div><dt className="font-medium text-gray-500">Channel</dt><dd className="mt-1 text-gray-900">{caseData.channel || <span className="text-gray-400">N/A</span>}</dd></div>
              <div><dt className="font-medium text-gray-500">Requester Type</dt><dd className="mt-1 text-gray-900">{caseData.requesterType || <span className="text-gray-400">N/A</span>}</dd></div>
              <div><dt className="font-medium text-gray-500">Lawful Basis</dt><dd className="mt-1 text-gray-900">{caseData.lawfulBasis || <span className="text-gray-400">Not set</span>}</dd></div>
              <div><dt className="font-medium text-gray-500">Received</dt><dd className="mt-1 text-gray-900">{new Date(caseData.receivedAt).toLocaleDateString()}</dd></div>
              <div><dt className="font-medium text-gray-500">Identity Verified</dt><dd className="mt-1 text-gray-900">{caseData.identityVerified ? "Yes" : "No"}</dd></div>
            </dl>
            {caseData.description && <div className="mt-4 border-t border-gray-200 pt-4"><dt className="text-sm font-medium text-gray-500">Description</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{caseData.description}</dd></div>}
          </div>
        )}
      </div>

      {/* Comments */}
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900">Comments</h2>
        {caseData.comments.length > 0 && (
          <div className="mt-4 space-y-4">
            {caseData.comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                  {getInitials(comment.author.name)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="text-sm font-medium text-gray-900">{comment.author.name}</span><span className="text-xs text-gray-400">{new Date(comment.createdAt).toLocaleString()}</span></div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{comment.body}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        <form onSubmit={ov.handleAddComment} className="mt-4 border-t border-gray-200 pt-4">
          <textarea value={ov.commentBody} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => ov.setCommentBody(e.target.value)} rows={3} className="input-field resize-y" placeholder="Write a comment..." />
          <div className="mt-2 flex justify-end"><button type="submit" disabled={!ov.commentBody.trim() || ov.addingComment} className="btn-primary text-sm">{ov.addingComment ? "Posting..." : "Post Comment"}</button></div>
        </form>
      </div>
    </div>
  );
}
